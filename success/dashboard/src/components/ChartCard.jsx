import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

/**
 * ChartCard — Wrapper card for chart visualizations.
 *
 * Props:
 *   title      - Chart title
 *   subtitle   - Optional description
 *   height     - Chart area height (default 300)
 *   children   - Recharts components
 *   action     - Optional action element (e.g., dropdown filter)
 */
export default function ChartCard({ title, subtitle, height = 300, children, action }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action && <Box>{action}</Box>}
        </Box>

        <Box sx={{ width: '100%', height }}>
          {children}
        </Box>
      </CardContent>
    </Card>
  );
}
