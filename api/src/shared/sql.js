import { Connection, Request, TYPES } from 'tedious';

/**
 * Execute a SQL query and return results as an array of objects.
 */
export function executeQuery(query, parameters = []) {
    return new Promise((resolve, reject) => {
        const config = {
            server: process.env.SQL_SERVER || 'sql-skillable-1f54a9ce.database.windows.net',
            authentication: {
                type: 'azure-active-directory-msi-app-service',
            },
            options: {
                database: process.env.SQL_DATABASE || 'SkillableLabTelemetry',
                encrypt: true,
                port: 1433,
                connectTimeout: 30000,
                requestTimeout: 30000,
            },
        };

        // If a full connection string is provided, parse it
        if (process.env.SQL_CONNECTION_STRING) {
            const cs = process.env.SQL_CONNECTION_STRING;
            const serverMatch = cs.match(/Server=tcp:([^,;]+)/i);
            const dbMatch = cs.match(/Database=([^;]+)/i);
            if (serverMatch) config.server = serverMatch[1];
            if (dbMatch) config.options.database = dbMatch[1];
        }

        const connection = new Connection(config);
        const rows = [];

        connection.on('connect', (err) => {
            if (err) {
                reject(err);
                return;
            }

            const request = new Request(query, (err, rowCount) => {
                connection.close();
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });

            // Add parameters
            parameters.forEach((p) => {
                request.addParameter(p.name, p.type, p.value);
            });

            // Collect rows
            request.on('row', (columns) => {
                const row = {};
                columns.forEach((col) => {
                    row[col.metadata.colName] = col.value;
                });
                rows.push(row);
            });

            connection.execSql(request);
        });

        connection.connect();
    });
}

export { TYPES };
