import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../../../components/DataDisplay';
import { Container } from '../../../components/Layout';
import { Model } from '../../../types/model';

interface TrainingMetrics {
  epoch: number;
  loss: number;
  accuracy: number;
  privacyBudgetUsed: number;
}

export const ModelDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [model, setModel] = useState<Model | null>(null);
  const [metrics, setMetrics] = useState<TrainingMetrics[]>([
    { epoch: 1, loss: 0.5, accuracy: 0.85, privacyBudgetUsed: 0.2 },
    { epoch: 2, loss: 0.3, accuracy: 0.89, privacyBudgetUsed: 0.4 },
    { epoch: 3, loss: 0.2, accuracy: 0.92, privacyBudgetUsed: 0.6 }
  ]);

  useEffect(() => {
    // TODO: Fetch model details from API
    setModel({
      id: '1',
      name: 'Privacy-Enhanced NLP Model',
      type: 'nlp',
      description: 'NLP model with differential privacy',
      status: 'ready',
      projectId: '1',
      projectName: 'Privacy-Enhanced NLP',
      accuracy: 0.92,
      privacyScore: 0.95,
      createdAt: '2024-01-19T00:00:00Z',
      updatedAt: '2024-01-19T00:00:00Z',
      lastTrainingTime: '2024-01-19T00:00:00Z',
      parameters: {
        epochs: 100,
        batchSize: 32,
        learningRate: 0.001,
        privacyBudget: 1.0
      }
    });
  }, [id]);

  if (!model) {
    return <div>Loading...</div>;
  }

  const getStatusColor = (status: Model['status']) => {
    switch (status) {
      case 'ready': return 'bg-green-100 text-green-800';
      case 'training': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'stopped': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Container>
      <div className="py-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{model.name}</h1>
            <p className="mt-1 text-sm text-gray-500">{model.description}</p>
          </div>
          <div className="flex space-x-4">
            {model.status === 'ready' && (
              <button className="btn btn-primary">
                Retrain Model
              </button>
            )}
            {model.status === 'training' && (
              <button className="btn btn-danger">
                Stop Training
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="bg-white">
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-500">Status</h3>
              <div className="mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(model.status)}`}>
                  {model.status.charAt(0).toUpperCase() + model.status.slice(1)}
                </span>
              </div>
            </div>
          </Card>

          <Card className="bg-white">
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-500">Accuracy</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {(model.accuracy * 100).toFixed(1)}%
              </p>
            </div>
          </Card>

          <Card className="bg-white">
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-500">Privacy Score</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {(model.privacyScore * 100).toFixed(1)}%
              </p>
            </div>
          </Card>

          <Card className="bg-white">
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-500">Last Training</h3>
              <p className="mt-2 text-sm text-gray-900">
                {new Date(model.lastTrainingTime || model.updatedAt).toLocaleString()}
              </p>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Model Parameters</h3>
              <dl className="grid grid-cols-1 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Epochs</dt>
                  <dd className="mt-1 text-sm text-gray-900">{model.parameters.epochs}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Batch Size</dt>
                  <dd className="mt-1 text-sm text-gray-900">{model.parameters.batchSize}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Learning Rate</dt>
                  <dd className="mt-1 text-sm text-gray-900">{model.parameters.learningRate}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Privacy Budget</dt>
                  <dd className="mt-1 text-sm text-gray-900">{model.parameters.privacyBudget}</dd>
                </div>
              </dl>
            </div>
          </Card>

          <Card className="bg-white">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Training Metrics</h3>
              <div className="space-y-4">
                {metrics.map((metric) => (
                  <div key={metric.epoch} className="grid grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-500">Epoch</div>
                      <div className="mt-1 text-sm text-gray-900">{metric.epoch}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Loss</div>
                      <div className="mt-1 text-sm text-gray-900">{metric.loss.toFixed(4)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Accuracy</div>
                      <div className="mt-1 text-sm text-gray-900">{(metric.accuracy * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Privacy Budget Used</div>
                      <div className="mt-1 text-sm text-gray-900">{metric.privacyBudgetUsed.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Container>
  );
};
