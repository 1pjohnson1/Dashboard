-- =============================================================================
-- File: tblInstances_OpsMonitor.sql
-- Operational monitoring schema for Skillable Lab Telemetry — 7-day rolling window
-- Designed for real-time error detection, React dashboard, and AI agent queries
-- 
-- NOTE: This file contains VIEWS and STORED PROCEDURES to supplement schema.sql
-- Run this AFTER schema.sql to populate dashboard and AI agent infrastructure.
-- =============================================================================

-- ============================================================================
-- SECTION 1: OPS-FOCUSED VIEWS (for React Dashboard)
-- ============================================================================

-- ── 1.1 vw_ActiveErrors ────────────────────────────────────────────────
-- Labs with errors RIGHT NOW
-- Dashboard: Error alert panel, real-time error feed
-- ────────────────────────────────────────────────────────────────────────
CREATE OR ALTER VIEW dbo.vw_ActiveErrors
AS
SELECT
    Id,
    LabProfileId,
    LabProfileName,
    DatacenterName,
    DeliveryRegionName,
    LabHostName,
    ErrorCount,
    Errors,
    ScriptResults,
    [State],
    CompletionStatus,
    StartDateTime,
    UserEmail,
    UserFirstName,
    UserLastName,
    Latency,
    StartupDuration,
    EstimatedReadySeconds,
    IngestedAt
FROM dbo.tblInstances
WHERE ErrorCount > 0
  AND [State] IN ('Running', 'Error', 'Building', 'Saving');
GO


-- ── 1.2 vw_StuckLabs ──────────────────────────────────────────────────
-- Labs running abnormally long (>2 hours and still active)
-- Dashboard: "Stuck labs" warning panel
-- ────────────────────────────────────────────────────────────────────────
CREATE OR ALTER VIEW dbo.vw_StuckLabs
AS
SELECT
    Id,
    LabProfileId,
    LabProfileName,
    TotalRunTime,
    TimeInSession,
    TimeRemaining,
    StartDateTime,
    UserEmail,
    UserFirstName,
    UserLastName,
    DatacenterName,
    LabHostName,
    [State],
    CompletionStatus,
    BrowserUserAgent,
    RemoteController
FROM dbo.tblInstances
WHERE TotalRunTime > 7200                     -- more than 2 hours
  AND [State] IN ('Running', 'Saving');
GO


-- ── 1.3 vw_FailedLabs ─────────────────────────────────────────────────
-- Recent failures, cancellations, and provisioning errors
-- Dashboard: Failure log table, error category breakdown
-- ────────────────────────────────────────────────────────────────────────
CREATE OR ALTER VIEW dbo.vw_FailedLabs
AS
SELECT
    Id,
    LabProfileId,
    LabProfileName,
    CompletionStatus,
    Errors,
    ScriptResults,
    ErrorCount,
    StartDateTime,
    EndDateTime,
    TotalRunTime,
    UserEmail,
    UserFirstName,
    UserLastName,
    DatacenterName,
    DeliveryRegionName,
    LabHostName,
    Latency,
    InstructorName,
    InstructorEmail
FROM dbo.tblInstances
WHERE CompletionStatus IN (
    'Cancelled',
    'Incomplete',
    'Storage Provisioning Failed',
    'Lab Creation Failed',
    'Resume Failed',
    'Save Failed'
);
GO


-- ── 1.4 vw_StartupDelays ──────────────────────────────────────────────
-- Slow lab provisioning (>120s actual OR >60s over estimate)
-- Dashboard: Startup performance panel, latency trend chart
-- ────────────────────────────────────────────────────────────────────────
CREATE OR ALTER VIEW dbo.vw_StartupDelays
AS
SELECT
    Id,
    LabProfileId,
    LabProfileName,
    StartupDuration,
    EstimatedReadySeconds,
    Latency,
    DatacenterName,
    DeliveryRegionName,
    LabHostName,
    PoolMemberName,
    StartDateTime,
    [State],
    CompletionStatus
FROM dbo.tblInstances
WHERE StartupDuration > 120                   -- more than 2 min actual
   OR (StartupDuration - EstimatedReadySeconds) > 60;  -- 60s+ over estimate
GO


-- ── 1.5 vw_DatacenterHealth ───────────────────────────────────────────
-- Datacenter-level KPIs: error rates, startup times, completion rates
-- Dashboard: Datacenter health scorecard, heatmap
-- ────────────────────────────────────────────────────────────────────────
CREATE OR ALTER VIEW dbo.vw_DatacenterHealth
AS
SELECT
    DatacenterName,
    DeliveryRegionName,
    COUNT(*)                                                        AS TotalLabs,
    SUM(CASE WHEN ErrorCount > 0 THEN 1 ELSE 0 END)                AS ErrorLabs,
    CAST(
        SUM(CASE WHEN ErrorCount > 0 THEN 1.0 ELSE 0 END)
        / NULLIF(COUNT(*), 0) * 100
    AS DECIMAL(5,2))                                                AS ErrorRatePct,
    SUM(CASE WHEN CompletionStatus = 'Complete' THEN 1 ELSE 0 END) AS CompletedLabs,
    CAST(
        SUM(CASE WHEN CompletionStatus = 'Complete' THEN 1.0 ELSE 0 END)
        / NULLIF(COUNT(*), 0) * 100
    AS DECIMAL(5,2))                                                AS CompletionRatePct,
    AVG(CASE
        WHEN CompletionStatus NOT IN (
            'Storage Provisioning Failed','Lab Creation Failed',
            'Resume Failed','Save Failed')
         AND StartupDuration IS NOT NULL
        THEN CAST(StartupDuration AS FLOAT) * 1000
    END)                                                            AS AvgStartupMs,
    AVG(CASE
        WHEN CompletionStatus NOT IN (
            'Storage Provisioning Failed','Lab Creation Failed',
            'Resume Failed','Save Failed')
         AND StartupDuration IS NOT NULL
         AND EstimatedReadySeconds IS NOT NULL
        THEN CAST(Latency AS FLOAT) * 1000
    END)                                                            AS AvgLatencyMs,
    AVG(TaskCompletePercent)                                        AS AvgTaskCompletePct,
    AVG(CAST(TotalRunTime AS FLOAT))                                AS AvgRunTimeSec,
    MIN(StartDateTime)                                              AS EarliestLab,
    MAX(StartDateTime)                                              AS LatestLab
FROM dbo.tblInstances
WHERE [Start] >= DATEDIFF(SECOND, '1970-01-01', DATEADD(DAY, -7, SYSUTCDATETIME()))
GROUP BY DatacenterName, DeliveryRegionName;
GO


-- ── 1.6 vw_LabProfileHealth ───────────────────────────────────────────
-- Lab profile-level KPIs: completions, errors, exam performance
-- Dashboard: Lab profile performance table, drill-down
-- ────────────────────────────────────────────────────────────────────────
CREATE OR ALTER VIEW dbo.vw_LabProfileHealth
AS
SELECT
    LabProfileId,
    LabProfileName,
    SeriesName,
    COUNT(*)                                                        AS TotalInstances,
    AVG(CAST(TotalRunTime AS FLOAT))                                AS AvgRunTimeSec,
    AVG(TaskCompletePercent)                                        AS AvgTaskCompletePct,
    SUM(CASE WHEN CompletionStatus = 'Complete' THEN 1 ELSE 0 END) AS Completed,
    SUM(CASE WHEN CompletionStatus = 'Incomplete' THEN 1 ELSE 0 END) AS Incomplete,
    SUM(CASE WHEN CompletionStatus = 'Cancelled' THEN 1 ELSE 0 END) AS Cancelled,
    SUM(CASE WHEN CompletionStatus IN (
        'Storage Provisioning Failed','Lab Creation Failed',
        'Resume Failed','Save Failed') THEN 1 ELSE 0 END)          AS SystemFailures,
    SUM(CASE WHEN ErrorCount > 0 THEN 1 ELSE 0 END)                AS WithErrors,
    SUM(CASE WHEN IsExam = 1 THEN 1 ELSE 0 END)                    AS ExamInstances,
    SUM(CASE WHEN ExamPassed = 1 THEN 1 ELSE 0 END)                AS ExamsPassed,
    CAST(
        SUM(CASE WHEN ExamPassed = 1 THEN 1.0 ELSE 0 END)
        / NULLIF(SUM(CASE WHEN IsExam = 1 THEN 1 ELSE 0 END), 0) * 100
    AS DECIMAL(5,2))                                                AS ExamPassRatePct,
    AVG(CASE
        WHEN CompletionStatus NOT IN (
            'Storage Provisioning Failed','Lab Creation Failed',
            'Resume Failed','Save Failed')
         AND StartupDuration IS NOT NULL
        THEN CAST(StartupDuration AS FLOAT) * 1000
    END)                                                            AS AvgStartupMs,
    AVG(CASE
        WHEN CompletionStatus NOT IN (
            'Storage Provisioning Failed','Lab Creation Failed',
            'Resume Failed','Save Failed')
         AND StartupDuration IS NOT NULL
         AND EstimatedReadySeconds IS NOT NULL
        THEN CAST(Latency AS FLOAT) * 1000
    END)                                                            AS AvgLatencyMs
FROM dbo.tblInstances
WHERE [Start] >= DATEDIFF(SECOND, '1970-01-01', DATEADD(DAY, -7, SYSUTCDATETIME()))
GROUP BY LabProfileId, LabProfileName, SeriesName;
GO


-- ── 1.7 vw_RecentActivity ─────────────────────────────────────────────
-- Last 24-hour rolling activity feed
-- Dashboard: Live activity feed, timeline view
-- ────────────────────────────────────────────────────────────────────────
CREATE OR ALTER VIEW dbo.vw_RecentActivity
AS
SELECT
    Id,
    LabProfileName,
    SeriesName,
    UserFirstName,
    UserLastName,
    UserEmail,
    InstructorName,
    [State],
    CompletionStatus,
    ErrorCount,
    TaskCompletePercent,
    StartDateTime,
    EndDateTime,
    TotalRunTime,
    TimeInSession,
    Latency,
    DatacenterName,
    DeliveryRegionName,
    City,
    Country,
    IsExam,
    ExamPassed,
    ExamScore,
    IngestedAt
FROM dbo.tblInstances
WHERE [Start] >= DATEDIFF(SECOND, '1970-01-01', DATEADD(HOUR, -24, SYSUTCDATETIME()));
GO


-- ============================================================================
-- SECTION 2: STORED PROCEDURES (for AI Agent)
-- ============================================================================

-- ── 2.1 sp_GetActiveErrors ─────────────────────────────────────────────
-- AI: "What errors are happening right now?"
-- AI: "Show me errors from the last 2 hours"
-- ────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_GetActiveErrors
    @HoursBack INT = 4
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        Id,
        LabProfileName,
        DatacenterName,
        LabHostName,
        DeliveryRegionName,
        ErrorCount,
        Errors,
        ScriptResults,
        [State],
        CompletionStatus,
        StartDateTime,
        Latency,
        UserEmail,
        UserFirstName,
        UserLastName
    FROM dbo.tblInstances
    WHERE ErrorCount > 0
      AND [Start] >= DATEDIFF(SECOND, '1970-01-01', DATEADD(HOUR, -@HoursBack, SYSUTCDATETIME()))
    ORDER BY ErrorCount DESC, StartDateTime DESC;
END
GO


-- ── 2.2 sp_GetDatacenterHealth ─────────────────────────────────────────
-- AI: "How is US East 2 performing?"
-- AI: "Which datacenter has the most errors?"
-- ────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_GetDatacenterHealth
    @DatacenterName NVARCHAR(255) = NULL,
    @HoursBack      INT           = 24
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        DatacenterName,
        DeliveryRegionName,
        COUNT(*)                                                        AS TotalLabs,
        SUM(CASE WHEN ErrorCount > 0 THEN 1 ELSE 0 END)                AS ErrorLabs,
        CAST(
            SUM(CASE WHEN ErrorCount > 0 THEN 1.0 ELSE 0 END)
            / NULLIF(COUNT(*), 0) * 100
        AS DECIMAL(5,2))                                                AS ErrorRatePct,
        SUM(CASE WHEN CompletionStatus = 'Complete' THEN 1 ELSE 0 END) AS CompletedLabs,
        CAST(
            SUM(CASE WHEN CompletionStatus = 'Complete' THEN 1.0 ELSE 0 END)
            / NULLIF(COUNT(*), 0) * 100
        AS DECIMAL(5,2))                                                AS CompletionRatePct,
        AVG(CASE
            WHEN CompletionStatus NOT IN (
                'Storage Provisioning Failed','Lab Creation Failed',
                'Resume Failed','Save Failed')
             AND StartupDuration IS NOT NULL
            THEN CAST(StartupDuration AS FLOAT) * 1000
        END)                                                            AS AvgStartupMs,
        AVG(CASE
            WHEN CompletionStatus NOT IN (
                'Storage Provisioning Failed','Lab Creation Failed',
                'Resume Failed','Save Failed')
             AND StartupDuration IS NOT NULL
             AND EstimatedReadySeconds IS NOT NULL
            THEN CAST(Latency AS FLOAT) * 1000
        END)                                                            AS AvgLatencyMs,
        AVG(TaskCompletePercent)                                        AS AvgTaskCompletePct,
        AVG(CAST(TotalRunTime AS FLOAT))                                AS AvgRunTimeSec
    FROM dbo.tblInstances
    WHERE [Start] >= DATEDIFF(SECOND, '1970-01-01', DATEADD(HOUR, -@HoursBack, SYSUTCDATETIME()))
      AND (@DatacenterName IS NULL OR DatacenterName = @DatacenterName)
    GROUP BY DatacenterName, DeliveryRegionName
    ORDER BY ErrorRatePct DESC;
END
GO


-- ── 2.3 sp_GetLabProfileHealth ─────────────────────────────────────────
-- AI: "What's wrong with lab profile 181003?"
-- AI: "Show me the worst performing lab profiles"
-- ────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_GetLabProfileHealth
    @LabProfileName NVARCHAR(500) = NULL,
    @HoursBack      INT           = 24
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        LabProfileId,
        LabProfileName,
        SeriesName,
        COUNT(*)                                                        AS TotalInstances,
        AVG(CAST(TotalRunTime AS FLOAT))                                AS AvgRunTimeSec,
        AVG(TaskCompletePercent)                                        AS AvgTaskCompletePct,
        SUM(CASE WHEN CompletionStatus = 'Complete' THEN 1 ELSE 0 END) AS Completed,
        SUM(CASE WHEN CompletionStatus = 'Incomplete' THEN 1 ELSE 0 END) AS Incomplete,
        SUM(CASE WHEN CompletionStatus = 'Cancelled' THEN 1 ELSE 0 END) AS Cancelled,
        SUM(CASE WHEN CompletionStatus IN (
            'Storage Provisioning Failed','Lab Creation Failed',
            'Resume Failed','Save Failed') THEN 1 ELSE 0 END)          AS SystemFailures,
        SUM(CASE WHEN ErrorCount > 0 THEN 1 ELSE 0 END)                AS WithErrors,
        SUM(CASE WHEN ExamPassed = 1 THEN 1 ELSE 0 END)                AS ExamsPassed,
        SUM(CASE WHEN IsExam = 1 THEN 1 ELSE 0 END)                    AS ExamInstances,
        AVG(CASE
            WHEN CompletionStatus NOT IN (
                'Storage Provisioning Failed','Lab Creation Failed',
                'Resume Failed','Save Failed')
             AND StartupDuration IS NOT NULL
            THEN CAST(StartupDuration AS FLOAT) * 1000
        END)                                                            AS AvgStartupMs,
        AVG(CASE
            WHEN CompletionStatus NOT IN (
                'Storage Provisioning Failed','Lab Creation Failed',
                'Resume Failed','Save Failed')
             AND StartupDuration IS NOT NULL
             AND EstimatedReadySeconds IS NOT NULL
            THEN CAST(Latency AS FLOAT) * 1000
        END)                                                            AS AvgLatencyMs
    FROM dbo.tblInstances
    WHERE [Start] >= DATEDIFF(SECOND, '1970-01-01', DATEADD(HOUR, -@HoursBack, SYSUTCDATETIME()))
      AND (@LabProfileName IS NULL OR LabProfileName LIKE '%' + @LabProfileName + '%')
    GROUP BY LabProfileId, LabProfileName, SeriesName
    ORDER BY SystemFailures DESC, WithErrors DESC;
END
GO


-- ── 2.4 sp_GetCompletionBreakdown ─────────────────────────────────────
-- AI: "What's the overall completion breakdown?"
-- AI: "How many labs failed vs completed today?"
-- ────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_GetCompletionBreakdown
    @HoursBack INT = 24
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        CompletionStatus,
        COUNT(*)                                                    AS InstanceCount,
        CAST(
            COUNT(*) * 100.0
            / NULLIF(SUM(COUNT(*)) OVER (), 0)
        AS DECIMAL(5,2))                                            AS Pct,
        AVG(CAST(TotalRunTime AS FLOAT))                            AS AvgRunTimeSec,
        AVG(TaskCompletePercent)                                    AS AvgTaskCompletePct,
        AVG(CAST(StartupDuration AS FLOAT))                         AS AvgStartupSec
    FROM dbo.tblInstances
    WHERE [Start] >= DATEDIFF(SECOND, '1970-01-01', DATEADD(HOUR, -@HoursBack, SYSUTCDATETIME()))
    GROUP BY CompletionStatus
    ORDER BY InstanceCount DESC;
END
GO


-- ============================================================================
-- SECTION 3: PURGE — 7-Day Rolling Window
-- ============================================================================

-- Purge audit log
IF OBJECT_ID('dbo.tblPurgeLog', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblPurgeLog
    (
        PurgeId     INT         IDENTITY(1,1) PRIMARY KEY,
        PurgedAt    DATETIME2   NOT NULL DEFAULT SYSUTCDATETIME(),
        RowsDeleted INT         NOT NULL
    );
END
GO

-- ── sp_PurgeExpiredInstances ───────────────────────────────────────────
-- Run daily via SQL Agent Job or ADF Scheduled Trigger
-- Deletes all instances older than 7 days and logs the count
-- ────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_PurgeExpiredInstances
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CutoffEpoch BIGINT = DATEDIFF(SECOND, '1970-01-01', DATEADD(DAY, -7, SYSUTCDATETIME()));
    DECLARE @Deleted INT;

    DELETE FROM dbo.tblInstances
    WHERE [Start] < @CutoffEpoch;

    SET @Deleted = @@ROWCOUNT;

    INSERT INTO dbo.tblPurgeLog (PurgedAt, RowsDeleted)
    VALUES (SYSUTCDATETIME(), @Deleted);

    SELECT @Deleted AS RowsPurged, SYSUTCDATETIME() AS PurgedAt;
END
GO

PRINT 'Operational monitoring views, procedures, and purge logic deployed.';
GO
