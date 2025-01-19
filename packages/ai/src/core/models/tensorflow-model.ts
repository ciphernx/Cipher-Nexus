import * as tf from '@tensorflow/tfjs-node';
import { BaseModel } from './base-model';
import { ModelConfig, TrainingConfig, PredictionResult, ModelMetrics } from '../types';

export class TensorFlowModel extends BaseModel {
  private model: tf.LayersModel | null = null;

  constructor(config: ModelConfig) {
    super(config);
    this.validateConfig();
  }

  async load(): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`file://${this.config.path}`);
      this.state.isLoaded = true;
    } catch (error) {
      throw new Error(`Failed to load model: ${error}`);
    }
  }

  async train(data: number[][], labels: number[][], config: TrainingConfig): Promise<ModelMetrics> {
    this.validateTrainingConfig(config);
    
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    this.state.isTraining = true;
    let processedData = data;
    let processedLabels = labels;

    try {
      // Handle encrypted data if encryption is enabled
      if (this.config.encryptionEnabled && this.encryptionService) {
        const encryptedData = await this.encryptData(data);
        processedData = await this.decryptData(encryptedData);
      }

      // Handle secure computation if protocol is enabled
      if (this.config.protocolEnabled && this.mpcProtocol) {
        processedData = await this.computeSecurely(processedData, 'train');
      }

      const xs = tf.tensor2d(processedData);
      const ys = tf.tensor2d(processedLabels);

      // Configure the model for training
      this.model.compile({
        optimizer: tf.train.adam(config.learningRate),
        loss: config.loss,
        metrics: config.metrics
      });

      // Train the model
      const history = await this.model.fit(xs, ys, {
        batchSize: config.batchSize,
        epochs: config.epochs,
        validationSplit: config.validationSplit
      });

      // Get the final metrics
      const metrics: ModelMetrics = {
        loss: history.history.loss[history.history.loss.length - 1]
      };

      if (history.history.acc) {
        metrics.accuracy = history.history.acc[history.history.acc.length - 1];
      }

      this.updateMetrics(metrics);
      return metrics;

    } catch (error) {
      throw new Error(`Training failed: ${error}`);
    } finally {
      this.state.isTraining = false;
    }
  }

  async predict(input: number[]): Promise<PredictionResult> {
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    try {
      let processedInput = input;

      // Handle encrypted data if encryption is enabled
      if (this.config.encryptionEnabled && this.encryptionService) {
        const encryptedInput = await this.encryptData([input]);
        processedInput = (await this.decryptData(encryptedInput))[0];
      }

      // Handle secure computation if protocol is enabled
      if (this.config.protocolEnabled && this.mpcProtocol) {
        processedInput = (await this.computeSecurely([input], 'predict'))[0];
      }

      const inputTensor = tf.tensor2d([processedInput]);
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const output = Array.from(await prediction.data());

      // Calculate confidence for classification tasks
      let confidence: number | undefined;
      if (this.config.taskType === 'classification') {
        confidence = Math.max(...output);
      }

      return {
        output: output,
        confidence,
        metadata: {
          modelType: 'tensorflow',
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      throw new Error(`Prediction failed: ${error}`);
    }
  }

  async save(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    try {
      await this.model.save(`file://${path}`);
    } catch (error) {
      throw new Error(`Failed to save model: ${error}`);
    }
  }

  protected validateConfig(): void {
    super.validateConfig();
    // Add TensorFlow-specific validation if needed
  }
} 