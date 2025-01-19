import { PrivacyConfig, TrainingConfig } from '../types';

export const validatePrivacyConfig = (config: PrivacyConfig): boolean => {
  const validLevels = ['basic', 'medium', 'high'];
  if (!validLevels.includes(config.encryptionLevel)) {
    throw new Error('Invalid encryption level');
  }
  return true;
};

export const validateTrainingConfig = (config: TrainingConfig): boolean => {
  if (config.batchSize <= 0 || config.epochs <= 0 || config.learningRate <= 0) {
    throw new Error('Invalid training parameters');
  }
  validatePrivacyConfig(config.privacyConfig);
  return true;
};
