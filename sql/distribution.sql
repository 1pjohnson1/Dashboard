-- =============================================================================
-- Skillable Lab Telemetry Dashboard — DISTRIBUTION PROCEDURES
-- Author: Penelope Johnson, Director — Lab Development
-- Date: June 2026
--
-- These procedures implement the set-based "distribute" stage of the ELT
-- pipeline. The ADF data service lands every API page into dbo.tblInstancesRaw
-- with a plain INSERT (dumb + fast, no per-row proc, timeout-proof). Once all
-- pages are landed, the pipeline calls these procedures to MERGE / shred the
-- staged data into the curated tables:
--
--   usp_TruncateStaging      reset the staging buffer at the start of a run
--   usp_DistributeInstances  raw -> dbo.tblInstances              (MUST run 1st)
--   usp_DistributeErrors     raw.Errors[]          -> dbo.tblErrors
--   usp_DistributeActivities raw.ActivityResults[] -> dbo.tblActivities
--   usp_UpdateGeoBuckets     curated -> dbo.tblGeoBuckets (enriched)
--
-- Errors / Activities / GeoBuckets are independent of one another and can be
-- run in parallel AFTER usp_DistributeInstances completes (the child-table
-- foreign keys require the curated instance rows to exist first).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCEDURE: usp_TruncateStaging
-- Empties the transient staging buffer. Called once at the start of each run so
-- duplicate rows from re-runs or overlapping pages never accumulate.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.usp_TruncateStaging
AS
BEGIN
    SET NOCOUNT ON;
    TRUNCATE TABLE dbo.tblInstancesRaw;
END;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCEDURE: usp_DistributeInstances
-- MERGEs the de-duplicated staging rows into the curated dbo.tblInstances.
-- Epoch -> DATETIME2 conversion is already handled by the computed columns on
-- the staging table. Only started instances (Start IS NOT NULL) are promoted.
-- ClassId is string in the API; curated tblInstances keeps INT, so it is safely
-- TRY_CONVERTed. ErrorCount is string in the API and is cast to INT here.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.usp_DistributeInstances
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH Deduped AS (
        SELECT *,
               ROW_NUMBER() OVER (PARTITION BY Id ORDER BY IngestedAt DESC) AS rn
        FROM dbo.tblInstancesRaw
        WHERE Id IS NOT NULL
          AND [Start] IS NOT NULL
    )
    MERGE dbo.tblInstances AS target
    USING (
        SELECT
            Id                                          AS InstanceId,
            LabProfileId,
            ISNULL(LabProfileName, 'Unknown')           AS LabProfileName,
            SeriesId,
            SeriesName,
            UserId,
            UserFirstName,
            UserLastName,
            UserEmail,
            TRY_CONVERT(INT, ClassId)                   AS ClassId,
            StartDateTime,
            EndDateTime,
            LastActivityDateTime,
            ExpirationDateTime,
            ISNULL([State], 'Unknown')                  AS [State],
            CompletionStatus,
            IpAddress,
            Country,
            Region,
            City,
            Latitude,
            Longitude,
            DatacenterId,
            DatacenterName,
            LabHostId,
            LabHostName,
            DeliveryRegionName,
            LastLatency,
            -- Treat the two creation/provisioning failure CompletionStatuses as
            -- errors so the dashboard error rate / "instances with errors"
            -- reflect them even when the API ErrorCount is 0.
            CASE
                WHEN CompletionStatus IN ('Lab Creation Failed', 'Storage Provisioning Failed', 'Lab Provisioning Failed')
                     AND ISNULL(TRY_CONVERT(INT, ErrorCount), 0) = 0
                THEN 1
                ELSE ISNULL(TRY_CONVERT(INT, ErrorCount), 0)
            END                                         AS ErrorCount,
            StartupDuration,
            EstimatedReadySeconds,
            TotalRunTime,
            TimeInSession,
            TaskCompletePercent,
            ExamPassed,
            ExamScore,
            IsExam,
            PlatformId,
            ApiConsumer
        FROM Deduped
        WHERE rn = 1
    ) AS source
    ON target.InstanceId = source.InstanceId
    WHEN MATCHED THEN
        UPDATE SET
            LabProfileId            = source.LabProfileId,
            LabProfileName          = source.LabProfileName,
            SeriesId                = source.SeriesId,
            SeriesName              = source.SeriesName,
            UserId                  = source.UserId,
            UserFirstName           = source.UserFirstName,
            UserLastName            = source.UserLastName,
            UserEmail               = source.UserEmail,
            ClassId                 = source.ClassId,
            StartDateTime           = source.StartDateTime,
            EndDateTime             = source.EndDateTime,
            LastActivityDateTime    = source.LastActivityDateTime,
            ExpirationDateTime      = source.ExpirationDateTime,
            State                   = source.State,
            CompletionStatus        = source.CompletionStatus,
            IpAddress               = source.IpAddress,
            Country                 = source.Country,
            Region                  = source.Region,
            City                    = source.City,
            Latitude                = source.Latitude,
            Longitude               = source.Longitude,
            DatacenterId            = source.DatacenterId,
            DatacenterName          = source.DatacenterName,
            LabHostId               = source.LabHostId,
            LabHostName             = source.LabHostName,
            DeliveryRegionName      = source.DeliveryRegionName,
            LastLatency             = source.LastLatency,
            ErrorCount              = source.ErrorCount,
            StartupDuration         = source.StartupDuration,
            EstimatedReadySeconds   = source.EstimatedReadySeconds,
            TotalRunTime            = source.TotalRunTime,
            TimeInSession           = source.TimeInSession,
            TaskCompletePercent     = source.TaskCompletePercent,
            ExamPassed              = source.ExamPassed,
            ExamScore               = source.ExamScore,
            IsExam                  = source.IsExam,
            PlatformId              = source.PlatformId,
            ApiConsumer             = source.ApiConsumer,
            IngestTimestamp         = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (
            InstanceId, LabProfileId, LabProfileName, SeriesId, SeriesName,
            UserId, UserFirstName, UserLastName, UserEmail, ClassId,
            StartDateTime, EndDateTime, LastActivityDateTime, ExpirationDateTime,
            State, CompletionStatus, IpAddress, Country, Region, City,
            Latitude, Longitude, DatacenterId, DatacenterName,
            LabHostId, LabHostName, DeliveryRegionName,
            LastLatency, ErrorCount, StartupDuration, EstimatedReadySeconds, TotalRunTime,
            TimeInSession, TaskCompletePercent, ExamPassed, ExamScore,
            IsExam, PlatformId, ApiConsumer
        )
        VALUES (
            source.InstanceId, source.LabProfileId, source.LabProfileName, source.SeriesId, source.SeriesName,
            source.UserId, source.UserFirstName, source.UserLastName, source.UserEmail, source.ClassId,
            source.StartDateTime, source.EndDateTime, source.LastActivityDateTime, source.ExpirationDateTime,
            source.State, source.CompletionStatus, source.IpAddress, source.Country, source.Region, source.City,
            source.Latitude, source.Longitude, source.DatacenterId, source.DatacenterName,
            source.LabHostId, source.LabHostName, source.DeliveryRegionName,
            source.LastLatency, source.ErrorCount, source.StartupDuration, source.EstimatedReadySeconds, source.TotalRunTime,
            source.TimeInSession, source.TaskCompletePercent, source.ExamPassed, source.ExamScore,
            source.IsExam, source.PlatformId, source.ApiConsumer
        );
END;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCEDURE: usp_DistributeErrors
-- Shreds the raw Errors[] JSON array into dbo.tblErrors, enriched with instance
-- context. Idempotent per window: existing error rows for the instances in the
-- current staging batch are cleared and rebuilt.
--
-- The Errors[] element shape (confirmed from a live mode=10 sample) is:
--     { "Message": "...", "Time": <epoch seconds>, "TimeValue": "/Date(ms)/" }
-- There is no per-error type field, so ErrorType is set to 'LabError'.
--
-- Per-activity script failures are also captured: each ActivityResults[] element
-- carries a ScriptResults[] array of
--     { ScriptId, Score, Passed, UiResponse, ScriptResponse, PlatformError, ScriptError }
-- and any element with ScriptError = true or PlatformError = true becomes an
-- error row (ErrorType 'ScriptError' / 'PlatformError', message = ScriptResponse).
--
-- In addition, the two creation/provisioning CompletionStatus values
--   'Lab Creation Failed' and 'Storage Provisioning Failed'/'Lab Provisioning Failed'
-- are recorded as dedicated error rows even when the Errors[] array is empty,
-- so failed launches always surface in the Error Deep Dive.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.usp_DistributeErrors
AS
BEGIN
    SET NOCOUNT ON;

    -- De-duplicate staging to the latest row per instance, and only consider
    -- instances that were actually promoted to the curated table (FK safety).
    ;WITH Deduped AS (
        SELECT r.*,
               ROW_NUMBER() OVER (PARTITION BY r.Id ORDER BY r.IngestedAt DESC) AS rn
        FROM dbo.tblInstancesRaw r
        WHERE r.Id IS NOT NULL
    ),
    Curr AS (
        SELECT d.*
        FROM Deduped d
        INNER JOIN dbo.tblInstances i ON i.InstanceId = d.Id
        WHERE d.rn = 1
    )
    SELECT * INTO #ErrInstances FROM Curr;

    -- Clear existing errors for this batch so re-runs stay idempotent.
    DELETE e
    FROM dbo.tblErrors e
    INNER JOIN #ErrInstances c ON c.Id = e.InstanceId;

    -- 1) Shred the Errors[] detail array (Message + epoch Time).
    INSERT INTO dbo.tblErrors (
        InstanceId, ErrorType, ErrorMessage, ErrorTimestamp,
        ApiConsumer, LabProfileId, LabProfileName, SeriesId, SeriesName,
        DatacenterName, LabHostName,
        DeliveryRegionName, Country, City, State, PlatformId, IsExam, StartupDuration
    )
    SELECT
        c.Id,
        'LabError'                                                  AS ErrorType,
        JSON_VALUE(err.value, '$.Message')                          AS ErrorMessage,
        CASE WHEN JSON_VALUE(err.value, '$.Time') IS NOT NULL
             THEN DATEADD(SECOND, TRY_CONVERT(BIGINT, JSON_VALUE(err.value, '$.Time')), '1970-01-01T00:00:00')
        END                                                         AS ErrorTimestamp,
        c.ApiConsumer, c.LabProfileId, c.LabProfileName, c.SeriesId, c.SeriesName,
        c.DatacenterName, c.LabHostName,
        c.DeliveryRegionName, c.Country, c.City, c.State, c.PlatformId, c.IsExam, c.StartupDuration
    FROM #ErrInstances c
    CROSS APPLY OPENJSON(c.Errors) AS err
    WHERE ISJSON(c.Errors) = 1;

    -- 2) Shred per-activity ScriptResults[] where the script/platform flagged an
    --    error. These are nested two levels deep:
    --        instance -> ActivityResults[] -> ScriptResults[]
    --    Element shape: { ScriptId, Score, Passed, UiResponse, ScriptResponse,
    --                     PlatformError (bool), ScriptError (bool) }
    --    ScriptResponse carries the failure detail.
    INSERT INTO dbo.tblErrors (
        InstanceId, ErrorType, ErrorMessage, ErrorTimestamp,
        ApiConsumer, LabProfileId, LabProfileName, SeriesId, SeriesName,
        DatacenterName, LabHostName,
        DeliveryRegionName, Country, City, State, PlatformId, IsExam, StartupDuration
    )
    SELECT
        c.Id,
        CASE WHEN LOWER(JSON_VALUE(sr.value, '$.PlatformError')) = 'true'
             THEN 'PlatformError' ELSE 'ScriptError' END           AS ErrorType,
        CONCAT(
            ISNULL(JSON_VALUE(act.value, '$.ActivityName'), 'Activity'),
            ' (ScriptId ', JSON_VALUE(sr.value, '$.ScriptId'), '): ',
            ISNULL(JSON_VALUE(sr.value, '$.ScriptResponse'), 'Script reported an error.')
        )                                                          AS ErrorMessage,
        c.StartDateTime                                            AS ErrorTimestamp,
        c.ApiConsumer, c.LabProfileId, c.LabProfileName, c.SeriesId, c.SeriesName,
        c.DatacenterName, c.LabHostName,
        c.DeliveryRegionName, c.Country, c.City, c.State, c.PlatformId, c.IsExam, c.StartupDuration
    FROM #ErrInstances c
    CROSS APPLY OPENJSON(c.ActivityResults) AS act
    CROSS APPLY OPENJSON(JSON_QUERY(act.value, '$.ScriptResults')) AS sr
    WHERE ISJSON(c.ActivityResults) = 1
      AND ISJSON(JSON_QUERY(act.value, '$.ScriptResults')) = 1
      AND (LOWER(JSON_VALUE(sr.value, '$.ScriptError'))   = 'true'
           OR LOWER(JSON_VALUE(sr.value, '$.PlatformError')) = 'true');

    -- 3) Creation / provisioning failures from CompletionStatus (always logged).
    INSERT INTO dbo.tblErrors (
        InstanceId, ErrorType, ErrorMessage, ErrorTimestamp,
        ApiConsumer, LabProfileId, LabProfileName, SeriesId, SeriesName,
        DatacenterName, LabHostName,
        DeliveryRegionName, Country, City, State, PlatformId, IsExam, StartupDuration
    )
    SELECT
        c.Id,
        c.CompletionStatus,
        CONCAT('Lab launch failure reported by CompletionStatus: ', c.CompletionStatus),
        c.StartDateTime,
        c.ApiConsumer, c.LabProfileId, c.LabProfileName, c.SeriesId, c.SeriesName,
        c.DatacenterName, c.LabHostName,
        c.DeliveryRegionName, c.Country, c.City, c.State, c.PlatformId, c.IsExam, c.StartupDuration
    FROM #ErrInstances c
    WHERE c.CompletionStatus IN ('Lab Creation Failed', 'Storage Provisioning Failed', 'Lab Provisioning Failed');

    DROP TABLE #ErrInstances;
END;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCEDURE: usp_DistributeActivities
-- Shreds the scored ActivityResults[] (and ActivityGroupResults[]) JSON arrays
-- into dbo.tblActivities, enriched with instance context. Idempotent per window.
-- Skills[] is intentionally NOT used here: it is lab-profile metadata, not
-- student results.
--
-- ActivityResults[] element shape (confirmed from a live mode=10 sample):
--     { "ActivityId", "ActivityName", "Scored", "Score", "Passed",
--       "ActivityType" (numeric code 0/10/20/30/40), ... }
-- There is no per-activity PossibleScore or Duration, so those land NULL.
-- Only scored activities (Scored = true) are promoted.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.usp_DistributeActivities
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH Deduped AS (
        SELECT r.*,
               ROW_NUMBER() OVER (PARTITION BY r.Id ORDER BY r.IngestedAt DESC) AS rn
        FROM dbo.tblInstancesRaw r
        WHERE r.Id IS NOT NULL
    ),
    Curr AS (
        SELECT d.*
        FROM Deduped d
        INNER JOIN dbo.tblInstances i ON i.InstanceId = d.Id
        WHERE d.rn = 1
    )
    SELECT * INTO #ActInstances FROM Curr;

    -- Clear existing activities for this batch so re-runs stay idempotent.
    DELETE a
    FROM dbo.tblActivities a
    INNER JOIN #ActInstances c ON c.Id = a.InstanceId;

    -- Shred ActivityResults[] and ActivityGroupResults[] together.
    INSERT INTO dbo.tblActivities (
        InstanceId, ActivityName, ActivityType, Score, PossibleScore,
        PassStatus, Duration,
        LabProfileId, LabProfileName, SeriesId, SeriesName, ApiConsumer
    )
    SELECT
        c.Id,
        ISNULL(JSON_VALUE(act.value, '$.ActivityName'), 'Unknown')  AS ActivityName,
        JSON_VALUE(act.value, '$.ActivityType')                     AS ActivityType,
        TRY_CONVERT(FLOAT, JSON_VALUE(act.value, '$.Score'))        AS Score,
        NULL                                                        AS PossibleScore,
        CASE LOWER(JSON_VALUE(act.value, '$.Passed'))
             WHEN 'true'  THEN 'Pass'
             WHEN 'false' THEN 'Fail'
        END                                                         AS PassStatus,
        NULL                                                        AS Duration,
        c.LabProfileId, c.LabProfileName, c.SeriesId, c.SeriesName, c.ApiConsumer
    FROM #ActInstances c
    CROSS APPLY (
        SELECT c.ActivityResults      AS arr
        UNION ALL
        SELECT c.ActivityGroupResults AS arr
    ) AS src
    CROSS APPLY OPENJSON(src.arr) AS act
    WHERE ISJSON(src.arr) = 1
      AND LOWER(ISNULL(JSON_VALUE(act.value, '$.Scored'), 'true')) = 'true';

    DROP TABLE #ActInstances;
END;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCEDURE: usp_UpdateGeoBuckets  (enriched)
-- Aggregates curated instances in a time window into geo-launch buckets,
-- now including coordinates, error totals, average latency / startup duration,
-- and unique-user counts. Window bounds are the API-call epoch parameters.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.usp_UpdateGeoBuckets
    @WindowStartEpoch   BIGINT,
    @WindowEndEpoch     BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @WindowStart DATETIME2(3) = DATEADD(SECOND, @WindowStartEpoch, '1970-01-01T00:00:00');
    DECLARE @WindowEnd   DATETIME2(3) = DATEADD(SECOND, @WindowEndEpoch,   '1970-01-01T00:00:00');

    DELETE FROM dbo.tblGeoBuckets
    WHERE BucketWindowStart = @WindowStart
      AND BucketWindowEnd   = @WindowEnd;

    INSERT INTO dbo.tblGeoBuckets (
        IpAddress, Country, Region, City, DeliveryRegionName,
        InstanceCount, SeriesId, SeriesName,
        Latitude, Longitude, ErrorCount, AvgLatency, AvgStartupDuration, UniqueUsers,
        BucketWindowStart, BucketWindowEnd
    )
    SELECT
        IpAddress,
        Country,
        Region,
        City,
        DeliveryRegionName,
        COUNT(*)                                                AS InstanceCount,
        SeriesId,
        SeriesName,
        MIN(Latitude)                                           AS Latitude,
        MIN(Longitude)                                          AS Longitude,
        SUM(ErrorCount)                                         AS ErrorCount,
        CAST(AVG(CAST(LastLatency     AS FLOAT)) AS DECIMAL(10,2)) AS AvgLatency,
        CAST(AVG(CAST(StartupDuration AS FLOAT)) AS DECIMAL(10,2)) AS AvgStartupDuration,
        COUNT(DISTINCT UserId)                                  AS UniqueUsers,
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

PRINT 'Distribution procedures deployed.';
GO

-- =============================================================================
-- GRANTS — the ADF managed identity (adf-skillable-dashboard) executes these.
-- Run once after deploying the procedures.
-- =============================================================================
-- GRANT EXECUTE ON OBJECT::dbo.usp_TruncateStaging      TO [adf-skillable-dashboard];
-- GRANT EXECUTE ON OBJECT::dbo.usp_DistributeInstances  TO [adf-skillable-dashboard];
-- GRANT EXECUTE ON OBJECT::dbo.usp_DistributeErrors     TO [adf-skillable-dashboard];
-- GRANT EXECUTE ON OBJECT::dbo.usp_DistributeActivities TO [adf-skillable-dashboard];
-- GRANT EXECUTE ON OBJECT::dbo.usp_UpdateGeoBuckets     TO [adf-skillable-dashboard];
-- GRANT INSERT, SELECT ON OBJECT::dbo.tblInstancesRaw   TO [adf-skillable-dashboard];
