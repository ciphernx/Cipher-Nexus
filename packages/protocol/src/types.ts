export interface PrivacyConfig {
  encryptionLevel: 'basic' | 'medium' | 'high';
  useHomomorphicEncryption: boolean;
  useZeroKnowledgeProof: boolean;
} 