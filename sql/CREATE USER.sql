CREATE USER [adf-skillable-dashboard] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [adf-skillable-dashboard];
ALTER ROLE db_datawriter ADD MEMBER [adf-skillable-dashboard];


CREATE TYPE dbo.InstanceTableType AS TABLE (
    InstanceId INT,
    LabProfileId INT,
    LabProfileName NVARCHAR(500),
    SeriesId INT,
    SeriesName NVARCHAR(255),
    UserId NVARCHAR(100),
    UserFirstName NVARCHAR(100),
    UserLastName NVARCHAR(100),
    UserEmail NVARCHAR(255),
    ClassId INT,
    StartEpoch BIGINT,
    EndEpoch BIGINT,
    LastActivityEpoch BIGINT,
    ExpirationEpoch BIGINT,
    State NVARCHAR(50)
);



ALTER TABLE dbo.tblInstances 
ADD UserEmail NVARCHAR(255) NULL;
