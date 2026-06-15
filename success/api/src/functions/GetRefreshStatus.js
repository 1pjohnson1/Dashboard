const { app } = require('@azure/functions');
const { executeQuery } = require('../shared/sql.js');

app.http('GetRefreshStatus', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const result = await executeQuery(
                `SELECT TOP 1
                    WindowStart,
                    WindowEnd,
                    IngestTimestamp
                 FROM dbo.tblRefreshLog
                 ORDER BY IngestTimestamp DESC`
            );

            if (!result.length) {
                return {
                    status: 200,
                    jsonBody: { windowStart: null, windowEnd: null, ingestTimestamp: null },
                };
            }

            const row = result[0];
            return {
                status: 200,
                jsonBody: {
                    windowStart:      row.WindowStart,
                    windowEnd:        row.WindowEnd,
                    ingestTimestamp:  row.IngestTimestamp,
                },
            };
        } catch (error) {
            context.error('GetRefreshStatus error:', error);
            return {
                status: 500,
                jsonBody: { error: error.message || 'Internal server error' },
            };
        }
    },
});
