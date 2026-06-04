const { app } = require('@azure/functions');
const { executeQuery, TYPES } = require('../shared/sql.js');

app.http("GetGeoBucketAnalysis", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        try {
            const days = parseInt(request.query.get("days") || "7", 10);
            const region = request.query.get("region") || "all";
            const cutoffEpoch = Math.floor(Date.now() / 1000) - days * 86400;

            // By country
            const byCountry = await executeQuery(
                `SELECT Country, COUNT(*) AS Count,
                        AVG(Latitude) AS AvgLat, AVG(Longitude) AS AvgLng
                 FROM dbo.tblInstances
                 WHERE StartEpoch >= @cutoff AND Country IS NOT NULL
                 ${region !== "all" ? "AND Region = @region" : ""}
                 GROUP BY Country
                 ORDER BY Count DESC`,
                [
                    { name: "cutoff", type: TYPES.BigInt, value: cutoffEpoch },
                    ...(region !== "all"
                        ? [{ name: "region", type: TYPES.NVarChar, value: region }]
                        : []),
                ]
            );

            // By region
            const byRegion = await executeQuery(
                `SELECT Country, Region, COUNT(*) AS Count
                 FROM dbo.tblInstances
                 WHERE StartEpoch >= @cutoff AND Region IS NOT NULL
                 ${region !== "all" ? "AND Region = @region" : ""}
                 GROUP BY Country, Region
                 ORDER BY Count DESC`,
                [
                    { name: "cutoff", type: TYPES.BigInt, value: cutoffEpoch },
                    ...(region !== "all"
                        ? [{ name: "region", type: TYPES.NVarChar, value: region }]
                        : []),
                ]
            );

            // By city (top 50 for mapping)
            const byCity = await executeQuery(
                `SELECT TOP 50 Country, Region, City, COUNT(*) AS Count,
                        AVG(Latitude) AS Lat, AVG(Longitude) AS Lng
                 FROM dbo.tblInstances
                 WHERE StartEpoch >= @cutoff AND City IS NOT NULL
                       AND Latitude IS NOT NULL AND Longitude IS NOT NULL
                 ${region !== "all" ? "AND Region = @region" : ""}
                 GROUP BY Country, Region, City
                 ORDER BY Count DESC`,
                [
                    { name: "cutoff", type: TYPES.BigInt, value: cutoffEpoch },
                    ...(region !== "all"
                        ? [{ name: "region", type: TYPES.NVarChar, value: region }]
                        : []),
                ]
            );

            // Available regions for filter
            const regions = await executeQuery(
                `SELECT DISTINCT Region
                 FROM dbo.tblInstances
                 WHERE StartEpoch >= @cutoff AND Region IS NOT NULL
                 ORDER BY Region`,
                [{ name: "cutoff", type: TYPES.BigInt, value: cutoffEpoch }]
            );

            return {
                status: 200,
                jsonBody: {
                    byCountry,
                    byRegion,
                    byCity,
                    availableRegions: regions.map((r) => r.Region),
                    days,
                    region,
                },
            };
        } catch (error) {
            context.error("GetGeoBucketAnalysis error:", error);
            return {
                status: 500,
                jsonBody: { error: error.message || "Internal server error" },
            };
        }
    },
});
