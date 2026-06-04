const { app } = require('@azure/functions');
const { executeQuery, TYPES } = require('../shared/sql.js');

app.http("GetConcurrentLaunches", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        try {
            const hours = parseInt(request.query.get("hours") || "24", 10);
            const cutoffEpoch = Math.floor(Date.now() / 1000) - hours * 3600;

            // Hourly launch counts
            const hourlyLaunches = await executeQuery(
                `SELECT DATEPART(HOUR, StartDateTime) AS HourOfDay,
                        COUNT(*) AS LaunchCount,
                        COUNT(DISTINCT LabProfileId) AS UniqueProfiles,
                        COUNT(DISTINCT UserId) AS UniqueUsers
                 FROM dbo.tblInstances
                 WHERE StartEpoch >= @cutoff AND StartDateTime IS NOT NULL
                 GROUP BY DATEPART(HOUR, StartDateTime)
                 ORDER BY HourOfDay`,
                [{ name: "cutoff", type: TYPES.BigInt, value: cutoffEpoch }]
            );

            // Peak concurrent (instances active at the same time)
            const peakConcurrent = await executeQuery(
                `SELECT TOP 1 CONVERT(VARCHAR(13), StartDateTime, 120) AS HourBucket,
                        COUNT(*) AS ConcurrentCount
                 FROM dbo.tblInstances
                 WHERE StartEpoch >= @cutoff AND StartDateTime IS NOT NULL
                 GROUP BY CONVERT(VARCHAR(13), StartDateTime, 120)
                 ORDER BY ConcurrentCount DESC`,
                [{ name: "cutoff", type: TYPES.BigInt, value: cutoffEpoch }]
            );

            // Timeline (instances per 15-min bucket)
            const timeline = await executeQuery(
                `SELECT DATEADD(MINUTE,
                        DATEDIFF(MINUTE, 0, StartDateTime) / 15 * 15, 0) AS TimeBucket,
                        COUNT(*) AS Count
                 FROM dbo.tblInstances
                 WHERE StartEpoch >= @cutoff AND StartDateTime IS NOT NULL
                 GROUP BY DATEADD(MINUTE,
                        DATEDIFF(MINUTE, 0, StartDateTime) / 15 * 15, 0)
                 ORDER BY TimeBucket`,
                [{ name: "cutoff", type: TYPES.BigInt, value: cutoffEpoch }]
            );

            return {
                status: 200,
                jsonBody: {
                        maxConcurrent: peakConcurrent[0] ? peakConcurrent[0].ConcurrentCount : 0,
                                            thresholdBreached: peakConcurrent[0] ? peakConcurrent[0].ConcurrentCount > 4 : false,
                                            windows: timeline.map(t => ({ windowStart: t.TimeBucket, windowEnd: t.TimeBucket, concurrentCount: t.Count, region: 'All', thresholdBreached: t.Count > 4 })),
                                            byRegion: hourlyLaunches.map(h => ({ hour: h.HourOfDay, launchCount: h.LaunchCount })),
                                            hours,
                },
            };
        } catch (error) {
            context.error("GetConcurrentLaunches error:", error);
            return {
                status: 500,
                jsonBody: { error: error.message || "Internal server error" },
            };
        }
    },
});
