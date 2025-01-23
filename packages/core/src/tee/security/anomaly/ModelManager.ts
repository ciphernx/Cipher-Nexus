import { Feature } from './types';
import * as tf from '@tensorflow/tfjs-node';
import { IsolationForest } from 'isolation-forest';
import { OneClassSVM } from 'one-class-svm';
import { AutoEncoder } from './models/AutoEncoder';
import { DensityEstimator } from './models/DensityEstimator';

export class ModelManager {
  private models: Map<string, any>;
  private modelPath: string;
  private autoEncoder: AutoEncoder;
  private densityEstimator: DensityEstimator;

  constructor(modelPath?: string) {
    this.modelPath = modelPath || './models';
    this.models = new Map();
    this.autoEncoder = new AutoEncoder();
    this.densityEstimator = new DensityEstimator();
  }

  async loadModel(): Promise<void> {
    try {
      // Initialize Isolation Forest
      this.models.set('isolationForest', new IsolationForest({
        contamination: 0.1,
        nEstimators: 100,
        maxSamples: 'auto'
      }));

      // Initialize One-Class SVM
      this.models.set('oneClassSVM', new OneClassSVM({
        kernel: 'rbf',
        nu: 0.1,
        gamma: 'auto'
      }));

      // Load pre-trained Autoencoder
      await this.autoEncoder.load(`${this.modelPath}/autoencoder`);
      this.models.set('autoencoder', this.autoEncoder);

      // Load pre-trained Density Estimator
      await this.densityEstimator.load(`${this.modelPath}/density`);
      this.models.set('densityEstimation', this.densityEstimator);
    } catch (error) {
      throw new Error(`Failed to load models: ${error}`);
    }
  }

  async predict(modelName: string, features: Feature[]): Promise<number> {
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`Model ${modelName} not found`);
    }

    try {
      switch (modelName) {
        case 'isolationForest':
          return this.predictIsolationForest(model, features);
        case 'oneClassSVM':
          return this.predictOneClassSVM(model, features);
        case 'autoencoder':
          return this.predictAutoencoder(features);
        case 'densityEstimation':
          return this.predictDensityEstimation(features);
        default:
          throw new Error(`Unknown model type: ${modelName}`);
      }
    } catch (error) {
      throw new Error(`Prediction failed for ${modelName}: ${error}`);
    }
  }

  private async predictIsolationForest(model: IsolationForest, features: Feature[]): Promise<number> {
    const featureArray = this.featuresToArray(features);
    const scores = await model.predict(featureArray);
    return this.normalizeScore(scores[0]);
  }

  private async predictOneClassSVM(model: OneClassSVM, features: Feature[]): Promise<number> {
    const featureArray = this.featuresToArray(features);
    const score = await model.predict(featureArray);
    return this.normalizeScore(score);
  }

  private async predictAutoencoder(features: Feature[]): Promise<number> {
    const tensor = this.featuresToTensor(features);
    const reconstructionError = await this.autoEncoder.getReconstructionError(tensor);
    return this.normalizeScore(reconstructionError);
  }

  private async predictDensityEstimation(features: Feature[]): Promise<number> {
    const tensor = this.featuresToTensor(features);
    const logProb = await this.densityEstimator.estimateDensity(tensor);
    return this.normalizeScore(-logProb); // Convert log probability to anomaly score
  }

  private featuresToArray(features: Feature[]): number[][] {
    return features.map(feature => Object.values(feature));
  }

  private featuresToTensor(features: Feature[]): tf.Tensor {
    const featureArray = this.featuresToArray(features);
    return tf.tensor2d(featureArray);
  }

  private normalizeScore(score: number): number {
    // Normalize score to [0, 1] range where 1 indicates high anomaly
    return 1 / (1 + Math.exp(-score));
  }

  async updateModels(features: Feature[][]): Promise<void> {
    try {
      const featureArray = this.featuresToArray(features.flat());

      // Update Isolation Forest
      const isolationForest = this.models.get('isolationForest');
      await isolationForest.fit(featureArray);

      // Update One-Class SVM
      const oneClassSVM = this.models.get('oneClassSVM');
      await oneClassSVM.fit(featureArray);

      // Update Autoencoder
      const tensor = tf.tensor2d(featureArray);
      await this.autoEncoder.update(tensor);

      // Update Density Estimator
      await this.densityEstimator.update(tensor);

      tensor.dispose();
    } catch (error) {
      throw new Error(`Failed to update models: ${error}`);
    }
  }

  async saveModels(): Promise<void> {
    try {
      // Save Autoencoder
      await this.autoEncoder.save(`${this.modelPath}/autoencoder`);

      // Save Density Estimator
      await this.densityEstimator.save(`${this.modelPath}/density`);

      // Save other model parameters if needed
      // Note: Isolation Forest and One-Class SVM states are maintained in memory
    } catch (error) {
      throw new Error(`Failed to save models: ${error}`);
    }
  }
} 