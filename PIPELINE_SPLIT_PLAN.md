# Dashboard Data Pipeline Split: Raw Ingest + Transform

## Objective
Split monolithic ADF pipeline into two stages for reliability and observability:
1. **Raw Ingest** (`pl_SkillableDataIngestion_cli.json`) — single API call, land raw JSON quickly
2. **Transform** (`pl_SkillableDataIngestion_transform.json`) — normalize and populate usable tables

## Current State
- `pl_SkillableDataIngestion_cli.json` — ingest + transform combined (monolithic)
- `pl_SkillableDataIngestion_new.json` — repurpose as transform pipeline
- Datasets:
  - `ds_SqlInstancesRaw` — raw JSON landing (new)
  - `ds_SqlInstances` — normalized output (to keep)
  - `ds_SqlActivities`, `ds_SqlErrors`, `ds_SqlGeoBuckets` — legacy or aggregated views (clarify)

## Plan

### Stage 1: Cleanup (Local + Remote)
1. **Archive `success/` folder** → Move to `.archive/Dashboard_success_state_<date>/` or tag in git
   - Preserves last known good state
   - Reduces clutter

2. **Track `.github/agents/`** → Add to git and push
   - Custom agent for lab workflow (already created)

3. **Clarify dataset usage**
   - Confirm `ds_SqlActivities`, `ds_SqlErrors`, `ds_SqlGeoBuckets` are consumed by which pipeline/view
   - If legacy, mark for removal

### Stage 2: Rename and Prepare Pipeline Split
1. **Rename** `pl_SkillableDataIngestion_new.json` → `pl_SkillableDataIngestion_transform.json`
2. **Configure transform pipeline** to:
   - Depend on successful completion of raw ingest
   - Read from `ds_SqlInstancesRaw`
   - Serialize raw JSON fields into usable normalized schema
   - Output to final tables (e.g., `ds_SqlInstances`, and any aggregated views)

### Stage 3: Handoff Contract (ADF Metadata)
Add to both pipelines:
- **Raw ingest outputs**: run_id, row_count, success_timestamp → SQL table `tblPipelineRuns`
- **Transform reads**: run_id from prior step, confirms dependencies
- **Idempotency**: Each transform run is keyed by run_id to prevent duplicates on reruns

### Stage 4: Testing
1. Verify raw ingest succeeds independently
2. Verify transform picks up raw data and completes
3. Confirm SWA frontend queries final tables correctly

## Files Changed
- `pipeline/pl_SkillableDataIngestion_new.json` → renamed to `pl_SkillableDataIngestion_transform.json`
- `sql/staging.sql` — add `tblPipelineRuns` for handoff tracking
- `.github/agents/` — commit and push
- `success/` — archive or remove

## Next: Transformation Specs
To finalize the transform pipeline, provide:
1. **Raw data sample** — example JSON from API (the actual shape in `tblInstancesRaw`)
2. **Target schema** — SQL schema for normalized output (what columns, types, constraints)
3. **Mapping rules** — how each raw field maps to normalized columns (esp. nested arrays/objects)
4. **Business logic** — any calculated fields, filtering, or aggregations

