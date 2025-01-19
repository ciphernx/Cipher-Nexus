import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Model {
  id: string;
  name: string;
  description: string;
  type: 'classification' | 'regression' | 'clustering';
  status: 'training' | 'deployed' | 'stopped' | 'error';
  accuracy: number;
  privacyScore: number;
  createdAt: string;
  updatedAt: string;
  version: string;
  datasetId: string;
}

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  privacyBudget: number;
}

export interface DeploymentConfig {
  replicas: number;
  minReplicas: number;
  maxReplicas: number;
  cpuThreshold: number;
  memoryThreshold: number;
}

interface ModelState {
  selectedModel: Model | null;
  trainingConfig: TrainingConfig;
  deploymentConfig: DeploymentConfig;
  setSelectedModel: (model: Model | null) => void;
  setTrainingConfig: (config: Partial<TrainingConfig>) => void;
  setDeploymentConfig: (config: Partial<DeploymentConfig>) => void;
  resetConfigs: () => void;
}

const initialTrainingConfig: TrainingConfig = {
  epochs: 10,
  batchSize: 32,
  learningRate: 0.001,
  privacyBudget: 1.0,
};

const initialDeploymentConfig: DeploymentConfig = {
  replicas: 1,
  minReplicas: 1,
  maxReplicas: 3,
  cpuThreshold: 80,
  memoryThreshold: 80,
};

export const useModelStore = create<ModelState>()(
  devtools(
    (set) => ({
      selectedModel: null,
      trainingConfig: initialTrainingConfig,
      deploymentConfig: initialDeploymentConfig,
      setSelectedModel: (model) =>
        set({ selectedModel: model }, false, 'setSelectedModel'),
      setTrainingConfig: (config) =>
        set(
          (state) => ({
            trainingConfig: { ...state.trainingConfig, ...config },
          }),
          false,
          'setTrainingConfig'
        ),
      setDeploymentConfig: (config) =>
        set(
          (state) => ({
            deploymentConfig: { ...state.deploymentConfig, ...config },
          }),
          false,
          'setDeploymentConfig'
        ),
      resetConfigs: () =>
        set(
          {
            trainingConfig: initialTrainingConfig,
            deploymentConfig: initialDeploymentConfig,
          },
          false,
          'resetConfigs'
        ),
    }),
    {
      name: 'Model Store',
    }
  )
); 