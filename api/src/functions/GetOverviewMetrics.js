const { app } = require('@azure/functions');
const { executeQuery, TYPES } = require('../shared/sql.js');

app.http('GetOverviewMetrics', {
	    methods: ['GET'],
	    authLevel: 'anonymous',
	    handler: async (request, context) => {
			        try {
						            const days = parseInt(request.query.get('days') || '7', 10);
						            const cutoffEpoch = Math.floor(Date.now() / 1000) - days * 86400;

			            const totalResult = await executeQuery(
							                `SELECT COUNT(*) AS TotalInstances,
											                    AVG(CAST(StartupDuration AS FLOAT)) AS AvgStartupDuration,
																                    AVG(CAST(TotalRunTime AS FLOAT)) AS AvgRunTime,
																					                    AVG(CAST(TimeInSession AS FLOAT)) AS AvgTimeInSession,
																										                    SUM(ErrorCount) AS TotalErrors,
																															                    AVG(CAST(TaskCompletePercent AS FLOAT)) AS AvgTaskComplete,
																																				                    SUM(CASE WHEN ExamPassed = 1 THEN 1 ELSE 0 END) AS ExamsPassed,
																																									                    SUM(CASE WHEN IsExam = 1 THEN 1 ELSE 0 END) AS TotalExams
																																														                FROM dbo.tblInstances
																																																		                WHERE StartEpoch >= @cutoff`,
							                [{ name: 'cutoff', type: TYPES.BigInt, value: cutoffEpoch }]
							            );

			            const byState = await executeQuery(
							                `SELECT State, COUNT(*) AS Count
											                FROM dbo.tblInstances
															                WHERE StartEpoch >= @cutoff
																			                GROUP BY State
																							                ORDER BY Count DESC`,
							                [{ name: 'cutoff', type: TYPES.BigInt, value: cutoffEpoch }]
							            );

			            const topLabs = await executeQuery(
							                `SELECT TOP 10 LabProfileId, LabProfileName, COUNT(*) AS Count
											                FROM dbo.tblInstances
															                WHERE StartEpoch >= @cutoff
																			                GROUP BY LabProfileId, LabProfileName
																							                ORDER BY Count DESC`,
							                [{ name: 'cutoff', type: TYPES.BigInt, value: cutoffEpoch }]
							            );

			            const dailyTrend = await executeQuery(
							                `SELECT CONVERT(DATE, StartDateTime) AS Day, COUNT(*) AS Count
											                FROM dbo.tblInstances
															                WHERE StartEpoch >= @cutoff AND StartDateTime IS NOT NULL
																			                GROUP BY CONVERT(DATE, StartDateTime)
																							                ORDER BY Day`,
							                [{ name: 'cutoff', type: TYPES.BigInt, value: cutoffEpoch }]
							            );

			            const summary = totalResult[0];
						            const errorRate = summary.TotalInstances
						                ? ((summary.TotalErrors / summary.TotalInstances) * 100).toFixed(2)
										                : '0.00';

			            return {
							                status: 200,
							                jsonBody: {
												                    summary: { ...summary, ErrorRate: parseFloat(errorRate) },
												                    byState,
												                    topLabProfiles: topLabs,
												                    dailyTrend,
												                    days,
											},
						};
					} catch (error) {
						            context.error('GetOverviewMetrics error:', error);
						            return {
										                status: 500,
										                jsonBody: {
															                    error: error.message || 'Internal server error',
															                    code: error.code || 'UNKNOWN',
															                    stack: error.stack,
															                    details: JSON.stringify(error),
														},
									};
					}
		},
});
