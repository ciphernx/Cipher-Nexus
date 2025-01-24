import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Heatmap,
  HeatmapSeries,
  HeatmapCell,
  XAxis,
  YAxis,
  ChartProvider,
  LinearGradient,
} from '@visx/xychart';
import { scaleLinear } from '@visx/scale';

interface AdvancedAnalysisProps {
  loading: boolean;
  error: string | null;
  analysisResult: {
    correlations: Record<string, Record<string, number>>;
    outliers: Record<string, number[]>;
    missingValues: Record<string, number>;
    distributions: Record<string, {
      type: 'normal' | 'skewed' | 'uniform' | 'unknown';
      skewness?: number;
      kurtosis?: number;
    }>;
  } | null;
}

export function AdvancedAnalysis({ loading, error, analysisResult }: AdvancedAnalysisProps) {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!analysisResult) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        No analysis results available. Please run the analysis first.
      </Alert>
    );
  }

  const renderCorrelationHeatmap = () => {
    const columns = Object.keys(analysisResult.correlations);
    const data = columns.flatMap((col1) =>
      columns.map((col2) => ({
        x: col1,
        y: col2,
        value: analysisResult.correlations[col1][col2],
      }))
    );

    const colorScale = scaleLinear({
      domain: [-1, 0, 1],
      range: ['#ff0000', '#ffffff', '#00ff00'],
    });

    return (
      <Box height={400} width="100%">
        <ChartProvider>
          <Heatmap data={data}>
            <LinearGradient
              id="heatmap-gradient"
              from="#ff0000"
              to="#00ff00"
              fromOffset={0}
              toOffset={1}
            />
            <HeatmapSeries
              dataKey="Correlation"
              data={data}
              xAccessor={(d) => d.x}
              yAccessor={(d) => d.y}
              colorAccessor={(d) => colorScale(d.value)}
            >
              {(cells) =>
                cells.map((cell) => (
                  <HeatmapCell
                    key={`${cell.x}-${cell.y}`}
                    {...cell}
                    tooltip={`${cell.x} - ${cell.y}: ${cell.value.toFixed(2)}`}
                  />
                ))
              }
            </HeatmapSeries>
            <XAxis />
            <YAxis />
          </Heatmap>
        </ChartProvider>
      </Box>
    );
  };

  const getDistributionColor = (type: string) => {
    switch (type) {
      case 'normal':
        return 'success';
      case 'skewed':
        return 'warning';
      case 'uniform':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Correlation Analysis
            </Typography>
            {renderCorrelationHeatmap()}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Distribution Analysis
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Column</TableCell>
                    <TableCell>Distribution Type</TableCell>
                    <TableCell>Skewness</TableCell>
                    <TableCell>Kurtosis</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(analysisResult.distributions).map(([column, info]) => (
                    <TableRow key={column}>
                      <TableCell>{column}</TableCell>
                      <TableCell>
                        <Chip
                          label={info.type}
                          color={getDistributionColor(info.type)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {info.skewness?.toFixed(2) || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {info.kurtosis?.toFixed(2) || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Data Quality Analysis
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Column</TableCell>
                    <TableCell>Missing Values</TableCell>
                    <TableCell>Outliers</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.keys(analysisResult.missingValues).map((column) => (
                    <TableRow key={column}>
                      <TableCell>{column}</TableCell>
                      <TableCell>
                        {analysisResult.missingValues[column]}
                        {analysisResult.missingValues[column] > 0 && (
                          <Chip
                            label="Missing Data"
                            color="warning"
                            size="small"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {analysisResult.outliers[column]?.length || 0}
                        {(analysisResult.outliers[column]?.length || 0) > 0 && (
                          <Chip
                            label="Has Outliers"
                            color="error"
                            size="small"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
} 