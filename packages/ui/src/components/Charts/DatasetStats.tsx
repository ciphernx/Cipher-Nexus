import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../DataDisplay';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartJSTooltip,
  Legend as ChartJSLegend,
  ArcElement,
} from 'chart.js';
import { Bar as ChartJSBar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartJSTooltip,
  ChartJSLegend,
  ArcElement
);

interface DatasetStatsProps {
  dataTypes: Record<string, string>;
  missingValues: number;
  totalRows: number;
  distributionData: Array<{
    name: string;
    value: number;
  }>;
}

// Transform data for Recharts
const transformDataForRecharts = (dataTypes: Record<string, string>) => {
  return Object.entries(dataTypes).map(([name, type]) => ({
    name,
    type: type,
    count: 1
  }));
};

export const DatasetStats = ({
  dataTypes,
  missingValues,
  totalRows,
  distributionData,
}: DatasetStatsProps) => {
  const rechartsData = transformDataForRecharts(dataTypes);
  
  // Chart.js data for data type distribution
  const dataTypeDistribution = {
    labels: Object.keys(dataTypes),
    datasets: [
      {
        label: 'Column Count',
        data: Object.values(dataTypes).map((type) =>
          Object.values(dataTypes).filter((t) => t === type).length
        ),
        backgroundColor: [
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 99, 132, 0.5)',
          'rgba(75, 192, 192, 0.5)',
          'rgba(255, 206, 86, 0.5)',
          'rgba(153, 102, 255, 0.5)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(153, 102, 255, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Chart.js data for quality distribution
  const qualityDistributionData = {
    labels: distributionData.map((item) => item.name),
    datasets: [
      {
        data: distributionData.map((item) => item.value),
        backgroundColor: [
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 99, 132, 0.5)',
          'rgba(255, 206, 86, 0.5)',
          'rgba(75, 192, 192, 0.5)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

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
  };

  const dataQualityScore = ((totalRows - missingValues) / totalRows) * 100;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Data Type Distribution</h2>
          <div className="h-64">
            <ChartJSBar data={dataTypeDistribution} options={options} />
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Data Quality Distribution</h2>
          <div className="h-64">
            <Pie data={qualityDistributionData} options={options} />
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Data Quality Score</h2>
          <div className="flex items-center justify-center h-80">
            <div className="text-center">
              <div className="text-5xl font-bold text-blue-600">
                {dataQualityScore.toFixed(1)}%
              </div>
              <div className="mt-2 text-sm text-gray-500">Overall Quality Score</div>
              <div className="mt-4 text-sm text-gray-700">
                Based on completeness, validity, and consistency
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Column Distribution</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rechartsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DatasetStats; 