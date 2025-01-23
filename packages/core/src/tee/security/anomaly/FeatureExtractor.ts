import { SecurityMeasurements } from '../../types';
import { Feature } from './types';

export class FeatureExtractor {
  private featureContributions: Record<string, number>;

  constructor() {
    this.featureContributions = {};
  }

  async extract(params: {
    current: SecurityMeasurements;
    history: SecurityMeasurements[];
    features: string[];
  }): Promise<Feature[]> {
    const { current, history, features } = params;
    const extractedFeatures: Feature[] = [];

    try {
      // Reset feature contributions
      this.resetFeatureContributions(features);

      // Extract basic features
      const basicFeatures = this.extractBasicFeatures(current);

      // Extract temporal features
      const temporalFeatures = this.extractTemporalFeatures(current, history);

      // Extract behavioral features
      const behavioralFeatures = this.extractBehavioralFeatures(current, history);

      // Combine all features
      const combinedFeatures = {
        ...basicFeatures,
        ...temporalFeatures,
        ...behavioralFeatures
      };

      // Filter requested features
      const feature = features.reduce((acc, featureName) => {
        if (featureName in combinedFeatures) {
          acc[featureName] = combinedFeatures[featureName];
        }
        return acc;
      }, {} as Record<string, number>);

      extractedFeatures.push(feature);

      // Calculate feature contributions
      this.calculateFeatureContributions(combinedFeatures);

      return extractedFeatures;
    } catch (error) {
      throw new Error(`Feature extraction failed: ${error}`);
    }
  }

  private extractBasicFeatures(measurements: SecurityMeasurements): Record<string, number> {
    const features: Record<string, number> = {
      securityScore: measurements.securityScore,
      vulnerabilityCount: measurements.vulnerabilities.length,
      highSeverityCount: measurements.vulnerabilities.filter(v => v.severity === 'high').length,
      mediumSeverityCount: measurements.vulnerabilities.filter(v => v.severity === 'medium').length,
      lowSeverityCount: measurements.vulnerabilities.filter(v => v.severity === 'low').length
    };

    return features;
  }

  private extractTemporalFeatures(
    current: SecurityMeasurements,
    history: SecurityMeasurements[]
  ): Record<string, number> {
    const features: Record<string, number> = {};

    if (history.length > 0) {
      // Calculate changes over time
      const previousMeasurement = history[history.length - 1];
      
      features.securityScoreChange = current.securityScore - previousMeasurement.securityScore;
      features.vulnerabilityCountChange = 
        current.vulnerabilities.length - previousMeasurement.vulnerabilities.length;
      
      // Calculate integrity changes
      features.integrityChange = 
        current.integrityHash === previousMeasurement.integrityHash ? 0 : 1;

      // Calculate moving averages
      features.avgSecurityScore = this.calculateMovingAverage(
        history.map(m => m.securityScore),
        10
      );
      
      features.avgVulnerabilityCount = this.calculateMovingAverage(
        history.map(m => m.vulnerabilities.length),
        10
      );
    } else {
      // Default values when no history is available
      features.securityScoreChange = 0;
      features.vulnerabilityCountChange = 0;
      features.integrityChange = 0;
      features.avgSecurityScore = current.securityScore;
      features.avgVulnerabilityCount = current.vulnerabilities.length;
    }

    return features;
  }

  private extractBehavioralFeatures(
    current: SecurityMeasurements,
    history: SecurityMeasurements[]
  ): Record<string, number> {
    const features: Record<string, number> = {};

    // Analyze behavior patterns
    features.behaviorPattern = this.analyzeBehaviorPattern(current, history);
    
    // Resource usage patterns
    features.resourceUsage = this.analyzeResourceUsage(current, history);
    
    // Error rate patterns
    features.errorRate = this.calculateErrorRate(current, history);

    return features;
  }

  private analyzeBehaviorPattern(
    current: SecurityMeasurements,
    history: SecurityMeasurements[]
  ): number {
    if (history.length === 0) return 0;

    // Calculate behavior deviation score
    let deviationScore = 0;
    const patterns = [
      this.analyzeSecurityScorePattern(current, history),
      this.analyzeVulnerabilityPattern(current, history),
      this.analyzeIntegrityPattern(current, history)
    ];

    deviationScore = patterns.reduce((sum, score) => sum + score, 0) / patterns.length;
    return deviationScore;
  }

  private analyzeSecurityScorePattern(
    current: SecurityMeasurements,
    history: SecurityMeasurements[]
  ): number {
    const scores = history.map(m => m.securityScore);
    const mean = this.calculateMean(scores);
    const stdDev = this.calculateStdDev(scores, mean);
    
    // Calculate z-score
    return Math.abs((current.securityScore - mean) / (stdDev || 1));
  }

  private analyzeVulnerabilityPattern(
    current: SecurityMeasurements,
    history: SecurityMeasurements[]
  ): number {
    const counts = history.map(m => m.vulnerabilities.length);
    const mean = this.calculateMean(counts);
    const stdDev = this.calculateStdDev(counts, mean);
    
    // Calculate z-score
    return Math.abs((current.vulnerabilities.length - mean) / (stdDev || 1));
  }

  private analyzeIntegrityPattern(
    current: SecurityMeasurements,
    history: SecurityMeasurements[]
  ): number {
    // Calculate frequency of integrity changes
    const changes = history.filter((m, i) => 
      i > 0 && m.integrityHash !== history[i - 1].integrityHash
    ).length;
    
    return changes / history.length;
  }

  private analyzeResourceUsage(
    current: SecurityMeasurements,
    history: SecurityMeasurements[]
  ): number {
    if (history.length === 0) return 0;

    // Calculate resource usage deviation
    const resourceMetrics = [
      this.calculateCPUUsageDeviation(current, history),
      this.calculateMemoryUsageDeviation(current, history),
      this.calculateIOUsageDeviation(current, history)
    ];

    return resourceMetrics.reduce((sum, metric) => sum + metric, 0) / resourceMetrics.length;
  }

  private calculateCPUUsageDeviation(
    current: SecurityMeasurements,
    history: SecurityMeasurements[]
  ): number {
    // Implementation depends on how CPU usage is stored in SecurityMeasurements
    return 0; // Placeholder
  }

  private calculateMemoryUsageDeviation(
    current: SecurityMeasurements,
    history: SecurityMeasurements[]
  ): number {
    // Implementation depends on how memory usage is stored in SecurityMeasurements
    return 0; // Placeholder
  }

  private calculateIOUsageDeviation(
    current: SecurityMeasurements,
    history: SecurityMeasurements[]
  ): number {
    // Implementation depends on how I/O usage is stored in SecurityMeasurements
    return 0; // Placeholder
  }

  private calculateErrorRate(
    current: SecurityMeasurements,
    history: SecurityMeasurements[]
  ): number {
    if (history.length === 0) return 0;

    // Calculate error rate based on security measurements
    const errorCounts = history.map(m => 
      m.vulnerabilities.filter(v => v.severity === 'high').length
    );
    
    const mean = this.calculateMean(errorCounts);
    const stdDev = this.calculateStdDev(errorCounts, mean);
    
    // Calculate z-score for current error count
    const currentErrors = current.vulnerabilities.filter(v => v.severity === 'high').length;
    return Math.abs((currentErrors - mean) / (stdDev || 1));
  }

  private calculateMovingAverage(values: number[], window: number): number {
    if (values.length === 0) return 0;
    
    const windowSize = Math.min(window, values.length);
    const windowValues = values.slice(-windowSize);
    return windowValues.reduce((sum, value) => sum + value, 0) / windowSize;
  }

  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    return Math.sqrt(variance);
  }

  private resetFeatureContributions(features: string[]): void {
    this.featureContributions = features.reduce((acc, feature) => {
      acc[feature] = 0;
      return acc;
    }, {} as Record<string, number>);
  }

  private calculateFeatureContributions(features: Record<string, number>): void {
    const total = Object.values(features).reduce((sum, value) => sum + Math.abs(value), 0);
    
    if (total === 0) return;

    Object.entries(features).forEach(([feature, value]) => {
      this.featureContributions[feature] = Math.abs(value) / total;
    });
  }

  getFeatureContributions(): Record<string, number> {
    return { ...this.featureContributions };
  }
} 