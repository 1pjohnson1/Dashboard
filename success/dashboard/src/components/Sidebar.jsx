import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer, Box, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Typography, Divider, Tooltip
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BugReportIcon from '@mui/icons-material/BugReport';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import PublicIcon from '@mui/icons-material/Public';
import ScienceIcon from '@mui/icons-material/Science';
import SyncIcon from '@mui/icons-material/Sync';
import { fetchRefreshStatus } from '../api/client';

const NAV_ITEMS = [
  { label: 'Overview & Health', path: '/', icon: <DashboardIcon /> },
  { label: 'Error Deep Dive', path: '/errors', icon: <BugReportIcon /> },
  { label: 'Concurrent Launches', path: '/concurrent', icon: <RocketLaunchIcon /> },
  { label: 'Geo Intelligence', path: '/geo', icon: <PublicIcon /> },
];

function formatRefreshTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'UTC', timeZoneName: 'short',
  });
}

export default function Sidebar({ width = 260 }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(null);

  useEffect(() => {
    fetchRefreshStatus()
      .then(setRefresh)
      .catch(() => {});
  }, []);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          backgroundColor: '#0a0a1a',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        },
      }}
    >
      {/* Logo / Title */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <ScienceIcon sx={{ color: 'primary.main', fontSize: 32 }} />
        <Box>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
            Skillable Lab
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Telemetry Dashboard
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* Navigation */}
      <List sx={{ px: 1, pt: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 2,
                  py: 1.2,
                  backgroundColor: isActive ? 'rgba(0, 210, 255, 0.1)' : 'transparent',
                  borderLeft: isActive ? '3px solid' : '3px solid transparent',
                  borderLeftColor: isActive ? 'primary.main' : 'transparent',
                  '&:hover': {
                    backgroundColor: isActive
                      ? 'rgba(0, 210, 255, 0.15)'
                      : 'rgba(255,255,255,0.04)',
                  },
                }}
              >
                <ListItemIcon sx={{ color: isActive ? 'primary.main' : 'text.secondary', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#fff' : 'text.secondary',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Last Refresh */}
      <Box sx={{ mx: 1, mt: 'auto' }}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 1.5 }} />
        <Tooltip
          title={refresh?.windowEnd ? `Data window end: ${formatRefreshTime(refresh.windowEnd)} UTC` : 'No refresh recorded yet'}
          placement="right"
          arrow
        >
          <Box
            sx={{
              display: 'flex', alignItems: 'flex-start', gap: 1,
              px: 1.5, py: 1.25,
              borderRadius: 2,
              backgroundColor: 'rgba(0,210,255,0.05)',
              border: '1px solid rgba(0,210,255,0.1)',
              cursor: 'default',
            }}
          >
            <SyncIcon sx={{ fontSize: 15, color: 'primary.main', mt: '2px', flexShrink: 0 }} />
            <Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                Data current as of
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: refresh?.windowEnd ? '#fff' : 'text.secondary', mt: 0.4, lineHeight: 1.3 }}>
                {refresh?.windowEnd ? formatRefreshTime(refresh.windowEnd) : '—'}
              </Typography>
            </Box>
          </Box>
        </Tooltip>
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.06)', mt: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center' }}>
          v3.0 — Azure Edition
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center', fontSize: '0.65rem' }}>
          Lab Development Team
        </Typography>
      </Box>
    </Drawer>
  );
}
