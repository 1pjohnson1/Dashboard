const { app } = require('@azure/functions');
const { executeQuery, TYPES } = require('../shared/sql.js');

app.http('GetDatacenterHealth', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const datacenterName = request.query.get('datacenterName');
            const hoursBack = parseInt(request.query.get('hoursBack') || '24', 10);

            let query, params;

            if (datacenterName) {
                // Single datacenter detail
                query = `
                    EXEC dbo.sp_GetDatacenterHealth 
                        @DatacenterName = @dcName, 
                        @HoursBack = @hours
                `;
                params = [
                    { name: 'dcName', type: TYPES.NVarChar, value: datacenterName },
                    { name: 'hours', type: TYPES.Int, value: hoursBack }
                ];
            } else {
                // All datacenters summary
                query = `
                    EXEC dbo.sp_GetDatacenterHealth 
                        @DatacenterName = NULL, 
                        @HoursBack = @hours
                `;
                params = [
                    { name: 'hours', type: TYPES.Int, value: hoursBack }
                ];
            }

            const result = await executeQuery(query, params);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: result,
                    count: result.length,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            context.error('GetDatacenterHealth error:', error);
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
