const { app } = require('@azure/functions');
const { executeQuery } = require('../shared/sql.js');

app.http('GetRefreshStatus', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            // Get the most recent ingestion timestamp and data freshness
            const freshness = await executeQuery(`
                SELECT TOP 1
                    MAX(IngestedAt) AS LastIngestTime,
                    COUNT(*) AS RecordCount,
                    MIN([Start]) AS EarliestRecord,
                    MAX([Start]) AS LatestRecord
                FROM dbo.tblInstances
            `);

            const lastIngest = freshness[0];

            // Calculate freshness in minutes
            const lastIngestTime = lastIngest?.LastIngestTime ? new Date(lastIngest.LastIngestTime) : null;
            const now = new Date();
            const minutesSinceRefresh = lastIngestTime ? Math.floor((now - lastIngestTime) / 60000) : null;

            // Check if we have recent data (less than 30 minutes old)
            const isRecent = minutesSinceRefresh !== null && minutesSinceRefresh < 30;

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: {
                        lastRefreshTime: lastIngestTime?.toISOString() || null,
                        minutesSinceRefresh: minutesSinceRefresh,
                        isRecent: isRecent,
                        recordCount: lastIngest?.RecordCount || 0,
                        earliestRecord: lastIngest?.EarliestRecord ? new Date(lastIngest.EarliestRecord).toISOString() : null,
                        latestRecord: lastIngest?.LatestRecord ? new Date(lastIngest.LatestRecord).toISOString() : null,
                        refreshStatus: isRecent ? 'CURRENT' : minutesSinceRefresh !== null ? 'STALE' : 'UNKNOWN'
                    },
                    timestamp: now.toISOString()
                }
            };
        } catch (error) {
            context.error('GetRefreshStatus error:', error);
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
