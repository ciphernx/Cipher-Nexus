export interface ModelConfig {
  architecture: string;
  layers: number[];
  activations: string[];
  optimizer: string;
  learningRate: number;
}

export interface FederatedConfig {
  roundsPerEpoch: number;
  minClients: number;
  clientsPerRound: number;
  localEpochs: number;
  localBatchSize: number;
}

export interface PrivateTrainingConfig {
  modelConfig: ModelConfig;
  federatedConfig: FederatedConfig;
  privacyBudget: number;
  noiseScale: number;
}
