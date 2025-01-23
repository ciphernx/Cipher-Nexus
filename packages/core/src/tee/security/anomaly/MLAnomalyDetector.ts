import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../../logging/Logger';
import { TEEMetrics, SecurityMeasurements } from '../../types';
import { MetricsManager } from '../../monitoring/MetricsManager';

export interface AnomalyDetectionConfig {
  trainingWindowSize: number;      // Number of data points for training
  predictionWindowSize: number;    // Number of data points for prediction
  anomalyThreshold: number;        // Standard deviations for anomaly detection
  retrainingInterval: number;      // Milliseconds between model retraining
  featureColumns: string[];        // Metrics to use as features
}

export interface AnomalyScore {
  score: number;
  threshold: number;
  isAnomaly: boolean;
  features: Record<string, number>;
  timestamp: number;
}

export class MLAnomalyDetector extends EventEmitter {
  private config: AnomalyDetectionConfig;
  private metricsManager: MetricsManager;
  private model: tf.LayersModel | null = null;
  private normalizer: tf.LayersModel | null = null;
  private lastTrainingTime: number = 0;
  private featureMeans: number[] = [];
  private featureStds: number[] = [];

  constructor(config: AnomalyDetectionConfig, metricsManager: MetricsManager) {
    super();
    this.config = config;
    this.metricsManager = metricsManager;

    // Initialize model
    this.initializeModel().catch(error => {
      logger.error('Failed to initialize anomaly detection model', {}, error as Error);
    });

    // Schedule periodic retraining
    setInterval(() => this.retrain(), this.config.retrainingInterval);
  }

  private async initializeModel(): Promise<void> {
    // Create autoencoder model
    const input = tf.input({ shape: [this.config.featureColumns.length] });
    
    // Encoder
    const encoded = tf.layers.dense({
      units: Math.floor(this.config.featureColumns.length / 2),
      activation: 'relu'
    }).apply(input);

    // Decoder
    const decoded = tf.layers.dense({
      units: this.config.featureColumns.length,
      activation: 'sigmoid'
    }).apply(encoded);

    this.model = tf.model({ inputs: input, outputs: decoded as tf.SymbolicTensor });
    
    // Compile model
    this.model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });

    // Create normalizer
    this.normalizer = this.createNormalizer();

    await this.retrain();
  }

  private createNormalizer(): tf.LayersModel {
    const input = tf.input({ shape: [this.config.featureColumns.length] });
    const normalized = tf.layers.dense({
      units: this.config.featureColumns.length,
      trainable: false
    }).apply(input);

    return tf.model({ inputs: input, outputs: normalized as tf.SymbolicTensor });
  }

  async detectAnomalies(
    metrics: TEEMetrics,
    securityMeasurements: SecurityMeasurements
  ): Promise<AnomalyScore> {
    try {
      if (!this.model || !this.normalizer) {
        throw new Error('Model not initialized');
      }

      // Extract features
      const features = this.extractFeatures(metrics, securityMeasurements);
      
      // Normalize features
      const normalizedFeatures = this.normalizeFeatures(features);
      
      // Get reconstruction error
      const input = tf.tensor2d([normalizedFeatures]);
      const reconstruction = this.model.predict(input) as tf.Tensor;
      
      const reconstructionError = tf.metrics.meanSquaredError(
        input,
        reconstruction
      ).dataSync()[0];

      // Calculate anomaly score
      const score = reconstructionError;
      const threshold = this.calculateThreshold();
      const isAnomaly = score > threshold;

      if (isAnomaly) {
        logger.warn('Anomaly detected', {
          score,
          threshold,
          features: Object.fromEntries(
            this.config.featureColumns.map((col, i) => [col, features[i]])
          )
        });

        this.emit('anomaly', {
          score,
          threshold,
          isAnomaly,
          features: Object.fromEntries(
            this.config.featureColumns.map((col, i) => [col, features[i]])
          ),
          timestamp: Date.now()
        });
      }

      return {
        score,
        threshold,
        isAnomaly,
        features: Object.fromEntries(
          this.config.featureColumns.map((col, i) => [col, features[i]])
        ),
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error('Failed to detect anomalies', {}, error as Error);
      throw error;
    }
  }

  private async retrain(): Promise<void> {
    try {
      // Get historical data
      const endTime = Date.now();
      const startTime = endTime - (this.config.trainingWindowSize * 60 * 1000);
      
      const trainingData = await this.collectTrainingData(startTime, endTime);
      if (trainingData.length < this.config.trainingWindowSize) {
        logger.warn('Insufficient data for retraining', {
          available: trainingData.length,
          required: this.config.trainingWindowSize
        });
        return;
      }

      // Normalize training data
      const { normalizedData, means, stds } = this.normalizeTrainingData(trainingData);
      
      // Update normalizer weights
      this.featureMeans = means;
      this.featureStds = stds;
      
      // Train model
      await this.model!.fit(
        tf.tensor2d(normalizedData),
        tf.tensor2d(normalizedData),
        {
          epochs: 50,
          batchSize: 32,
          shuffle: true,
          validationSplit: 0.2
        }
      );

      this.lastTrainingTime = Date.now();
      logger.info('Successfully retrained anomaly detection model');

    } catch (error) {
      logger.error('Failed to retrain model', {}, error as Error);
    }
  }

  private async collectTrainingData(
    startTime: number,
    endTime: number
  ): Promise<number[][]> {
    const data: number[][] = [];

    for (const column of this.config.featureColumns) {
      const metrics = await this.metricsManager.getMetricsHistory(
        column,
        startTime,
        endTime
      );

      metrics.forEach((metric, i) => {
        if (!data[i]) data[i] = [];
        data[i].push(metric.value);
      });
    }

    return data;
  }

  private extractFeatures(
    metrics: TEEMetrics,
    securityMeasurements: SecurityMeasurements
  ): number[] {
    return this.config.featureColumns.map(column => {
      switch (column) {
        case 'cpu_usage':
          return metrics.cpuUsage;
        case 'memory_usage':
          return metrics.memoryUsage;
        case 'active_operations':
          return metrics.activeOperations;
        case 'queued_operations':
          return metrics.queuedOperations;
        case 'security_score':
          return securityMeasurements.securityScore;
        default:
          throw new Error(`Unknown feature column: ${column}`);
      }
    });
  }

  private normalizeFeatures(features: number[]): number[] {
    return features.map((value, i) => 
      (value - this.featureMeans[i]) / (this.featureStds[i] || 1)
    );
  }

  private normalizeTrainingData(data: number[][]): {
    normalizedData: number[][];
    means: number[];
    stds: number[];
  } {
    const numFeatures = data[0].length;
    const means = new Array(numFeatures).fill(0);
    const stds = new Array(numFeatures).fill(0);

    // Calculate means
    data.forEach(row => {
      row.forEach((value, i) => {
        means[i] += value;
      });
    });
    means.forEach((sum, i) => means[i] /= data.length);

    // Calculate standard deviations
    data.forEach(row => {
      row.forEach((value, i) => {
        stds[i] += Math.pow(value - means[i], 2);
      });
    });
    stds.forEach((sum, i) => stds[i] = Math.sqrt(sum / data.length));

    // Normalize data
    const normalizedData = data.map(row =>
      row.map((value, i) => (value - means[i]) / (stds[i] || 1))
    );

    return { normalizedData, means, stds };
  }

  private calculateThreshold(): number {
    return this.config.anomalyThreshold;
  }
} 