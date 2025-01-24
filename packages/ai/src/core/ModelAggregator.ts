import { EventEmitter } from 'events';
import { ModelUpdate } from '../types/federated';

interface AggregationResult {
  aggregatedWeights: Float32Array[];
  metrics: {
    loss: number;
    accuracy: number;
  };
}

export class ModelAggregator extends EventEmitter {
  constructor(private strategy: 'FedAvg' | 'FedProx' | 'FedMA') {
    super();
  }

  async aggregateUpdates(
    updates: ModelUpdate[],
    globalWeights: Float32Array[]
  ): Promise<AggregationResult> {
    try {
      let aggregatedWeights: Float32Array[];
      
      switch (this.strategy) {
        case 'FedAvg':
          aggregatedWeights = await this.federatedAveraging(updates);
          break;
        case 'FedProx':
          aggregatedWeights = await this.federatedProximal(updates, globalWeights);
          break;
        case 'FedMA':
          aggregatedWeights = await this.federatedMatchingAveraging(updates);
          break;
        default:
          throw new Error(`Unsupported aggregation strategy: ${this.strategy}`);
      }

      const metrics = this.computeAggregatedMetrics(updates);

      this.emit('aggregationCompleted', {
        strategy: this.strategy,
        metrics
      });

      return {
        aggregatedWeights,
        metrics
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async federatedAveraging(updates: ModelUpdate[]): Promise<Float32Array[]> {
    // Implement FedAvg algorithm
    // weights = sum(n_k * w_k) / sum(n_k)
    // where n_k is the number of samples and w_k is the model weights
    
    const totalSamples = updates.reduce((sum, update) => sum + update.weights[0].length, 0);
    const numLayers = updates[0].weights.length;
    const aggregatedWeights: Float32Array[] = [];

    for (let layer = 0; layer < numLayers; layer++) {
      const layerShape = updates[0].weights[layer].length;
      const layerWeights = new Float32Array(layerShape);

      for (let i = 0; i < layerShape; i++) {
        let weightedSum = 0;
        for (const update of updates) {
          const sampleWeight = update.weights[0].length / totalSamples;
          weightedSum += update.weights[layer][i] * sampleWeight;
        }
        layerWeights[i] = weightedSum;
      }

      aggregatedWeights.push(layerWeights);
      this.emit('aggregationProgress', {
        layer,
        totalLayers: numLayers
      });
    }

    return aggregatedWeights;
  }

  private async federatedProximal(
    updates: ModelUpdate[],
    globalWeights: Float32Array[]
  ): Promise<Float32Array[]> {
    // Implement FedProx algorithm
    // Adds proximal term to client objective:
    // L_i(w) + (μ/2)||w - w_t||^2
    
    const mu = 0.01; // Proximal term coefficient
    const numLayers = updates[0].weights.length;
    const aggregatedWeights: Float32Array[] = [];

    for (let layer = 0; layer < numLayers; layer++) {
      const layerShape = updates[0].weights[layer].length;
      const layerWeights = new Float32Array(layerShape);

      for (let i = 0; i < layerShape; i++) {
        let sum = 0;
        for (const update of updates) {
          // Add proximal term penalty
          const diff = update.weights[layer][i] - globalWeights[layer][i];
          sum += update.weights[layer][i] - mu * diff;
        }
        layerWeights[i] = sum / updates.length;
      }

      aggregatedWeights.push(layerWeights);
      this.emit('aggregationProgress', {
        layer,
        totalLayers: numLayers
      });
    }

    return aggregatedWeights;
  }

  private async federatedMatchingAveraging(updates: ModelUpdate[]): Promise<Float32Array[]> {
    // Implement FedMA algorithm
    // 1. Layer-wise matching of neurons
    // 2. Optimal transport for weight matching
    // 3. Weighted averaging of matched weights
    
    const numLayers = updates[0].weights.length;
    const aggregatedWeights: Float32Array[] = [];

    for (let layer = 0; layer < numLayers; layer++) {
      const layerShape = updates[0].weights[layer].length;
      const layerWeights = new Float32Array(layerShape);

      // Simplified implementation - just averaging for now
      // TODO: Implement proper neuron matching and optimal transport
      for (let i = 0; i < layerShape; i++) {
        let sum = 0;
        for (const update of updates) {
          sum += update.weights[layer][i];
        }
        layerWeights[i] = sum / updates.length;
      }

      aggregatedWeights.push(layerWeights);
      this.emit('aggregationProgress', {
        layer,
        totalLayers: numLayers
      });
    }

    return aggregatedWeights;
  }

  private computeAggregatedMetrics(updates: ModelUpdate[]): {
    loss: number;
    accuracy: number;
  } {
    // Compute weighted average of metrics
    const totalSamples = updates.reduce((sum, update) => sum + update.weights[0].length, 0);
    
    let weightedLoss = 0;
    let weightedAccuracy = 0;

    for (const update of updates) {
      const weight = update.weights[0].length / totalSamples;
      weightedLoss += update.metrics.loss * weight;
      weightedAccuracy += update.metrics.accuracy * weight;
    }

    return {
      loss: weightedLoss,
      accuracy: weightedAccuracy
    };
  }
} 