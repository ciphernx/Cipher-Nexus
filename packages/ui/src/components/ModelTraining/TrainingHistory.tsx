import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../DataDisplay';

interface TrainingMetrics {
  epoch: number;
  loss: number;
  accuracy: number;
  val_loss: number;
  val_accuracy: number;
}

interface TrainingHistoryProps {
  metrics: TrainingMetrics[];
  modelName: string;
  startTime: string;
  endTime: string;
  status: 'completed' | 'failed' | 'in_progress';
  totalEpochs: number;
}

export const TrainingHistory: React.FC<TrainingHistoryProps> = ({
  metrics,
  modelName,
  startTime,
  endTime,
  status,
  totalEpochs,
}) => {
  const statusColors = {
    completed: 'text-green-600 bg-green-100',
    failed: 'text-red-600 bg-red-100',
    in_progress: 'text-blue-600 bg-blue-100',
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{modelName}</h2>
              <div className="mt-1 text-sm text-gray-500">
                Started: {formatDate(startTime)}
                {status !== 'in_progress' && ` • Ended: ${formatDate(endTime)}`}
              </div>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                statusColors[status]
              }`}
            >
              {status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <div className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <div className="p-4">
                  <div className="text-sm font-medium text-gray-500">Current Epoch</div>
                  <div className="mt-1 text-2xl font-semibold text-gray-900">
                    {metrics.length} / {totalEpochs}
                  </div>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="text-sm font-medium text-gray-500">Latest Loss</div>
                  <div className="mt-1 text-2xl font-semibold text-gray-900">
                    {metrics[metrics.length - 1]?.loss.toFixed(4) || 'N/A'}
                  </div>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="text-sm font-medium text-gray-500">Latest Accuracy</div>
                  <div className="mt-1 text-2xl font-semibold text-gray-900">
                    {metrics[metrics.length - 1]?.accuracy
                      ? `${(metrics[metrics.length - 1].accuracy * 100).toFixed(2)}%`
                      : 'N/A'}
                  </div>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="text-sm font-medium text-gray-500">Best Validation Accuracy</div>
                  <div className="mt-1 text-2xl font-semibold text-gray-900">
                    {Math.max(...metrics.map((m) => m.val_accuracy))
                      ? `${(Math.max(...metrics.map((m) => m.val_accuracy)) * 100).toFixed(2)}%`
                      : 'N/A'}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Training Progress</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="epoch" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="loss"
                          stroke="#8884d8"
                          name="Training Loss"
                        />
                        <Line
                          type="monotone"
                          dataKey="val_loss"
                          stroke="#82ca9d"
                          name="Validation Loss"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Accuracy Metrics</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="epoch" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="accuracy"
                          stroke="#8884d8"
                          name="Training Accuracy"
                        />
                        <Line
                          type="monotone"
                          dataKey="val_accuracy"
                          stroke="#82ca9d"
                          name="Validation Accuracy"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainingHistory; 