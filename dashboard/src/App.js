import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import Sidebar from './components/Sidebar';
import OverviewPage from './pages/OverviewPage';
import ErrorDeepDivePage from './pages/ErrorDeepDivePage';
import ConcurrentLaunchesPage from './pages/ConcurrentLaunchesPage';
import GeoBucketsPage from './pages/GeoBucketsPage';

const SIDEBAR_WIDTH = 260;

function App() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar width={SIDEBAR_WIDTH} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: `${SIDEBAR_WIDTH}px`,
          p: 3,
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/errors" element={<ErrorDeepDivePage />} />
          <Route path="/concurrent" element={<ConcurrentLaunchesPage />} />
          <Route path="/geo" element={<GeoBucketsPage />} />
        </Routes>
      </Box>
    </Box>
  );
}

export default App;
