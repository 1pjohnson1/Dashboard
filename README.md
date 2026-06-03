# Skillable Lab Telemetry Dashboard — Azure Edition

> **Author:** Penelope Johnson, Director — Lab Development  
> **Date:** May 2026  
> **Version:** 3.0 (Azure Migration)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AZURE DATA FACTORY  (~$2-5/mo)                  │
│                                                                     │
│  ┌───────────────┐   ┌──────────────┐   ┌────────────────────────┐ │
│  │ Skillable API │──▶│  Pipeline    │──▶│   Azure SQL Database   │ │
│  │ (REST)        │   │  Copy +      │   │   (Free / Basic Tier)  │ │
│  │ /api/v3/      │   │  Transform   │   │                        │ │
│  │ details       │   │  ForEach     │   │  tblInstances          │ │
│  └───────────────┘   │  Pagination  │   │  tblErrors             │ │
│                      └──────────────┘   │  tblActivities         │ │
│  Trigger: Every 6 hrs                   │  tblGeoBuckets         │ │
│  (00:00, 06:00, 12:00, 18:00 EST)       └──────────┬─────────────┘ │
└─────────────────────────────────────────────────────┼───────────────┘
                                                      │
┌─────────────────────────────────────────────────────┼───────────────┐
│              AZURE STATIC WEB APPS  (Free)          │               │
│                                                     │               │
│  ┌──────────────────────┐   ┌───────────────────────▼─────────┐    │
│  │   React Dashboard    │◄──│  Azure Functions API (managed)  │    │
│  │                      │   │                                 │    │
│  │  📊 Overview & Health│   │  /api/GetOverviewMetrics        │    │
│  │  🔴 Error Deep Dive  │   │  /api/GetErrorDeepDive          │    │
│  │  🚀 Concurrent Launches│  │  /api/GetConcurrentLaunches     │    │
│  │  🌍 Geo Intelligence  │   │  /api/GetGeoBucketAnalysis      │    │
│  └──────────────────────┘   └─────────────────────────────────┘    │
│                                                                     │
│  CI/CD: GitHub Actions ──▶ Auto-deploy on push to main             │
└─────────────────────────────────────────────────────────────────────┘
```

## Folder Structure

```
skillable-lab-dashboard-azure/
├── README.md                          ← You are here
├── IMPLEMENTATION_GUIDE.md            ← Full step-by-step setup guide
├── sql/
│   ├── schema.sql                     ← Tables, indexes, views
│   └── stored_procedures.sql          ← Upsert + query procs
├── adf/
│   └── arm_template.json              ← ADF ARM deployment template
├── api/
│   ├── package.json
│   ├── host.json
│   ├── shared/
│   │   └── db.js                      ← SQL connection helper
│   ├── GetOverviewMetrics/
│   │   ├── index.js
│   │   └── function.json
│   ├── GetErrorDeepDive/
│   │   ├── index.js
│   │   └── function.json
│   ├── GetConcurrentLaunches/
│   │   ├── index.js
│   │   └── function.json
│   └── GetGeoBucketAnalysis/
│       ├── index.js
│       └── function.json
├── dashboard/
│   ├── package.json
│   ├── staticwebapp.config.json
│   └── src/
│       ├── index.js
│       ├── App.js
│       ├── theme.js
│       ├── api/
│       │   └── client.js
│       ├── components/
│       │   ├── KpiCard.jsx
│       │   ├── AlertBanner.jsx
│       │   ├── Sidebar.jsx
│       │   ├── ChartCard.jsx
│       │   ├── DataTable.jsx
│       │   └── RegionSlicer.jsx
│       └── pages/
│           ├── OverviewPage.jsx
│           ├── ErrorDeepDivePage.jsx
│           ├── ConcurrentLaunchesPage.jsx
│           └── GeoBucketsPage.jsx
└── .github/
    └── workflows/
        └── deploy.yml                 ← CI/CD to Azure Static Web Apps
```

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_ORG/skillable-lab-dashboard-azure.git
cd skillable-lab-dashboard-azure

# 2. Follow the Implementation Guide
#    Open IMPLEMENTATION_GUIDE.md and complete Phases 1-6

# 3. Local development (React dashboard)
cd dashboard
npm install
npm start          # http://localhost:3000

# 4. Local development (Azure Functions API)
cd api
npm install
func start          # http://localhost:7071/api/
```

## Estimated Monthly Cost

| Resource                  | Tier         | Cost        |
|---------------------------|--------------|-------------|
| Azure Data Factory        | Consumption  | ~$2-5       |
| Azure SQL Database        | Free / Basic | $0-5        |
| Azure Static Web Apps     | Free         | $0          |
| Azure Functions (managed) | Consumption  | $0 (1M free)|
| **Total**                 |              | **~$2-10**  |

## Key Links

- [Implementation Guide](./IMPLEMENTATION_GUIDE.md)
- [Skillable API Docs](https://docs.skillable.com)
- [Azure Data Factory REST Connector](https://learn.microsoft.com/en-us/azure/data-factory/connector-rest)
- [Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/)
