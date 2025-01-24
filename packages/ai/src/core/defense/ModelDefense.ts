import { EventEmitter } from 'events';
import { ModelUpdate } from '../../types/federated';

interface DefenseConfig {
  // Anomaly detection
  outlierThreshold: number;
  minUpdatesForDetection: number;
  
  // Byzantine tolerance
  byzantineThreshold: number;
  useKrum: boolean;
  
  // Model validation
  validationMetrics: string[];
  accuracyThreshold: number;
  lossThreshold: number;
}

interface ValidationResult {
  isValid: boolean;
  metrics: {
    accuracy: number;
    loss: number;
    divergence: number;
  };
  anomalies: string[];
}

export class ModelDefense extends EventEmitter {
  private updateHistory: ModelUpdate[] = [];
  private clientScores: Map<string, number> = new Map();
  private byzantineScores: Map<string, number> = new Map();

  constructor(private config: DefenseConfig) {
    super();
  }

  async validateUpdate(
    update: ModelUpdate,
    globalWeights: Float32Array[]
  ): Promise<ValidationResult> {
    try {
      const anomalies: string[] = [];
      
      // Store update for historical analysis
      this.updateHistory.push(update);
      if (this.updateHistory.length > this.config.minUpdatesForDetection) {
        this.updateHistory.shift();
      }

      // 1. Anomaly Detection
      const isAnomaly = await this.detectAnomalies(update, anomalies);
      if (isAnomaly) {
        this.emit('anomalyDetected', {
          clientId: update.clientId,
          anomalies
        });
      }

      // 2. Byzantine Detection
      const isByzantine = await this.detectByzantine(update);
      if (isByzantine) {
        this.emit('byzantineDetected', {
          clientId: update.clientId
        });
        anomalies.push('Byzantine behavior detected');
      }

      // 3. Model Validation
      const metrics = await this.validateModel(update, globalWeights);
      const isValid = this.isUpdateValid(metrics, anomalies);

      // Update client scores
      this.updateClientScore(update.clientId, isValid, metrics);

      return {
        isValid: isValid && !isAnomaly && !isByzantine,
        metrics,
        anomalies
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async aggregateDefense(
    updates: ModelUpdate[],
    globalWeights: Float32Array[]
  ): Promise<ModelUpdate[]> {
    try {
      let filteredUpdates = updates;

      // Apply Krum if enabled
      if (this.config.useKrum) {
        filteredUpdates = await this.applyKrum(updates, globalWeights);
      }

      // Filter out updates from clients with low scores
      filteredUpdates = filteredUpdates.filter(update => 
        (this.clientScores.get(update.clientId) || 0) >= 0.5
      );

      this.emit('updatesFiltered', {
        originalCount: updates.length,
        filteredCount: filteredUpdates.length
      });

      return filteredUpdates;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  getClientScore(clientId: string): number {
    return this.clientScores.get(clientId) || 0;
  }

  private async detectAnomalies(
    update: ModelUpdate,
    anomalies: string[]
  ): Promise<boolean> {
    if (this.updateHistory.length < this.config.minUpdatesForDetection) {
      return false;
    }

    let isAnomaly = false;

    // 1. Check for statistical outliers in weights
    for (let layer = 0; layer < update.weights.length; layer++) {
      const stats = this.computeLayerStatistics(layer);
      const layerWeights = update.weights[layer];

      for (let i = 0; i < layerWeights.length; i++) {
        const zscore = Math.abs((layerWeights[i] - stats.mean) / stats.std);
        if (zscore > this.config.outlierThreshold) {
          isAnomaly = true;
          anomalies.push(`Weight outlier detected in layer ${layer}`);
          break;
        }
      }
    }

    // 2. Check for sudden changes in metrics
    const metricStats = this.computeMetricStatistics();
    const accuracyZScore = Math.abs(
      (update.metrics.accuracy - metricStats.accuracy.mean) / 
      metricStats.accuracy.std
    );
    const lossZScore = Math.abs(
      (update.metrics.loss - metricStats.loss.mean) / 
      metricStats.loss.std
    );

    if (accuracyZScore > this.config.outlierThreshold) {
      isAnomaly = true;
      anomalies.push('Accuracy anomaly detected');
    }

    if (lossZScore > this.config.outlierThreshold) {
      isAnomaly = true;
      anomalies.push('Loss anomaly detected');
    }

    return isAnomaly;
  }

  private async detectByzantine(update: ModelUpdate): Promise<boolean> {
    if (this.updateHistory.length < this.config.minUpdatesForDetection) {
      return false;
    }

    let byzantineScore = 0;

    // 1. Check for consistent opposite gradients
    const consistentOpposite = this.checkConsistentOpposite(update);
    if (consistentOpposite) {
      byzantineScore += 0.5;
    }

    // 2. Check for gradient magnitude anomalies
    const magnitudeAnomaly = this.checkGradientMagnitude(update);
    if (magnitudeAnomaly) {
      byzantineScore += 0.3;
    }

    // 3. Check for model divergence
    const divergenceAnomaly = this.checkModelDivergence(update);
    if (divergenceAnomaly) {
      byzantineScore += 0.2;
    }

    // Update Byzantine score for client
    const currentScore = this.byzantineScores.get(update.clientId) || 0;
    this.byzantineScores.set(
      update.clientId,
      0.7 * currentScore + 0.3 * byzantineScore
    );

    return this.byzantineScores.get(update.clientId)! > this.config.byzantineThreshold;
  }

  private async validateModel(
    update: ModelUpdate,
    globalWeights: Float32Array[]
  ): Promise<ValidationResult['metrics']> {
    // Compute model divergence
    const divergence = this.computeModelDivergence(update.weights, globalWeights);

    return {
      accuracy: update.metrics.accuracy,
      loss: update.metrics.loss,
      divergence
    };
  }

  private async applyKrum(
    updates: ModelUpdate[],
    globalWeights: Float32Array[]
  ): Promise<ModelUpdate[]> {
    const n = updates.length;
    const f = Math.floor((n - 1) / 2); // Byzantine tolerance
    const m = n - f - 2; // Number of updates to keep

    if (m <= 0) {
      return updates;
    }

    // Compute pairwise distances
    const distances: number[][] = [];
    for (let i = 0; i < n; i++) {
      distances[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          distances[i][j] = 0;
          continue;
        }
        distances[i][j] = this.computeUpdateDistance(
          updates[i].weights,
          updates[j].weights
        );
      }
    }

    // For each update, sum its m closest distances
    const scores: { index: number; score: number }[] = [];
    for (let i = 0; i < n; i++) {
      const sortedDistances = [...distances[i]].sort((a, b) => a - b);
      const score = sortedDistances.slice(0, m).reduce((a, b) => a + b, 0);
      scores.push({ index: i, score });
    }

    // Select updates with lowest scores
    scores.sort((a, b) => a.score - b.score);
    return scores
      .slice(0, m)
      .map(({ index }) => updates[index]);
  }

  private computeLayerStatistics(layer: number) {
    const values = this.updateHistory.map(u => Array.from(u.weights[layer])).flat();
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return {
      mean,
      std: Math.sqrt(variance)
    };
  }

  private computeMetricStatistics() {
    const accuracies = this.updateHistory.map(u => u.metrics.accuracy);
    const losses = this.updateHistory.map(u => u.metrics.loss);

    return {
      accuracy: {
        mean: accuracies.reduce((a, b) => a + b, 0) / accuracies.length,
        std: Math.sqrt(
          accuracies.reduce((a, b) => a + Math.pow(b - accuracies.reduce((x, y) => x + y, 0) / accuracies.length, 2), 0) /
          accuracies.length
        )
      },
      loss: {
        mean: losses.reduce((a, b) => a + b, 0) / losses.length,
        std: Math.sqrt(
          losses.reduce((a, b) => a + Math.pow(b - losses.reduce((x, y) => x + y, 0) / losses.length, 2), 0) /
          losses.length
        )
      }
    };
  }

  private checkConsistentOpposite(update: ModelUpdate): boolean {
    if (this.updateHistory.length === 0) return false;

    let oppositeCount = 0;
    let totalCount = 0;

    for (let layer = 0; layer < update.weights.length; layer++) {
      const avgHistoryGradient = new Float32Array(update.weights[layer].length);
      
      // Compute average gradient from history
      for (const historyUpdate of this.updateHistory) {
        for (let i = 0; i < avgHistoryGradient.length; i++) {
          avgHistoryGradient[i] += historyUpdate.weights[layer][i] / this.updateHistory.length;
        }
      }

      // Check for opposite signs
      for (let i = 0; i < update.weights[layer].length; i++) {
        if (Math.sign(update.weights[layer][i]) * Math.sign(avgHistoryGradient[i]) < 0) {
          oppositeCount++;
        }
        totalCount++;
      }
    }

    return oppositeCount / totalCount > 0.8; // 80% threshold
  }

  private checkGradientMagnitude(update: ModelUpdate): boolean {
    if (this.updateHistory.length === 0) return false;

    let anomalyCount = 0;
    let totalCount = 0;

    for (let layer = 0; layer < update.weights.length; layer++) {
      const stats = this.computeLayerStatistics(layer);
      const layerWeights = update.weights[layer];

      for (let i = 0; i < layerWeights.length; i++) {
        const magnitude = Math.abs(layerWeights[i]);
        const zscore = Math.abs((magnitude - stats.mean) / stats.std);
        if (zscore > this.config.outlierThreshold * 2) {
          anomalyCount++;
        }
        totalCount++;
      }
    }

    return anomalyCount / totalCount > 0.1; // 10% threshold
  }

  private checkModelDivergence(update: ModelUpdate): boolean {
    if (this.updateHistory.length === 0) return false;

    let totalDivergence = 0;

    for (const historyUpdate of this.updateHistory) {
      totalDivergence += this.computeUpdateDistance(
        update.weights,
        historyUpdate.weights
      );
    }

    const avgDivergence = totalDivergence / this.updateHistory.length;
    return avgDivergence > this.config.outlierThreshold * 3;
  }

  private computeModelDivergence(
    weights: Float32Array[],
    globalWeights: Float32Array[]
  ): number {
    let totalDivergence = 0;
    let totalElements = 0;

    for (let layer = 0; layer < weights.length; layer++) {
      for (let i = 0; i < weights[layer].length; i++) {
        totalDivergence += Math.pow(
          weights[layer][i] - globalWeights[layer][i],
          2
        );
        totalElements++;
      }
    }

    return Math.sqrt(totalDivergence / totalElements);
  }

  private computeUpdateDistance(
    weights1: Float32Array[],
    weights2: Float32Array[]
  ): number {
    let distance = 0;
    let totalElements = 0;

    for (let layer = 0; layer < weights1.length; layer++) {
      for (let i = 0; i < weights1[layer].length; i++) {
        distance += Math.pow(weights1[layer][i] - weights2[layer][i], 2);
        totalElements++;
      }
    }

    return Math.sqrt(distance / totalElements);
  }

  private isUpdateValid(
    metrics: ValidationResult['metrics'],
    anomalies: string[]
  ): boolean {
    if (metrics.accuracy < this.config.accuracyThreshold) {
      anomalies.push('Accuracy below threshold');
      return false;
    }

    if (metrics.loss > this.config.lossThreshold) {
      anomalies.push('Loss above threshold');
      return false;
    }

    return true;
  }

  private updateClientScore(
    clientId: string,
    isValid: boolean,
    metrics: ValidationResult['metrics']
  ): void {
    const currentScore = this.clientScores.get(clientId) || 0.5;
    const updateScore = isValid ? 1 : 0;
    
    // Weighted average of current score and update score
    const newScore = 0.7 * currentScore + 0.3 * updateScore;
    this.clientScores.set(clientId, newScore);
  }
} 