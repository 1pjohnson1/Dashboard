# Transform Pipeline Deployment Guide

## Overview
The **Transform pipeline** (`pl_SkillableDataIngestion_transform.json`) converts raw API data from `tblInstancesRaw` into normalized, queryable schema in `tblInstances` for dashboard and AI agent use.

## Two-Stage Pipeline Architecture

```
┌─────────────────────────────────────┐
│  Stage 1: Raw Ingest (5 min cycle)  │
├─────────────────────────────────────┤
│ • Call Skillable API (single call)  │
│ • Land ALL fields to tblInstancesRaw│
│ • Log RunId to tblPipelineRuns      │
│ • Truncate raw table before landing │
│ • FAIL FAST on network/API errors   │
└─────────────────────────────────────┘
                  ↓ on success
┌─────────────────────────────────────┐
│  Stage 2: Transform (after ingest)  │
├─────────────────────────────────────┤
│ • Check for successful RawIngest run│
│ • Read tblInstancesRaw              │
│ • Normalize to tblInstances schema  │
│ • Serialize JSON arrays             │
│ • Truncate/MERGE prior data         │
│ • Log RunId to tblPipelineRuns      │
│ • Ready for dashboard & AI queries  │
└─────────────────────────────────────┘
```

## Deployment Steps

### 1. Deploy SQL Infrastructure (One-time)

Run in order:
```sql
-- 1. Core schema
SQLCMD -S <server> -d <database> -i sql\schema.sql

-- 2. Staging table (raw ingest landing)
SQLCMD -S <server> -d <database> -i sql\staging.sql

-- 3. Distribution table (normalized output)
SQLCMD -S <server> -d <database> -i sql\distribution.sql

-- 4. Ops monitoring (views + procedures for dashboard & AI)
SQLCMD -S <server> -d <database> -i sql\tblInstances_OpsMonitor.sql
```

### 2. Create/Register Transform Pipeline in ADF

**Option A: Manual via Azure Portal**
1. Go to Azure Data Factory
2. Create new pipeline: `pl_SkillableDataIngestion_transform`
3. Paste contents of `pipeline/pl_SkillableDataIngestion_transform_config.json`
4. Publish

**Option B: ARM Template / CLI**
```bash
az datafactory pipeline create \
  --resource-group <rg> \
  --factory-name <adf-name> \
  --name pl_SkillableDataIngestion_transform \
  --pipeline @pipeline/pl_SkillableDataIngestion_transform_config.json
```

### 3. Verify Datasets
Confirm these datasets exist in ADF:
- `ds_SqlInstancesRaw` — landing zone (source for Transform)
- `ds_SqlInstances` — normalized output (sink for Transform)

### 4. Test the Flow

**Manual Test:**
1. Trigger `pl_SkillableDataIngestion_cli` (Raw Ingest)
   - Verify data lands in `tblInstancesRaw`
   - Check `tblPipelineRuns` for RawIngest Completed status
2. Trigger `pl_SkillableDataIngestion_transform` (Transform)
   - Verify data appears in `tblInstances`
   - Check `tblPipelineRuns` for Transform Completed status
3. Query dashboard views:
   ```sql
   SELECT * FROM dbo.vw_ActiveErrors;
   SELECT * FROM dbo.vw_DatacenterHealth;
   SELECT * FROM dbo.sp_GetLabProfileHealth NULL, 24;
   ```

**Scheduled Test:**
1. Create ADF Trigger to invoke Transform pipeline immediately after RawIngest succeeds
2. Monitor 1 full cycle (5 min ingest + transform)

## Key Configuration Details

### Transform Pipeline Dependencies
- **GetLatestRawIngestRun** — checks for prior successful run before proceeding
- **LogTransformStart** — records start time and pipeline run ID
- **CopyRawToNormalized** — main transform activity
  - SQL query selects and casts fields
  - Maps 60+ fields from raw → normalized
  - Serializes JSON arrays (Errors, ScriptResults, Notes, Sessions)
- **LogTransformComplete** — marks run as Completed in `tblPipelineRuns`

### Field Handling
- **Epoch integers** (Start, End, LastActivity, etc.) → passed through as BIGINT
  - SQL computed columns convert to DATETIME2 on read (no storage overhead)
- **Formatted strings** (*Time suffix) → passed through as NVARCHAR(50)
- **JSON arrays** (Errors, Notes, Sessions, etc.) → serialized to NVARCHAR(MAX)
  - Dashboard/AI queries parse with JSON_VALUE(), JSON_QUERY() as needed
- **Dropped fields** — excluded by SQL query (credentials, non-ops fields)

### Idempotency & Reruns
- Transform pipeline links to RawIngest via `PriorRunId` in `tblPipelineRuns`
- Each transform run reads ALL of `tblInstancesRaw` and re-populates `tblInstances`
- Safe to rerun transform after ingest (data is idempotent)
- 7-day purge (via `sp_PurgeExpiredInstances`) keeps data footprint small

## Monitoring & Troubleshooting

### Check Pipeline Runs
```sql
SELECT * FROM dbo.tblPipelineRuns
ORDER BY StartTime DESC;
```

### Monitor tblInstancesRaw (raw data)
```sql
SELECT COUNT(*) AS RawCount FROM dbo.tblInstancesRaw;
SELECT TOP 5 Id, LabProfileName, ErrorCount, StartDateTime 
FROM dbo.tblInstancesRaw;
```

### Monitor tblInstances (normalized data)
```sql
SELECT COUNT(*) AS NormalizedCount FROM dbo.tblInstances;
SELECT TOP 5 * FROM dbo.vw_RecentActivity;
```

### Debug Transform Failures
1. Check ADF pipeline run logs (execution details)
2. Query `tblPipelineRuns` for error message
3. Verify `tblInstancesRaw` has data (ingest succeeded)
4. Test SQL query manually (from Transform's source activity)

## Next Steps

1. **Deploy** SQL infrastructure (run scripts above)
2. **Test** raw ingest pipeline (`pl_SkillableDataIngestion_cli`)
3. **Create** Transform pipeline in ADF
4. **Run** manual end-to-end test
5. **Add** ADF trigger for automatic chaining (Transform starts when Ingest succeeds)
6. **Wire** dashboard React frontend to query `vw_*` views
7. **Integrate** AI agent with `sp_Get*` procedures

## Dashboard Integration (Next)

React dashboard should query views via Azure Functions:
```javascript
// Example: GetOverviewMetrics function
SELECT * FROM dbo.vw_DatacenterHealth;
SELECT * FROM dbo.vw_LabProfileHealth;
```

## AI Agent Integration (Next)

AI agent can invoke stored procedures:
```
Agent prompt: "Show me errors from the last 4 hours"
→ sp_GetActiveErrors @HoursBack = 4
→ Returns ErrorCount, Errors, ScriptResults, LabProfile, etc.
```

