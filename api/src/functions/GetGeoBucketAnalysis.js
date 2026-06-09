const { app } = require('@azure/functions');
const { executeQuery, TYPES } = require('../shared/sql.js');

app.http('GetGeoBucketAnalysis', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const days   = parseInt(request.query.get('days') || '7', 10);
            const region = request.query.get('region') || 'all';
            const cutoff = new Date(Date.now() - days * 86400 * 1000);

            const regionFilter = region !== 'all' ? 'AND Region = @region' : '';
            const regionParam  = region !== 'all'
                ? [{ name: 'region', type: TYPES.NVarChar, value: region }]
                : [];
            const params = [{ name: 'cutoff', type: TYPES.DateTime2, value: cutoff }, ...regionParam];

            const byCountry = await executeQuery(
                `SELECT Country, COUNT(*) AS Count,
                        AVG(Latitude) AS AvgLat, AVG(Longitude) AS AvgLng
                 FROM dbo.tblInstances
                 WHERE StartDateTime >= @cutoff AND Country IS NOT NULL ${regionFilter}
                 GROUP BY Country
                 ORDER BY Count DESC`,
                params
            );

            const byRegion = await executeQuery(
                `SELECT Country, Region, COUNT(*) AS Count
                 FROM dbo.tblInstances
                 WHERE StartDateTime >= @cutoff AND Region IS NOT NULL ${regionFilter}
                 GROUP BY Country, Region
                 ORDER BY Count DESC`,
                params
            );

            const byCity = await executeQuery(
                `SELECT TOP 50 Country, Region, City, COUNT(*) AS Count,
                        AVG(Latitude) AS Lat, AVG(Longitude) AS Lng
                 FROM dbo.tblInstances
                 WHERE StartDateTime >= @cutoff AND City IS NOT NULL
                       AND Latitude IS NOT NULL AND Longitude IS NOT NULL ${regionFilter}
                 GROUP BY Country, Region, City
                 ORDER BY Count DESC`,
                params
            );

            const regions = await executeQuery(
                `SELECT DISTINCT Region
                 FROM dbo.tblInstances
                 WHERE StartDateTime >= @cutoff AND Region IS NOT NULL
                 ORDER BY Region`,
                [{ name: 'cutoff', type: TYPES.DateTime2, value: cutoff }]
            );

            return {
                status: 200,
                jsonBody: {
                    byCountry,
                    byRegion,
                    byCity,
                    availableRegions: regions.map(r => r.Region),
                    days,
                    region,
                    regions:    byRegion.map(r => ({ region: r.Region, totalLaunches: r.Count, errorRate: 0, avgLatency: 0 })),
                    geoBuckets: byCity.map(c => ({ ipAddress: '', country: c.Country, region: c.City, launchCount: c.Count, seriesName: '' })),
                },
            };
        } catch (error) {
            context.error('GetGeoBucketAnalysis error:', error);
            return { status: 500, jsonBody: { error: error.message || 'Internal server error' } };
        }
    },
});
