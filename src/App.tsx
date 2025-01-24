import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { MainLayout } from './layouts/MainLayout';
import { DatasetsPage } from './pages/DatasetsPage';
import { TrainingPage } from './pages/TrainingPage';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <MainLayout>
          <Routes>
            <Route path="/datasets" element={<DatasetsPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/" element={<Navigate to="/datasets" replace />} />
          </Routes>
        </MainLayout>
      </Router>
    </ThemeProvider>
  );
} 