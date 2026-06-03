'use strict';

const { executeProc } = require('../shared/db');

/**
 * GET /api/GetConcurrentLaunches?hours=24
 * 
 * Returns 5-minute window concurrent launch counts,
 * max concurrent by region, and threshold breach detection.
 */
module.exports = async function (context, req) {
    try {
        const hours = parseInt(req.query.hours) || 24;

        const result = await executeProc('dbo.usp_GetConcurrentLaunches', {
            Hours: hours
        });

        // Recordset 0: 5-minute window concurrent counts
        const windows = (result.recordsets[0] || []).map(row => ({
            region: row.DeliveryRegionName || 'Unknown',
            windowStart: row.WindowStart,
            windowEnd: row.WindowEnd,
            concurrentCount: row.ConcurrentCount,
            thresholdBreached: row.ThresholdBreached
        }));

        // Recordset 1: Max concurrent by region
        const byRegion = (result.recordsets[1] || []).map(row => ({
            region: row.DeliveryRegionName || 'Unknown',
            maxConcurrent: row.MaxConcurrent
        }));

        // Recordset 2: Overall max
        const overall = result.recordsets[2][0] || {
            MaxConcurrent: 0,
            ThresholdBreached: false
        };

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                maxConcurrent: overall.MaxConcurrent,
                thresholdBreached: overall.ThresholdBreached,
                windows,
                byRegion,
                periodHours: hours
            }
        };
    } catch (err) {
        context.log.error('GetConcurrentLaunches failed:', err.message);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                error: 'Failed to retrieve concurrent launch data.',
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            }
        };
    }
};
