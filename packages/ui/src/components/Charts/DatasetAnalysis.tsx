import React from 'react';
import {
  BarChart,
  Bar as RechartsBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { Card } from '../DataDisplay';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartJSTooltip,
  Legend as ChartJSLegend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartJSTooltip,
  ChartJSLegend,
  Filler
);

interface DatasetAnalysisProps {
  correlations: Array<{ field1: string; field2: string; score: number }>;
  distributions: Array<{
    field: string;
    distribution: Array<{ value: string; count: number }>;
  }>;
  summary: Array<{
    field: string;
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
    uniqueValues?: number;
  }>;
  correlationData: {
    labels: string[];
    values: number[];
  };
  trendData: {
    labels: string[];
    values: number[];
  };
  outlierData: {
    labels: string[];
    values: number[];
    threshold: number[];
  };
}

export const DatasetAnalysis: React.FC<DatasetAnalysisProps> = ({
  correlations,
  distributions,
  summary,
  correlationData,
  trendData,
  outlierData,
}) => {
  // 转换相关性数据为散点图格式
  const correlationDataForRecharts = correlations.map(({ field1, field2, score }) => ({
    x: field1,
    y: field2,
    z: Math.abs(score),
  }));

  // 获取数值型字段的统计信息
  const numericFields = summary.filter(
    (field) => field.min !== undefined && field.max !== undefined
  );

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const correlationChartData = {
    labels: correlationData.labels,
    datasets: [
      {
        label: 'Feature Correlation',
        data: correlationData.values,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.4,
      },
    ],
  };

  const trendChartData = {
    labels: trendData.labels,
    datasets: [
      {
        label: 'Data Trend',
        data: trendData.values,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const outlierChartData = {
    labels: outlierData.labels,
    datasets: [
      {
        label: 'Values',
        data: outlierData.values,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        pointRadius: 4,
      },
      {
        label: 'Threshold',
        data: outlierData.threshold,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        borderDash: [5, 5],
        pointRadius: 0,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">Dataset Analysis</h2>
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="p-6">
            <h3 className="text-base font-medium text-gray-900 mb-4">Feature Correlation</h3>
            <div className="h-64">
              <Line data={correlationChartData} options={options} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-base font-medium text-gray-900 mb-4">Data Trend Analysis</h3>
            <div className="h-64">
              <Line data={trendChartData} options={options} />
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="p-6">
            <h3 className="text-base font-medium text-gray-900 mb-4">Outlier Detection</h3>
            <div className="h-64">
              <Line data={outlierChartData} options={options} />
            </div>
          </div>
        </Card>
      </div>

      {/* Correlation Matrix */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Field Correlations</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" type="category" />
                <YAxis dataKey="y" type="category" />
                <ZAxis dataKey="z" range={[50, 400]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    if (payload && payload[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-2 border rounded shadow">
                          <p>{`${data.x} - ${data.y}`}</p>
                          <p className="font-medium">
                            Correlation: {(data.z * 100).toFixed(1)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter data={correlationDataForRecharts} fill="#8884d8" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Numeric Fields Distribution */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Numeric Fields Distribution
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={numericFields}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="field" />
                <YAxis />
                <Tooltip />
                <Legend />
                <RechartsBar dataKey="min" name="Minimum" fill="#8884d8" />
                <RechartsBar dataKey="max" name="Maximum" fill="#82ca9d" />
                <RechartsBar dataKey="mean" name="Mean" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Field Value Distributions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {distributions.map(({ field, distribution }) => (
          <Card key={field}>
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {field} Distribution
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="value" />
                    <YAxis />
                    <Tooltip />
                    <RechartsBar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DatasetAnalysis; 