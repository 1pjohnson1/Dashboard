const { app } = require('@azure/functions');
const { executeQuery } = require('../shared/sql.js');

app.http('GetErrorDeepDive', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            // Get active errors
            const activeErrors = await executeQuery(`
                SELECT 
                    Id, LabProfileName, DatacenterName, LabHostName,
                    ErrorCount, [Error], Errors, [State], CompletionStatus,
                    [Status], StartDateTime, Latency, UserEmail
                FROM dbo.vw_ActiveErrors
                ORDER BY ErrorCount DESC, StartDateTime DESC
            `);

            // Get failed labs
            const failedLabs = await executeQuery(`
                SELECT 
                    Id, LabProfileId, LabProfileName, CompletionStatus,
                    [Error], ErrorCount, StartDateTime, EndDateTime,
                    TotalRunTime, DatacenterName, UserEmail
                FROM dbo.vw_FailedLabs
                ORDER BY ErrorCount DESC
            `);

            // Get startup alerts
            const startupAlerts = await executeQuery(`
                SELECT 
                    Id, LabProfileName, StartupDuration,
                    EstimatedReadySeconds, Latency, DatacenterName,
                    DeliveryRegionName, LabHostName, StartDateTime,
                    [State], CompletionStatus, UserEmail
                FROM dbo.vw_StartupAlerts
                ORDER BY StartupDuration DESC
            `);

            const enrichedErrors = activeErrors.map(row => ({
                ...row,
                Errors: row.Errors ? tryParseJson(row.Errors) : null
            }));

            const enrichedFailed = failedLabs.map(row => ({
                ...row,
                Error: row.Error ? tryParseJson(row.Error) : null
            }));

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: {
                        activeErrors: enrichedErrors,
                        failedLabs: enrichedFailed,
                        startupAlerts: startupAlerts,
                        summary: {
                            totalActiveErrors: enrichedErrors.length,
                            totalFailedLabs: enrichedFailed.length,
                            totalStartupAlerts: startupAlerts.length
                        }
                    },
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            context.error('GetErrorDeepDive error:', error);
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

function tryParseJson(str) {
    try {
        return JSON.parse(str);
    } catch {
        return str;
    }
}
