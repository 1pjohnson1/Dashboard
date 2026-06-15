import React, { useState, useEffect, useCallback } from 'react';
import { Box, Grid, Typography, CircularProgress, Button } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PublicIcon from '@mui/icons-material/Public';
import PlaceIcon from '@mui/icons-material/Place';
import SpeedIcon from '@mui/icons-material/Speed';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell
} from 'recharts';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import RegionSlicer from '../components/RegionSlicer';
import { fetchGeoBucketAnalysis } from '../api/client';
import { CHART_COLORS, CHART_PALETTE } from '../theme';

const GEO_TABLE_COLUMNS = [
  { field: 'ipAddress', headerName: 'IP Address', width: 140 },
  { field: 'country', headerName: 'Country', width: 140 },
  { field: 'region', headerName: 'Region', width: 140 },
  { field: 'city', headerName: 'City', width: 140 },
  { field: 'deliveryRegion', headerName: 'Delivery Region', width: 180 },
  { field: 'instanceCount', headerName: 'Launches', width: 100, align: 'right' },
  { field: 'seriesName', headerName: 'Series', width: 200 },
  { field: 'windowStart', headerName: 'Window Start', width: 180,
    format: (val) => val ? new Date(val).toLocaleString() : '—'
  },
];

export default function GeoBucketsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState('all');

  const loadData = useCallback(async (region = 'all') => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchGeoBucketAnalysis(region, 7);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load geo data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedRegion);
  }, [loadData, selectedRegion]);

  const handleRegionChange = (region) => {
    setSelectedRegion(region);
  };

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  if (error && !data) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 2 }}>
        <Typography color="error" variant="h6">{error}</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => loadData(selectedRegion)}>Retry</Button>
      </Box>
    );
  }

  const totalLaunches = data.regions.reduce((sum, r) => sum + r.totalLaunches, 0);
  const topRegion = data.regions.length > 0
    ? data.regions.reduce((max, r) => r.totalLaunches > max.totalLaunches ? r : max, data.regions[0])
    : { region: 'N/A', totalLaunches: 0 };
  const avgLatency = data.regions.length > 0
    ? (data.regions.reduce((sum, r) => sum + (r.avgLatencyMs || 0), 0) / data.regions.length).toFixed(1)
    : 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ color: '#fff' }}>Geo Intelligence</Typography>
          <Typography variant="subtitle1">Last {data.periodDays} days — Regional launch and latency analysis</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <RegionSlicer
            regions={data.availableRegions}
            selectedRegion={selectedRegion}
            onChange={handleRegionChange}
          />
          <Button size="small" startIcon={<RefreshIcon />} onClick={() => loadData(selectedRegion)}>
            Refresh
          </Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <KpiCard
            title="Total Regions"
            value={data.regions.length}
            subtitle={`${totalLaunches.toLocaleString()} total launches`}
            icon={<PublicIcon />}
            color={CHART_COLORS.primary}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard
            title="Top Region"
            value={topRegion.region}
            subtitle={`${topRegion.totalLaunches?.toLocaleString()} launches`}
            icon={<PlaceIcon />}
            color={CHART_COLORS.success}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KpiCard
            title="Avg Latency"
            value={`${avgLatency} ms`}
            subtitle="Across selected regions"
            icon={<SpeedIcon />}
            color={CHART_COLORS.secondary}
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Launches by Region */}
        <Grid item xs={12}>
          <ChartCard title="Launches by Delivery Region" subtitle="Total instance launches per region" height={350}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.regions} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" stroke="#546e7a" fontSize={11} />
                <YAxis dataKey="region" type="category" stroke="#546e7a" fontSize={10} width={180} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#16213e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.8rem' }}
                  formatter={(val, name) => {
                    if (name === 'totalLaunches') return [val.toLocaleString(), 'Launches'];
                    if (name === 'errorRate') return [`${val}%`, 'Error Rate'];
                    return [val, name];
                  }}
                />
                <Bar dataKey="totalLaunches" name="totalLaunches" radius={[0, 4, 4, 0]} maxBarSize={30}>
                  {data.regions.map((entry, idx) => (
                    <Cell key={idx} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* Geo Bucket Table */}
      <DataTable
        title="Geo Launch Buckets"
        columns={GEO_TABLE_COLUMNS}
        rows={data.geoBuckets}
        searchable
        maxHeight={400}
        searchFields={['ipAddress', 'country', 'region', 'city', 'deliveryRegion', 'seriesName']}
      />
    </Box>
  );
}
