const { app } = require('@azure/functions');
const { executeQuery, TYPES } = require('../shared/sql.js');

app.http('GetCompletionBreakdown', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const hoursBack = parseInt(request.query.get('hoursBack') || '24', 10);

            const query = `
                EXEC dbo.sp_GetCompletionBreakdown 
                    @HoursBack = @hours
            `;
            const params = [
                { name: 'hours', type: TYPES.Int, value: hoursBack }
            ];

            const result = await executeQuery(query, params);

            // Transform to UI-friendly format
            const breakdown = result.map(row => ({
                status: row.CompletionStatus,
                count: row.InstanceCount,
                percentage: parseFloat(row.Pct),
                avgRunTimeSec: row.AvgRunTimeSec,
                avgTaskCompletePct: row.AvgTaskCompletePct,
                avgStartupSec: row.AvgStartupSec
            }));

            // Summary stats
            const totalInstances = breakdown.reduce((sum, b) => sum + b.count, 0);
            const successCount = breakdown.find(b => b.status === 'Complete')?.count || 0;
            const failureCount = breakdown
                .filter(b => ['Cancelled', 'Incomplete', 'Storage Provisioning Failed', 'Lab Creation Failed', 
                            'Resume Failed', 'Save Failed'].includes(b.status))
                .reduce((sum, b) => sum + b.count, 0);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: {
                        breakdown: breakdown,
                        summary: {
                            totalInstances,
                            successCount,
                            failureCount,
                            successRate: totalInstances > 0 ? ((successCount / totalInstances) * 100).toFixed(2) : '0.00'
                        }
                    },
                    timestamp: new Date().toISOString(),
                    hoursBack
                }
            };
        } catch (error) {
            context.error('GetCompletionBreakdown error:', error);
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
