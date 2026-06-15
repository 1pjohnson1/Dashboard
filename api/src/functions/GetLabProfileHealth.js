const { app } = require('@azure/functions');
const { executeQuery, TYPES } = require('../shared/sql.js');

app.http('GetLabProfileHealth', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const labProfileName = request.query.get('labProfileName');
            const hoursBack = parseInt(request.query.get('hoursBack') || '24', 10);

            let query, params;

            if (labProfileName) {
                // Filter by profile name (partial match supported)
                query = `
                    EXEC dbo.sp_GetLabProfileHealth 
                        @LabProfileName = @profileName, 
                        @HoursBack = @hours
                `;
                params = [
                    { name: 'profileName', type: TYPES.NVarChar, value: labProfileName },
                    { name: 'hours', type: TYPES.Int, value: hoursBack }
                ];
            } else {
                // All lab profiles
                query = `
                    EXEC dbo.sp_GetLabProfileHealth 
                        @LabProfileName = NULL, 
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
            context.error('GetLabProfileHealth error:', error);
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
