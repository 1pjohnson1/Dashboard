const { app } = require('@azure/functions');
const { executeQuery, TYPES } = require('../shared/sql.js');

app.http('GetActiveErrors', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const hoursBack = parseInt(request.query.get('hoursBack') || '4', 10);

            const query = `
                EXEC dbo.sp_GetActiveErrors 
                    @HoursBack = @hours
            `;
            const params = [
                { name: 'hours', type: TYPES.Int, value: hoursBack }
            ];

            const result = await executeQuery(query, params);

            // Parse JSON fields where present
            const enriched = result.map(row => ({
                ...row,
                Errors: row.Errors ? tryParseJson(row.Errors) : null,
                ScriptResults: row.ScriptResults ? tryParseJson(row.ScriptResults) : null,
                AnswerResults: row.AnswerResults ? tryParseJson(row.AnswerResults) : null
            }));

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: enriched,
                    count: enriched.length,
                    timestamp: new Date().toISOString(),
                    hoursBack
                }
            };
        } catch (error) {
            context.error('GetActiveErrors error:', error);
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
