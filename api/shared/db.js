'use strict';

const sql = require('mssql');

/**
 * SQL connection pool singleton.
 * Reads SQL_CONNECTION_STRING from environment variables.
 * In Azure Static Web Apps, this is set via Application Settings.
 * Locally, it reads from local.settings.json.
 */

let pool = null;

const config = {
    connectionString: process.env.SQL_CONNECTION_STRING,
    options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 30000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

/**
 * Returns a connected SQL connection pool (singleton).
 * Creates the pool on first call, reuses on subsequent calls.
 */
async function getPool() {
    if (pool) {
        return pool;
    }

    if (!process.env.SQL_CONNECTION_STRING) {
        throw new Error(
            'SQL_CONNECTION_STRING environment variable is not set. ' +
            'For local development, add it to api/local.settings.json. ' +
            'For Azure, set it in Static Web Apps Application Settings.'
        );
    }

    try {
        pool = await sql.connect(config.connectionString);
        console.log('SQL connection pool created successfully.');
        return pool;
    } catch (err) {
        pool = null;
        console.error('Failed to create SQL connection pool:', err.message);
        throw err;
    }
}

/**
 * Executes a stored procedure and returns all recordsets.
 * @param {string} procName - Name of the stored procedure (e.g., 'dbo.usp_GetOverviewMetrics')
 * @param {Object} params - Key-value pairs of parameter names and values
 * @returns {Object} - { recordsets, recordset, rowsAffected }
 */
async function executeProc(procName, params = {}) {
    const db = await getPool();
    const request = db.request();

    for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
    }

    return await request.execute(procName);
}

module.exports = { getPool, executeProc, sql };
