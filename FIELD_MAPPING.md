# Field Mapping: Raw API → tblInstances Normalized Schema

## Overview
Raw ingest (`tblInstancesRaw`) lands all API fields as-is with `mapComplexValuesToString: true`.
Transform pipeline normalizes into `tblInstances` ops monitoring schema by:
1. Selecting fields to keep (dropping credential/sensitive fields)
2. Passing through simple scalar fields
3. Serializing complex objects to JSON strings
4. Retaining both epoch integers AND formatted time strings
5. Relying on computed columns in tblInstances for DateTime conversions

## Field Categories

### 1. Simple Scalar Passthrough (no transformation)
```
Id                      → Id
LabProfileId            → LabProfileId
LabProfileName          → LabProfileName
SeriesId                → SeriesId
SeriesName              → SeriesName
UserFirstName           → UserFirstName
UserLastName            → UserLastName
UserEmail               → UserEmail
InstructorName          → InstructorName
InstructorEmail         → InstructorEmail
Start                   → Start (epoch BIGINT)
End                     → End (epoch BIGINT)
LastActivity            → LastActivity (epoch BIGINT)
Expires                 → Expires (epoch BIGINT)
LastSave                → LastSave (epoch BIGINT)
SaveExpires             → SaveExpires (epoch BIGINT)
StartTime               → StartTime (formatted string)
EndTime                 → EndTime (formatted string)
LastActivityTime        → LastActivityTime (formatted string)
ExpiresTime             → ExpiresTime (formatted string)
LastSaveTime            → LastSaveTime (formatted string)
SaveExpiresTime         → SaveExpiresTime (formatted string)
State                   → State
CompletionStatus        → CompletionStatus
IpAddress               → IpAddress
Country                 → Country
Region                  → Region
City                     → City
Latitude                → Latitude
Longitude               → Longitude
DatacenterId            → DatacenterId
DatacenterName          → DatacenterName
DeliveryRegionId        → DeliveryRegionId
DeliveryRegionName      → DeliveryRegionName
LabHostId               → LabHostId
LabHostName             → LabHostName
PoolMemberName          → PoolMemberName
StartupDuration         → StartupDuration
EstimatedReadySeconds   → EstimatedReadySeconds
TotalRunTime            → TotalRunTime
TimeInSession           → TimeInSession
TimeRemaining           → TimeRemaining
ErrorCount              → ErrorCount
LastLatency             → LastLatency
IsExam                  → IsExam
ExamPassed              → ExamPassed
ExamScore               → ExamScore
ExamMaxPossibleScore    → ExamMaxPossibleScore
ExamPassingScore        → ExamPassingScore
TaskCompletePercent     → TaskCompletePercent
LastSaveTriggerType     → LastSaveTriggerType
BrowserUserAgent        → BrowserUserAgent
RemoteController        → RemoteController
Language                → Language
PlatformId              → PlatformId
ApiConsumerName         → ApiConsumerName
```

### 2. JSON Serialization (complex objects → NVARCHAR(MAX) JSON strings)
```
Errors                  → Errors (JSON array as string)
ScriptResults           → ScriptResults (JSON array as string)
Notes                   → Notes (JSON array as string)
Sessions                → Sessions (JSON array as string)
ActivityResults         → (NOT persisted — too large for ops view; child table in future)
ActivityGroupResults    → (NOT persisted — too large for ops view; child table in future)
```

### 3. Dropped Fields (sensitive or unused)
```
UserId                          (dropped — privacy)
ClassId, ClassName              (dropped — not needed for ops monitoring)
CloudCredentials                (dropped — sensitive)
CloudPlatformId                 (dropped — not applicable to ops)
CloudPortalCredentials          (dropped — sensitive)
VirtualMachineCredentials       (dropped — sensitive)
Skills                          (dropped — use SessionResults for ops)
Snapshots                       (dropped — use SessionResults for ops)
Products                        (dropped — use LabProfileName for ops)
PublicIpAddresses               (dropped — use IpAddress)
ExamScoredById                  (dropped — ops doesn't need scorer identity)
ExamScoredByName                (dropped — ops doesn't need scorer identity)
ExamScoredDate, ExamScoredTime  (kept in schema but not critical)
ExamDetails                     (dropped — too large, use Score + Pass status)
ExamCutoffScaledScore           (dropped — not ops relevant)
ExamMaxScaledScore              (dropped — not ops relevant)
ExamMaxPossibleRawScore         (dropped — not ops relevant)
ExamMinScaledScore              (dropped — not ops relevant)
ExamPassingRawScore             (dropped — not ops relevant)
ExamScaledScore                 (dropped — not ops relevant)
ClientUrl, DetailsUrl, MonitorUrl (dropped — frontend concerns)
InstructionsSetId               (dropped — not ops relevant)
Task, Exercise                  (dropped — too detailed for ops)
NumTasks, NumCompletedTasks     (dropped — use TaskCompletePercent)
PreinstanceStartTime            (dropped — not ops relevant)
Tag                             (dropped — not ops relevant)
HasContent                      (dropped — not ops relevant)
```

### 4. Notes on Complex Fields

**Errors**: API returns an array of error objects:
```json
[
  {
    "ErrorId": 123,
    "ErrorText": "Lab provisioning timeout",
    "Severity": "High",
    "Timestamp": "2026-06-15T12:34:56Z"
  }
]
```
→ Stored as JSON string; parsed by dashboard/queries as needed

**ScriptResults**: Automation results:
```json
[
  {
    "ScriptId": 1,
    "Score": 0,
    "Passed": false,
    "PlatformError": null,
    "ScriptError": null,
    "UiResponse": "Check failed"
  }
]
```

**Sessions**: Lab session state:
```json
[
  {
    "SessionId": "abc-123",
    "CreatedTime": "2026-06-15T12:00:00Z",
    "State": "Active"
  }
]
```

**Notes**: Lab notes / annotations (array of text strings or objects)

## ADF Transform Activity
The transform pipeline will use a **Lookup** (to read tblInstancesRaw) → **Copy** activity with:
- Source: tblInstancesRaw (all rows)
- Sink: tblInstances
- Translator mappings (simple field passthrough + JSON serialization via `mapComplexValuesToString: false` for the sink — data is already stringified from raw ingest)
- Post-copy: call `usp_LogPipelineRun` to mark transform as Complete

## Idempotency & Dependencies
- Transform pipeline waits for RawIngest `RunId` (via `usp_GetLatestRawIngestRun`)
- Transform deletes prior `tblInstances` rows for the same run window (or uses MERGE for upsert)
- After transform completes, tblInstances is ready for dashboard queries and AI agent procedures

