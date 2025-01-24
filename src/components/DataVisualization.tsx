import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
} from 'recharts';

interface DataPoint {
  [key: string]: number | string;
}

interface DataVisualizationProps {
  data: DataPoint[];
  title: string;
  xAxis: string;
  yAxis: string;
  chartType?: 'line' | 'bar' | 'scatter';
}

export function DataVisualization({
  data,
  title,
  xAxis,
  yAxis,
  chartType = 'line',
}: DataVisualizationProps) {
  const [selectedChart, setSelectedChart] = React.useState(chartType);

  const renderChart = () => {
    switch (selectedChart) {
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxis} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={yAxis} stroke="#8884d8" />
          </LineChart>
        );
      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxis} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={yAxis} fill="#8884d8" />
          </BarChart>
        );
      case 'scatter':
        return (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxis} type="number" />
            <YAxis dataKey={yAxis} type="number" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend />
            <Scatter name={title} data={data} fill="#8884d8" />
          </ScatterChart>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" component="h3">
            {title}
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Chart Type</InputLabel>
            <Select
              value={selectedChart}
              label="Chart Type"
              onChange={(e) => setSelectedChart(e.target.value as 'line' | 'bar' | 'scatter')}
            >
              <MenuItem value="line">Line Chart</MenuItem>
              <MenuItem value="bar">Bar Chart</MenuItem>
              <MenuItem value="scatter">Scatter Plot</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box height={300}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
} 