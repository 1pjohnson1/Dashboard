import React, { useState, useMemo } from 'react';
import {
  Card, CardContent, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, TextField, InputAdornment,
  Box, Typography, Chip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

/**
 * DataTable — Reusable sortable/searchable data table.
 *
 * Props:
 *   title       - Table title
 *   columns     - Array of { field, headerName, width, format, align }
 *                  format can be a function(value, row) => rendered content
 *   rows        - Array of data objects
 *   searchable  - Enable search filter (default true)
 *   maxHeight   - Max scroll height (default 400)
 *   searchFields - Array of field names to search against (defaults to all)
 */
export default function DataTable({
  title,
  columns = [],
  rows = [],
  searchable = true,
  maxHeight = 400,
  searchFields,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [orderBy, setOrderBy] = useState('');
  const [orderDir, setOrderDir] = useState('asc');

  const fieldsToSearch = searchFields || columns.map((c) => c.field);

  // Filter rows by search term
  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter((row) =>
      fieldsToSearch.some((field) => {
        const val = row[field];
        return val != null && String(val).toLowerCase().includes(term);
      })
    );
  }, [rows, searchTerm, fieldsToSearch]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (!orderBy) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const aVal = a[orderBy];
      const bVal = b[orderBy];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return orderDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return orderDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, orderBy, orderDir]);

  const handleSort = (field) => {
    if (orderBy === field) {
      setOrderDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(field);
      setOrderDir('asc');
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          {title && (
            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
              {title}
            </Typography>
          )}
          {searchable && (
            <TextField
              size="small"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: 250,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 2,
                  fontSize: '0.85rem',
                },
              }}
            />
          )}
        </Box>

        <TableContainer sx={{ maxHeight, borderRadius: 1 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell
                    key={col.field}
                    align={col.align || 'left'}
                    sx={{ width: col.width }}
                  >
                    <TableSortLabel
                      active={orderBy === col.field}
                      direction={orderBy === col.field ? orderDir : 'asc'}
                      onClick={() => handleSort(col.field)}
                      sx={{
                        '&.Mui-active': { color: 'primary.main' },
                        '& .MuiTableSortLabel-icon': { color: 'primary.main !important' },
                      }}
                    >
                      {col.headerName}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No data available
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row, idx) => (
                  <TableRow
                    key={idx}
                    sx={{
                      backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      '&:hover': { backgroundColor: 'rgba(0, 210, 255, 0.04)' },
                    }}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.field} align={col.align || 'left'} sx={{ fontSize: '0.82rem' }}>
                        {col.format ? col.format(row[col.field], row) : row[col.field] ?? '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Showing {sortedRows.length} of {rows.length} rows
          </Typography>
          {searchTerm && (
            <Chip
              label={`Filter: "${searchTerm}"`}
              size="small"
              onDelete={() => setSearchTerm('')}
              sx={{ fontSize: '0.7rem' }}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
