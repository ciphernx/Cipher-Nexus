export interface ModelConfig {
  architecture: string;
  hyperparameters: {
    learningRate: number;
    batchSize: number;
    epochs: number;
    optimizer: string;
  };
  inputShape: number[];
  outputShape: number[];
}

export interface FederatedConfig {
  minClients: number;
  roundTimeout: number;
  aggregationStrategy: 'FedAvg' | 'FedProx' | 'FedMA';
  clientSelectionStrategy: 'Random' | 'PowerOfChoice' | 'Reputation';
  privacyConfig: {
    differentialPrivacy: {
      enabled: boolean;
      epsilon: number;
      delta: number;
    };
    secureSummation: {
      enabled: boolean;
      threshold: number;
    };
  };
}

export interface ClientState {
  clientId: string;
  datasetSize: number;
  lastUpdate: Date;
  computeCapability: {
    flops: number;
    memory: number;
    bandwidth: number;
  };
  reputation: number;
  status: 'IDLE' | 'TRAINING' | 'AGGREGATING' | 'ERROR';
}

export interface ModelUpdate {
  clientId: string;
  round: number;
  weights: Float32Array[];
  metrics: {
    loss: number;
    accuracy: number;
    trainingDuration: number;
  };
  timestamp: Date;
}

export interface TrainingRound {
  roundId: number;
  startTime: Date;
  endTime?: Date;
  selectedClients: string[];
  status: 'INITIALIZING' | 'IN_PROGRESS' | 'AGGREGATING' | 'COMPLETED' | 'FAILED';
  updates: ModelUpdate[];
  aggregatedMetrics?: {
    globalLoss: number;
    globalAccuracy: number;
    participationRate: number;
  };
}

export interface PrivacyMetrics {
  epsilon: number;
  delta: number;
  clipNorm: number;
  noiseScale: number;
  gradientNorm: number;
} 