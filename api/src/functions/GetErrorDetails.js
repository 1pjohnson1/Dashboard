const { app } = require('@azure/functions');
const { executeQuery, TYPES } = require('../shared/sql.js');

app.http('GetErrorDetails', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const labInstanceId = request.query.get('labInstanceId');
            const hoursBack = parseInt(request.query.get('hoursBack') || '4', 10);

            let query, params;

            if (labInstanceId) {
                // Specific instance error details
                query = `
                    EXEC dbo.sp_GetErrorDetails 
                        @LabInstanceId = @instId, 
                        @HoursBack = @hours
                `;
                params = [
                    { name: 'instId', type: TYPES.Int, value: parseInt(labInstanceId, 10) },
                    { name: 'hours', type: TYPES.Int, value: hoursBack }
                ];
            } else {
                // Recent errors across all instances
                query = `
                    EXEC dbo.sp_GetErrorDetails 
                        @LabInstanceId = NULL, 
                        @HoursBack = @hours
                `;
                params = [
                    { name: 'hours', type: TYPES.Int, value: hoursBack }
                ];
            }

            const result = await executeQuery(query, params);

            // Parse JSON fields where present
            const enriched = result.map(row => ({
                ...row,
                Errors: row.Errors ? tryParseJson(row.Errors) : null,
                ScriptResults: row.ScriptResults ? tryParseJson(row.ScriptResults) : null,
                AnswerResults: row.AnswerResults ? tryParseJson(row.AnswerResults) : null,
                AnswerTexts: row.AnswerTexts ? tryParseJson(row.AnswerTexts) : null
            }));

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: enriched,
                    count: enriched.length,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            context.error('GetErrorDetails error:', error);
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
