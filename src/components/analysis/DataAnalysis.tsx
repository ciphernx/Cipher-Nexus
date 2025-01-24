import React, { useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
} from 'recharts';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface DataPoint {
  [key: string]: number | string;
}

interface ColumnStats {
  name: string;
  type: 'numeric' | 'categorical';
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  uniqueValues?: number;
  mostCommon?: { value: string; count: number }[];
}

interface DataAnalysisProps {
  data: DataPoint[];
  onRefresh?: () => void;
  onExport?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analysis-tabpanel-${index}`}
      aria-labelledby={`analysis-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export function DataAnalysis({ data, onRefresh, onExport }: DataAnalysisProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [columnStats, setColumnStats] = useState<ColumnStats[]>([]);
  const [currentTab, setCurrentTab] = useState(0);
  const [chartType, setChartType] = useState<'bar' | 'scatter' | 'line'>('bar');

  useEffect(() => {
    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      setSelectedColumns(columns.slice(0, 2));
      calculateColumnStats(columns);
    }
  }, [data]);

  const calculateColumnStats = (columns: string[]) => {
    const stats: ColumnStats[] = columns.map(column => {
      const values = data.map(d => d[column]);
      const isNumeric = values.every(v => !isNaN(Number(v)));

      if (isNumeric) {
        const numericValues = values.map(v => Number(v));
        const sorted = [...numericValues].sort((a, b) => a - b);
        return {
          name: column,
          type: 'numeric',
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
          median: sorted[Math.floor(sorted.length / 2)],
          std: calculateStandardDeviation(numericValues),
        };
      } else {
        const valueCounts = new Map<string, number>();
        values.forEach(v => {
          const count = valueCounts.get(String(v)) || 0;
          valueCounts.set(String(v), count + 1);
        });
        const mostCommon = Array.from(valueCounts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        return {
          name: column,
          type: 'categorical',
          uniqueValues: valueCounts.size,
          mostCommon,
        };
      }
    });

    setColumnStats(stats);
  };

  const calculateStandardDeviation = (values: number[]): number => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  };

  const renderChart = () => {
    if (selectedColumns.length < 2) return null;

    const chartData = data.map(d => ({
      x: d[selectedColumns[0]],
      y: d[selectedColumns[1]],
    }));

    switch (chartType) {
      case 'scatter':
        return (
          <ScatterChart width={600} height={400}>
            <CartesianGrid />
            <XAxis type="number" dataKey="x" name={selectedColumns[0]} />
            <YAxis type="number" dataKey="y" name={selectedColumns[1]} />
            <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Data Points" data={chartData} fill="#8884d8" />
          </ScatterChart>
        );
      case 'line':
        return (
          <LineChart width={600} height={400} data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Line type="monotone" dataKey="y" stroke="#8884d8" />
          </LineChart>
        );
      default:
        return (
          <BarChart width={600} height={400} data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Bar dataKey="y" fill="#8884d8" />
          </BarChart>
        );
    }
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Data Analysis</Typography>
          <Box>
            {onRefresh && (
              <Tooltip title="Refresh Data">
                <IconButton onClick={onRefresh} size="small">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}
            {onExport && (
              <Tooltip title="Export Analysis">
                <IconButton onClick={onExport} size="small">
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Tabs
          value={currentTab}
          onChange={(_, newValue) => setCurrentTab(newValue)}
          aria-label="analysis tabs"
        >
          <Tab label="Summary Statistics" />
          <Tab label="Visualization" />
        </Tabs>

        <TabPanel value={currentTab} index={0}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Column</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Statistics</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {columnStats.map((stat) => (
                  <TableRow key={stat.name}>
                    <TableCell>{stat.name}</TableCell>
                    <TableCell>{stat.type}</TableCell>
                    <TableCell>
                      {stat.type === 'numeric' ? (
                        <>
                          Min: {stat.min?.toFixed(2)}<br />
                          Max: {stat.max?.toFixed(2)}<br />
                          Mean: {stat.mean?.toFixed(2)}<br />
                          Median: {stat.median?.toFixed(2)}<br />
                          Std: {stat.std?.toFixed(2)}
                        </>
                      ) : (
                        <>
                          Unique Values: {stat.uniqueValues}<br />
                          Most Common:<br />
                          {stat.mostCommon?.map(({ value, count }) => (
                            <span key={value}>
                              {value}: {count}<br />
                            </span>
                          ))}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Chart Type</InputLabel>
                <Select
                  value={chartType}
                  label="Chart Type"
                  onChange={(e) => setChartType(e.target.value as any)}
                >
                  <MenuItem value="bar">Bar Chart</MenuItem>
                  <MenuItem value="scatter">Scatter Plot</MenuItem>
                  <MenuItem value="line">Line Chart</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth margin="normal">
                <InputLabel>X Axis</InputLabel>
                <Select
                  value={selectedColumns[0]}
                  label="X Axis"
                  onChange={(e) => setSelectedColumns([e.target.value, selectedColumns[1]])}
                >
                  {columnStats.map(stat => (
                    <MenuItem key={stat.name} value={stat.name}>
                      {stat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth margin="normal">
                <InputLabel>Y Axis</InputLabel>
                <Select
                  value={selectedColumns[1]}
                  label="Y Axis"
                  onChange={(e) => setSelectedColumns([selectedColumns[0], e.target.value])}
                >
                  {columnStats.map(stat => (
                    <MenuItem key={stat.name} value={stat.name}>
                      {stat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={8}>
              <Box height={400}>
                <ResponsiveContainer>
                  {renderChart()}
                </ResponsiveContainer>
              </Box>
            </Grid>
          </Grid>
        </TabPanel>
      </CardContent>
    </Card>
  );
} 