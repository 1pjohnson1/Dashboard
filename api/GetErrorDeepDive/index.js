'use strict';

const { executeProc } = require('../shared/db');

/**
 * GET /api/GetErrorDeepDive?days=7
 * 
 * Returns error rate by API consumer, error types, daily error trend,
 * and recent error records for the Error Deep Dive dashboard page.
 */
module.exports = async function (context, req) {
    try {
        const days = parseInt(req.query.days) || 7;

        const result = await executeProc('dbo.usp_GetErrorDeepDive', {
            Days: days
        });

        // Recordset 0: Error rate by API consumer
        const errorRateByConsumer = (result.recordsets[0] || []).map(row => ({
            apiConsumer: row.ApiConsumer,
            totalInstances: row.TotalInstances,
            instancesWithErrors: row.InstancesWithErrors,
            totalErrors: row.TotalErrors,
            errorRate: parseFloat(row.ErrorRate) || 0,
            thresholdBreached: row.ThresholdBreached
        }));

        // Recordset 1: Errors by type
        const errorsByType = (result.recordsets[1] || []).map(row => ({
            errorType: row.ErrorType,
            count: row.ErrorCount
        }));

        // Recordset 2: Daily error trend
        const errorTrend = (result.recordsets[2] || []).map(row => ({
            date: row.ErrorDate,
            errorCount: row.ErrorCount
        }));

        // Recordset 3: Recent errors
        const recentErrors = (result.recordsets[3] || []).map(row => ({
            errorId: row.ErrorId,
            instanceId: row.InstanceId,
            labProfileName: row.LabProfileName,
            seriesName: row.SeriesName,
            errorType: row.ErrorType,
            errorMessage: row.ErrorMessage,
            apiConsumer: row.ApiConsumer,
            datacenterName: row.DatacenterName,
            labHostName: row.LabHostName,
            timestamp: row.IngestTimestamp
        }));

        // Determine overall threshold status
        const breachedConsumers = errorRateByConsumer
            .filter(c => c.thresholdBreached)
            .map(c => c.apiConsumer);

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                errorRateByConsumer,
                errorsByType,
                errorTrend,
                recentErrors,
                thresholdBreached: breachedConsumers.length > 0,
                breachedConsumers,
                periodDays: days
            }
        };
    } catch (err) {
        context.log.error('GetErrorDeepDive failed:', err.message);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                error: 'Failed to retrieve error deep dive data.',
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            }
        };
    }
};
