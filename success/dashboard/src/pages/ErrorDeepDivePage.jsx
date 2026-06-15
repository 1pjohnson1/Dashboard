import React, { useState, useEffect, useCallback } from 'react';
import { Box, Grid, Typography, CircularProgress, Button, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts';
import KpiCard from '../components/KpiCard';
import AlertBanner from '../components/AlertBanner';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import { fetchErrorDeepDive } from '../api/client';
import { CHART_COLORS } from '../theme';
import BugReportIcon from '@mui/icons-material/BugReport';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const ERROR_TABLE_COLUMNS = [
  { field: 'instanceId', headerName: 'Instance ID', width: 110 },
  { field: 'labProfileName', headerName: 'Lab Profile', width: 250 },
  { field: 'seriesName', headerName: 'Series', width: 150 },
  { field: 'errorType', headerName: 'Error Type', width: 160,
    format: (val) => (
      <Chip label={val} size="small" color="error" variant="outlined" sx={{ fontSize: '0.7rem' }} />
    )
  },
  { field: 'errorMessage', headerName: 'Message', width: 300 },
  { field: 'apiConsumer', headerName: 'API Consumer', width: 200 },
  { field: 'datacenterName', headerName: 'Datacenter', width: 160 },
  { field: 'timestamp', headerName: 'Timestamp', width: 170,
    format: (val) => val ? new Date(val).toLocaleString() : '—'
  },
];

export default function ErrorDeepDivePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchErrorDeepDive(7);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load error data');
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

  const totalErrors = data.errorRateByConsumer.reduce((sum, c) => sum + c.totalErrors, 0);
  const avgErrorRate = data.errorRateByConsumer.length > 0
    ? (data.errorRateByConsumer.reduce((sum, c) => sum + c.errorRate, 0) / data.errorRateByConsumer.length).toFixed(2)
    : 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ color: '#fff' }}>Error Deep Dive</Typography>
          <Typography variant="subtitle1">Last {data.periodDays} days — Error analysis by consumer, type, and trend</Typography>
        </Box>
        <Button size="small" startIcon={<RefreshIcon />} onClick={loadData}>Refresh</Button>
      </Box>

      {/* Threshold Alert */}
      <AlertBanner
        message="Error rate threshold breached (>2%) for one or more API consumers"
        severity="error"
        details={data.breachedConsumers}
        visible={data.thresholdBreached}
      />

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <KpiCard
            title="Total Errors"
            value={totalErrors.toLocaleString()}
            subtitle={`Across ${data.errorRateByConsumer.length} consumers`}
            icon={<BugReportIcon />}
            color={CHART_COLORS.error}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard
            title="Avg Error Rate"
            value={`${avgErrorRate}%`}
            subtitle="Across all consumers"
            icon={<ErrorOutlineIcon />}
            color={CHART_COLORS.warning}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard
            title="Error Types"
            value={data.errorsByType.length}
            subtitle="Unique categories"
            icon={<BugReportIcon />}
            color={CHART_COLORS.secondary}
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Error Rate by Consumer */}
        <Grid item xs={12} lg={7}>
          <ChartCard title="Error Rate by API Consumer" subtitle="Red dashed line = 2% threshold" height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.errorRateByConsumer} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="apiConsumer" stroke="#546e7a" fontSize={10} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="#546e7a" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#16213e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.8rem' }}
                  formatter={(val) => [`${val}%`, 'Error Rate']}
                />
                <ReferenceLine y={2} stroke={CHART_COLORS.error} strokeDasharray="5 5" label={{ value: '2% threshold', position: 'right', fill: CHART_COLORS.error, fontSize: 11 }} />
                <Bar dataKey="errorRate" fill={CHART_COLORS.error} radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Daily Error Trend */}
        <Grid item xs={12} lg={5}>
          <ChartCard title="Daily Error Trend" subtitle="Error count by day" height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.errorTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="#546e7a" fontSize={11}
                  tickFormatter={(val) => val ? new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                />
                <YAxis stroke="#546e7a" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#16213e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.8rem' }}
                />
                <Line type="monotone" dataKey="errorCount" stroke={CHART_COLORS.error} strokeWidth={2} dot={{ r: 3 }} name="Errors" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* Error Table */}
      <DataTable
        title="Recent Errors"
        columns={ERROR_TABLE_COLUMNS}
        rows={data.recentErrors}
        searchable
        maxHeight={400}
        searchFields={['labProfileName', 'errorType', 'errorMessage', 'apiConsumer', 'datacenterName']}
      />
    </Box>
  );
}
