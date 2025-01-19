import { ModelUpdate } from '../../types/federated';

export interface AlgorithmConfig {
  // FedProx parameters
  mu?: number;
  
  // FedMA parameters
  matchingLayers?: string[];
  matchingThreshold?: number;
  
  // FedDyn parameters
  alpha?: number;
  dynamicRegularization?: boolean;
  
  // SCAFFOLD parameters
  serverLearningRate?: number;
  useControlVariates?: boolean;
}

export class FederatedAlgorithms {
  private previousWeights: Float32Array[] | null = null;
  private dynamicGradient: Float32Array[] | null = null;
  private controlVariates: Map<string, Float32Array[]> = new Map();
  private serverControlVariate: Float32Array[] | null = null;

  constructor(private config: AlgorithmConfig) {}

  async applyFedProx(
    updates: ModelUpdate[],
    globalWeights: Float32Array[]
  ): Promise<Float32Array[]> {
    const mu = this.config.mu || 0.01;
    const aggregatedWeights: Float32Array[] = [];
    const totalSamples = updates.reduce((sum, u) => sum + u.weights[0].length, 0);

    for (let layer = 0; layer < globalWeights.length; layer++) {
      const layerWeights = new Float32Array(globalWeights[layer].length);

      for (let i = 0; i < layerWeights.length; i++) {
        let weightedSum = 0;
        for (const update of updates) {
          const sampleWeight = update.weights[0].length / totalSamples;
          const proximalTerm = mu * (update.weights[layer][i] - globalWeights[layer][i]);
          weightedSum += sampleWeight * (update.weights[layer][i] - proximalTerm);
        }
        layerWeights[i] = weightedSum;
      }

      aggregatedWeights.push(layerWeights);
    }

    return aggregatedWeights;
  }

  async applyFedMA(
    updates: ModelUpdate[],
    globalWeights: Float32Array[]
  ): Promise<Float32Array[]> {
    const threshold = this.config.matchingThreshold || 0.5;
    const matchingLayers = this.config.matchingLayers || [];
    const aggregatedWeights: Float32Array[] = [];

    for (let layer = 0; layer < globalWeights.length; layer++) {
      if (matchingLayers.includes(layer.toString())) {
        // Apply neuron matching for specified layers
        const matchedWeights = await this.matchNeurons(
          updates.map(u => u.weights[layer]),
          threshold
        );
        aggregatedWeights.push(matchedWeights);
      } else {
        // Use regular averaging for other layers
        const layerWeights = await this.averageWeights(
          updates.map(u => u.weights[layer])
        );
        aggregatedWeights.push(layerWeights);
      }
    }

    return aggregatedWeights;
  }

  async applyFedDyn(
    updates: ModelUpdate[],
    globalWeights: Float32Array[]
  ): Promise<Float32Array[]> {
    const alpha = this.config.alpha || 0.1;
    const aggregatedWeights: Float32Array[] = [];

    // Initialize dynamic gradient if not exists
    if (!this.dynamicGradient) {
      this.dynamicGradient = globalWeights.map(layer => 
        new Float32Array(layer.length).fill(0)
      );
    }

    // Store previous weights
    this.previousWeights = globalWeights.map(layer => new Float32Array(layer));

    for (let layer = 0; layer < globalWeights.length; layer++) {
      const layerWeights = new Float32Array(globalWeights[layer].length);
      
      for (let i = 0; i < layerWeights.length; i++) {
        let weightedSum = 0;
        for (const update of updates) {
          weightedSum += update.weights[layer][i] / updates.length;
        }

        // Apply dynamic regularization
        if (this.config.dynamicRegularization) {
          const dynamicTerm = alpha * this.dynamicGradient[layer][i];
          layerWeights[i] = weightedSum - dynamicTerm;
        } else {
          layerWeights[i] = weightedSum;
        }
      }

      aggregatedWeights.push(layerWeights);
    }

    // Update dynamic gradient
    this.updateDynamicGradient(aggregatedWeights);

    return aggregatedWeights;
  }

  async applySCAFFOLD(
    updates: ModelUpdate[],
    globalWeights: Float32Array[]
  ): Promise<Float32Array[]> {
    const learningRate = this.config.serverLearningRate || 1.0;
    const aggregatedWeights: Float32Array[] = [];

    // Initialize server control variate if not exists
    if (!this.serverControlVariate) {
      this.serverControlVariate = globalWeights.map(layer =>
        new Float32Array(layer.length).fill(0)
      );
    }

    for (let layer = 0; layer < globalWeights.length; layer++) {
      const layerWeights = new Float32Array(globalWeights[layer].length);
      
      for (let i = 0; i < layerWeights.length; i++) {
        let deltaSum = 0;
        let controlSum = 0;

        for (const update of updates) {
          const clientControls = this.getClientControlVariate(update.clientId);
          deltaSum += update.weights[layer][i] - globalWeights[layer][i];
          controlSum += clientControls[layer][i] - this.serverControlVariate![layer][i];
        }

        // Update weights using control variates
        layerWeights[i] = globalWeights[layer][i] + 
          learningRate * (deltaSum / updates.length - controlSum / updates.length);
      }

      aggregatedWeights.push(layerWeights);
    }

    // Update server control variate
    this.updateServerControlVariate(aggregatedWeights, globalWeights);

    return aggregatedWeights;
  }

  private async matchNeurons(
    layerUpdates: Float32Array[],
    threshold: number
  ): Promise<Float32Array> {
    const numNeurons = layerUpdates[0].length;
    const matchedWeights = new Float32Array(numNeurons);
    const similarities = new Array(numNeurons);

    // Compute pairwise cosine similarities
    for (let i = 0; i < numNeurons; i++) {
      similarities[i] = new Array(numNeurons);
      for (let j = 0; j < numNeurons; j++) {
        similarities[i][j] = this.computeCosineSimilarity(
          layerUpdates.map(update => update[i]),
          layerUpdates.map(update => update[j])
        );
      }
    }

    // Match neurons using greedy matching
    const matched = new Set<number>();
    for (let i = 0; i < numNeurons; i++) {
      if (matched.has(i)) continue;

      let bestMatch = -1;
      let maxSimilarity = threshold;

      for (let j = i + 1; j < numNeurons; j++) {
        if (matched.has(j)) continue;

        if (similarities[i][j] > maxSimilarity) {
          maxSimilarity = similarities[i][j];
          bestMatch = j;
        }
      }

      if (bestMatch !== -1) {
        // Average matched neurons
        for (let k = 0; k < layerUpdates.length; k++) {
          matchedWeights[i] += (layerUpdates[k][i] + layerUpdates[k][bestMatch]) / 
            (2 * layerUpdates.length);
        }
        matched.add(i);
        matched.add(bestMatch);
      } else {
        // Keep original weights for unmatched neurons
        for (let k = 0; k < layerUpdates.length; k++) {
          matchedWeights[i] += layerUpdates[k][i] / layerUpdates.length;
        }
      }
    }

    return matchedWeights;
  }

  private computeCosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    return normA && normB ? dotProduct / (normA * normB) : 0;
  }

  private async averageWeights(weights: Float32Array[]): Promise<Float32Array> {
    const averaged = new Float32Array(weights[0].length);
    for (let i = 0; i < averaged.length; i++) {
      for (const weight of weights) {
        averaged[i] += weight[i] / weights.length;
      }
    }
    return averaged;
  }

  private updateDynamicGradient(newWeights: Float32Array[]): void {
    if (!this.previousWeights || !this.dynamicGradient) return;

    for (let layer = 0; layer < newWeights.length; layer++) {
      for (let i = 0; i < newWeights[layer].length; i++) {
        const gradientUpdate = newWeights[layer][i] - this.previousWeights[layer][i];
        this.dynamicGradient[layer][i] += gradientUpdate;
      }
    }
  }

  private getClientControlVariate(clientId: string): Float32Array[] {
    if (!this.controlVariates.has(clientId)) {
      // Initialize client control variate if not exists
      this.controlVariates.set(
        clientId,
        this.serverControlVariate!.map(layer => new Float32Array(layer.length).fill(0))
      );
    }
    return this.controlVariates.get(clientId)!;
  }

  private updateServerControlVariate(
    newWeights: Float32Array[],
    oldWeights: Float32Array[]
  ): void {
    if (!this.serverControlVariate) return;

    for (let layer = 0; layer < newWeights.length; layer++) {
      for (let i = 0; i < newWeights[layer].length; i++) {
        const update = newWeights[layer][i] - oldWeights[layer][i];
        this.serverControlVariate[layer][i] += update;
      }
    }
  }
} 