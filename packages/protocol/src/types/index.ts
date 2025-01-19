export interface PrivacyConfig {
  encryptionLevel: 'basic' | 'medium' | 'high';
  useHomomorphicEncryption: boolean;
  useZeroKnowledgeProof: boolean;
}

export interface TrainingConfig {
  batchSize: number;
  epochs: number;
  learningRate: number;
  privacyConfig: PrivacyConfig;
}
