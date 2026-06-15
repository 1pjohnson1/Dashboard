import React, { useState, useEffect, useCallback } from 'react';
import { Box, Grid, Typography, CircularProgress, Button, Chip } from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SpeedIcon from '@mui/icons-material/Speed';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import { fetchOverviewMetrics } from '../api/client';
import { CHART_COLORS, CHART_PALETTE } from '../theme';

const STATUS_COLORS = {
  Complete: CHART_COLORS.success,
  Cancelled: CHART_COLORS.warning,
  Error: CHART_COLORS.error,
  Running: CHART_COLORS.primary,
  Building: CHART_COLORS.info,
  Starting: CHART_COLORS.accent2,
  Saving: CHART_COLORS.secondary,
};

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchOverviewMetrics(7);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load overview data');
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
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData}>
          Retry
        </Button>
      </Box>
    );
  }

  const formatHour = (val) => {
    if (!val) return '';
    const d = new Date(val);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ color: '#fff' }}>Overview & Health</Typography>
          <Typography variant="subtitle1">Last {data.periodDays} days — Lab instance telemetry</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip label={`${data.totalInstances} total instances`} size="small" color="primary" variant="outlined" />
          <Button size="small" startIcon={<RefreshIcon />} onClick={loadData}>Refresh</Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Total Launches"
            value={data.totalInstances?.toLocaleString()}
            subtitle={`Last ${data.periodDays} days`}
            icon={<RocketLaunchIcon />}
            color={CHART_COLORS.primary}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Success Rate"
            value={`${data.successRate}%`}
            subtitle={`${data.completedInstances?.toLocaleString()} completed`}
            icon={<CheckCircleIcon />}
            color={CHART_COLORS.success}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Avg Latency"
            value={`${data.avgLatencyMs} ms`}
            subtitle={`Startup: ${data.avgStartupDuration}s avg`}
            icon={<SpeedIcon />}
            color={CHART_COLORS.secondary}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Active Labs"
            value={data.activeLabsNow?.toLocaleString()}
            subtitle="Currently running"
            icon={<PlayArrowIcon />}
            color={CHART_COLORS.warning}
          />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={2}>
        {/* Launch Trend Line Chart */}
        <Grid item xs={12} lg={8}>
          <ChartCard title="Launches Over Time" subtitle="Hourly launch count with error overlay" height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.launchesOverTime} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="hour" tickFormatter={formatHour} stroke="#546e7a" fontSize={11} />
                <YAxis yAxisId="left" stroke="#546e7a" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" stroke="#546e7a" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#16213e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.8rem' }}
                  labelFormatter={formatHour}
                />
                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                <Line yAxisId="left" type="monotone" dataKey="launches" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} name="Launches" />
                <Line yAxisId="right" type="monotone" dataKey="errors" stroke={CHART_COLORS.error} strokeWidth={2} dot={false} name="Errors" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Status Breakdown Pie Chart */}
        <Grid item xs={12} lg={4}>
          <ChartCard title="Status Breakdown" subtitle="Instance completion status" height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.statusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  label={({ status, count }) => `${status}: ${count}`}
                  labelLine={false}
                >
                  {data.statusBreakdown.map((entry, idx) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS[entry.status] || CHART_PALETTE[idx % CHART_PALETTE.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#16213e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.8rem' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
}
