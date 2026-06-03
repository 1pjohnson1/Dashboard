'use strict';

const { executeProc } = require('../shared/db');

/**
 * GET /api/GetOverviewMetrics?days=7
 * 
 * Returns KPI aggregates, status breakdown, and hourly launch trend
 * for the Overview & Health dashboard page.
 */
module.exports = async function (context, req) {
    try {
        const days = parseInt(req.query.days) || 7;

        const result = await executeProc('dbo.usp_GetOverviewMetrics', {
            Days: days
        });

        // Recordset 0: KPI summary (single row)
        const kpis = result.recordsets[0][0] || {
            TotalInstances: 0,
            CompletedInstances: 0,
            SuccessRate: 0,
            AvgLatencyMs: 0,
            ActiveLabsNow: 0,
            TotalErrors: 0,
            ErrorRate: 0,
            CreationFailures: 0,
            AvgStartupDuration: 0
        };

        // Recordset 1: Status breakdown
        const statusBreakdown = (result.recordsets[1] || []).map(row => ({
            status: row.Status || 'Unknown',
            count: row.InstanceCount
        }));

        // Recordset 2: Hourly launch trend
        const launchesOverTime = (result.recordsets[2] || []).map(row => ({
            hour: row.HourBucket,
            launches: row.LaunchCount,
            errors: row.ErrorCount
        }));

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                totalInstances: kpis.TotalInstances,
                completedInstances: kpis.CompletedInstances,
                successRate: parseFloat(kpis.SuccessRate) || 0,
                avgLatencyMs: parseFloat(kpis.AvgLatencyMs) || 0,
                activeLabsNow: kpis.ActiveLabsNow,
                totalErrors: kpis.TotalErrors,
                errorRate: parseFloat(kpis.ErrorRate) || 0,
                creationFailures: kpis.CreationFailures,
                avgStartupDuration: parseFloat(kpis.AvgStartupDuration) || 0,
                statusBreakdown,
                launchesOverTime,
                periodDays: days
            }
        };
    } catch (err) {
        context.log.error('GetOverviewMetrics failed:', err.message);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                error: 'Failed to retrieve overview metrics.',
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            }
        };
    }
};
