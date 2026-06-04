const { app } = require('@azure/functions');
const { executeQuery, TYPES } = require('../shared/sql.js');

app.http("GetErrorDeepDive", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        try {
            const days = parseInt(request.query.get("days") || "7", 10);
            const cutoffEpoch = Math.floor(Date.now() / 1000) - days * 86400;

            // Error counts by code
            const byCode = await executeQuery(
                `SELECT e.ErrorCode, COUNT(*) AS Count, MAX(e.ErrorMessage) AS SampleMessage
                 FROM dbo.tblErrors e
                 INNER JOIN dbo.tblInstances i ON e.InstanceId = i.InstanceId
                 WHERE i.StartEpoch >= @cutoff
                 GROUP BY e.ErrorCode
                 ORDER BY Count DESC`,
                [{ name: "cutoff", type: TYPES.BigInt, value: cutoffEpoch }]
            );

            // Top erroring lab profiles
            const topErrorLabs = await executeQuery(
                `SELECT TOP 10 i.LabProfileId, i.LabProfileName,
                        COUNT(DISTINCT e.InstanceId) AS ErrorInstances,
                        SUM(i.ErrorCount) AS TotalErrors
                 FROM dbo.tblInstances i
                 INNER JOIN dbo.tblErrors e ON i.InstanceId = e.InstanceId
                 WHERE i.StartEpoch >= @cutoff
                 GROUP BY i.LabProfileId, i.LabProfileName
                 ORDER BY TotalErrors DESC`,
                [{ name: "cutoff", type: TYPES.BigInt, value: cutoffEpoch }]
            );

            // Error trend by day
            const errorTrend = await executeQuery(
                `SELECT CONVERT(DATE, i.StartDateTime) AS Day, COUNT(*) AS ErrorCount
                 FROM dbo.tblErrors e
                 INNER JOIN dbo.tblInstances i ON e.InstanceId = i.InstanceId
                 WHERE i.StartEpoch >= @cutoff AND i.StartDateTime IS NOT NULL
                 GROUP BY CONVERT(DATE, i.StartDateTime)
                 ORDER BY Day`,
                [{ name: "cutoff", type: TYPES.BigInt, value: cutoffEpoch }]
            );

            // Recent errors
            const recentErrors = await executeQuery(
                `SELECT TOP 50 e.InstanceId, e.ErrorCode, e.ErrorMessage,
                        i.LabProfileName, i.State, i.StartDateTime
                 FROM dbo.tblErrors e
                 INNER JOIN dbo.tblInstances i ON e.InstanceId = i.InstanceId
                 WHERE i.StartEpoch >= @cutoff
                 ORDER BY i.StartEpoch DESC`,
                [{ name: "cutoff", type: TYPES.BigInt, value: cutoffEpoch }]
            );

            return {
                status: 200,
                jsonBody: {
                    byCode,
                    topErrorLabProfiles: topErrorLabs,
                    errorTrend,
                    recentErrors,
                    days,
                },
            };
        } catch (error) {
            context.error("GetErrorDeepDive error:", error);
            return {
                status: 500,
                jsonBody: { error: error.message || "Internal server error" },
            };
        }
    },
});
