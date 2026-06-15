const { app } = require('@azure/functions');
const { executeQuery } = require('../shared/sql.js');

app.http('GetConcurrentLaunches', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const hours = parseInt(request.query.get('hours') || '24', 10);

            // Get completion breakdown
            const completionBreakdown = await executeQuery(`
                SELECT 
                    CompletionStatus,
                    COUNT(*) AS InstanceCount
                FROM dbo.tblInstances
                WHERE [Start] >= DATEDIFF(SECOND, '1970-01-01', DATEADD(HOUR, -${Math.min(hours, 24)}, SYSUTCDATETIME()))
                GROUP BY CompletionStatus
                ORDER BY InstanceCount DESC
            `);

            // Get hourly launch volume
            const hourlyLaunches = await executeQuery(`
                SELECT 
                    DATEADD(HOUR, DATEDIFF(HOUR, 0, DATEADD(SECOND, [Start], '1970-01-01T00:00:00Z')), 0) AS HourBucket,
                    COUNT(*) AS LaunchCount,
                    COUNT(DISTINCT LabProfileId) AS UniqueProfiles
                FROM dbo.tblInstances
                WHERE [Start] >= DATEDIFF(SECOND, '1970-01-01', DATEADD(HOUR, -${Math.min(hours, 24)}, SYSUTCDATETIME()))
                GROUP BY DATEADD(HOUR, DATEDIFF(HOUR, 0, DATEADD(SECOND, [Start], '1970-01-01T00:00:00Z')), 0)
                ORDER BY HourBucket DESC
            `);

            const peakConcurrent = Math.max(...hourlyLaunches.map(h => h.LaunchCount), 0);

            // Lab profile breakdown
            const byLabProfile = await executeQuery(`
                SELECT TOP 15
                    LabProfileId,
                    LabProfileName,
                    COUNT(*) AS LaunchCount,
                    SUM(CASE WHEN CompletionStatus = 'Complete' THEN 1 ELSE 0 END) AS Completed
                FROM dbo.tblInstances
                WHERE [Start] >= DATEDIFF(SECOND, '1970-01-01', DATEADD(HOUR, -${Math.min(hours, 24)}, SYSUTCDATETIME()))
                GROUP BY LabProfileId, LabProfileName
                ORDER BY LaunchCount DESC
            `);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: {
                        completionBreakdown: completionBreakdown,
                        hourlyLaunches: hourlyLaunches,
                        byLabProfile: byLabProfile,
                        summary: {
                            totalLaunches: completionBreakdown.reduce((sum, cb) => sum + cb.InstanceCount, 0),
                            peakConcurrentEstimate: peakConcurrent,
                            uniqueProfiles: byLabProfile.length,
                            periodHours: Math.min(hours, 24)
                        }
                    },
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            context.error('GetConcurrentLaunches error:', error);
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
