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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { Card } from '../DataDisplay';

interface EvaluationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  confidenceScore: number;
}

interface ConfusionMatrix {
  truePositive: number;
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
}

interface ModelEvaluationProps {
  metrics: EvaluationMetrics;
  confusionMatrix: ConfusionMatrix;
  classDistribution: Array<{
    className: string;
    count: number;
  }>;
  privacyScore: number;
}

export const ModelEvaluation: React.FC<ModelEvaluationProps> = ({
  metrics,
  confusionMatrix,
  classDistribution,
  privacyScore,
}) => {
  const radarData = [
    { metric: 'Accuracy', value: metrics.accuracy },
    { metric: 'Precision', value: metrics.precision },
    { metric: 'Recall', value: metrics.recall },
    { metric: 'F1 Score', value: metrics.f1Score },
    { metric: 'AUC', value: metrics.auc },
  ];

  const confusionMatrixData = [
    { name: 'True Positive', value: confusionMatrix.truePositive },
    { name: 'True Negative', value: confusionMatrix.trueNegative },
    { name: 'False Positive', value: confusionMatrix.falsePositive },
    { name: 'False Negative', value: confusionMatrix.falseNegative },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <div className="text-sm font-medium text-gray-500">Accuracy</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {(metrics.accuracy * 100).toFixed(2)}%
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-sm font-medium text-gray-500">F1 Score</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {(metrics.f1Score * 100).toFixed(2)}%
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-sm font-medium text-gray-500">AUC-ROC</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {(metrics.auc * 100).toFixed(2)}%
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-sm font-medium text-gray-500">Privacy Score</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {(privacyScore * 100).toFixed(2)}%
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis domain={[0, 1]} />
                  <Radar
                    name="Model Performance"
                    dataKey="value"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confusion Matrix</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={confusionMatrixData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Class Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="className" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#82ca9d" name="Sample Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Model Confidence</h3>
          <div className="flex items-center">
            <div className="flex-1 bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-600 rounded-full h-4"
                style={{ width: `${metrics.confidenceScore * 100}%` }}
              />
            </div>
            <span className="ml-4 text-sm font-medium text-gray-700">
              {(metrics.confidenceScore * 100).toFixed(1)}%
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Model confidence score based on prediction probabilities
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModelEvaluation; 