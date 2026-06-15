import React from 'react';
import { Alert, AlertTitle, Collapse, Box, Chip, Stack } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/**
 * AlertBanner — Displays threshold breach alerts with details.
 *
 * Props:
 *   message    - Main alert message
 *   severity   - 'error' | 'warning' | 'info' | 'success'
 *   details    - Array of detail strings (e.g., breached consumer names)
 *   visible    - Boolean to show/hide with animation
 *   onClose    - Optional close handler
 */
export default function AlertBanner({ message, severity = 'warning', details = [], visible = true, onClose }) {
  return (
    <Collapse in={visible}>
      <Alert
        severity={severity}
        icon={<WarningAmberIcon />}
        onClose={onClose}
        sx={{
          mb: 2,
          borderRadius: 2,
          backgroundColor: severity === 'error'
            ? 'rgba(233, 69, 96, 0.12)'
            : severity === 'warning'
            ? 'rgba(255, 171, 64, 0.12)'
            : 'rgba(0, 210, 255, 0.08)',
          border: '1px solid',
          borderColor: severity === 'error'
            ? 'rgba(233, 69, 96, 0.3)'
            : severity === 'warning'
            ? 'rgba(255, 171, 64, 0.3)'
            : 'rgba(0, 210, 255, 0.2)',
          '& .MuiAlert-icon': {
            color: severity === 'error' ? '#e94560' : severity === 'warning' ? '#ffab40' : '#00d2ff',
          },
        }}
      >
        <AlertTitle sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
          {message}
        </AlertTitle>
        {details.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {details.map((detail, i) => (
                <Chip
                  key={i}
                  label={detail}
                  size="small"
                  color={severity}
                  variant="outlined"
                  sx={{ fontSize: '0.75rem' }}
                />
              ))}
            </Stack>
          </Box>
        )}
      </Alert>
    </Collapse>
  );
}
