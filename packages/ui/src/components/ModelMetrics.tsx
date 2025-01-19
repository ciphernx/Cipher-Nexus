import React from 'react';
import { Card, CardContent, Typography, Grid } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface MetricData {
  epoch: number;
  loss: number;
  accuracy: number;
  valLoss: number;
  valAccuracy: number;
}

interface ModelMetricsProps {
  metrics: MetricData[];
}

export const ModelMetrics: React.FC<ModelMetricsProps> = ({ metrics }) => {
  const epochs = metrics.map((m) => m.epoch);
  
  const accuracyData = {
    labels: epochs,
    datasets: [
      {
        label: 'Training Accuracy',
        data: metrics.map((m) => m.accuracy),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
      {
        label: 'Validation Accuracy',
        data: metrics.map((m) => m.valAccuracy),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      },
    ],
  };

  const lossData = {
    labels: epochs,
    datasets: [
      {
        label: 'Training Loss',
        data: metrics.map((m) => m.loss),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
      {
        label: 'Validation Loss',
        data: metrics.map((m) => m.valLoss),
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.5)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Training Metrics
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Accuracy
            </Typography>
            <Line options={chartOptions} data={accuracyData} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Loss
            </Typography>
            <Line options={chartOptions} data={lossData} />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}; 