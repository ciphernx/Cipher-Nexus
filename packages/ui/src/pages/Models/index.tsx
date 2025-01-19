import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table } from '../../components/DataDisplay';
import { Container } from '../../components/Layout';
import { Model } from '../../types/model';

const MOCK_MODELS: Model[] = [
  {
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
  },
  {
    id: '2',
    name: 'Secure Vision Model',
    type: 'vision',
    description: 'Computer vision with homomorphic encryption',
    status: 'training',
    projectId: '2',
    projectName: 'Secure Data Analysis',
    accuracy: 0.88,
    privacyScore: 0.98,
    createdAt: '2024-01-19T00:00:00Z',
    updatedAt: '2024-01-19T00:00:00Z',
    parameters: {
      epochs: 50,
      batchSize: 64,
      learningRate: 0.0005,
      privacyBudget: 2.0
    }
  }
];

export const ModelsPage: React.FC = () => {
  const navigate = useNavigate();
  const [models] = useState<Model[]>(MOCK_MODELS);

  const getStatusColor = (status: Model['status']) => {
    switch (status) {
      case 'ready': return 'bg-green-100 text-green-800';
      case 'training': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'stopped': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const columns = [
    {
      key: 'name',
      title: 'Model Name',
      render: (value: string, model: Model) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{model.description}</div>
        </div>
      )
    },
    {
      key: 'projectName',
      title: 'Project',
      render: (value: string, model: Model) => (
        <a
          href={`/projects/${model.projectId}`}
          className="text-primary hover:text-primary-dark"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/projects/${model.projectId}`);
          }}
        >
          {value}
        </a>
      )
    },
    {
      key: 'status',
      title: 'Status',
      render: (value: Model['status']) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      )
    },
    {
      key: 'accuracy',
      title: 'Accuracy',
      render: (value: number) => `${(value * 100).toFixed(1)}%`
    },
    {
      key: 'privacyScore',
      title: 'Privacy Score',
      render: (value: number) => (
        <div className="flex items-center">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            value >= 0.9 ? 'bg-green-100 text-green-800' :
            value >= 0.7 ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {(value * 100).toFixed(1)}%
          </span>
        </div>
      )
    },
    {
      key: 'actions',
      title: '',
      render: (_: any, model: Model) => (
        <div className="flex justify-end space-x-2">
          <button
            className="text-sm text-primary hover:text-primary-dark"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/models/${model.id}`);
            }}
          >
            View
          </button>
          {model.status === 'training' && (
            <button
              className="text-sm text-red-600 hover:text-red-800"
              onClick={(e) => {
                e.stopPropagation();
                console.log('Stop training:', model.id);
              }}
            >
              Stop
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <Container>
      <div className="py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Models</h1>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/models/new')}
          >
            Train New Model
          </button>
        </div>

        <Card className="bg-white overflow-hidden">
          <div className="p-6">
            <Table
              data={models}
              columns={columns}
              onRowClick={(model) => navigate(`/models/${model.id}`)}
            />
          </div>
        </Card>
      </div>
    </Container>
  );
};
