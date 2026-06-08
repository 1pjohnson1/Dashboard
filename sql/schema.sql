-- =============================================================================
-- Skillable Lab Telemetry Dashboard — SQL Schema
-- Author: Penelope Johnson, Director — Lab Development
-- Date: May 2026
-- Target: Azure SQL Database (Free / Basic tier)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: tblInstances
-- One row per lab instance. InstanceId comes from Skillable API (not identity).
-- ─────────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tblInstances')
CREATE TABLE dbo.tblInstances (
    InstanceId          INT             NOT NULL,
    LabProfileId        INT             NOT NULL,
    LabProfileName      NVARCHAR(500)   NOT NULL,
    SeriesId            INT             NULL,
    SeriesName          NVARCHAR(255)   NULL,
    UserId              NVARCHAR(100)   NULL,
    UserFirstName       NVARCHAR(100)   NULL,
    UserLastName        NVARCHAR(100)   NULL,
    UserEmail           NVARCHAR(255)   NULL,
    ClassId             INT             NULL,
    StartEpoch          BIGINT          NOT NULL,
    EndEpoch            BIGINT          NULL,
    LastActivityEpoch   BIGINT          NULL,
    ExpirationEpoch     BIGINT          NULL,
    StartDateTime AS DATEADD(SECOND, StartEpoch, CONVERT(DATETIME, '19700101', 112)) PERSISTED,
    EndDateTime         AS CASE WHEN EndEpoch IS NOT NULL
                        THEN DATEADD(SECOND, EndEpoch, CONVERT(DATETIME, '19700101', 112))
                        ELSE NULL END PERSISTED,
    State               NVARCHAR(50)    NOT NULL,
    CompletionStatus    NVARCHAR(50)    NULL,
    IpAddress           NVARCHAR(50)    NULL,
    Country             NVARCHAR(100)   NULL,
    Region              NVARCHAR(100)   NULL,
    City                NVARCHAR(100)   NULL,
    Latitude            FLOAT           NULL,
    Longitude           FLOAT           NULL,
    DatacenterId        INT             NULL,
    DatacenterName      NVARCHAR(255)   NULL,
    LabHostId           INT             NULL,
    LabHostName         NVARCHAR(255)   NULL,
    DeliveryRegionName  NVARCHAR(255)   NULL,
    LastLatency         INT             NULL,
    ErrorCount          INT             NOT NULL DEFAULT 0,
    StartupDuration     INT             NULL,
    TotalRunTime        INT             NULL,
    TimeInSession       INT             NULL,
    TaskCompletePercent FLOAT           NULL,
    ExamPassed          BIT             NULL,
    ExamScore           FLOAT           NULL,
    IsExam              BIT             NULL,
    PlatformId          INT             NULL,
    ApiConsumer         NVARCHAR(255)   NULL,
    IngestTimestamp     DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_tblInstances PRIMARY KEY CLUSTERED (InstanceId)
);
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: tblErrors
-- One row per error event. Append-only — no updates.
-- ─────────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tblErrors')
CREATE TABLE dbo.tblErrors (
    ErrorId             INT             IDENTITY(1,1) NOT NULL,
    InstanceId          INT             NOT NULL,
    ErrorType           NVARCHAR(255)   NOT NULL,
    ErrorMessage        NVARCHAR(MAX)   NULL,
    ErrorTimestamp      DATETIME2(3)    NULL,
    ApiConsumer         NVARCHAR(255)   NULL,
    LabProfileId        INT             NULL,
    LabProfileName      NVARCHAR(500)   NULL,
    SeriesId            INT             NULL,
    SeriesName          NVARCHAR(255)   NULL,
    DatacenterName      NVARCHAR(255)   NULL,
    LabHostName         NVARCHAR(255)   NULL,
    IngestTimestamp     DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_tblErrors PRIMARY KEY CLUSTERED (ErrorId),
    CONSTRAINT FK_tblErrors_InstanceId FOREIGN KEY (InstanceId) REFERENCES dbo.tblInstances(InstanceId)
);
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: tblActivities
-- One row per scored activity result within a lab instance.
-- ─────────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tblActivities')
CREATE TABLE dbo.tblActivities (
    ActivityId          INT             IDENTITY(1,1) NOT NULL,
    InstanceId          INT             NOT NULL,
    ActivityName        NVARCHAR(500)   NOT NULL,
    ActivityType        NVARCHAR(100)   NULL,
    Score               FLOAT           NULL,
    PossibleScore       FLOAT           NULL,
    PassStatus          NVARCHAR(50)    NULL,
    Duration            INT             NULL,
    IngestTimestamp     DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_tblActivities PRIMARY KEY CLUSTERED (ActivityId),
    CONSTRAINT FK_tblActivities_InstanceId FOREIGN KEY (InstanceId) REFERENCES dbo.tblInstances(InstanceId)
);
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: tblGeoBuckets
-- Aggregated launch counts by IP + time window for concurrent launch detection.
-- ─────────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tblGeoBuckets')
CREATE TABLE dbo.tblGeoBuckets (
    BucketId            INT             IDENTITY(1,1) NOT NULL,
    IpAddress           NVARCHAR(50)    NOT NULL,
    Country             NVARCHAR(100)   NULL,
    Region              NVARCHAR(100)   NULL,
    City                NVARCHAR(100)   NULL,
    DeliveryRegionName  NVARCHAR(255)   NULL,
    InstanceCount       INT             NOT NULL DEFAULT 0,
    SeriesId            INT             NULL,
    SeriesName          NVARCHAR(255)   NULL,
    BucketWindowStart   DATETIME2(3)    NOT NULL,
    BucketWindowEnd     DATETIME2(3)    NOT NULL,
    IngestTimestamp     DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_tblGeoBuckets PRIMARY KEY CLUSTERED (BucketId)
);
GO

-- =============================================================================
-- INDEXES
-- =============================================================================

-- tblInstances indexes
CREATE NONCLUSTERED INDEX IX_tblInstances_State
    ON dbo.tblInstances (State) INCLUDE (CompletionStatus, ErrorCount);

CREATE NONCLUSTERED INDEX IX_tblInstances_StartEpoch
    ON dbo.tblInstances (StartEpoch DESC)
    INCLUDE (LabProfileId, SeriesId, State, CompletionStatus, ErrorCount);

CREATE NONCLUSTERED INDEX IX_tblInstances_DeliveryRegion
    ON dbo.tblInstances (DeliveryRegionName)
    INCLUDE (ErrorCount, LastLatency, StartEpoch);

CREATE NONCLUSTERED INDEX IX_tblInstances_ApiConsumer
    ON dbo.tblInstances (ApiConsumer)
    INCLUDE (ErrorCount, StartEpoch);

CREATE NONCLUSTERED INDEX IX_tblInstances_IngestTimestamp
    ON dbo.tblInstances (IngestTimestamp DESC);

CREATE NONCLUSTERED INDEX IX_tblInstances_StartDateTime
    ON dbo.tblInstances (StartDateTime DESC)
    INCLUDE (DeliveryRegionName, IpAddress, Country);

CREATE NONCLUSTERED INDEX IX_tblInstances_DatacenterName
    ON dbo.tblInstances (DatacenterName)
    INCLUDE (ErrorCount, LabHostName);

-- tblErrors indexes
CREATE NONCLUSTERED INDEX IX_tblErrors_InstanceId
    ON dbo.tblErrors (InstanceId);

CREATE NONCLUSTERED INDEX IX_tblErrors_ApiConsumer
    ON dbo.tblErrors (ApiConsumer)
    INCLUDE (ErrorType, IngestTimestamp);

CREATE NONCLUSTERED INDEX IX_tblErrors_IngestTimestamp
    ON dbo.tblErrors (IngestTimestamp DESC);

CREATE NONCLUSTERED INDEX IX_tblErrors_ErrorType
    ON dbo.tblErrors (ErrorType)
    INCLUDE (InstanceId, ApiConsumer);

-- tblActivities indexes
CREATE NONCLUSTERED INDEX IX_tblActivities_InstanceId
    ON dbo.tblActivities (InstanceId);

CREATE NONCLUSTERED INDEX IX_tblActivities_IngestTimestamp
    ON dbo.tblActivities (IngestTimestamp DESC);

-- tblGeoBuckets indexes
CREATE NONCLUSTERED INDEX IX_tblGeoBuckets_Region
    ON dbo.tblGeoBuckets (DeliveryRegionName)
    INCLUDE (InstanceCount, BucketWindowStart);

CREATE NONCLUSTERED INDEX IX_tblGeoBuckets_BucketWindow
    ON dbo.tblGeoBuckets (BucketWindowStart DESC)
    INCLUDE (IpAddress, InstanceCount, DeliveryRegionName);

CREATE NONCLUSTERED INDEX IX_tblGeoBuckets_IngestTimestamp
    ON dbo.tblGeoBuckets (IngestTimestamp DESC);
GO

-- =============================================================================
-- TABLE-VALUED PARAMETER TYPES
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TYPE: InstanceTableType
-- Table-valued parameter type consumed by usp_UpsertInstance.
-- Referenced by ADF Copy Activity sink (sqlWriterTableType = dbo.InstanceTableType,
-- storedProcedureTableTypeParameterName = InstanceData).
-- Excludes computed columns (StartDateTime, EndDateTime) and server-default
-- column (IngestTimestamp) — those are derived or set by the proc/server.
-- ─────────────────────────────────────────────────────────────────────────────
IF TYPE_ID(N'dbo.InstanceTableType') IS NULL
    EXEC (N'
    CREATE TYPE dbo.InstanceTableType AS TABLE (
        InstanceId          INT             NOT NULL,
        LabProfileId        INT             NOT NULL,
        LabProfileName      NVARCHAR(500)   NOT NULL,
        SeriesId            INT             NULL,
        SeriesName          NVARCHAR(255)   NULL,
        UserId              NVARCHAR(100)   NULL,
        UserFirstName       NVARCHAR(100)   NULL,
        UserLastName        NVARCHAR(100)   NULL,
        UserEmail           NVARCHAR(255)   NULL,
        ClassId             INT             NULL,
        StartEpoch          BIGINT          NULL,
        EndEpoch            BIGINT          NULL,
        LastActivityEpoch   BIGINT          NULL,
        ExpirationEpoch     BIGINT          NULL,
        State               NVARCHAR(50)    NULL,
        CompletionStatus    NVARCHAR(50)    NULL,
        IpAddress           NVARCHAR(50)    NULL,
        Country             NVARCHAR(100)   NULL,
        Region              NVARCHAR(100)   NULL,
        City                NVARCHAR(100)   NULL,
        Latitude            FLOAT           NULL,
        Longitude           FLOAT           NULL,
        DatacenterId        INT             NULL,
        DatacenterName      NVARCHAR(255)   NULL,
        LabHostId           INT             NULL,
        LabHostName         NVARCHAR(255)   NULL,
        DeliveryRegionName  NVARCHAR(255)   NULL,
        LastLatency         INT             NULL,
        ErrorCount          INT             NULL,
        StartupDuration     INT             NULL,
        TotalRunTime        INT             NULL,
        TimeInSession       INT             NULL,
        TaskCompletePercent FLOAT           NULL,
        ExamPassed          BIT             NULL,
        ExamScore           FLOAT           NULL,
        IsExam              BIT             NULL,
        PlatformId          INT             NULL,
        ApiConsumer         NVARCHAR(255)   NULL
    )');
GO

-- =============================================================================
-- VIEWS
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW: vw_OverviewMetrics
-- Returns KPI aggregates for the Overview & Health dashboard page.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER VIEW dbo.vw_OverviewMetrics
AS
SELECT
    COUNT(*)                                                        AS TotalInstances,
    SUM(CASE WHEN CompletionStatus = 'Complete' THEN 1 ELSE 0 END) AS CompletedInstances,
    CAST(
        CASE WHEN COUNT(*) > 0
            THEN (SUM(CASE WHEN CompletionStatus = 'Complete' THEN 1.0 ELSE 0.0 END) / COUNT(*)) * 100
            ELSE 0
        END AS DECIMAL(5,2)
    )                                                               AS SuccessRate,
    CAST(AVG(CAST(LastLatency AS FLOAT)) AS DECIMAL(10,2))         AS AvgLatencyMs,
    SUM(CASE WHEN State IN ('Running', 'Building', 'Starting')
             THEN 1 ELSE 0 END)                                    AS ActiveLabsNow,
    SUM(ErrorCount)                                                 AS TotalErrors,
    CAST(
        CASE WHEN COUNT(*) > 0
            THEN (SUM(CASE WHEN ErrorCount > 0 THEN 1.0 ELSE 0.0 END) / COUNT(*)) * 100
            ELSE 0
        END AS DECIMAL(5,2)
    )                                                               AS ErrorRate,
    SUM(CASE WHEN ErrorCount > 0
              AND CompletionStatus IS NULL
              AND State IN ('Error', 'Off')
             THEN 1 ELSE 0 END)                                    AS CreationFailures,
    CAST(AVG(CAST(StartupDuration AS FLOAT)) AS DECIMAL(10,2))    AS AvgStartupDuration
FROM dbo.tblInstances;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW: vw_ErrorRateByConsumer
-- Groups by API consumer to show which integration channel has highest errors.
-- The 2% threshold is flagged for alerting.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER VIEW dbo.vw_ErrorRateByConsumer
AS
SELECT
    ISNULL(ApiConsumer, 'Unknown')                              AS ApiConsumer,
    COUNT(*)                                                    AS TotalInstances,
    SUM(CASE WHEN ErrorCount > 0 THEN 1 ELSE 0 END)           AS InstancesWithErrors,
    SUM(ErrorCount)                                             AS TotalErrors,
    CAST(
        CASE WHEN COUNT(*) > 0
            THEN (SUM(CASE WHEN ErrorCount > 0 THEN 1.0 ELSE 0.0 END) / COUNT(*)) * 100
            ELSE 0
        END AS DECIMAL(5,2)
    )                                                           AS ErrorRate,
    CASE
        WHEN COUNT(*) > 0
         AND (SUM(CASE WHEN ErrorCount > 0 THEN 1.0 ELSE 0.0 END) / COUNT(*)) > 0.02
        THEN 1 ELSE 0
    END                                                         AS ThresholdBreached
FROM dbo.tblInstances
GROUP BY ApiConsumer;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW: vw_ConcurrentLaunches
-- Buckets lab starts into 5-minute windows and counts concurrent launches
-- per delivery region. Flags windows with >4 concurrent launches.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER VIEW dbo.vw_ConcurrentLaunches
AS
WITH FiveMinWindows AS (
    SELECT
        DeliveryRegionName,
        -- Floor StartDateTime to nearest 5-minute boundary
        DATEADD(MINUTE,
            (DATEDIFF(MINUTE, '2000-01-01', StartDateTime) / 5) * 5,
            '2000-01-01'
        )                                                       AS WindowStart,
        DATEADD(MINUTE,
            ((DATEDIFF(MINUTE, '2000-01-01', StartDateTime) / 5) * 5) + 5,
            '2000-01-01'
        )                                                       AS WindowEnd,
        COUNT(*)                                                AS ConcurrentCount
    FROM dbo.tblInstances
    WHERE StartDateTime IS NOT NULL
    GROUP BY
        DeliveryRegionName,
        DATEADD(MINUTE,
            (DATEDIFF(MINUTE, '2000-01-01', StartDateTime) / 5) * 5,
            '2000-01-01'
        ),
        DATEADD(MINUTE,
            ((DATEDIFF(MINUTE, '2000-01-01', StartDateTime) / 5) * 5) + 5,
            '2000-01-01'
        )
)
SELECT
    DeliveryRegionName,
    WindowStart,
    WindowEnd,
    ConcurrentCount,
    CASE WHEN ConcurrentCount > 4 THEN 1 ELSE 0 END           AS ThresholdBreached
FROM FiveMinWindows;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW: vw_RegionSummary
-- Launches and error metrics grouped by delivery region.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER VIEW dbo.vw_RegionSummary
AS
SELECT
    ISNULL(DeliveryRegionName, 'Unknown')                       AS DeliveryRegionName,
    COUNT(*)                                                    AS TotalLaunches,
    SUM(CASE WHEN ErrorCount > 0 THEN 1 ELSE 0 END)           AS InstancesWithErrors,
    SUM(ErrorCount)                                             AS TotalErrors,
    CAST(
        CASE WHEN COUNT(*) > 0
            THEN (SUM(CASE WHEN ErrorCount > 0 THEN 1.0 ELSE 0.0 END) / COUNT(*)) * 100
            ELSE 0
        END AS DECIMAL(5,2)
    )                                                           AS ErrorRate,
    CAST(AVG(CAST(LastLatency AS FLOAT)) AS DECIMAL(10,2))     AS AvgLatencyMs,
    CAST(AVG(CAST(StartupDuration AS FLOAT)) AS DECIMAL(10,2)) AS AvgStartupDuration,
    COUNT(DISTINCT LabProfileId)                                AS UniqueLabProfiles,
    COUNT(DISTINCT DatacenterName)                              AS UniqueDatacenters
FROM dbo.tblInstances
GROUP BY DeliveryRegionName;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW: vw_HourlyLaunchTrend
-- Hourly launch count trend for the time-series chart.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER VIEW dbo.vw_HourlyLaunchTrend
AS
SELECT
    DATEADD(HOUR,
        DATEDIFF(HOUR, '2000-01-01', StartDateTime),
        '2000-01-01'
    )                                                           AS HourBucket,
    COUNT(*)                                                    AS LaunchCount,
    SUM(CASE WHEN ErrorCount > 0 THEN 1 ELSE 0 END)           AS ErrorCount
FROM dbo.tblInstances
WHERE StartDateTime IS NOT NULL
GROUP BY
    DATEADD(HOUR,
        DATEDIFF(HOUR, '2000-01-01', StartDateTime),
        '2000-01-01'
    );
GO

PRINT 'Schema deployment complete.';
GO
