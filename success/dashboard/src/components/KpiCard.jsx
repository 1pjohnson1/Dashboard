import React from 'react';
import { Card, CardContent, Box, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

/**
 * KpiCard — Displays a single KPI metric with optional trend indicator.
 *
 * Props:
 *   title       - Card title (e.g., "Total Launches")
 *   value       - Main metric value (e.g., "1,247" or 94.3)
 *   subtitle    - Descriptive subtitle (e.g., "Last 7 days")
 *   icon        - MUI icon element (e.g., <RocketLaunchIcon />)
 *   color       - Accent color for the top bar and icon (e.g., "#00d2ff")
 *   trend       - Optional: { direction: 'up'|'down'|'flat', value: '12%' }
 *   loading     - Show skeleton placeholder
 */
export default function KpiCard({ title, value, subtitle, icon, color = '#00d2ff', trend, loading }) {
  const TrendIcon = trend?.direction === 'up'
    ? TrendingUpIcon
    : trend?.direction === 'down'
    ? TrendingDownIcon
    : TrendingFlatIcon;

  const trendColor = trend?.direction === 'up'
    ? '#00e676'
    : trend?.direction === 'down'
    ? '#e94560'
    : '#a0aec0';

  return (
    <Card
      sx={{
        position: 'relative',
        overflow: 'visible',
        minWidth: 200,
        flex: '1 1 220px',
      }}
    >
      {/* Accent bar at top */}
      <Box
        sx={{
          height: 4,
          borderRadius: '12px 12px 0 0',
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
        }}
      />

      <CardContent sx={{ pt: 2, pb: '16px !important' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" sx={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', mb: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#fff', fontSize: '1.75rem', lineHeight: 1 }}>
              {loading ? '—' : value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>

          {icon && (
            <Box
              sx={{
                p: 1,
                borderRadius: 2,
                backgroundColor: `${color}15`,
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {icon}
            </Box>
          )}
        </Box>

        {/* Trend indicator */}
        {trend && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
            <TrendIcon sx={{ fontSize: 16, color: trendColor }} />
            <Typography variant="caption" sx={{ color: trendColor, fontWeight: 600 }}>
              {trend.value}
            </Typography>
            {trend.label && (
              <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>
                {trend.label}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
