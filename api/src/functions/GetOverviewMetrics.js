const { app } = require('@azure/functions');
const { executeQuery, TYPES } = require('../shared/sql.js');

app.http('GetOverviewMetrics', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const days = parseInt(request.query.get('days') || '7', 10);
            const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(days, 30)) : 7;

            const sinceEpochQuery = `
                DATEDIFF(SECOND, '1970-01-01', DATEADD(DAY, -${safeDays}, SYSUTCDATETIME()))
            `;

            // KPI summary from normalized table.
            const overview = await executeQuery(`
                SELECT
                    COUNT(*) AS TotalInstances,
                    SUM(CASE WHEN CompletionStatus = 'Complete' THEN 1 ELSE 0 END) AS CompletedInstances,
                    SUM(CASE WHEN [State] IN ('Started','Resumed') AND EndDateTime IS NULL THEN 1 ELSE 0 END) AS ActiveLabsNow,
                    AVG(CAST(CASE WHEN Latency IS NOT NULL THEN Latency * 1000.0 END AS FLOAT)) AS AvgLatencyMs,
                    AVG(CAST(CASE WHEN StartupDuration IS NOT NULL THEN StartupDuration END AS FLOAT)) AS AvgStartupDuration,
                    SUM(CASE WHEN ErrorCount > 0 OR [Error] IS NOT NULL THEN 1 ELSE 0 END) AS ErrorInstances
                FROM dbo.tblInstances
                WHERE [Start] >= ${sinceEpochQuery}
            `);

            // Hourly launches and error trend for chart.
            const latencyTrend = await executeQuery(
                `SELECT 
                    DATEADD(HOUR, DATEDIFF(HOUR, 0, DATEADD(SECOND, [Start], '1970-01-01T00:00:00Z')), 0) AS HourBucket,
                    COUNT(*) AS Launches,
                    SUM(CASE WHEN ErrorCount > 0 OR [Error] IS NOT NULL THEN 1 ELSE 0 END) AS Errors
                 FROM dbo.tblInstances
                 WHERE [Start] >= ${sinceEpochQuery}
                 GROUP BY DATEADD(HOUR, DATEDIFF(HOUR, 0, DATEADD(SECOND, [Start], '1970-01-01T00:00:00Z')), 0)
                 ORDER BY HourBucket ASC`
            );

            // Completion status distribution for pie chart.
            const statusBreakdown = await executeQuery(`
                SELECT 
                    ISNULL(NULLIF(CompletionStatus, ''), 'Unknown') AS [Status],
                    COUNT(*) AS [Count]
                FROM dbo.tblInstances
                WHERE [Start] >= ${sinceEpochQuery}
                GROUP BY ISNULL(NULLIF(CompletionStatus, ''), 'Unknown')
                ORDER BY [Count] DESC
            `);

            const summary = overview[0] || {};
            const totalInstances = summary.TotalInstances || 0;
            const completedInstances = summary.CompletedInstances || 0;
            const successRate = totalInstances > 0
                ? Number(((completedInstances * 100.0) / totalInstances).toFixed(1))
                : 0;

            const launchesOverTime = latencyTrend.map((row) => ({
                hour: row.HourBucket,
                launches: row.Launches || 0,
                errors: row.Errors || 0,
            }));

            const chartStatusBreakdown = statusBreakdown.map((row) => ({
                status: row.Status,
                count: row.Count || 0,
            }));

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: {
                        periodDays: safeDays,
                        totalInstances,
                        completedInstances,
                        successRate,
                        avgLatencyMs: summary.AvgLatencyMs != null ? Number(summary.AvgLatencyMs.toFixed(1)) : null,
                        avgStartupDuration: summary.AvgStartupDuration != null ? Number(summary.AvgStartupDuration.toFixed(1)) : null,
                        activeLabsNow: summary.ActiveLabsNow || 0,
                        errorInstances: summary.ErrorInstances || 0,
                        launchesOverTime,
                        statusBreakdown: chartStatusBreakdown,
                        timestamp: new Date().toISOString()
                    }
                }
            };
        } catch (error) {
            context.error('GetOverviewMetrics error:', error);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: error.message || 'Internal server error'
                }
            };
        }
    }
});
