# Skillable Lab Telemetry Dashboard — Implementation Guide

> **Author:** Penelope Johnson, Director — Lab Development
> **Version:** 3.0 (Azure Migration)
> **Last Updated:** May 2026

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Phase 1 — Azure Resource Setup](#2-phase-1--azure-resource-setup)
3. [Phase 2 — Deploy SQL Schema](#3-phase-2--deploy-sql-schema)
4. [Phase 3 — Azure Data Factory](#4-phase-3--azure-data-factory)
5. [Phase 4 — Azure Functions API](#5-phase-4--azure-functions-api)
6. [Phase 5 — React Dashboard](#6-phase-5--react-dashboard)
7. [Phase 6 — Deploy to Azure Static Web Apps](#7-phase-6--deploy-to-azure-static-web-apps)
8. [Phase 7 — Monitoring & Maintenance](#8-phase-7--monitoring--maintenance)
9. [Troubleshooting](#9-troubleshooting)
10. [Cost Summary](#10-cost-summary)

---

## 1. Prerequisites

### Tools Required

| Tool | Version | Install |
|------|---------|---------|
| Azure CLI | 2.60+ | `winget install Microsoft.AzureCLI` or [install guide](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) |
| Node.js | 18 LTS or 20 LTS | [nodejs.org](https://nodejs.org) |
| Azure Functions Core Tools | v4 | `npm install -g azure-functions-core-tools@4` |
| Git | 2.40+ | [git-scm.com](https://git-scm.com) |
| VS Code | Latest | [code.visualstudio.com](https://code.visualstudio.com) |
| Azure Data Studio | Latest | [learn.microsoft.com](https://learn.microsoft.com/en-us/azure-data-studio/download) |
| Static Web Apps CLI | Latest | `npm install -g @azure/static-web-apps-cli` |

### VS Code Extensions (Recommended)

- Azure Functions
- Azure Databases
- Azure Static Web Apps
- ES7+ React/Redux/React-Native snippets
- Prettier

### Accounts & Access

- Azure subscription with Contributor role
- Skillable API key (obtain from Skillable admin portal or contact support)
- GitHub account (for CI/CD)

### Skillable API Reference

The Skillable API we are calling:

- **Base URL:** `https://labondemand.com/api/v3/`
- **Auth:** API key passed as query parameter `?api_key=YOUR_KEY` or header
- **Endpoints used:**
  - `labinstance/search` — paginated search of lab instances
  - `details` — full lab instance details by ID
- **Key parameters for search:**
  - `start` — epoch timestamp (start of window)
  - `end` — epoch timestamp (end of window)
  - `pageIndex` — 0-based page number
  - `pageSize` — results per page (max 100)
  - `sort` — e.g., `start desc`
  - `mode` — 10 (returns detailed results)

---

## 2. Phase 1 — Azure Resource Setup

### 2.1 Sign In to Azure

```bash
az login
az account set --subscription "YOUR_SUBSCRIPTION_NAME_OR_ID"
```

### 2.2 Set Shell Variables

Set these once and reuse throughout the guide. Adjust values as needed.

```bash
# ── Configuration Variables ──
RESOURCE_GROUP="rg-skillable-dashboard"
LOCATION="eastus"
SQL_SERVER_NAME="sql-skillable-$(openssl rand -hex 4)"
SQL_DB_NAME="SkillableLabTelemetry"
SQL_ADMIN_USER="sqladmin"
SQL_ADMIN_PASS="$(openssl rand -base64 16)!"    # Store this securely!
ADF_NAME="adf-skillable-dashboard"
FUNC_APP_NAME="func-skillable-api"
SWA_NAME="swa-skillable-dashboard"
STORAGE_ACCOUNT="stskillable$(openssl rand -hex 4)"

# Print the generated values so you can save them
echo "SQL Server:  $SQL_SERVER_NAME"    SQL Server:  sql-skillable-1f54a9ce

echo "SQL Admin:   $SQL_ADMIN_USER"     SQL Admin:   Entra ID - pjohnson@comptia.org (sqladmin)
echo "SQL Pass:    $SQL_ADMIN_PASS"     SQL Pass:    
echo "Storage:     $STORAGE_ACCOUNT"    Storage:     stskillabledb7d06f3

Tenant: 2454cb25-0d8f-493f-9d61-4af91dfb4de9
Subscription: lods_unmanaged_prd04 (64211474-4e1d-4ae0-b4ed-a2f85e5ec5c8)




> ⚠️ **Save these values securely** — you will need them in later phases.

### 2.3 Create Resource Group

```bash
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION
```

### 2.4 Create Azure SQL Server & Database

```bash
# Create the SQL Server
az sql server create \
  --name $SQL_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --admin-user $SQL_ADMIN_USER \
  --admin-password "$SQL_ADMIN_PASS"

COMPTIA+pjohnson@PJohnson-Prec25 MINGW64 ~/Dashboard (master)
$ az sql server create \
> --name $SQL_SERVER_NAME \
> --resource-group $RESOURCE_GROUP \
> --location $LOCATION \
> --admin-user $SQL_ADMIN_USER \
> --admin-password "$SQL_ADMIN_PASS"
{
  "administratorLogin": "sqladmin",
  "administratorLoginPassword": null,
  "administrators": null,
  "createMode": null,
  "externalGovernanceStatus": "Disabled",
  "federatedClientId": null,
  "fullyQualifiedDomainName": "sql-skillable-1f54a9ce.database.windows.net",
  "id": "/subscriptions/64211474-4e1d-4ae0-b4ed-a2f85e5ec5c8/resourceGroups/rg-skillable-dashboard/providers/Microsoft.Sql/servers/sql-skillable-1f54a9ce",
  "identity": null,
  "isIPv6Enabled": null,
  "keyId": null,
  "kind": "v12.0",
  "location": "eastus",
  "minimalTlsVersion": "1.2",
  "name": "sql-skillable-1f54a9ce",
  "primaryUserAssignedIdentityId": null,
  "privateEndpointConnections": [],
  "publicNetworkAccess": "Enabled",
  "resourceGroup": "rg-skillable-dashboard",
  "restrictOutboundNetworkAccess": "Disabled",
  "retentionDays": -1,
  "state": "Ready",
  "tags": null,
  "type": "Microsoft.Sql/servers",
  "version": "12.0",
  "workspaceFeature": null



# Create the database (Free tier — 32 GB, 5 DTUs)
az sql db create \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER_NAME \
  --name $SQL_DB_NAME \
  --edition Free \


> **Note:** The Free tier provides 32 GB storage and 5 DTUs — more than enough for
> this workload. If you need more performance later, upgrade to Basic ($4.99/mo).

### 2.5 Configure Firewall Rules

```bash
# Allow Azure services to connect (required for ADF and Functions)
az sql server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER_NAME \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Allow your local IP for development
MY_IP=$(curl -s https://api.ipify.org)
az sql server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER_NAME \
  --name AllowMyIP \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP
```

### 2.6 Get Connection String

```bash
az sql db show-connection-string \
  --server $SQL_SERVER_NAME \
  --name $SQL_DB_NAME \
  --client ado.net

# Output is:
# Server=tcp:sql-skillable-1f54a9ce.database.windows.net,1433;Database=SkillableLabTelemetry;User ID=sqladmin;Password=cu+/KIiAtehG2N3eIYCjjQ==!;Encrypt=true;TrustServerCertificate=false;Connection Timeout=30;


Save the full connection string — you will need it for ADF and Functions config.

### 2.7 Create Storage Account (for ADF + Functions)

```bash
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS
```

---

## 3. Phase 2 — Deploy SQL Schema

### 3.1 Connect to Your Database

**Option A — Azure Data Studio:**
1. Open Azure Data Studio
2. Click **New Connection**
3. Server: `<SQL_SERVER_NAME>.database.windows.net`
4. Authentication: SQL Login
5. Username: `sqladmin`
6. Password: (the one you generated)
7. Database: `SkillableLabTelemetry`

**Option B — sqlcmd from terminal:**

```bash
sqlcmd -S "$SQL_SERVER_NAME.database.windows.net" \
       -d $SQL_DB_NAME \
       -U $SQL_ADMIN_USER \
       -P "$SQL_ADMIN_PASS" \
       -i sql/schema.sql
```

### 3.2 Run the Schema Script

Open and execute `sql/schema.sql`. This creates:

- **tblInstances** — one row per lab instance (primary data table)
- **tblErrors** — one row per error event linked to an instance
- **tblActivities** — one row per scored activity result
- **tblGeoBuckets** — aggregated launch counts by IP + 6-hour window
- **Indexes** on all foreign keys, timestamps, and filter columns
- **Views** for dashboard pages:
  - `vw_OverviewMetrics` — KPI aggregates
  - `vw_ErrorRateByConsumer` — error rates grouped by API consumer
  - `vw_ConcurrentLaunches` — 5-minute window concurrent launch counts
  - `vw_RegionSummary` — launches and errors by delivery region

### 3.3 Run the Stored Procedures Script

```bash
sqlcmd -S "$SQL_SERVER_NAME.database.windows.net" \
       -d $SQL_DB_NAME \
       -U $SQL_ADMIN_USER \
       -P "$SQL_ADMIN_PASS" \
       -i sql/stored_procedures.sql
```

### 3.4 Verify

```sql
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';
-- Should show: tblInstances, tblErrors, tblActivities, tblGeoBuckets

SELECT name FROM sys.procedures;
-- Should show all usp_* procedures
```

---

## 4. Phase 3 — Azure Data Factory

### 4.1 Create the Data Factory Instance

```bash
az datafactory create \
  --resource-group $RESOURCE_GROUP \
  --factory-name $ADF_NAME \
  --location $LOCATION
```

### 4.2 Open ADF Studio

Navigate to [https://adf.azure.com](https://adf.azure.com) and select your factory.

### 4.3 Create Linked Services

#### 4.3.1 Skillable REST API Linked Service

In ADF Studio → **Manage** tab → **Linked services** → **+ New** → **REST**

| Setting | Value |
|---------|-------|
| Name | `ls_SkillableAPI` |
| Base URL | `https://labondemand.com/api/v3/` |
| Authentication type | Anonymous |
| Additional headers | (none — API key is passed as query param) |

> **Why Anonymous?** The Skillable API uses an `api_key` query parameter rather than
> an Authorization header. We pass the key in the pipeline URL expression.

**JSON definition (for ARM template / Git mode):**

```json
{
  "name": "ls_SkillableAPI",
  "type": "Microsoft.DataFactory/factories/linkedservices",
  "properties": {
    "type": "RestService",
    "typeProperties": {
      "url": "https://labondemand.com/api/v3/",
      "enableServerCertificateValidation": true,
      "authenticationType": "Anonymous"
    }
  }
}
```

#### 4.3.2 Azure SQL Linked Service

**Manage** → **Linked services** → **+ New** → **Azure SQL Database**

| Setting | Value |
|---------|-------|
| Name | `ls_AzureSql` |
| Server name | `<SQL_SERVER_NAME>.database.windows.net` |
| Database name | `SkillableLabTelemetry` |
| Authentication | SQL authentication |
| User name | `sqladmin` |
| Password | (your password — store in Azure Key Vault for production) |

**JSON definition:**

```json
{
  "name": "ls_AzureSql",
  "type": "Microsoft.DataFactory/factories/linkedservices",
  "properties": {
    "type": "AzureSqlDatabase",
    "typeProperties": {
      "connectionString": "Server=tcp:<server>.database.windows.net,1433;Database=SkillableLabTelemetry;User ID=sqladmin;Password=<password>;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
    }
  }
}

But First — Grant ADF Access to the Database
CREATE USER.sql
The managed identity won't work until you create a user for it in the database. Run this in VS Code (MSSQL extension, connected with your Entra ID):
SQLCREATE USER [adf-skillable-dashboard] FROM EXTERNAL PROVIDER;ALTER ROLE db_datareader ADD MEMBER [adf-skillable-dashboard];ALTER ROLE db_datawriter ADD MEMBER [adf-skillable-dashboard];

#Create Key Vault
#Get your Object ID (3740f345-3ea9-47f3-9c32-9560a28d8748)
az ad signed-in-user show --query id -o tsv
az role assignment create `
  --role "Key Vault Secrets Officer" `
  --assignee-object-id "3740f345-3ea9-47f3-9c32-9560a28d8748" `
  --assignee-principal-type "User" `
  --scope "/subscriptions/64211474-4e1d-4ae0-b4ed-a2f85e5ec5c8/resourceGroups/rg-skillable-dashboard/providers/Microsoft.KeyVault/vaults/kv-skillable-dashboard"
#Output
  {
  "condition": null,
  "conditionVersion": null,
  "createdBy": null,
  "createdOn": "2026-06-02T17:35:58.291858+00:00",
  "delegatedManagedIdentityResourceId": null,
  "description": null,
  "id": "/subscriptions/64211474-4e1d-4ae0-b4ed-a2f85e5ec5c8/resourceGroups/rg-skillable-dashboard/providers/Microsoft.KeyVault/vaults/kv-skillable-dashboard/providers/Microsoft.Authorization/roleAssignments/64e8df5f-b17d-4f11-af6e-a7717bc3ebb9",
  "name": "64e8df5f-b17d-4f11-af6e-a7717bc3ebb9",
  "principalId": "3740f345-3ea9-47f3-9c32-9560a28d8748",
  "principalType": "User",
  "resourceGroup": "rg-skillable-dashboard",
  "roleDefinitionId": "/subscriptions/64211474-4e1d-4ae0-b4ed-a2f85e5ec5c8/providers/Microsoft.Authorization/roleDefinitions/b86a8fe4-44ce-4948-aee5-eccb2c155cd7",
  "scope": "/subscriptions/64211474-4e1d-4ae0-b4ed-a2f85e5ec5c8/resourceGroups/rg-skillable-dashboard/providers/Microsoft.KeyVault/vaults/kv-skillable-dashboard",
  "type": "Microsoft.Authorization/roleAssignments",
  "updatedBy": "3740f345-3ea9-47f3-9c32-9560a28d8748",
  "updatedOn": "2026-06-02T17:35:58.979862+00:00"
}


> 🔒 **Production tip:** Use Azure Key Vault to store the SQL password and Skillable
> API key. Reference them in ADF via Key Vault linked service.

### 4.4 Create Datasets

#### 4.4.1 REST Source Dataset

**Author** tab → **Datasets** → **+ New** → **REST**

| Setting | Value |
|---------|-------|
| Name | `ds_SkillableSearch` |
| Linked service | `ls_SkillableAPI` |
| Relative URL | (set dynamically in pipeline) |

#### 4.4.2 SQL Sink Datasets

Create one dataset per target table:

| Dataset Name | Linked Service | Table |
|--------------|---------------|-------|
| `ds_SqlInstances` | `ls_AzureSql` | `dbo.tblInstances` |
| `ds_SqlErrors` | `ls_AzureSql` | `dbo.tblErrors` |
| `ds_SqlActivities` | `ls_AzureSql` | `dbo.tblActivities` |
| `ds_SqlGeoBuckets` | `ls_AzureSql` | `dbo.tblGeoBuckets` |

### 4.5 Create the Ingestion Pipeline

**Author** tab → **Pipelines** → **+ New pipeline**

Name: `pl_SkillableDataIngestion`

#### 4.5.1 Pipeline Parameters

| Parameter | Type | Default |
|-----------|------|---------|
| `StartEpoch` | Int | (none — set by trigger) |
| `EndEpoch` | Int | (none — set by trigger) |
| `PageSize` | Int | `100` |

The pipeline does not take `SkillableApiKey` as a parameter. It retrieves the API
key at runtime from Azure Key Vault.

#### 4.5.2 Pipeline Variables

| Variable | Type | Default |
|----------|------|---------|
| `TotalResults` | Int | `0` |
| `TotalPages` | Int | `0` |
| `PageArray` | Array | `[]` |

#### 4.5.3 Activity 1 — Web Activity: Get First Page & Total Count

Name: `GetFirstPageAndCount`
Type: **Web**

| Setting | Value |
|---------|-------|
| Method | GET |
| URL | `@concat('https://labondemand.com/api/v3/labinstance/search?start=', string(pipeline().parameters.StartEpoch), '&end=', string(pipeline().parameters.EndEpoch), '&pageIndex=0&pageSize=', string(pipeline().parameters.PageSize), '&sort=start%20desc&mode=10')` |

This returns a JSON response with:
```json
{
  "Results": [ ... ],
  "TotalCount": 347,
  "Status": 1,
  "Error": null
}
```

#### 4.5.4 Activity 2 — Set Variable: Calculate Total Pages

Name: `SetTotalPages`
Type: **Set variable**

| Setting | Value |
|---------|-------|
| Variable | `TotalPages` |
| Value | `@add(div(activity('GetFirstPageAndCount').output.TotalCount, pipeline().parameters.PageSize), if(equals(mod(activity('GetFirstPageAndCount').output.TotalCount, pipeline().parameters.PageSize), 0), 0, 1))` |

#### 4.5.5 Activity 3 — Set Variable: Build Page Index Array

Name: `BuildPageArray`
Type: **Set variable**

| Setting | Value |
|---------|-------|
| Variable | `PageArray` |
| Value | `@range(0, variables('TotalPages'))` |

This creates an array like `[0, 1, 2, 3]` for 4 pages.

#### 4.5.6 Activity 4 — ForEach: Iterate Over Pages

Name: `ForEachPage`
Type: **ForEach**

| Setting | Value |
|---------|-------|
| Items | `@variables('PageArray')` |
| Is Sequential | `true` (to avoid API rate limiting) |
| Batch count | 1 |

**Inside the ForEach:**

##### Activity 4a — Copy Activity: Fetch Page & Write to SQL

Name: `CopySearchResultsToSql`
Type: **Copy data**

**Source configuration:**

| Setting | Value |
|---------|-------|
| Source dataset | `ds_SkillableSearch` |
| Relative URL | `@concat('labinstance/search?start=', string(pipeline().parameters.StartEpoch), '&end=', string(pipeline().parameters.EndEpoch), '&pageIndex=', string(item()), '&pageSize=', string(pipeline().parameters.PageSize), '&sort=start%20desc&mode=10')` |
| Request method | GET |

**Sink configuration:**

| Setting | Value |
|---------|-------|
| Sink dataset | `ds_SqlInstances` |
| Write behavior | `Stored procedure` |
| Stored procedure | `dbo.usp_UpsertInstance` |

**Mapping (Source JSON → SQL columns):**

| Source (JSON path) | Destination (SQL column) |
|--------------------|--------------------------|
| `$.Results[*].Id` | `InstanceId` |
| `$.Results[*].LabProfileId` | `LabProfileId` |
| `$.Results[*].LabProfileName` | `LabProfileName` |
| `$.Results[*].SeriesId` | `SeriesId` |
| `$.Results[*].SeriesName` | `SeriesName` |
| `$.Results[*].UserId` | `UserId` |
| `$.Results[*].UserFirstName` | `UserFirstName` |
| `$.Results[*].UserLastName` | `UserLastName` |
| `$.Results[*].Start` | `StartEpoch` |
| `$.Results[*].End` | `EndEpoch` |
| `$.Results[*].State` | `State` |
| `$.Results[*].CompletionStatus` | `CompletionStatus` |
| `$.Results[*].IpAddress` | `IpAddress` |
| `$.Results[*].Country` | `Country` |
| `$.Results[*].Region` | `Region` |
| `$.Results[*].City` | `City` |
| `$.Results[*].Latitude` | `Latitude` |
| `$.Results[*].Longitude` | `Longitude` |
| `$.Results[*].DatacenterId` | `DatacenterId` |
| `$.Results[*].DatacenterName` | `DatacenterName` |
| `$.Results[*].LabHostId` | `LabHostId` |
| `$.Results[*].LabHostName` | `LabHostName` |
| `$.Results[*].DeliveryRegionName` | `DeliveryRegionName` |
| `$.Results[*].LastLatency` | `LastLatency` |
| `$.Results[*].ErrorCount` | `ErrorCount` |
| `$.Results[*].StartupDuration` | `StartupDuration` |
| `$.Results[*].TotalRunTime` | `TotalRunTime` |
| `$.Results[*].TimeInSession` | `TimeInSession` |
| `$.Results[*].TaskCompletePercent` | `TaskCompletePercent` |
| `$.Results[*].ExamPassed` | `ExamPassed` |
| `$.Results[*].ExamScore` | `ExamScore` |
| `$.Results[*].IsExam` | `IsExam` |
| `$.Results[*].PlatformId` | `PlatformId` |

##### Activity 4b — ForEach Nested: Process Errors

For each instance that has `ErrorCount > 0`, call the Details API to get the
full error array, then write each error to `tblErrors`.

Name: `ProcessErrors`

This is an **If Condition** inside the outer ForEach:

- **Condition:** `@greater(item().ErrorCount, 0)`
- **True branch:** Web Activity to call `/details?labInstanceId=@{item().Id}&api_key=...`
  then ForEach over the `Errors` array, inserting into `tblErrors` via stored proc.

#### 4.5.7 Activity 5 — Stored Procedure: Update Geo Buckets

Name: `UpdateGeoBuckets`
Type: **Stored procedure**

| Setting | Value |
|---------|-------|
| Linked service | `ls_AzureSql` |
| Stored procedure | `dbo.usp_UpdateGeoBuckets` |
| Parameters | StartEpoch, EndEpoch |

This aggregates the newly inserted instances into geo-launch buckets.

### 4.6 Create the Trigger

**Author** tab → **Triggers** → **+ New**

| Setting | Value |
|---------|-------|
| Name | `tr_Every6Hours` |
| Type | **Tumbling window** |
| Start time | `2026-06-01T05:00:00Z` (midnight EST = 05:00 UTC) |
| Recurrence | Every **6 hours** |
| Max concurrency | 1 |
| Retry policy | 3 retries, 5 minutes apart |
| Delay | 0 |

**Trigger → Pipeline parameter mapping:**

| Trigger Parameter | Pipeline Parameter | Value |
|-------------------|--------------------|-------|
| WindowStart | `StartEpoch` | `@formatDateTime(trigger().outputs.windowStartTime, 'yyyy-MM-ddTHH:mm:ssZ')` → convert to epoch in pipeline |
| WindowEnd | `EndEpoch` | `@formatDateTime(trigger().outputs.windowEndTime, 'yyyy-MM-ddTHH:mm:ssZ')` → convert to epoch in pipeline |

> **Epoch conversion in ADF expression:**
> `@div(sub(ticks(trigger().outputs.windowStartTime), ticks('1970-01-01T00:00:00Z')), 10000000)`

### 4.7 Deploy via ARM Template (Alternative)

Instead of manually configuring in the portal, you can deploy the included ARM
template:

```bash
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file adf/arm_template.json \
  --parameters \
    factoryName=$ADF_NAME \
    sqlServerName=$SQL_SERVER_NAME \
    sqlDatabaseName=$SQL_DB_NAME \
    sqlAdminUser=$SQL_ADMIN_USER \
    keyVaultName=$KEYVAULT_NAME \
    sqlAdminPasswordSecretName="SqlAdminPassword" \
    skillableApiKeySecretName="SkillableApiKey"
```

### 4.8 Validate & Test

1. In ADF Studio, click **Debug** on the pipeline
2. Enter test parameters:
   - `StartEpoch`: `1780102800` (a recent 6-hour window start)
   - `EndEpoch`: `1780124400`
   - `PageSize`: `10` (small for testing)
3. Monitor the run — each activity should show green ✅
4. Verify data in SQL:
   ```sql
   SELECT TOP 10 * FROM tblInstances ORDER BY IngestTimestamp DESC;
   SELECT COUNT(*) FROM tblInstances;
   ```

---

## 5. Phase 4 — Azure Functions API

The API layer sits between the React dashboard and Azure SQL. It runs as
**managed Functions** inside Azure Static Web Apps (no separate Function App
needed).

### 5.1 Project Structure

```
api/
├── package.json
├── host.json
├── local.settings.json      ← NOT committed to Git
├── shared/
│   └── db.js                ← SQL connection helper
├── GetOverviewMetrics/
│   ├── index.js
│   └── function.json
├── GetErrorDeepDive/
│   ├── index.js
│   └── function.json
├── GetConcurrentLaunches/
│   ├── index.js
│   └── function.json
└── GetGeoBucketAnalysis/
    ├── index.js
    └── function.json
```

### 5.2 Local Configuration

Create `api/local.settings.json` (do NOT commit this):

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "",
    "SQL_CONNECTION_STRING": "Server=tcp:<server>.database.windows.net,1433;Database=SkillableLabTelemetry;User ID=sqladmin;Password=<password>;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
  }
}
```

### 5.3 Install Dependencies

```bash
cd api
npm install
```

### 5.4 Run Locally

```bash
cd api
func start
```

Test endpoints:
- `http://localhost:7071/api/GetOverviewMetrics`
- `http://localhost:7071/api/GetErrorDeepDive`
- `http://localhost:7071/api/GetConcurrentLaunches`
- `http://localhost:7071/api/GetGeoBucketAnalysis?region=US East (Ashburn)`

### 5.5 API Endpoints Reference

#### GET /api/GetOverviewMetrics

Returns KPI aggregates for the dashboard overview page.

**Response:**
```json
{
  "totalInstances": 1247,
  "successRate": 94.3,
  "avgLatencyMs": 42.7,
  "activeLabsNow": 23,
  "totalErrors": 71,
  "errorRate": 5.7,
  "creationFailures": 12,
  "avgStartupDuration": 87.4,
  "statusBreakdown": [
    { "status": "Complete", "count": 892 },
    { "status": "Cancelled", "count": 198 },
    { "status": "Error", "count": 71 },
    { "status": "Running", "count": 23 }
  ],
  "launchesOverTime": [
    { "hour": "2026-05-30T00:00:00Z", "count": 45 },
    { "hour": "2026-05-30T01:00:00Z", "count": 38 }
  ]
}
```

#### GET /api/GetErrorDeepDive

**Query params:** `?days=7` (optional, default 7)

**Response:**
```json
{
  "errorRateByConsumer": [
    { "apiConsumer": "CompTIA LG - LabSim - Production", "totalInstances": 980, "totalErrors": 45, "errorRate": 4.59 },
    { "apiConsumer": "CompTIA KCTP", "totalInstances": 267, "totalErrors": 26, "errorRate": 9.74 }
  ],
  "errorsByType": [
    { "errorType": "Lab Creation Failed", "count": 12 },
    { "errorType": "VM Connection", "count": 8 }
  ],
  "errorTrend": [
    { "date": "2026-05-24", "errorCount": 9 },
    { "date": "2026-05-25", "errorCount": 14 }
  ],
  "recentErrors": [
    {
      "instanceId": 62142897,
      "labProfileName": "04.1.10 AWS: Live Lab: Managing Storage Resources",
      "errorMessage": "Error starting lab instance",
      "errorTimestamp": "2026-05-30T14:23:00Z",
      "apiConsumer": "CompTIA LG - LabSim - Production"
    }
  ],
  "thresholdBreached": true,
  "breachedConsumers": ["CompTIA KCTP"]
}
```

#### GET /api/GetConcurrentLaunches

**Query params:** `?hours=24` (optional, default 24)

**Response:**
```json
{
  "maxConcurrent": 7,
  "thresholdBreached": true,
  "windows": [
    { "windowStart": "2026-05-30T14:00:00Z", "windowEnd": "2026-05-30T14:05:00Z", "concurrentCount": 7, "region": "US East (Ashburn)" },
    { "windowStart": "2026-05-30T14:05:00Z", "windowEnd": "2026-05-30T14:10:00Z", "concurrentCount": 3, "region": "US East (Ashburn)" }
  ],
  "byRegion": [
    { "region": "US East (Ashburn)", "maxConcurrent": 7 },
    { "region": "EU North (London)", "maxConcurrent": 4 }
  ]
}
```

#### GET /api/GetGeoBucketAnalysis

**Query params:** `?region=all` (optional filter)

**Response:**
```json
{
  "regions": [
    {
      "region": "US East (Ashburn)",
      "totalLaunches": 456,
      "errorRate": 3.2,
      "avgLatency": 38.4,
      "topProfiles": [
        { "labProfileName": "Security+ SY0-701", "count": 89 }
      ]
    }
  ],
  "geoBuckets": [
    { "ipAddress": "102.218.46.65", "country": "South Africa", "region": "Mpumalanga", "launchCount": 12, "seriesName": "Cloud+" }
  ]
}
```

---

## 6. Phase 5 — React Dashboard

### 6.1 Create the React App

```bash
cd dashboard
npm install
```

Or if starting from scratch:

```bash
npx create-react-app dashboard
cd dashboard
npm install recharts @mui/material @mui/icons-material @emotion/react @emotion/styled axios react-router-dom
```

### 6.2 Component Architecture

```
App.jsx
├── Sidebar (navigation)
├── Routes
│   ├── /  → OverviewPage
│   │   ├── KpiCard × 4 (Total Launches, Success Rate, Avg Latency, Active Labs)
│   │   ├── ChartCard → LineChart (launches over time)
│   │   └── ChartCard → PieChart (status breakdown)
│   │
│   ├── /errors → ErrorDeepDivePage
│   │   ├── AlertBanner (if error rate > 2%)
│   │   ├── ChartCard → BarChart (error rate by consumer)
│   │   ├── ChartCard → LineChart (error trend)
│   │   └── DataTable (recent errors with search/filter)
│   │
│   ├── /concurrent → ConcurrentLaunchesPage
│   │   ├── KpiCard (max concurrent)
│   │   ├── AlertBanner (if > 4 concurrent)
│   │   ├── ChartCard → AreaChart (concurrent count over time)
│   │   └── DataTable (top windows)
│   │
│   └── /geo → GeoBucketsPage
│       ├── RegionSlicer (dropdown filter)
│       ├── KpiCard × 3 (total regions, top region, avg latency)
│       ├── ChartCard → BarChart (launches by region)
│       └── DataTable (geo bucket details)
```

### 6.3 Run Locally with SWA CLI

The SWA CLI lets you run the React app and Azure Functions together locally:

```bash
# From project root
swa start dashboard/build --api-location api

# Or for development with hot reload:
cd dashboard && npm start    # Terminal 1 — React on :3000
cd api && func start         # Terminal 2 — Functions on :7071
swa start http://localhost:3000 --api-devserver-url http://localhost:7071
```

### 6.4 Build for Production

```bash
cd dashboard
npm run build
```

This creates the `dashboard/build/` folder that Static Web Apps will serve.

---

## 7. Phase 6 — Deploy to Azure Static Web Apps

### 7.1 Create the Static Web App

**Option A — Azure CLI:**

```bash
az staticwebapp create \
  --name $SWA_NAME \
  --resource-group $RESOURCE_GROUP \
  --location "eastus2" \
  --sku Free \
  --source "https://github.com/YOUR_ORG/skillable-lab-dashboard-azure" \
  --branch main \
  --app-location "/dashboard" \
  --api-location "/api" \
  --output-location "build" \
  --token "YOUR_GITHUB_PAT"
```

**Option B — Azure Portal:**
1. Search "Static Web Apps" → Create
2. Select your subscription and resource group
3. Name: `swa-skillable-dashboard`
4. Plan: Free
5. Source: GitHub → authorize → select repo and branch
6. Build presets: React
7. App location: `/dashboard`
8. API location: `/api`
9. Output location: `build`

### 7.2 Configure Application Settings

The Functions API needs the SQL connection string. Set it in the Static Web App:

```bash
az staticwebapp appsettings set \
  --name $SWA_NAME \
  --resource-group $RESOURCE_GROUP \
  --setting-names \
    SQL_CONNECTION_STRING="Server=tcp:<server>.database.windows.net,1433;Database=SkillableLabTelemetry;User ID=sqladmin;Password=<password>;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
```

### 7.3 GitHub Actions CI/CD

The portal setup automatically creates a GitHub Actions workflow. Alternatively,
use the included `.github/workflows/deploy.yml` file.

The workflow:
1. Triggers on push to `main`
2. Builds the React app (`npm run build` in `/dashboard`)
3. Deploys static assets + API functions to Azure Static Web Apps
4. Creates preview environments for pull requests

### 7.4 Custom Domain (Optional)

```bash
# Add a custom domain
az staticwebapp hostname set \
  --name $SWA_NAME \
  --resource-group $RESOURCE_GROUP \
  --hostname "labdashboard.yourdomain.com"
```

Then add a CNAME record in your DNS provider pointing to the SWA default hostname.

### 7.5 Verify Deployment

1. Go to Azure Portal → Static Web Apps → your app
2. Click the **URL** (e.g., `https://happy-river-abc123.azurestaticapps.net`)
3. Verify all 4 dashboard pages load with data
4. Test API endpoints: `https://your-swa-url/api/GetOverviewMetrics`

---

## 8. Phase 7 — Monitoring & Maintenance

### 8.1 ADF Pipeline Monitoring

In ADF Studio → **Monitor** tab:
- View pipeline runs, success/failure status, duration
- Set up alerts: **Monitor** → **Alerts & metrics** → **+ New alert rule**
  - Metric: `PipelineFailedRuns`
  - Condition: Greater than 0
  - Action group: Email to your team

### 8.2 Weekly Data Cleanup

To match your current Office Script cleanup (Friday midnight EST), add a
**Stored Procedure Activity** in a separate ADF pipeline:

Pipeline: `pl_WeeklyDataPurge`
Trigger: **Schedule** — every Friday at `05:00 UTC` (midnight EST)

**Stored procedure:** `dbo.usp_CleanupOldData`

```sql
-- This deletes data older than 7 days (same as your current Excel purge)
EXEC dbo.usp_CleanupOldData @RetentionDays = 7;
```

### 8.3 Error Rate Alerts

Create a separate pipeline `pl_ErrorRateAlert` that runs every hour:

1. **Lookup Activity** → Execute `SELECT * FROM vw_ErrorRateByConsumer WHERE ErrorRate > 0.02`
2. **If Condition** → `@greater(activity('Lookup1').output.count, 0)`
3. **True branch** → **Web Activity** to send email via Logic App HTTP trigger or send to a Teams webhook

### 8.4 SQL Performance Monitoring

```bash
# Check database size
az sql db show \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER_NAME \
  --name $SQL_DB_NAME \
  --query "{size: currentSizeBytes, maxSize: maxSizeBytes}"
```

---

## 9. Troubleshooting

### ADF Pipeline Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `RestSourceCallFailed` | Skillable API down or rate limit | Check API status; increase retry delay |
| `SqlSinkWriteFailure` | SQL auth expired or table schema mismatch | Verify connection string; compare column types |
| `TimeoutError` | API response > 4 min (Logic Apps limit) | Reduce PageSize; add pagination |
| `InvalidTemplate` | ARM template syntax error | Validate with `az deployment group validate` |
| `ActivityRunFailed: Expression evaluation failed` | Bad dynamic expression | Debug expressions in ADF expression builder |

### SQL Connection Issues

| Error | Fix |
|-------|-----|
| `Cannot open server` | Check firewall rules — ensure Azure services are allowed |
| `Login failed for user` | Verify username/password; check if account is disabled |
| `Connection timeout` | Increase timeout in connection string to 60s |

### React Dashboard Issues

| Issue | Fix |
|-------|-----|
| API returns 404 | Ensure `staticwebapp.config.json` has correct API route |
| CORS error in dev | Use SWA CLI proxy (`swa start`) instead of direct fetch |
| Charts not rendering | Check API response format matches component expectations |
| Blank page on refresh | Ensure navigation fallback is set in `staticwebapp.config.json` |

### Functions Cold Start

Managed Functions in SWA Free tier may have cold starts of 5-10 seconds on first
request. This is normal. To mitigate:
- Add a loading spinner in the React components (already included)
- Consider Standard tier SWA ($9/mo) for better performance

---

## 10. Cost Summary

### Monthly Estimate (Your Workload: 4 runs/day, ~100-500 records/run)

| Resource | Tier | Monthly Cost |
|----------|------|-------------|
| Azure SQL Database | Free (32 GB) | **$0** |
| Azure Data Factory | Consumption | **~$2-5** |
| Azure Static Web Apps | Free | **$0** |
| Azure Functions (managed) | Included in SWA | **$0** |
| **Total** | | **~$2-5/month** |

### Cost Breakdown — ADF

| Component | Calculation | Cost |
|-----------|-------------|------|
| Orchestration | 4 runs × 30 days × ~8 activities = 960 runs/mo | ~$0.96 |
| Data Movement | 4 runs × ~3 min × 4 DIU = ~24 DIU-min/day | ~$0.60 |
| Pipeline Activities | Lookup + Set Variable + ForEach overhead | ~$0.10 |
| **ADF Total** | | **~$1.66** |

### When to Upgrade

| Trigger | Action | New Cost |
|---------|--------|----------|
| SQL Free tier too slow | Upgrade to Basic (5 DTU) | +$4.99/mo |
| Need custom auth / SLA | Upgrade SWA to Standard | +$9/mo |
| Data volume > 32 GB | Upgrade SQL to S0 (10 DTU, 250 GB) | +$15/mo |
| Need Data Flows transforms | Add ADF Data Flows (8 vCore min) | +$15-30/mo |

### Comparison with Current Stack

| Component | Current (Power Automate) | New (Azure) | Savings |
|-----------|-------------------------|-------------|---------|
| Data ingestion | PA Premium ~$15/mo | ADF ~$2-5/mo | ✅ ~$10 |
| Data storage | Excel on SharePoint | Azure SQL Free | ✅ No file locks |
| Dashboard | Power BI Pro ~$10/mo | React on SWA Free | ✅ $10 |
| API layer | PA HTTP connector | Azure Functions Free | ✅ No timeouts |
| **Total** | **~$25+/mo** | **~$2-5/mo** | **~$20/mo** |
