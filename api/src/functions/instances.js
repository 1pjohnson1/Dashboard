import { app } from "@azure/functions";
import { Connection, Request } from "tedious";

const config = {
    server: "sql-skillable-1f54a9ce.database.windows.net",
    authentication: {
        type: "default",
        options: {
            userName: "",
            password: ""
        }
    },
    options: {
        database: "SkillableLabTelemetry",
        encrypt: true,
        connectionString: process.env.SQL_CONNECTION_STRING
    }
};

app.http("instances", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        // Simple query - expand as needed
        const query = "SELECT TOP 100 * FROM dbo.tblInstances ORDER BY StartEpoch DESC";

        return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "API is working", endpoint: "/api/instances" })
        };
    }
});