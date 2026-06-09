import React, { useState, useEffect, useCallback } from 'react';
import { Box, Grid, Typography, CircularProgress, Button } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import GroupsIcon from '@mui/icons-material/Groups';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Cell
} from 'recharts';
import KpiCard from '../components/KpiCard';
import AlertBanner from '../components/AlertBanner';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import { fetchConcurrentLaunches } from '../api/client';
import { CHART_COLORS, CHART_PALETTE } from '../theme';

const WINDOW_TABLE_COLUMNS = [
  { field: 'region', headerName: 'Region', width: 200 },
  { field: 'windowStart', headerName: 'Window Start', width: 180,
    format: (val) => val ? new Date(val).toLocaleString() : '—'
  },
  { field: 'windowEnd', headerName: 'Window End', width: 180,
    format: (val) => val ? new Date(val).toLocaleString() : '—'
  },
  { field: 'concurrentCount', headerName: 'Concurrent', width: 120, align: 'right' },
  { field: 'thresholdBreached', headerName: 'Breached', width: 100,
    format: (val) => val ? '⚠️ Yes' : '✅ No'
  },
];

export default function ConcurrentLaunchesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchConcurrentLaunches(24);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load concurrent launch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 2 }}>
        <Typography color="error" variant="h6">{error}</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData}>Retry</Button>
      </Box>
    );
  }

  const formatTime = (val) => {
    if (!val) return '';
    const d = new Date(val);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const breachedWindows = data.windows.filter(w => w.thresholdBreached);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ color: '#fff' }}>Concurrent Launches</Typography>
          <Typography variant="subtitle1">Last {data.periodHours} hours — 5-minute window analysis</Typography>
        </Box>
        <Button size="small" startIcon={<RefreshIcon />} onClick={loadData}>Refresh</Button>
      </Box>

      {/* Threshold Alert */}
      <AlertBanner
        message={`Concurrent launch threshold breached (>4) — Max: ${data.maxConcurrent} simultaneous launches`}
        severity="warning"
        details={breachedWindows.slice(0, 5).map(w =>
          `${w.region}: ${w.concurrentCount} at ${new Date(w.windowStart).toLocaleTimeString()}`
        )}
        visible={data.thresholdBreached}
      />

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <KpiCard
            title="Max Concurrent"
            value={data.maxConcurrent}
            subtitle={data.thresholdBreached ? '⚠️ Above threshold' : '✅ Within threshold'}
            icon={<GroupsIcon />}
            color={data.thresholdBreached ? CHART_COLORS.warning : CHART_COLORS.success}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard
            title="Breached Windows"
            value={breachedWindows.length}
            subtitle="Windows exceeding 4 concurrent"
            icon={<GroupsIcon />}
            color={CHART_COLORS.error}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard
            title="Regions Monitored"
            value={data.byRegion.length}
            subtitle="Active delivery regions"
            icon={<GroupsIcon />}
            color={CHART_COLORS.info}
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Concurrent Over Time */}
        <Grid item xs={12} lg={7}>
          <ChartCard title="Concurrent Launches Over Time" subtitle="5-minute windows — dashed line = threshold (4)" height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.windows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="concurrentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="windowStart" tickFormatter={formatTime} stroke="#546e7a" fontSize={11} />
                <YAxis stroke="#546e7a" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#16213e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.8rem' }}
                  labelFormatter={(val) => val ? new Date(val).toLocaleString() : ''}
                />
                <ReferenceLine y={4} stroke={CHART_COLORS.error} strokeDasharray="5 5" label={{ value: 'Threshold (4)', position: 'right', fill: CHART_COLORS.error, fontSize: 11 }} />
                <Area type="monotone" dataKey="concurrentCount" stroke={CHART_COLORS.primary} fill="url(#concurrentGrad)" strokeWidth={2} name="Concurrent" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Max by Region */}
        <Grid item xs={12} lg={5}>
          <ChartCard title="Max Concurrent by Region" height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byRegion} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" stroke="#546e7a" fontSize={11} />
                <YAxis dataKey="region" type="category" stroke="#546e7a" fontSize={10} width={140} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#16213e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.8rem' }}
                />
                <Bar dataKey="maxConcurrent" radius={[0, 4, 4, 0]} maxBarSize={30}>
                  {data.byRegion.map((entry, idx) => (
                    <Cell key={idx} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* Breached Windows Table */}
      <DataTable
        title="Launch Windows"
        columns={WINDOW_TABLE_COLUMNS}
        rows={data.windows}
        searchable
        maxHeight={400}
      />
    </Box>
  );
}
