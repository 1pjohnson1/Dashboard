-- =============================================================================
-- Skillable Lab Telemetry Dashboard — Stored Procedures
-- Author: Penelope Johnson, Director — Lab Development
-- Date: May 2026
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCEDURE: usp_UpsertInstance
-- Called by ADF Copy Activity sink. Uses MERGE to insert or update.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.usp_UpsertInstance
    @InstanceId         INT,
    @LabProfileId       INT,
    @LabProfileName     NVARCHAR(500),
    @SeriesId           INT             = NULL,
    @SeriesName         NVARCHAR(255)   = NULL,
    @UserId             NVARCHAR(100)   = NULL,
    @UserFirstName      NVARCHAR(100)   = NULL,
    @UserLastName       NVARCHAR(100)   = NULL,
    @ClassId            INT             = NULL,
    @StartEpoch         BIGINT,
    @EndEpoch           BIGINT          = NULL,
    @LastActivityEpoch  BIGINT          = NULL,
    @ExpirationEpoch    BIGINT          = NULL,
    @State              NVARCHAR(50),
    @CompletionStatus   NVARCHAR(50)    = NULL,
    @IpAddress          NVARCHAR(50)    = NULL,
    @Country            NVARCHAR(100)   = NULL,
    @Region             NVARCHAR(100)   = NULL,
    @City               NVARCHAR(100)   = NULL,
    @Latitude           FLOAT           = NULL,
    @Longitude          FLOAT           = NULL,
    @DatacenterId       INT             = NULL,
    @DatacenterName     NVARCHAR(255)   = NULL,
    @LabHostId          INT             = NULL,
    @LabHostName        NVARCHAR(255)   = NULL,
    @DeliveryRegionName NVARCHAR(255)   = NULL,
    @LastLatency        INT             = NULL,
    @ErrorCount         INT             = 0,
    @StartupDuration    INT             = NULL,
    @TotalRunTime       INT             = NULL,
    @TimeInSession      INT             = NULL,
    @TaskCompletePercent FLOAT          = NULL,
    @ExamPassed         BIT             = NULL,
    @ExamScore          FLOAT           = NULL,
    @IsExam             BIT             = NULL,
    @PlatformId         INT             = NULL,
    @ApiConsumer        NVARCHAR(255)   = NULL
AS
BEGIN
    SET NOCOUNT ON;

    MERGE dbo.tblInstances AS target
    USING (SELECT @InstanceId AS InstanceId) AS source
    ON target.InstanceId = source.InstanceId
    WHEN MATCHED THEN
        UPDATE SET
            LabProfileId        = @LabProfileId,
            LabProfileName      = @LabProfileName,
            SeriesId            = @SeriesId,
            SeriesName          = @SeriesName,
            UserId              = @UserId,
            UserFirstName       = @UserFirstName,
            UserLastName        = @UserLastName,
            ClassId             = @ClassId,
            StartEpoch          = @StartEpoch,
            EndEpoch            = @EndEpoch,
            LastActivityEpoch   = @LastActivityEpoch,
            ExpirationEpoch     = @ExpirationEpoch,
            State               = @State,
            CompletionStatus    = @CompletionStatus,
            IpAddress           = @IpAddress,
            Country             = @Country,
            Region              = @Region,
            City                = @City,
            Latitude            = @Latitude,
            Longitude           = @Longitude,
            DatacenterId        = @DatacenterId,
            DatacenterName      = @DatacenterName,
            LabHostId           = @LabHostId,
            LabHostName         = @LabHostName,
            DeliveryRegionName  = @DeliveryRegionName,
            LastLatency         = @LastLatency,
            ErrorCount          = @ErrorCount,
            StartupDuration     = @StartupDuration,
            TotalRunTime        = @TotalRunTime,
            TimeInSession       = @TimeInSession,
            TaskCompletePercent = @TaskCompletePercent,
            ExamPassed          = @ExamPassed,
            ExamScore           = @ExamScore,
            IsExam              = @IsExam,
            PlatformId          = @PlatformId,
            ApiConsumer         = @ApiConsumer,
            IngestTimestamp     = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (
            InstanceId, LabProfileId, LabProfileName, SeriesId, SeriesName,
            UserId, UserFirstName, UserLastName, ClassId,
            StartEpoch, EndEpoch, LastActivityEpoch, ExpirationEpoch,
            State, CompletionStatus, IpAddress, Country, Region, City,
            Latitude, Longitude, DatacenterId, DatacenterName,
            LabHostId, LabHostName, DeliveryRegionName,
            LastLatency, ErrorCount, StartupDuration, TotalRunTime,
            TimeInSession, TaskCompletePercent, ExamPassed, ExamScore,
            IsExam, PlatformId, ApiConsumer
        )
        VALUES (
            @InstanceId, @LabProfileId, @LabProfileName, @SeriesId, @SeriesName,
            @UserId, @UserFirstName, @UserLastName, @ClassId,
            @StartEpoch, @EndEpoch, @LastActivityEpoch, @ExpirationEpoch,
            @State, @CompletionStatus, @IpAddress, @Country, @Region, @City,
            @Latitude, @Longitude, @DatacenterId, @DatacenterName,
            @LabHostId, @LabHostName, @DeliveryRegionName,
            @LastLatency, @ErrorCount, @StartupDuration, @TotalRunTime,
            @TimeInSession, @TaskCompletePercent, @ExamPassed, @ExamScore,
            @IsExam, @PlatformId, @ApiConsumer
        );
END;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCEDURE: usp_InsertError
-- Appends error records. Idempotent — checks for existing InstanceId + Message.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.usp_InsertError
    @InstanceId         INT,
    @ErrorType          NVARCHAR(255),
    @ErrorMessage       NVARCHAR(MAX)   = NULL,
    @ErrorTimestamp      DATETIME2(3)   = NULL,
    @ApiConsumer        NVARCHAR(255)   = NULL,
    @LabProfileId       INT             = NULL,
    @LabProfileName     NVARCHAR(500)   = NULL,
    @SeriesId           INT             = NULL,
    @SeriesName         NVARCHAR(255)   = NULL,
    @DatacenterName     NVARCHAR(255)   = NULL,
    @LabHostName        NVARCHAR(255)   = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Avoid duplicate errors for the same instance + message
    IF NOT EXISTS (
        SELECT 1 FROM dbo.tblErrors
        WHERE InstanceId = @InstanceId
          AND ErrorMessage = @ErrorMessage
    )
    BEGIN
        INSERT INTO dbo.tblErrors (
            InstanceId, ErrorType, ErrorMessage, ErrorTimestamp,
            ApiConsumer, LabProfileId, LabProfileName,
            SeriesId, SeriesName, DatacenterName, LabHostName
        )
        VALUES (
            @InstanceId, @ErrorType, @ErrorMessage, @ErrorTimestamp,
            @ApiConsumer, @LabProfileId, @LabProfileName,
            @SeriesId, @SeriesName, @DatacenterName, @LabHostName
        );
    END;
END;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCEDURE: usp_InsertActivity
-- Appends activity results. Idempotent — checks for existing InstanceId + Name.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.usp_InsertActivity
    @InstanceId         INT,
    @ActivityName       NVARCHAR(500),
    @ActivityType       NVARCHAR(100)   = NULL,
    @Score              FLOAT           = NULL,
    @PossibleScore      FLOAT           = NULL,
    @PassStatus         NVARCHAR(50)    = NULL,
    @Duration           INT             = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.tblActivities
        WHERE InstanceId = @InstanceId
          AND ActivityName = @ActivityName
    )
    BEGIN
        INSERT INTO dbo.tblActivities (
            InstanceId, ActivityName, ActivityType,
            Score, PossibleScore, PassStatus, Duration
        )
        VALUES (
            @InstanceId, @ActivityName, @ActivityType,
            @Score, @PossibleScore, @PassStatus, @Duration
        );
    END;
END;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCEDURE: usp_UpdateGeoBuckets
-- Aggregates instances from a time window into geo-launch buckets.
-- Called by ADF pipeline after instance ingestion.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.usp_UpdateGeoBuckets
    @WindowStartEpoch   BIGINT,
    @WindowEndEpoch     BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @WindowStart DATETIME2(3) = DATEADD(SECOND, @WindowStartEpoch, '1970-01-01T00:00:00Z');
    DECLARE @WindowEnd   DATETIME2(3) = DATEADD(SECOND, @WindowEndEpoch, '1970-01-01T00:00:00Z');

    -- Delete existing buckets for this window to avoid duplicates on re-run
    DELETE FROM dbo.tblGeoBuckets
    WHERE BucketWindowStart = @WindowStart
      AND BucketWindowEnd   = @WindowEnd;

    -- Insert aggregated buckets
    INSERT INTO dbo.tblGeoBuckets (
        IpAddress, Country, Region, City, DeliveryRegionName,
        InstanceCount, SeriesId, SeriesName,
        BucketWindowStart, BucketWindowEnd
    )
    SELECT
        IpAddress,
        Country,
        Region,
        City,
        DeliveryRegionName,
        COUNT(*)            AS InstanceCount,
        SeriesId,
        SeriesName,
        @WindowStart,
        @WindowEnd
    FROM dbo.tblInstances
    WHERE StartDateTime >= @WindowStart
      AND StartDateTime <  @WindowEnd
      AND IpAddress IS NOT NULL
    GROUP BY
        IpAddress, Country, Region, City, DeliveryRegionName,
        SeriesId, SeriesName;
END;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCEDURE: usp_GetOverviewMetrics
-- Returns all data needed by the Overview & Health page.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.usp_GetOverviewMetrics
    @Days INT = 7
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CutoffDate DATETIME2(3) = DATEADD(DAY, -@Days, SYSUTCDATETIME());

    -- 1. KPI Summary
    SELECT
        COUNT(*)                                                        AS TotalInstances,
        SUM(CASE WHEN CompletionStatus = 'Complete' THEN 1 ELSE 0 END) AS CompletedInstances,
        CAST(
            CASE WHEN COUNT(*) > 0
                THEN (SUM(CASE WHEN CompletionStatus = 'Complete' THEN 1.0 ELSE 0.0 END)
                      / COUNT(*)) * 100
                ELSE 0 END AS DECIMAL(5,2)
        )                                                               AS SuccessRate,
        CAST(AVG(CAST(LastLatency AS FLOAT)) AS DECIMAL(10,2))         AS AvgLatencyMs,
        SUM(CASE WHEN State IN ('Running','Building','Starting')
                 THEN 1 ELSE 0 END)                                    AS ActiveLabsNow,
        SUM(ErrorCount)                                                 AS TotalErrors,
        CAST(
            CASE WHEN COUNT(*) > 0
                THEN (SUM(CASE WHEN ErrorCount > 0 THEN 1.0 ELSE 0.0 END)
                      / COUNT(*)) * 100
                ELSE 0 END AS DECIMAL(5,2)
        )                                                               AS ErrorRate,
        SUM(CASE WHEN ErrorCount > 0
                  AND (CompletionStatus IS NULL OR CompletionStatus = '')
                  AND State IN ('Error','Off')
                 THEN 1 ELSE 0 END)                                    AS CreationFailures,
        CAST(AVG(CAST(StartupDuration AS FLOAT)) AS DECIMAL(10,2))    AS AvgStartupDuration
    FROM dbo.tblInstances
    WHERE IngestTimestamp >= @CutoffDate;

    -- 2. Status Breakdown
    SELECT
        ISNULL(CompletionStatus, State) AS Status,
        COUNT(*)                        AS InstanceCount
    FROM dbo.tblInstances
    WHERE IngestTimestamp >= @CutoffDate
    GROUP BY ISNULL(CompletionStatus, State)
    ORDER BY InstanceCount DESC;

    -- 3. Hourly Launch Trend
    SELECT
        DATEADD(HOUR,
            DATEDIFF(HOUR, '2000-01-01', StartDateTime),
            '2000-01-01'
        )                           AS HourBucket,
        COUNT(*)                    AS LaunchCount,
        SUM(CASE WHEN ErrorCount > 0 THEN 1 ELSE 0 END) AS ErrorCount
    FROM dbo.tblInstances
    WHERE IngestTimestamp >= @CutoffDate
      AND StartDateTime IS NOT NULL
    GROUP BY
        DATEADD(HOUR,
            DATEDIFF(HOUR, '2000-01-01', StartDateTime),
            '2000-01-01'
        )
    ORDER BY HourBucket;
END;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCEDURE: usp_GetErrorDeepDive
-- Returns error analytics for the Error Deep Dive page.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.usp_GetErrorDeepDive
    @Days INT = 7
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CutoffDate DATETIME2(3) = DATEADD(DAY, -@Days, SYSUTCDATETIME());

    -- 1. Error Rate by API Consumer
    SELECT
        ISNULL(ApiConsumer, 'Unknown')                              AS ApiConsumer,
        COUNT(*)                                                    AS TotalInstances,
        SUM(CASE WHEN ErrorCount > 0 THEN 1 ELSE 0 END)           AS InstancesWithErrors,
        SUM(ErrorCount)                                             AS TotalErrors,
        CAST(
            CASE WHEN COUNT(*) > 0
                THEN (SUM(CASE WHEN ErrorCount > 0 THEN 1.0 ELSE 0.0 END)
                      / COUNT(*)) * 100
                ELSE 0 END AS DECIMAL(5,2)
        )                                                           AS ErrorRate,
        CASE
            WHEN COUNT(*) > 0
             AND (SUM(CASE WHEN ErrorCount > 0 THEN 1.0 ELSE 0.0 END) / COUNT(*)) > 0.02
            THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT)
        END                                                         AS ThresholdBreached
    FROM dbo.tblInstances
    WHERE IngestTimestamp >= @CutoffDate
    GROUP BY ApiConsumer
    ORDER BY ErrorRate DESC;

    -- 2. Errors by Type / Category
    SELECT
        ErrorType,
        COUNT(*) AS ErrorCount
    FROM dbo.tblErrors
    WHERE IngestTimestamp >= @CutoffDate
    GROUP BY ErrorType
    ORDER BY ErrorCount DESC;

    -- 3. Daily Error Trend
    SELECT
        CAST(IngestTimestamp AS DATE) AS ErrorDate,
        COUNT(*)                     AS ErrorCount
    FROM dbo.tblErrors
    WHERE IngestTimestamp >= @CutoffDate
    GROUP BY CAST(IngestTimestamp AS DATE)
    ORDER BY ErrorDate;

    -- 4. Recent Errors (top 50)
    SELECT TOP 50
        e.ErrorId,
        e.InstanceId,
        e.LabProfileName,
        e.SeriesName,
        e.ErrorType,
        e.ErrorMessage,
        e.ApiConsumer,
        e.DatacenterName,
        e.LabHostName,
        e.IngestTimestamp
    FROM dbo.tblErrors e
    WHERE e.IngestTimestamp >= @CutoffDate
    ORDER BY e.IngestTimestamp DESC;
END;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCEDURE: usp_GetConcurrentLaunches
-- Returns 5-minute window concurrent launch data.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.usp_GetConcurrentLaunches
    @Hours INT = 24
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CutoffDate DATETIME2(3) = DATEADD(HOUR, -@Hours, SYSUTCDATETIME());

    -- 1. 5-minute window concurrent counts
    SELECT
        DeliveryRegionName,
        WindowStart,
        WindowEnd,
        ConcurrentCount,
        ThresholdBreached
    FROM dbo.vw_ConcurrentLaunches
    WHERE WindowStart >= @CutoffDate
    ORDER BY WindowStart DESC;

    -- 2. Max concurrent by region
    SELECT
        DeliveryRegionName,
        MAX(ConcurrentCount) AS MaxConcurrent
    FROM dbo.vw_ConcurrentLaunches
    WHERE WindowStart >= @CutoffDate
    GROUP BY DeliveryRegionName
    ORDER BY MaxConcurrent DESC;

    -- 3. Overall max
    SELECT
        MAX(ConcurrentCount) AS MaxConcurrent,
        CASE WHEN MAX(ConcurrentCount) > 4 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS ThresholdBreached
    FROM dbo.vw_ConcurrentLaunches
    WHERE WindowStart >= @CutoffDate;
END;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCEDURE: usp_GetGeoBucketAnalysis
-- Returns geo/region analytics with optional region filter.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.usp_GetGeoBucketAnalysis
    @Region NVARCHAR(255) = NULL,
    @Days   INT = 7
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CutoffDate DATETIME2(3) = DATEADD(DAY, -@Days, SYSUTCDATETIME());

    -- 1. Region summary
    SELECT
        DeliveryRegionName,
        TotalLaunches,
        TotalErrors,
        ErrorRate,
        AvgLatencyMs,
        AvgStartupDuration,
        UniqueLabProfiles,
        UniqueDatacenters
    FROM dbo.vw_RegionSummary
    WHERE (@Region IS NULL OR @Region = 'all' OR DeliveryRegionName = @Region);

    -- 2. Geo bucket details
    SELECT
        gb.IpAddress,
        gb.Country,
        gb.Region,
        gb.City,
        gb.DeliveryRegionName,
        gb.InstanceCount,
        gb.SeriesName,
        gb.BucketWindowStart,
        gb.BucketWindowEnd
    FROM dbo.tblGeoBuckets gb
    WHERE gb.IngestTimestamp >= @CutoffDate
      AND (@Region IS NULL OR @Region = 'all' OR gb.DeliveryRegionName = @Region)
    ORDER BY gb.InstanceCount DESC, gb.BucketWindowStart DESC;

    -- 3. Top lab profiles by region
    SELECT TOP 20
        DeliveryRegionName,
        LabProfileName,
        COUNT(*) AS LaunchCount
    FROM dbo.tblInstances
    WHERE IngestTimestamp >= @CutoffDate
      AND (@Region IS NULL OR @Region = 'all' OR DeliveryRegionName = @Region)
    GROUP BY DeliveryRegionName, LabProfileName
    ORDER BY LaunchCount DESC;
END;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCEDURE: usp_CleanupOldData
-- Deletes data older than @RetentionDays from all tables.
-- Matches the existing Office Script weekly purge (Friday midnight EST).
-- Schedule: ADF trigger every Friday at 05:00 UTC (midnight EST).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.usp_CleanupOldData
    @RetentionDays INT = 7
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CutoffDate DATETIME2(3) = DATEADD(DAY, -@RetentionDays, SYSUTCDATETIME());

    -- Delete in dependency order (children first)
    DELETE FROM dbo.tblGeoBuckets   WHERE IngestTimestamp < @CutoffDate;
    DELETE FROM dbo.tblActivities   WHERE IngestTimestamp < @CutoffDate;
    DELETE FROM dbo.tblErrors       WHERE IngestTimestamp < @CutoffDate;
    DELETE FROM dbo.tblInstances    WHERE IngestTimestamp < @CutoffDate;

    -- Return summary
    SELECT
        'Cleanup complete' AS Status,
        @CutoffDate        AS CutoffDate,
        @RetentionDays     AS RetentionDays,
        SYSUTCDATETIME()   AS ExecutedAt;
END;
GO

PRINT 'Stored procedures deployment complete.';
GO
