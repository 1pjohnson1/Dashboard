const { app } = require('@azure/functions');
const { executeQuery, TYPES } = require('../shared/sql.js');

app.http('GetVpnSuspects', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const hoursBack = parseInt(request.query.get('hoursBack') || '24', 10);

            const query = `
                EXEC dbo.sp_GetVpnSuspects 
                    @HoursBack = @hours
            `;
            const params = [
                { name: 'hours', type: TYPES.Int, value: hoursBack }
            ];

            const result = await executeQuery(query, params);

            // Transform and flag suspicious patterns
            const suspects = result.map(row => ({
                id: row.Id,
                labProfileName: row.LabProfileName,
                studentIp: row.IpAddress,
                reportedPublicIps: row.PublicIpAddresses ? tryParseJson(row.PublicIpAddresses) : [],
                location: {
                    country: row.Country,
                    region: row.Region,
                    city: row.City
                },
                browserUserAgent: row.BrowserUserAgent,
                remoteController: row.RemoteController,
                student: {
                    email: row.UserEmail,
                    firstName: row.UserFirstName,
                    lastName: row.UserLastName
                },
                startDateTime: row.StartDateTime,
                state: row.State,
                completionStatus: row.CompletionStatus,
                suspicionLevel: determineSuspicionLevel(row)
            }));

            // Group by suspicion level
            const bySuspicion = {
                HIGH: suspects.filter(s => s.suspicionLevel === 'HIGH'),
                MEDIUM: suspects.filter(s => s.suspicionLevel === 'MEDIUM'),
                LOW: suspects.filter(s => s.suspicionLevel === 'LOW')
            };

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: {
                        allSuspects: suspects,
                        summary: {
                            totalFlags: suspects.length,
                            highRisk: bySuspicion.HIGH.length,
                            mediumRisk: bySuspicion.MEDIUM.length,
                            lowRisk: bySuspicion.LOW.length
                        },
                        byRisk: bySuspicion
                    },
                    timestamp: new Date().toISOString(),
                    hoursBack
                }
            };
        } catch (error) {
            context.error('GetVpnSuspects error:', error);
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
        return [str];
    }
}

function determineSuspicionLevel(row) {
    // HIGH: Recent activity with IP mismatch + specific patterns
    // MEDIUM: IP mismatch with some other indicators
    // LOW: IP mismatch but recent completion
    if (row.State && row.State === 'Error') return 'HIGH';
    if (row.CompletionStatus === 'Complete') return 'LOW';
    return 'MEDIUM';
}
