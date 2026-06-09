const { app } = require('@azure/functions');
const { executeQuery, TYPES } = require('../shared/sql.js');

app.http('GetErrorDeepDive', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const days = parseInt(request.query.get('days') || '7', 10);
            const cutoff = new Date(Date.now() - days * 86400 * 1000);

            let byCode = [], topErrorLabs = [], errorTrend = [], recentErrors = [];

            try {
                byCode = await executeQuery(
                    `SELECT e.ErrorCode, COUNT(*) AS Count, MAX(e.ErrorMessage) AS SampleMessage
                     FROM dbo.tblErrors e
                     INNER JOIN dbo.tblInstances i ON e.InstanceId = i.InstanceId
                     WHERE i.StartDateTime >= @cutoff
                     GROUP BY e.ErrorCode
                     ORDER BY Count DESC`,
                    [{ name: 'cutoff', type: TYPES.DateTime2, value: cutoff }]
                );

                topErrorLabs = await executeQuery(
                    `SELECT TOP 10 i.LabProfileId, i.LabProfileName,
                            COUNT(DISTINCT e.InstanceId) AS ErrorInstances,
                            SUM(i.ErrorCount)            AS TotalErrors
                     FROM dbo.tblInstances i
                     INNER JOIN dbo.tblErrors e ON i.InstanceId = e.InstanceId
                     WHERE i.StartDateTime >= @cutoff
                     GROUP BY i.LabProfileId, i.LabProfileName
                     ORDER BY TotalErrors DESC`,
                    [{ name: 'cutoff', type: TYPES.DateTime2, value: cutoff }]
                );

                errorTrend = await executeQuery(
                    `SELECT CONVERT(DATE, i.StartDateTime) AS Day, COUNT(*) AS Count
                     FROM dbo.tblErrors e
                     INNER JOIN dbo.tblInstances i ON e.InstanceId = i.InstanceId
                     WHERE i.StartDateTime >= @cutoff
                     GROUP BY CONVERT(DATE, i.StartDateTime)
                     ORDER BY Day`,
                    [{ name: 'cutoff', type: TYPES.DateTime2, value: cutoff }]
                );

                recentErrors = await executeQuery(
                    `SELECT TOP 50 e.InstanceId, e.ErrorCode, e.ErrorMessage,
                            i.LabProfileName, i.State, i.StartDateTime
                     FROM dbo.tblErrors e
                     INNER JOIN dbo.tblInstances i ON e.InstanceId = i.InstanceId
                     WHERE i.StartDateTime >= @cutoff
                     ORDER BY i.StartDateTime DESC`,
                    [{ name: 'cutoff', type: TYPES.DateTime2, value: cutoff }]
                );
            } catch (sqlError) {
                context.warn('GetErrorDeepDive: SQL query failed (tables may not exist):', sqlError.message);
            }

            return {
                status: 200,
                jsonBody: {
                    byCode:             byCode.map(r => ({ errorCode: r.ErrorCode, count: r.Count, sampleMessage: r.SampleMessage })),
                    topErrorLabProfiles: topErrorLabs.map(r => ({ labProfileName: r.LabProfileName, errorInstances: r.ErrorInstances, totalErrors: r.TotalErrors })),
                    errorTrend:         errorTrend.map(r => ({ date: r.Day, errorCount: r.Count })),
                    recentErrors:       recentErrors.map(r => ({ instanceId: r.InstanceId, errorCode: r.ErrorCode, errorMessage: r.ErrorMessage, labProfileName: r.LabProfileName, state: r.State, startDateTime: r.StartDateTime })),
                    days,
                    errorsByType:       byCode.map(r => ({ errorType: r.ErrorCode || 'Unknown', count: r.Count })),
                    errorRateByConsumer: [],
                    thresholdBreached:  false,
                    breachedConsumers:  [],
                },
            };
        } catch (error) {
            context.error('GetErrorDeepDive error:', error);
            return { status: 500, jsonBody: { error: error.message || 'Internal server error' } };
        }
    },
});
