import { FederatedConfig, ModelConfig, ModelUpdate, ModelState } from '../types';
import { PrivacyProtocol } from '@cipher-nexus/protocol';

export class FederatedLearning {
  private globalModel: ModelState | null = null;
  private roundNumber: number = 0;
  private clientUpdates: Map<string, ModelUpdate> = new Map();

  constructor(
    private modelConfig: ModelConfig,
    private fedConfig: FederatedConfig,
    private privacyProtocol: PrivacyProtocol
  ) {}

  async initializeModel(): Promise<void> {
    try {
      // Initialize model with random weights
      this.globalModel = {
        weights: await this.generateInitialWeights(),
        round: 0,
        metrics: {
          accuracy: 0,
          loss: 0,
          timestamp: new Date()
        }
      };

      // Encrypt initial model if privacy is enabled
      if (this.fedConfig.enablePrivacy && this.globalModel) {
        this.globalModel.weights = await this.privacyProtocol.encrypt(this.globalModel.weights);
      }
    } catch (error: any) {
      throw new Error(`Model initialization failed: ${error.message}`);
    }
  }

  async aggregateUpdates(clientUpdates: ModelUpdate[]): Promise<ModelState> {
    try {
      this.roundNumber++;
      const validUpdates = await this.validateUpdates(clientUpdates);
      
      // Decrypt updates if privacy is enabled
      let processedUpdates = validUpdates;
      if (this.fedConfig.enablePrivacy) {
        processedUpdates = await Promise.all(
          validUpdates.map(async update => ({
            ...update,
            weights: await this.privacyProtocol.decrypt(update.weights)
          }))
        );
      }

      // Perform federated averaging
      const aggregatedWeights = this.federatedAveraging(processedUpdates);
      
      // Update global model
      this.globalModel = {
        weights: aggregatedWeights,
        round: this.roundNumber,
        metrics: await this.computeMetrics(processedUpdates)
      };

      // Encrypt updated model if privacy is enabled
      if (this.fedConfig.enablePrivacy && this.globalModel) {
        this.globalModel.weights = await this.privacyProtocol.encrypt(this.globalModel.weights);
      }

      if (!this.globalModel) {
        throw new Error('Failed to update global model');
      }

      return this.globalModel;
    } catch (error: any) {
      throw new Error(`Update aggregation failed: ${error.message}`);
    }
  }

  async distributeModel(): Promise<ModelState> {
    try {
      if (!this.globalModel) {
        throw new Error('Global model not initialized');
      }

      // Create a copy of the global model for distribution
      const distributionModel = {
        ...this.globalModel,
        round: this.roundNumber
      };

      return distributionModel;
    } catch (error: any) {
      throw new Error(`Model distribution failed: ${error.message}`);
    }
  }

  private async generateInitialWeights(): Promise<number[][][]> {
    // Generate random weights based on model configuration
    const weights: number[][][] = [];
    for (const layer of this.modelConfig.layers) {
      const layerWeights: number[][] = Array(layer.units)
        .fill(0)
        .map(() => Array(layer.inputDim)
          .fill(0)
          .map(() => Math.random() * 2 - 1)
        );
      weights.push(layerWeights);
    }
    return weights;
  }

  private async validateUpdates(updates: ModelUpdate[]): Promise<ModelUpdate[]> {
    // Filter out invalid updates
    return updates.filter(update => {
      // Check update structure
      if (!update.weights || !update.clientId) {
        return false;
      }

      // Check for malicious updates (e.g., extreme values)
      const hasExtremeValues = this.checkExtremeValues(update.weights);
      if (hasExtremeValues) {
        return false;
      }

      return true;
    });
  }

  private checkExtremeValues(weights: any): boolean {
    // Check for extreme or NaN values in weights
    const flatWeights = Array.isArray(weights) ? weights.flat(Infinity) : [weights];
    return flatWeights.some(w => 
      isNaN(w) || 
      !isFinite(w) || 
      Math.abs(w) > this.fedConfig.maxWeightMagnitude
    );
  }

  private federatedAveraging(updates: ModelUpdate[]): number[][][] {
    // Implement federated averaging algorithm
    const numUpdates = updates.length;
    if (numUpdates === 0) {
      throw new Error('No valid updates to aggregate');
    }

    // Initialize aggregated weights with zeros
    const aggregatedWeights: number[][][] = updates[0].weights.map(layer =>
      layer.map(row =>
        Array(row.length).fill(0)
      )
    );

    // Sum all weights
    for (const update of updates) {
      update.weights.forEach((layer, i) =>
        layer.forEach((row, j) =>
          row.forEach((weight, k) => {
            aggregatedWeights[i][j][k] += weight / numUpdates;
          })
        )
      );
    }

    return aggregatedWeights;
  }

  private async computeMetrics(updates: ModelUpdate[]): Promise<{
    accuracy: number;
    loss: number;
    timestamp: Date;
  }> {
    // Compute aggregated metrics from client updates
    const metrics = updates.reduce(
      (acc, update) => ({
        accuracy: acc.accuracy + (update.metrics?.accuracy || 0),
        loss: acc.loss + (update.metrics?.loss || 0)
      }),
      { accuracy: 0, loss: 0 }
    );

    const numUpdates = updates.length;
    return {
      accuracy: metrics.accuracy / numUpdates,
      loss: metrics.loss / numUpdates,
      timestamp: new Date()
    };
  }
}
