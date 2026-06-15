const { app } = require('@azure/functions');
const { executeQuery } = require('../shared/sql.js');

app.http('GetGeoInsights', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            // Get geo-distributed lab instances with error stats
            const query = `
                SELECT
                    Country,
                    Region,
                    City,
                    Latitude,
                    Longitude,
                    InstanceCount,
                    ErrorCount,
                    ErrorRatePct,
                    AvgCompletionPct,
                    AvgLatencyMs,
                    PossibleVpnCount
                FROM dbo.vw_GeoInsights
                ORDER BY InstanceCount DESC
            `;

            const result = await executeQuery(query, []);

            // Group by country for summary
            const byCountry = {};
            result.forEach(row => {
                if (!byCountry[row.Country]) {
                    byCountry[row.Country] = {
                        country: row.Country,
                        totalInstances: 0,
                        totalErrors: 0,
                        avgErrorRate: 0,
                        regions: []
                    };
                }
                byCountry[row.Country].totalInstances += row.InstanceCount;
                byCountry[row.Country].totalErrors += row.ErrorCount;
                byCountry[row.Country].regions.push(row);
            });

            // Calculate weighted average error rates
            const countrySummary = Object.values(byCountry).map(c => ({
                ...c,
                avgErrorRate: c.totalInstances > 0 
                    ? (c.totalErrors / c.totalInstances * 100).toFixed(2)
                    : '0.00'
            }));

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: {
                        detailedLocations: result,
                        countrySummary: countrySummary,
                        totalLocations: result.length,
                        totalInstances: result.reduce((sum, r) => sum + r.InstanceCount, 0),
                        totalErrors: result.reduce((sum, r) => sum + r.ErrorCount, 0)
                    },
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            context.error('GetGeoInsights error:', error);
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
