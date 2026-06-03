'use strict';

const { executeProc } = require('../shared/db');

/**
 * GET /api/GetGeoBucketAnalysis?region=all&days=7
 * 
 * Returns region summary, geo bucket details, and top lab profiles
 * for the Geo Intelligence dashboard page.
 */
module.exports = async function (context, req) {
    try {
        const region = req.query.region || 'all';
        const days = parseInt(req.query.days) || 7;

        const result = await executeProc('dbo.usp_GetGeoBucketAnalysis', {
            Region: region === 'all' ? null : region,
            Days: days
        });

        // Recordset 0: Region summary
        const regions = (result.recordsets[0] || []).map(row => ({
            region: row.DeliveryRegionName,
            totalLaunches: row.TotalLaunches,
            totalErrors: row.TotalErrors,
            errorRate: parseFloat(row.ErrorRate) || 0,
            avgLatencyMs: parseFloat(row.AvgLatencyMs) || 0,
            avgStartupDuration: parseFloat(row.AvgStartupDuration) || 0,
            uniqueLabProfiles: row.UniqueLabProfiles,
            uniqueDatacenters: row.UniqueDatacenters
        }));

        // Recordset 1: Geo bucket details
        const geoBuckets = (result.recordsets[1] || []).map(row => ({
            ipAddress: row.IpAddress,
            country: row.Country,
            region: row.Region,
            city: row.City,
            deliveryRegion: row.DeliveryRegionName,
            instanceCount: row.InstanceCount,
            seriesName: row.SeriesName,
            windowStart: row.BucketWindowStart,
            windowEnd: row.BucketWindowEnd
        }));

        // Recordset 2: Top lab profiles by region
        const topProfiles = (result.recordsets[2] || []).map(row => ({
            region: row.DeliveryRegionName,
            labProfileName: row.LabProfileName,
            launchCount: row.LaunchCount
        }));

        // Build available regions list for the slicer
        const availableRegions = regions.map(r => r.region).sort();

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                regions,
                geoBuckets,
                topProfiles,
                availableRegions,
                selectedRegion: region,
                periodDays: days
            }
        };
    } catch (err) {
        context.log.error('GetGeoBucketAnalysis failed:', err.message);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                error: 'Failed to retrieve geo bucket analysis data.',
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            }
        };
    }
};
