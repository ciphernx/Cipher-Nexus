import { ModelConfig, ModelState, TrainingConfig, PredictionResult, ModelMetrics } from '../types';
import { AES } from '@ciphernx/crypto';
import { MPCProtocol } from '@ciphernx/protocol';

export abstract class BaseModel {
  protected config: ModelConfig;
  protected state: ModelState;
  protected encryptionService?: AES;
  protected mpcProtocol?: MPCProtocol;

  constructor(config: ModelConfig) {
    this.config = config;
    this.state = {
      isLoaded: false,
      isTraining: false
    };

    if (config.encryptionEnabled) {
      this.encryptionService = new AES();
    }

    if (config.protocolEnabled) {
      this.mpcProtocol = new MPCProtocol();
    }
  }

  abstract async load(): Promise<void>;
  
  abstract async train(data: number[][], labels: number[][], config: TrainingConfig): Promise<ModelMetrics>;
  
  abstract async predict(input: number[]): Promise<PredictionResult>;
  
  abstract async save(path: string): Promise<void>;

  protected async encryptData(data: number[][]): Promise<Buffer> {
    if (!this.encryptionService) {
      throw new Error('Encryption service not initialized');
    }
    const serializedData = JSON.stringify(data);
    return this.encryptionService.encrypt(Buffer.from(serializedData));
  }

  protected async decryptData(encryptedData: Buffer): Promise<number[][]> {
    if (!this.encryptionService) {
      throw new Error('Encryption service not initialized');
    }
    const decryptedData = await this.encryptionService.decrypt(encryptedData);
    return JSON.parse(decryptedData.toString());
  }

  protected async computeSecurely(data: number[][], operation: string): Promise<number[][]> {
    if (!this.mpcProtocol) {
      throw new Error('MPC protocol not initialized');
    }
    // Initialize MPC session and perform secure computation
    await this.mpcProtocol.initialize();
    const session = await this.mpcProtocol.createSession([]);
    // Set local values and perform computation
    // This is a simplified version - actual implementation would depend on the specific operation
    return data;
  }

  public getState(): ModelState {
    return { ...this.state };
  }

  public getConfig(): ModelConfig {
    return { ...this.config };
  }

  protected updateMetrics(metrics: ModelMetrics): void {
    this.state.metrics = metrics;
    this.state.lastUpdated = new Date();
  }

  protected validateConfig(): void {
    if (!this.config.path) {
      throw new Error('Model path is required');
    }
    if (!this.config.inputShape || !this.config.outputShape) {
      throw new Error('Input and output shapes are required');
    }
  }

  protected validateTrainingConfig(config: TrainingConfig): void {
    if (config.batchSize <= 0) {
      throw new Error('Batch size must be positive');
    }
    if (config.epochs <= 0) {
      throw new Error('Number of epochs must be positive');
    }
    if (config.learningRate <= 0) {
      throw new Error('Learning rate must be positive');
    }
  }
} 