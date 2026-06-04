const { Connection, Request, TYPES } = require('tedious');

/**
 * Execute a SQL query and return results as an array of objects.
 */
function executeQuery(query, parameters = []) {
        return new Promise((resolve, reject) => {
                    const cs = process.env.SQL_CONNECTION_STRING || '';

                                   // Parse connection string fields
                                   const serverMatch = cs.match(/Server=tcp:([^,;]+)/i);
                    const dbMatch = cs.match(/(?:Initial Catalog|Database)=([^;]+)/i);
                    const userMatch = cs.match(/User ID=([^;]+)/i);
                    const pwdMatch = cs.match(/Password=([^;]+)/i);

                                   const server = serverMatch ? serverMatch[1] : (process.env.SQL_SERVER || 'sql-skillable-1f54a9ce.database.windows.net');
                    const database = dbMatch ? dbMatch[1] : (process.env.SQL_DATABASE || 'SkillableLabTelemetry');

                                   let config;
                    if (userMatch && pwdMatch) {
                                    // Use SQL Server login when credentials are in the connection string
                        config = {
                                            server,
                                            authentication: {
                                                                    type: 'default',
                                                                    options: {
                                                                                                userName: userMatch[1],
                                                                                                password: pwdMatch[1],
                                                                    },
                                            },
                                            options: {
                                                                    database,
                                                                    encrypt: true,
                                                                    port: 1433,
                                                                    connectTimeout: 30000,
                                                                    requestTimeout: 30000,
                                                                    trustServerCertificate: false,
                                            },
                        };
                    } else {
                                    // Fall back to Managed Identity (requires Standard plan or linked Function App)
                        config = {
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

module.exports = { executeQuery, TYPES };
