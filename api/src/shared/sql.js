const { Connection, Request, TYPES } = require('tedious');
const { SecretClient } = require('@azure/keyvault-secrets');
const { DefaultAzureCredential } = require('@azure/identity');

let _cachedPassword = null;

async function getSqlPassword() {
    if (_cachedPassword !== null) return _cachedPassword;

    const kvUrl = process.env.KEY_VAULT_URL;
    if (kvUrl) {
        const client = new SecretClient(kvUrl, new DefaultAzureCredential());
        const secret = await client.getSecret('SqlAdminPassword');
        _cachedPassword = secret.value;
        return _cachedPassword;
    }

    // Local dev fallback: read password from SQL_CONNECTION_STRING
    const cs = process.env.SQL_CONNECTION_STRING || '';
    const match = cs.match(/Password=([^;]+)/i);
    return match ? match[1] : null;
}

async function executeQuery(query, parameters = []) {
    const server   = process.env.SQL_SERVER   || 'sql-skillable-1f54a9ce.database.windows.net';
    const database = process.env.SQL_DATABASE || 'SkillableLabTelemetry';
    const user     = process.env.SQL_ADMIN_USER || 'sqladmin';
    const password = await getSqlPassword();

    const config = password
        ? {
            server,
            authentication: {
                type: 'default',
                options: { userName: user, password },
            },
            options: {
                database,
                encrypt: true,
                port: 1433,
                connectTimeout: 30000,
                requestTimeout: 30000,
                trustServerCertificate: false,
            },
        }
        : {
            // Fallback to Managed Identity when no password is available
            server,
            authentication: {
                type: 'azure-active-directory-msi-app-service',
            },
            options: {
                database,
                encrypt: true,
                port: 1433,
                connectTimeout: 30000,
                requestTimeout: 30000,
            },
        };

    return new Promise((resolve, reject) => {
        const connection = new Connection(config);
        const rows = [];

        connection.on('connect', (err) => {
            if (err) {
                reject(err);
                return;
            }

            const request = new Request(query, (err) => {
                connection.close();
                if (err) reject(err);
                else resolve(rows);
            });

            parameters.forEach((p) => request.addParameter(p.name, p.type, p.value));

            request.on('row', (columns) => {
                const row = {};
                columns.forEach((col) => { row[col.metadata.colName] = col.value; });
                rows.push(row);
            });

            connection.execSql(request);
        });

        connection.connect();
    });
}

module.exports = { executeQuery, TYPES };
