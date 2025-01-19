import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/DataDisplay';
import { Container } from '../../../components/Layout';
import { Input, Select } from '../../../components/Form';
import { Project } from '../../../types/project';

interface TrainingConfig {
  name: string;
  description: string;
  projectId: string;
  modelType: 'nlp' | 'vision' | 'tabular' | 'custom';
  parameters: {
    epochs: number;
    batchSize: number;
    learningRate: number;
    privacyBudget: number;
  };
}

const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Privacy-Enhanced NLP',
    description: 'Natural Language Processing with privacy guarantees',
    privacyLevel: 'high',
    status: 'active',
    createdAt: '2024-01-19T00:00:00Z',
    updatedAt: '2024-01-19T00:00:00Z',
    modelCount: 3,
    dataSize: '500GB'
  }
];

export const TrainModelPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [config, setConfig] = useState<TrainingConfig>({
    name: '',
    description: '',
    projectId: '',
    modelType: 'nlp',
    parameters: {
      epochs: 100,
      batchSize: 32,
      learningRate: 0.001,
      privacyBudget: 1.0
    }
  });

  const handleStartTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // TODO: Implement actual API call
      console.log('Starting training with config:', config);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      navigate('/models');
    } catch (error) {
      console.error('Failed to start training:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <div className="py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Train New Model</h1>
        </div>

        <form onSubmit={handleStartTraining}>
          <div className="grid grid-cols-1 gap-6">
            <Card className="bg-white">
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
                <div className="space-y-4">
                  <Input
                    label="Model Name"
                    value={config.name}
                    onChange={(value) => setConfig({ ...config, name: value })}
                    required
                    placeholder="Enter model name"
                  />
                  
                  <Input
                    label="Description"
                    value={config.description}
                    onChange={(value) => setConfig({ ...config, description: value })}
                    required
                    placeholder="Enter model description"
                  />

                  <Select
                    label="Project"
                    value={config.projectId}
                    onChange={(value) => setConfig({ ...config, projectId: value })}
                    options={projects.map(p => ({ value: p.id, label: p.name }))}
                    required
                  />

                  <Select
                    label="Model Type"
                    value={config.modelType}
                    onChange={(value) => setConfig({ ...config, modelType: value as TrainingConfig['modelType'] })}
                    options={[
                      { value: 'nlp', label: 'Natural Language Processing' },
                      { value: 'vision', label: 'Computer Vision' },
                      { value: 'tabular', label: 'Tabular Data' },
                      { value: 'custom', label: 'Custom Model' }
                    ]}
                    required
                  />
                </div>
              </div>
            </Card>

            <Card className="bg-white">
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Training Parameters</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Number of Epochs"
                    type="number"
                    value={String(config.parameters.epochs)}
                    onChange={(value) => setConfig({
                      ...config,
                      parameters: { ...config.parameters, epochs: Number(value) }
                    })}
                    required
                  />

                  <Input
                    label="Batch Size"
                    type="number"
                    value={String(config.parameters.batchSize)}
                    onChange={(value) => setConfig({
                      ...config,
                      parameters: { ...config.parameters, batchSize: Number(value) }
                    })}
                    required
                  />

                  <Input
                    label="Learning Rate"
                    type="number"
                    value={String(config.parameters.learningRate)}
                    onChange={(value) => setConfig({
                      ...config,
                      parameters: { ...config.parameters, learningRate: Number(value) }
                    })}
                    required
                  />

                  <Input
                    label="Privacy Budget"
                    type="number"
                    value={String(config.parameters.privacyBudget)}
                    onChange={(value) => setConfig({
                      ...config,
                      parameters: { ...config.parameters, privacyBudget: Number(value) }
                    })}
                    required
                  />
                </div>
              </div>
            </Card>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate('/models')}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Starting Training...' : 'Start Training'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Container>
  );
};
