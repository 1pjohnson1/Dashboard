const { app } = require('@azure/functions');
const { executeQuery } = require('../shared/sql.js');

app.http('GetGeoBucketAnalysis', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            // Get detailed geo insights
            const geoData = await executeQuery(`
                SELECT 
                    Country, Region, City, Latitude, Longitude,
                    InstanceCount, ErrorCount, ErrorRatePct,
                    AvgCompletionPct, AvgLatencyMs, PossibleVpnCount
                FROM dbo.vw_GeoInsights
                ORDER BY InstanceCount DESC
            `);

            // Get VPN suspects detail
            const vpnSuspects = await executeQuery(`
                SELECT 
                    Id, LabProfileName, IpAddress, PublicIpAddresses,
                    Country, Region, City, BrowserUserAgent,
                    UserEmail, UserFirstName, UserLastName,
                    StartDateTime, [State], CompletionStatus
                FROM dbo.vw_VpnDetection
                ORDER BY StartDateTime DESC
            `);

            const byCountry = {};
            geoData.forEach(row => {
                if (!byCountry[row.Country]) {
                    byCountry[row.Country] = {
                        country: row.Country,
                        instances: 0,
                        errors: 0
                    };
                }
                byCountry[row.Country].instances += row.InstanceCount;
                byCountry[row.Country].errors += row.ErrorCount;
            });

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: {
                        detailedLocations: geoData,
                        byCountry: Object.values(byCountry),
                        vpnSuspects: vpnSuspects,
                        summary: {
                            totalLocations: geoData.length,
                            totalInstances: geoData.reduce((sum, r) => sum + r.InstanceCount, 0),
                            totalErrors: geoData.reduce((sum, r) => sum + r.ErrorCount, 0),
                            vpnFlagsCount: vpnSuspects.length
                        }
                    },
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            context.error('GetGeoBucketAnalysis error:', error);
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
