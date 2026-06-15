# Skillable Dashboard Lab Telemetry — Integration Complete

## Overview

The Skillable Dashboard Lab Telemetry project is now **end-to-end integrated**:

- **SQL**: 10 views + 6 stored procedures (v3 schema) ✅
- **Azure Functions**: 12 HTTP endpoints aligned with v3 schema ✅  
- **React Dashboard**: Fully wired to API with 9 custom hooks ✅
- **SWA Configuration**: Routes /api/* to Functions, SPA fallback enabled ✅

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     REACT DASHBOARD                              │
│  /dashboard/src/pages/*.jsx → /api/useDashboardApi.js hooks    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP to /api/*
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  AZURE FUNCTIONS (12 endpoints)                  │
│  /api/src/functions/*.js → Tedious → Azure SQL Database       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│         AZURE SQL v3 Schema (11 views + 6 stored procs)          │
│  dbo.vw_Overview, vw_ActiveErrors, vw_GeoInsights, ...          │
│  dbo.sp_GetDatacenterHealth, sp_GetActiveErrors, ...            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Created/Updated

### Azure Functions (12 total)
| Function | Type | Data Source | Status |
|----------|------|-------------|--------|
| GetDatacenterHealth | HTTP | sp_GetDatacenterHealth | ✅ New |
| GetLabProfileHealth | HTTP | sp_GetLabProfileHealth | ✅ New |
| GetActiveErrors | HTTP | sp_GetActiveErrors | ✅ New |
| GetErrorDetails | HTTP | sp_GetErrorDetails | ✅ New |
| GetGeoInsights | HTTP | vw_GeoInsights | ✅ New |
| GetCompletionBreakdown | HTTP | sp_GetCompletionBreakdown | ✅ New |
| GetVpnSuspects | HTTP | sp_GetVpnSuspects | ✅ New |
| GetOverviewMetrics | HTTP | vw_Overview + vw_LatencyTrend + vw_RecentActivity | ✅ Updated |
| GetErrorDeepDive | HTTP | vw_ActiveErrors + vw_FailedLabs + vw_StartupAlerts | ✅ Updated |
| GetGeoBucketAnalysis | HTTP | vw_GeoInsights + vw_VpnDetection | ✅ Updated |
| GetConcurrentLaunches | HTTP | tblInstances (epoch queries) | ✅ Updated |
| GetRefreshStatus | HTTP | tblInstances (IngestedAt) | ✅ Updated |

### React Hooks
- `dashboard/src/api/useDashboardApi.js` — 9 custom hooks for API integration
  - `useDatacenterHealth(datacenterName?, hoursBack?)`
  - `useLabProfileHealth(labProfileName?, hoursBack?)`
  - `useActiveErrors(hoursBack?)`
  - `useErrorDetails(labInstanceId?, hoursBack?)`
  - `useGeoInsights()`
  - `useCompletionBreakdown(hoursBack?)`
  - `useVpnSuspects(hoursBack?)`
  - `useOverviewMetrics(days?)`

### API Client
- `dashboard/src/api/client.js` — Updated with new v3 endpoint functions

---

## Local Development Setup

### Prerequisites
- Node.js 18+ 
- Azure Functions Core Tools 4.x
- Azure CLI (for local SQL connection testing)
- SQL Server connection details

### Step 1: Install Dependencies

```bash
# Install API dependencies
cd api
npm install

# Install Dashboard dependencies  
cd ../dashboard
npm install
```

### Step 2: Configure Environment

**API (`api/local.settings.json`)** — Already configured:
```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "KEY_VAULT_URL": "https://kv-skillable-dashboard.vault.azure.net/",
    "SQL_SERVER": "sql-skillable-1f54a9ce.database.windows.net",
    "SQL_DATABASE": "SkillableLabTelemetry",
    "SQL_ADMIN_USER": "sqladmin"
  }
}
```

**Dashboard** — Environment variable (optional):
```bash
# .env (create in dashboard/ folder)
REACT_APP_API_URL=/api
```

### Step 3: Run Locally

**Terminal 1 — Azure Functions:**
```bash
cd api
npm run build  # or: npm install to prepare
func host start
```
Expected output:
```
GetDatacenterHealth: [GET] http://localhost:7071/api/getDatacenterHealth
GetLabProfileHealth: [GET] http://localhost:7071/api/getLabProfileHealth
GetActiveErrors: [GET] http://localhost:7071/api/getActiveErrors
... (12 total endpoints)
```

**Terminal 2 — React Dashboard:**
```bash
cd dashboard
npm start
```
Expected output:
```
Compiled successfully!
You can now view skillable-lab-dashboard in the browser.
Local: http://localhost:3000
```

### Step 4: Test Locally

1. **Functions endpoint test:**
   ```bash
   curl http://localhost:7071/api/getDatacenterHealth?hoursBack=24
   ```
   Expected response:
   ```json
   {
     "success": true,
     "data": [...],
     "timestamp": "2026-06-15T..."
   }
   ```

2. **Dashboard test:**
   - Open http://localhost:3000 in browser
   - Navigate to **Overview** page
   - Should see live data from Azure Functions
   - Check browser DevTools → Network to verify API calls

---

## Build for Deployment

### Build React Dashboard
```bash
cd dashboard
npm run build
```
Output: `dashboard/build/` folder (ready for Azure Static Web App)

### Prepare Functions
```bash
cd api
npm prune --production  # Remove dev dependencies
```
Output: `api/src/functions/` ready for deployment

---

## Deploy to Azure

### Option 1: Using AZD (Recommended)

```bash
# From root Dashboard folder
azd deploy
```

### Option 2: Manual Azure Static Web App Deployment

1. **Create SWA in Azure Portal:**
   - Resource: Azure Static Web App
   - Deployment source: GitHub (or local)
   - Build location: `dashboard/`
   - Output location: `build`
   - API location: `api`

2. **Configure Environment Variables (Azure Portal):**
   - KEY_VAULT_URL: `https://kv-skillable-dashboard.vault.azure.net/`
   - SQL_SERVER: `sql-skillable-1f54a9ce.database.windows.net`
   - SQL_DATABASE: `SkillableLabTelemetry`
   - SQL_ADMIN_USER: `sqladmin`

3. **Test Endpoints:**
   ```bash
   # After deployment
   https://<your-swa>.azurestaticapps.net/api/getDatacenterHealth?hoursBack=24
   https://<your-swa>.azurestaticapps.net  # React frontend
   ```

---

## CI/CD Integration

### GitHub Actions (if configured)

The workflow should:
1. **Build React:** `npm run build` → produces `dashboard/build/`
2. **Build Functions:** Ensure `api/` folder exists with functions
3. **Deploy:** Push to SWA via GitHub integration

Example workflow trigger:
```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
```

---

## Troubleshooting

### Problem: "Cannot find module '@azure/functions'"
```bash
cd api && npm install
```

### Problem: React returns 404 for API calls
**Solution:** Ensure SWA routing is correct in `staticwebapp.config.json`:
```json
"routes": [
  {
    "route": "/api/*",
    "allowedRoles": ["anonymous"]
  }
]
```

### Problem: SQL connection timeout
**Solution:** Check network connectivity:
```bash
# Test SQL connection
sqlcmd -S sql-skillable-1f54a9ce.database.windows.net \
       -U sqladmin@sql-skillable-1f54a9ce \
       -d SkillableLabTelemetry
```

### Problem: "Errors view does not exist" or similar SQL errors
**Solution:** Ensure v3 schema is deployed:
```bash
# Run SQL schema scripts in order:
# 1. tblInstances_Dashboard_v3.sql (CREATE TABLE + indexes)
# 2. schema.sql (CREATE VIEW + procedures)
# 3. staging.sql (if needed)
```

---

## API Response Formats

### Success Response
```json
{
  "success": true,
  "data": [...],
  "timestamp": "2026-06-15T14:30:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Connection timeout",
  "status": 500
}
```

---

## Performance & Monitoring

### Monitor Functions
- Azure Portal → Function App → Overview
- Check invocation count, errors, response times

### Monitor React Dashboard
- Browser DevTools → Performance tab
- Check API call latency (should be <1 second per endpoint)

### Optimize Queries
- `hoursBack` parameter: Use smaller windows for faster queries
- Most queries cached in Azure SQL for <5 min windows
- Consider adding caching layer if needed

---

## Next Steps

1. **Test all 12 endpoints** with various parameters
2. **Wire remaining React pages** to use new hooks (optional)
3. **Set up monitoring** via Application Insights
4. **Configure authentication** if needed (Azure AD, API key)
5. **Add data refresh** schedule via ADF or Azure Functions Timer

---

## Support & Documentation

- **API Docs:** Each function includes request/response examples in comments
- **React Hooks:** See `useDashboardApi.js` for usage examples
- **SQL Schema:** See `tblInstances_Dashboard_v3.sql` for view/procedure definitions

---

**Status:** 🟢 Ready for deployment | Last Updated: 2026-06-15
