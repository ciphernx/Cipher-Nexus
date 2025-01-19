export type ModelType = 'nlp' | 'vision' | 'tabular' | 'custom';
export type ModelStatus = 'training' | 'ready' | 'failed' | 'stopped';

export interface Model {
  id: string;
  name: string;
  type: ModelType;
  description: string;
  status: ModelStatus;
  projectId: string;
  projectName: string;
  accuracy: number;
  privacyScore: number;
  createdAt: string;
  updatedAt: string;
  lastTrainingTime?: string;
  parameters: {
    epochs: number;
    batchSize: number;
    learningRate: number;
    privacyBudget: number;
  };
}
