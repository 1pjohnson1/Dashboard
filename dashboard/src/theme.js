import { createTheme } from '@mui/material/styles';

/**
 * Dark theme for the Skillable Lab Telemetry Dashboard.
 * Color palette inspired by the existing Power BI dashboard.
 */

// Chart color palette — use these in Recharts components
export const CHART_COLORS = {
  primary:    '#00d2ff',  // Cyan — primary metric
  secondary:  '#7b2ff7',  // Purple — secondary metric
  success:    '#00e676',  // Green — success/complete
  error:      '#e94560',  // Red — errors/alerts
  warning:    '#ffab40',  // Orange — warnings
  info:       '#448aff',  // Blue — informational
  muted:      '#546e7a',  // Gray — muted/inactive
  accent1:    '#0f3460',  // Dark blue — bar fills
  accent2:    '#ff6e40',  // Coral — highlights
  accent3:    '#76ff03',  // Lime — positive delta
};

export const CHART_PALETTE = [
  '#00d2ff', '#7b2ff7', '#e94560', '#ffab40',
  '#00e676', '#448aff', '#ff6e40', '#76ff03',
  '#0f3460', '#546e7a'
];

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00d2ff',
      light: '#5edfff',
      dark: '#0097a7',
      contrastText: '#000000',
    },
    secondary: {
      main: '#7b2ff7',
      light: '#b47cff',
      dark: '#4a00c3',
    },
    error: {
      main: '#e94560',
      light: '#ff7a8a',
      dark: '#b71c3a',
    },
    warning: {
      main: '#ffab40',
      light: '#ffd180',
      dark: '#c67c00',
    },
    success: {
      main: '#00e676',
      light: '#66ffa6',
      dark: '#00b248',
    },
    background: {
      default: '#1a1a2e',
      paper: '#16213e',
    },
    text: {
      primary: '#e0e0e0',
      secondary: '#a0aec0',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
    },
    subtitle1: {
      color: '#a0aec0',
      fontWeight: 400,
    },
    body2: {
      color: '#a0aec0',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#16213e',
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
          transition: 'box-shadow 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: '#0f3460',
          color: '#e0e0e0',
          fontWeight: 600,
          fontSize: '0.8rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
        body: {
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
});

export default theme;
