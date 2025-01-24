export interface ModelConfig {
  layers: {
    units: number;
    inputDim: number;
  }[];
}

export interface FederatedConfig {
  enablePrivacy: boolean;
  maxWeightMagnitude: number;
  minClientUpdates: number;
}

export interface ModelState {
  weights: number[][][];
  round: number;
  metrics: {
    accuracy: number;
    loss: number;
    timestamp: Date;
  };
}

export interface ModelUpdate {
  clientId: string;
  weights: number[][][];
  metrics?: {
    accuracy: number;
    loss: number;
  };
} 