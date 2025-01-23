import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import * as tf from '@tensorflow/tfjs-node';
import { MetricsManager } from './MetricsManager';

export interface AnomalyDetectionConfig {
  trainingWindowSize: number;      // Number of data points for training
  predictionWindowSize: number;    // Number of data points for prediction
  anomalyThreshold: number;        // Standard deviations for anomaly detection
  retrainingInterval: number;      // Milliseconds between model retraining
  featureColumns: string[];        // Metrics to use as features
  modelConfig: {
    hiddenLayers: number[];        // Neurons in each hidden layer
    dropoutRate: number;           // Dropout rate for regularization
    learningRate: number;          // Learning rate for training
    batchSize: number;             // Batch size for training
    epochs: number;                // Number of training epochs
  };
  ensembleConfig: {
    enabled: boolean;              // Whether to use ensemble learning
    numModels: number;             // Number of models in ensemble
    votingThreshold: number;       // Threshold for ensemble voting
  };
}

export interface AnomalyScore {
  score: number;                   // Anomaly score (0-1)
  threshold: number;               // Current threshold for anomaly detection
  isAnomaly: boolean;             // Whether this is considered an anomaly
  features: Record<string, number>;// Feature values that contributed
  confidence: number;             // Confidence in the prediction (0-1)
  modelContributions: {           // Individual model contributions
    modelId: string;
    score: number;
    confidence: number;
  }[];
  timestamp: number;
}

export interface MetricDataPoint {
  timestamp: number;
  metrics: Record<string, number>;
}

export class MLAnomalyDetector extends EventEmitter {
  private readonly config: AnomalyDetectionConfig;
  private readonly metricsManager: MetricsManager;
  private models: tf.LayersModel[] = [];
  private featureStats: Map<string, { mean: number; std: number }>;
  private trainingData: MetricDataPoint[] = [];
  private retrainingTimeout: NodeJS.Timeout | null = null;
  private isTraining: boolean = false;

  constructor(config: AnomalyDetectionConfig, metricsManager: MetricsManager) {
    super();
    this.config = config;
    this.metricsManager = metricsManager;
    this.featureStats = new Map();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      if (this.config.ensembleConfig.enabled) {
        // Initialize ensemble models
        for (let i = 0; i < this.config.ensembleConfig.numModels; i++) {
          const model = await this.createModel();
          this.models.push(model);
        }
      } else {
        // Initialize single model
        const model = await this.createModel();
        this.models.push(model);
      }

      // Schedule initial training
      await this.retrain();
      this.scheduleRetraining();

      logger.info('ML Anomaly Detector initialized', {
        numModels: this.models.length,
        featureColumns: this.config.featureColumns
      });
    } catch (error) {
      logger.error('Failed to initialize ML Anomaly Detector', {}, error as Error);
      throw error;
    }
  }

  private createModel(): tf.LayersModel {
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.dense({
      units: this.config.modelConfig.hiddenLayers[0],
      inputShape: [this.config.featureColumns.length],
      activation: 'relu'
    }));

    // Add dropout for regularization
    model.add(tf.layers.dropout({ rate: this.config.modelConfig.dropoutRate }));

    // Hidden layers
    for (let i = 1; i < this.config.modelConfig.hiddenLayers.length; i++) {
      model.add(tf.layers.dense({
        units: this.config.modelConfig.hiddenLayers[i],
        activation: 'relu'
      }));
      model.add(tf.layers.dropout({ rate: this.config.modelConfig.dropoutRate }));
    }

    // Output layer
    model.add(tf.layers.dense({
      units: this.config.featureColumns.length,
      activation: 'sigmoid'
    }));

    // Compile model
    model.compile({
      optimizer: tf.train.adam(this.config.modelConfig.learningRate),
      loss: 'meanSquaredError',
      metrics: ['accuracy']
    });

    return model;
  }

  async detectAnomalies(dataPoints: MetricDataPoint[]): Promise<AnomalyScore[]> {
    try {
      const results: AnomalyScore[] = [];

      for (const dataPoint of dataPoints) {
        const features = this.extractFeatures(dataPoint);
        const normalizedFeatures = this.normalizeFeatures(features);
        
        const modelPredictions = await Promise.all(
          this.models.map(async (model, index) => {
            const input = tf.tensor2d([Object.values(normalizedFeatures)]);
            const prediction = await model.predict(input) as tf.Tensor;
            const reconstructionError = tf.metrics.meanSquaredError(
              input,
              prediction
            ).dataSync()[0];

            return {
              modelId: `model_${index}`,
              score: reconstructionError,
              confidence: this.calculateConfidence(reconstructionError)
            };
          })
        );

        // Aggregate predictions from all models
        const aggregatedScore = this.aggregatePredictions(modelPredictions);
        
        results.push({
          score: aggregatedScore.score,
          threshold: this.config.anomalyThreshold,
          isAnomaly: aggregatedScore.score > this.config.anomalyThreshold,
          features,
          confidence: aggregatedScore.confidence,
          modelContributions: modelPredictions,
          timestamp: dataPoint.timestamp
        });
      }

      return results;
    } catch (error) {
      logger.error('Anomaly detection failed', {}, error as Error);
      throw error;
    }
  }

  private aggregatePredictions(predictions: Array<{
    modelId: string;
    score: number;
    confidence: number;
  }>): { score: number; confidence: number } {
    if (this.config.ensembleConfig.enabled) {
      // Weighted average based on confidence
      const totalConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0);
      const weightedScore = predictions.reduce(
        (sum, p) => sum + (p.score * p.confidence),
        0
      ) / totalConfidence;

      // Calculate ensemble confidence
      const confidenceScores = predictions.map(p => p.confidence);
      const meanConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
      const stdConfidence = Math.sqrt(
        confidenceScores.reduce((sq, n) => sq + Math.pow(n - meanConfidence, 2), 0) /
        confidenceScores.length
      );

      return {
        score: weightedScore,
        confidence: meanConfidence / (1 + stdConfidence) // Normalize confidence
      };
    } else {
      // Single model case
      return {
        score: predictions[0].score,
        confidence: predictions[0].confidence
      };
    }
  }

  private calculateConfidence(reconstructionError: number): number {
    // Convert reconstruction error to confidence score (0-1)
    const maxError = this.config.anomalyThreshold * 2;
    return Math.max(0, 1 - (reconstructionError / maxError));
  }

  async retrain(): Promise<void> {
    if (this.isTraining) return;

    try {
      this.isTraining = true;
      const trainingData = await this.prepareTrainingData();

      // Train each model in the ensemble
      await Promise.all(this.models.map(async (model, index) => {
        const history = await model.fit(
          trainingData.inputs,
          trainingData.inputs, // Autoencoder reconstructs its input
          {
            epochs: this.config.modelConfig.epochs,
            batchSize: this.config.modelConfig.batchSize,
            validationSplit: 0.2,
            callbacks: {
              onEpochEnd: (epoch, logs) => {
                logger.debug(`Model ${index} training epoch ${epoch}`, { logs });
              }
            }
          }
        );

        return history;
      }));

      this.updateFeatureStats();
      logger.info('Model retraining completed', {
        numModels: this.models.length,
        dataPoints: trainingData.inputs.shape[0]
      });
    } catch (error) {
      logger.error('Model retraining failed', {}, error as Error);
      throw error;
    } finally {
      this.isTraining = false;
    }
  }

  private async prepareTrainingData(): Promise<{ inputs: tf.Tensor2D }> {
    // Collect training data from metrics manager
    const metrics = await this.metricsManager.getMetricsHistory(
      Date.now() - this.config.trainingWindowSize,
      Date.now()
    );

    const features = metrics.map(m => {
      const extracted = this.extractFeatures(m);
      return Object.values(this.normalizeFeatures(extracted));
    });

    return {
      inputs: tf.tensor2d(features)
    };
  }

  private scheduleRetraining(): void {
    if (this.retrainingTimeout) {
      clearTimeout(this.retrainingTimeout);
    }

    this.retrainingTimeout = setTimeout(
      async () => {
        await this.retrain();
        this.scheduleRetraining();
      },
      this.config.retrainingInterval
    );
  }

  dispose(): void {
    if (this.retrainingTimeout) {
      clearTimeout(this.retrainingTimeout);
    }

    // Clean up TensorFlow models
    this.models.forEach(model => model.dispose());
    this.models = [];
  }

  private extractFeatures(dataPoint: MetricDataPoint): Record<string, number> {
    const features: Record<string, number> = {};
    
    for (const column of this.config.featureColumns) {
      features[column] = dataPoint.metrics[column] || 0;
    }

    return features;
  }

  private normalizeFeatures(
    features: Record<string, number>
  ): Record<string, number> {
    const normalized: Record<string, number> = {};

    for (const [key, value] of Object.entries(features)) {
      const stats = this.featureStats.get(key);
      if (stats) {
        normalized[key] = (value - stats.mean) / (stats.std || 1);
      } else {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  private updateFeatureStats(): void {
    for (const column of this.config.featureColumns) {
      const values = this.trainingData.map(d => d.metrics[column] || 0);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);

      this.featureStats.set(column, { mean, std });
    }
  }
} 