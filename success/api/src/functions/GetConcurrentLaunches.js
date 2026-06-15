const { app } = require('@azure/functions');
const { executeQuery, TYPES } = require('../shared/sql.js');

app.http('GetConcurrentLaunches', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const hours = parseInt(request.query.get('hours') || '24', 10);
            const cutoff = new Date(Date.now() - hours * 3600 * 1000);

            const hourlyLaunches = await executeQuery(
                `SELECT DATEPART(HOUR, StartDateTime) AS HourOfDay,
                        COUNT(*) AS LaunchCount,
                        COUNT(DISTINCT LabProfileId) AS UniqueProfiles,
                        COUNT(DISTINCT UserId)       AS UniqueUsers
                 FROM dbo.tblInstances
                 WHERE StartDateTime >= @cutoff
                 GROUP BY DATEPART(HOUR, StartDateTime)
                 ORDER BY HourOfDay`,
                [{ name: 'cutoff', type: TYPES.DateTime2, value: cutoff }]
            );

            const peakConcurrent = await executeQuery(
                `SELECT TOP 1 CONVERT(VARCHAR(13), StartDateTime, 120) AS HourBucket,
                        COUNT(*) AS ConcurrentCount
                 FROM dbo.tblInstances
                 WHERE StartDateTime >= @cutoff
                 GROUP BY CONVERT(VARCHAR(13), StartDateTime, 120)
                 ORDER BY ConcurrentCount DESC`,
                [{ name: 'cutoff', type: TYPES.DateTime2, value: cutoff }]
            );

            const timeline = await executeQuery(
                `SELECT DATEADD(MINUTE,
                        DATEDIFF(MINUTE, 0, StartDateTime) / 15 * 15, 0) AS TimeBucket,
                        COUNT(*) AS Count
                 FROM dbo.tblInstances
                 WHERE StartDateTime >= @cutoff
                 GROUP BY DATEADD(MINUTE,
                        DATEDIFF(MINUTE, 0, StartDateTime) / 15 * 15, 0)
                 ORDER BY TimeBucket`,
                [{ name: 'cutoff', type: TYPES.DateTime2, value: cutoff }]
            );

            return {
                status: 200,
                jsonBody: {
                    maxConcurrent:    peakConcurrent[0] ? peakConcurrent[0].ConcurrentCount : 0,
                    thresholdBreached: peakConcurrent[0] ? peakConcurrent[0].ConcurrentCount > 4 : false,
                    windows:          timeline.map(t => ({ windowStart: t.TimeBucket, windowEnd: t.TimeBucket, concurrentCount: t.Count, region: 'All', thresholdBreached: t.Count > 4 })),
                    byRegion:         hourlyLaunches.map(h => ({ hour: h.HourOfDay, launchCount: h.LaunchCount })),
                    hours,
                },
            };
        } catch (error) {
            context.error('GetConcurrentLaunches error:', error);
            return { status: 500, jsonBody: { error: error.message || 'Internal server error' } };
        }
    },
});
