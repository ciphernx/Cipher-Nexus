import { SecurityMeasurements } from '../../types';
import { EventEmitter } from 'events';
import { ModelManager } from './ModelManager';
import { FeatureExtractor } from './FeatureExtractor';
import { AnomalyScore, DetectionResult, Feature } from './types';

export class AnomalyDetector extends EventEmitter {
  private modelManager: ModelManager;
  private featureExtractor: FeatureExtractor;
  private readonly threshold: number;
  private readonly historySize: number;
  private measurementHistory: SecurityMeasurements[];

  constructor(options: {
    modelPath?: string;
    threshold?: number;
    historySize?: number;
  } = {}) {
    super();
    this.threshold = options.threshold || 0.8;
    this.historySize = options.historySize || 1000;
    this.measurementHistory = [];
    this.modelManager = new ModelManager(options.modelPath);
    this.featureExtractor = new FeatureExtractor();
  }

  async initialize(): Promise<void> {
    try {
      await this.modelManager.loadModel();
      this.emit('initialized');
    } catch (error) {
      throw new Error(`Failed to initialize anomaly detector: ${error}`);
    }
  }

  async detect(measurements: SecurityMeasurements): Promise<DetectionResult> {
    try {
      // Update history
      this.updateHistory(measurements);

      // Extract features
      const features = await this.extractFeatures(measurements);

      // Get predictions from all models
      const scores = await this.getPredictions(features);

      // Analyze results
      const result = this.analyzeResults(scores);

      // Emit events based on detection
      this.emitDetectionEvents(result);

      return result;
    } catch (error) {
      throw new Error(`Anomaly detection failed: ${error}`);
    }
  }

  private updateHistory(measurements: SecurityMeasurements): void {
    this.measurementHistory.push(measurements);
    if (this.measurementHistory.length > this.historySize) {
      this.measurementHistory.shift();
    }
  }

  private async extractFeatures(measurements: SecurityMeasurements): Promise<Feature[]> {
    return this.featureExtractor.extract({
      current: measurements,
      history: this.measurementHistory,
      features: [
        'securityScore',
        'vulnerabilityCount',
        'integrityChange',
        'behaviorPattern',
        'resourceUsage',
        'errorRate'
      ]
    });
  }

  private async getPredictions(features: Feature[]): Promise<AnomalyScore[]> {
    const models = [
      'isolationForest',
      'oneClassSVM',
      'autoencoder',
      'densityEstimation'
    ];

    const predictions = await Promise.all(
      models.map(model => this.modelManager.predict(model, features))
    );

    return predictions.map((score, index) => ({
      model: models[index],
      score,
      timestamp: Date.now()
    }));
  }

  private analyzeResults(scores: AnomalyScore[]): DetectionResult {
    // Calculate ensemble score
    const ensembleScore = this.calculateEnsembleScore(scores);
    
    // Determine anomaly type and severity
    const { isAnomaly, type, severity } = this.classifyAnomaly(ensembleScore, scores);

    // Generate explanation
    const explanation = this.generateExplanation(scores, type, severity);

    return {
      isAnomaly,
      ensembleScore,
      type,
      severity,
      explanation,
      timestamp: Date.now(),
      modelScores: scores,
      confidence: this.calculateConfidence(scores)
    };
  }

  private calculateEnsembleScore(scores: AnomalyScore[]): number {
    // Weight the scores based on model reliability
    const weights = {
      isolationForest: 0.3,
      oneClassSVM: 0.25,
      autoencoder: 0.25,
      densityEstimation: 0.2
    };

    return scores.reduce((sum, score) => {
      return sum + score.score * weights[score.model as keyof typeof weights];
    }, 0);
  }

  private classifyAnomaly(ensembleScore: number, scores: AnomalyScore[]): {
    isAnomaly: boolean;
    type: string;
    severity: 'low' | 'medium' | 'high';
  } {
    const isAnomaly = ensembleScore > this.threshold;
    
    // Determine anomaly type based on feature contributions
    const type = this.determineAnomalyType(scores);
    
    // Calculate severity based on how far the score is above threshold
    const severity = this.calculateSeverity(ensembleScore);

    return { isAnomaly, type, severity };
  }

  private determineAnomalyType(scores: AnomalyScore[]): string {
    // Analyze feature contributions to determine the type of anomaly
    const featureContributions = this.featureExtractor.getFeatureContributions();
    
    if (featureContributions.securityScore > 0.5) {
      return 'security_degradation';
    } else if (featureContributions.behaviorPattern > 0.5) {
      return 'abnormal_behavior';
    } else if (featureContributions.resourceUsage > 0.5) {
      return 'resource_abuse';
    } else if (featureContributions.integrityChange > 0.5) {
      return 'integrity_violation';
    }
    
    return 'unknown';
  }

  private calculateSeverity(score: number): 'low' | 'medium' | 'high' {
    if (score > 0.95) return 'high';
    if (score > 0.85) return 'medium';
    return 'low';
  }

  private calculateConfidence(scores: AnomalyScore[]): number {
    // Calculate the standard deviation of scores
    const mean = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s.score - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Higher confidence if scores agree (low standard deviation)
    return Math.max(0, 1 - stdDev);
  }

  private generateExplanation(
    scores: AnomalyScore[],
    type: string,
    severity: string
  ): string {
    const featureContributions = this.featureExtractor.getFeatureContributions();
    const topFeatures = Object.entries(featureContributions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    return `Detected ${severity} severity ${type} anomaly. ` +
      `Main contributing factors: ${topFeatures.map(([feature, contribution]) => 
        `${feature} (${Math.round(contribution * 100)}%)`
      ).join(', ')}. ` +
      `Model agreement: ${Math.round(this.calculateConfidence(scores) * 100)}%`;
  }

  private emitDetectionEvents(result: DetectionResult): void {
    this.emit('detection', result);

    if (result.isAnomaly) {
      this.emit('anomaly', result);
      
      if (result.severity === 'high') {
        this.emit('critical_anomaly', result);
      }
    }
  }

  async updateModel(measurements: SecurityMeasurements[]): Promise<void> {
    try {
      // Extract features from new measurements
      const features = await Promise.all(
        measurements.map(m => this.extractFeatures(m))
      );

      // Update each model
      await this.modelManager.updateModels(features);

      this.emit('model_updated');
    } catch (error) {
      throw new Error(`Failed to update anomaly detection models: ${error}`);
    }
  }

  async save(): Promise<void> {
    try {
      await this.modelManager.saveModels();
      this.emit('models_saved');
    } catch (error) {
      throw new Error(`Failed to save anomaly detection models: ${error}`);
    }
  }
} 