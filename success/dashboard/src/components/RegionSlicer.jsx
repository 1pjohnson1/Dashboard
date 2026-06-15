import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, Box } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';

/**
 * RegionSlicer — Dropdown filter for selecting delivery region.
 *
 * Props:
 *   regions         - Array of region name strings
 *   selectedRegion  - Currently selected region (or 'all')
 *   onChange        - Callback: (regionName) => void
 *   label           - Label text (default "Delivery Region")
 */
export default function RegionSlicer({
  regions = [],
  selectedRegion = 'all',
  onChange,
  label = 'Delivery Region',
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <PublicIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
      <FormControl size="small" sx={{ minWidth: 250 }}>
        <InputLabel id="region-slicer-label">{label}</InputLabel>
        <Select
          labelId="region-slicer-label"
          id="region-slicer"
          value={selectedRegion}
          label={label}
          onChange={(e) => onChange(e.target.value)}
          sx={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderRadius: 2,
            fontSize: '0.85rem',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255,255,255,0.12)',
            },
          }}
        >
          <MenuItem value="all">
            <em>All Regions</em>
          </MenuItem>
          {regions.map((region) => (
            <MenuItem key={region} value={region}>
              {region}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
