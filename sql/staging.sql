-- =============================================================================
-- Skillable Lab Telemetry Dashboard — RAW STAGING TABLE
-- Author: Penelope Johnson, Director — Lab Development
-- Date: June 2026
-- Target: Azure SQL Database
--
-- PURPOSE
--   tblInstancesRaw is the "accept-all" landing zone for the Skillable
--   labinstance/search (mode=10) API. The ADF data service stays DUMB and FAST:
--   it does a plain column-mapped INSERT of every page, with NO per-row stored
--   procedure and NO transformation, so it is immune to per-row timeouts.
--
--   It is a TRANSIENT buffer: the pipeline TRUNCATEs it at the start of every
--   run, lands all pages, then a set-based distribute step MERGEs the data into
--   the curated tables (tblInstances) and shreds the nested JSON arrays into the
--   child tables (tblErrors, tblActivities) and rebuilds tblGeoBuckets.
--
-- TIMESTAMPS
--   The API returns BOTH epoch integers (Start, End, Expires, ...) and formatted
--   strings (StartTime, EndTime, ...). We store the epoch integers and let SQL
--   compute DATETIME2 via DATEADD. The string variants are retained verbatim for
--   reference. The only epoch that drives the dashboard "Refresh" indicator is
--   the API-call WINDOW (StartEpoch/EndEpoch parameters) written to
--   tblRefreshLog — that is a separate concern and is untouched here.
--
-- TYPE NOTES (from the live API contract)
--   * ClassId   is string|null in the API (NOT int) -> NVARCHAR.
--   * ErrorCount is string in the API               -> stored NVARCHAR, cast
--                                                       to INT during distribute.
--   * Id        is int64 in the API; kept INT here to match the curated schema
--                and existing foreign keys.
-- =============================================================================

IF OBJECT_ID(N'dbo.tblInstancesRaw', N'U') IS NOT NULL
    DROP TABLE dbo.tblInstancesRaw;
GO

CREATE TABLE dbo.tblInstancesRaw
(
    -- ── IDENTITY ────────────────────────────────────────────────────────────
    Id                          INT             NULL,   -- API: Id (int64)

    -- ── LAB PROFILE / SERIES ──────────────────────────────────────────────────
    LabProfileId                INT             NULL,
    LabProfileName              NVARCHAR(500)   NULL,
    SeriesId                    INT             NULL,
    SeriesName                  NVARCHAR(500)   NULL,

    -- ── USER ──────────────────────────────────────────────────────────────────
    UserId                      NVARCHAR(255)   NULL,
    UserFirstName               NVARCHAR(255)   NULL,
    UserLastName                NVARCHAR(255)   NULL,
    UserEmail                   NVARCHAR(320)   NULL,

    -- ── CLASS / INSTRUCTOR ─────────────────────────────────────────────────────
    ClassId                     NVARCHAR(255)   NULL,   -- API: string|null
    ClassName                   NVARCHAR(500)   NULL,
    InstructorId                NVARCHAR(255)   NULL,
    InstructorName              NVARCHAR(255)   NULL,
    InstructorEmail             NVARCHAR(320)   NULL,

    -- ── TIMESTAMPS: EPOCH INTEGERS (seconds since 1970-01-01) ──────────────────
    PreinstanceStartTime        BIGINT          NULL,
    [Start]                     BIGINT          NULL,
    [End]                       BIGINT          NULL,
    LastActivity                BIGINT          NULL,
    Expires                     BIGINT          NULL,
    LastSave                    BIGINT          NULL,
    SaveExpires                 BIGINT          NULL,
    ExamScoredDate              BIGINT          NULL,

    -- ── TIMESTAMPS: FORMATTED STRINGS (retained verbatim from API) ─────────────
    StartTime                   NVARCHAR(50)    NULL,
    EndTime                     NVARCHAR(50)    NULL,
    LastActivityTime            NVARCHAR(50)    NULL,
    ExpiresTime                 NVARCHAR(50)    NULL,
    LastSaveTime                NVARCHAR(50)    NULL,
    SaveExpiresTime             NVARCHAR(50)    NULL,
    ExamScoredTime              NVARCHAR(50)    NULL,

    -- ── TIMESTAMPS: COMPUTED DATETIME2 (derived from epoch columns) ────────────
    StartDateTime               AS (CASE WHEN [Start]        IS NOT NULL THEN DATEADD(SECOND, [Start],        '1970-01-01T00:00:00') END),
    EndDateTime                 AS (CASE WHEN [End]          IS NOT NULL THEN DATEADD(SECOND, [End],          '1970-01-01T00:00:00') END),
    LastActivityDateTime        AS (CASE WHEN LastActivity   IS NOT NULL THEN DATEADD(SECOND, LastActivity,   '1970-01-01T00:00:00') END),
    ExpirationDateTime          AS (CASE WHEN Expires        IS NOT NULL THEN DATEADD(SECOND, Expires,        '1970-01-01T00:00:00') END),
    LastSaveDateTime            AS (CASE WHEN LastSave       IS NOT NULL THEN DATEADD(SECOND, LastSave,       '1970-01-01T00:00:00') END),
    SaveExpiresDateTime         AS (CASE WHEN SaveExpires    IS NOT NULL THEN DATEADD(SECOND, SaveExpires,    '1970-01-01T00:00:00') END),

    -- ── STATE / STATUS ─────────────────────────────────────────────────────────
    [State]                     NVARCHAR(50)    NULL,
    CompletionStatus            NVARCHAR(50)    NULL,
    LastSaveTriggerType         NVARCHAR(50)    NULL,

    -- ── HOST / DATACENTER / DELIVERY ───────────────────────────────────────────
    PoolMemberName              NVARCHAR(255)   NULL,
    LabHostId                   INT             NULL,
    LabHostName                 NVARCHAR(255)   NULL,
    DatacenterId                INT             NULL,
    DatacenterName              NVARCHAR(255)   NULL,
    DeliveryRegionId            INT             NULL,
    DeliveryRegionName          NVARCHAR(255)   NULL,
    PlatformId                  INT             NULL,
    CloudPlatformId             INT             NULL,

    -- ── PERFORMANCE / TIMING METRICS ───────────────────────────────────────────
    TimeInSession               INT             NULL,
    TotalRunTime                INT             NULL,
    TimeRemaining               INT             NULL,
    StartupDuration             INT             NULL,
    EstimatedReadySeconds       INT             NULL,
    LastLatency                 INT             NULL,
    ErrorCount                  NVARCHAR(20)    NULL,   -- API: string; cast to INT downstream

    -- ── CONTENT / PROGRESS ─────────────────────────────────────────────────────
    HasContent                  BIT             NULL,
    Task                        NVARCHAR(500)   NULL,
    Exercise                    NVARCHAR(500)   NULL,
    NumTasks                    INT             NULL,
    NumCompletedTasks           INT             NULL,
    TaskCompletePercent         FLOAT           NULL,

    -- ── EXAM / SCORING ─────────────────────────────────────────────────────────
    IsExam                      BIT             NULL,
    ExamPassed                  BIT             NULL,
    ExamScore                   FLOAT           NULL,
    ExamMaxPossibleScore        FLOAT           NULL,
    ExamPassingScore            FLOAT           NULL,
    ExamScoredById              BIGINT          NULL,
    ExamScoredByName            NVARCHAR(255)   NULL,
    ExamDetails                 NVARCHAR(MAX)   NULL,
    ExamScaledScore             FLOAT           NULL,
    ExamPassingRawScore         FLOAT           NULL,
    ExamMaxPossibleRawScore     FLOAT           NULL,
    ExamMinScaledScore          FLOAT           NULL,
    ExamMaxScaledScore          FLOAT           NULL,
    ExamCutoffScaledScore       FLOAT           NULL,

    -- ── GEOLOCATION ────────────────────────────────────────────────────────────
    IpAddress                   NVARCHAR(50)    NULL,
    Country                     NVARCHAR(100)   NULL,
    Region                      NVARCHAR(100)   NULL,
    City                        NVARCHAR(100)   NULL,
    Latitude                    FLOAT           NULL,
    Longitude                   FLOAT           NULL,

    -- ── MISC / DEPRECATED / INSTRUCTIONS ───────────────────────────────────────
    MonitorUrl                  NVARCHAR(MAX)   NULL,   -- deprecated (always null)
    DetailsUrl                  NVARCHAR(MAX)   NULL,
    ClientUrl                   NVARCHAR(MAX)   NULL,   -- deprecated (always null)
    RemoteController            NVARCHAR(255)   NULL,
    Tag                         NVARCHAR(MAX)   NULL,
    BrowserUserAgent            NVARCHAR(1000)  NULL,
    InstructionsSetId           NVARCHAR(100)   NULL,   -- API: InstructionsSetId
    [Language]                  NVARCHAR(20)    NULL,   -- API: Language

    -- ── API / CONSUMER ─────────────────────────────────────────────────────────
    -- NOTE: the API "Status" (0=Error, 1=Success) and "Error" fields are
    -- RESPONSE-ENVELOPE level (siblings of "Results"), not per-instance, so they
    -- are not landed here. The pipeline already guards bad responses via the
    -- EnsureFirstPage Until loop.
    ApiConsumer                 NVARCHAR(255)   NULL,   -- API: ApiConsumerName

    -- ── NESTED ARRAYS / OBJECTS (stored as JSON; shredded downstream) ──────────
    Errors                      NVARCHAR(MAX)   NULL,   -- -> tblErrors
    ActivityResults             NVARCHAR(MAX)   NULL,   -- -> tblActivities
    ActivityGroupResults        NVARCHAR(MAX)   NULL,   -- -> tblActivities
    Skills                      NVARCHAR(MAX)   NULL,   -- lab-profile metadata (kept as-is)
    Products                    NVARCHAR(MAX)   NULL,
    Sessions                    NVARCHAR(MAX)   NULL,
    Snapshots                   NVARCHAR(MAX)   NULL,
    Notes                       NVARCHAR(MAX)   NULL,
    PublicIpAddresses           NVARCHAR(MAX)   NULL,
    CloudCredentials            NVARCHAR(MAX)   NULL,
    CloudPortalCredentials      NVARCHAR(MAX)   NULL,
    VirtualMachineCredentials   NVARCHAR(MAX)   NULL,

    -- ── ETL METADATA ───────────────────────────────────────────────────────────
    IngestedAt                  DATETIME2(3)    NOT NULL
        CONSTRAINT DF_tblInstancesRaw_IngestedAt DEFAULT (SYSUTCDATETIME())
);
GO

-- Non-unique index on Id to speed the distribute MERGE. No PK / FK here: the
-- distribute step de-duplicates (latest IngestedAt per Id) so the landing step
-- can stay dumb and tolerate duplicate rows across pages or re-runs.
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_tblInstancesRaw_Id')
    CREATE NONCLUSTERED INDEX IX_tblInstancesRaw_Id
        ON dbo.tblInstancesRaw (Id);
GO

PRINT 'tblInstancesRaw staging table deployed.';
GO
