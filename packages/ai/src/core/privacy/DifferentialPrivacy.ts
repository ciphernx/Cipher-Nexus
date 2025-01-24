import { EventEmitter } from 'events';
import { ModelUpdate } from '../../types/federated';

interface DPConfig {
  epsilon: number;
  delta: number;
  maxGradientNorm: number;
  noiseMultiplier: number;
  minBatchSize: number;
  maxReservedBudget: number;
}

interface PrivacyAccountant {
  epsilon: number;
  delta: number;
  steps: number;
  alpha: number;
}

export class DifferentialPrivacy extends EventEmitter {
  private privacyBudgets: Map<string, PrivacyAccountant> = new Map();
  private reservedBudgets: Map<string, number> = new Map();
  private globalBudget: PrivacyAccountant;

  constructor(private config: DPConfig) {
    super();
    this.globalBudget = {
      epsilon: 0,
      delta: 0,
      steps: 0,
      alpha: 1.0
    };
  }

  async applyDifferentialPrivacy(
    update: ModelUpdate,
    batchSize: number
  ): Promise<ModelUpdate> {
    try {
      // Check privacy budget
      if (!this.checkPrivacyBudget(update.clientId)) {
        throw new Error('Privacy budget exceeded');
      }

      // Validate batch size
      if (batchSize < this.config.minBatchSize) {
        throw new Error('Batch size too small for privacy guarantees');
      }

      // 1. Clip gradients
      const clippedWeights = this.clipGradients(update.weights);

      // 2. Add calibrated noise
      const noisyWeights = this.addGaussianNoise(
        clippedWeights,
        batchSize
      );

      // 3. Update privacy accountant
      this.updatePrivacyAccounting(update.clientId, batchSize);

      this.emit('privacyApplied', {
        clientId: update.clientId,
        currentBudget: this.getPrivacyBudget(update.clientId)
      });

      return {
        ...update,
        weights: noisyWeights
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async reservePrivacyBudget(
    clientId: string,
    requestedEpsilon: number
  ): Promise<boolean> {
    try {
      const currentReserved = this.reservedBudgets.get(clientId) || 0;
      
      if (currentReserved + requestedEpsilon > this.config.maxReservedBudget) {
        return false;
      }

      this.reservedBudgets.set(
        clientId,
        currentReserved + requestedEpsilon
      );

      this.emit('budgetReserved', {
        clientId,
        requestedEpsilon,
        totalReserved: currentReserved + requestedEpsilon
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  getPrivacyBudget(clientId: string): PrivacyAccountant {
    return (
      this.privacyBudgets.get(clientId) || {
        epsilon: 0,
        delta: 0,
        steps: 0,
        alpha: 1.0
      }
    );
  }

  getGlobalPrivacyBudget(): PrivacyAccountant {
    return this.globalBudget;
  }

  private clipGradients(weights: Float32Array[]): Float32Array[] {
    const clippedWeights: Float32Array[] = [];
    
    for (const layerWeights of weights) {
      const layerNorm = this.computeL2Norm(layerWeights);
      const scale = Math.min(1, this.config.maxGradientNorm / layerNorm);
      
      const clippedLayer = new Float32Array(layerWeights.length);
      for (let i = 0; i < layerWeights.length; i++) {
        clippedLayer[i] = layerWeights[i] * scale;
      }
      
      clippedWeights.push(clippedLayer);
    }

    return clippedWeights;
  }

  private addGaussianNoise(
    weights: Float32Array[],
    batchSize: number
  ): Float32Array[] {
    const noisyWeights: Float32Array[] = [];
    const sensitivity = this.config.maxGradientNorm;
    const sigma = (sensitivity * this.config.noiseMultiplier) / Math.sqrt(batchSize);

    for (const layerWeights of weights) {
      const noisyLayer = new Float32Array(layerWeights.length);
      
      for (let i = 0; i < layerWeights.length; i++) {
        const noise = this.generateGaussianNoise(0, sigma);
        noisyLayer[i] = layerWeights[i] + noise;
      }
      
      noisyWeights.push(noisyLayer);
    }

    return noisyWeights;
  }

  private updatePrivacyAccounting(
    clientId: string,
    batchSize: number
  ): void {
    // Get current privacy accounting
    const accountant = this.getPrivacyBudget(clientId);
    
    // Update using moments accountant
    const q = batchSize / this.getTotalSamples(clientId);
    const stepEpsilon = this.computeStepEpsilon(q);
    
    accountant.epsilon += stepEpsilon;
    accountant.delta += this.config.delta / accountant.steps;
    accountant.steps += 1;
    
    // Update alpha using optimal composition
    accountant.alpha = this.computeOptimalAlpha(
      accountant.epsilon,
      accountant.delta,
      accountant.steps
    );

    // Update global budget
    this.globalBudget.epsilon += stepEpsilon;
    this.globalBudget.delta += this.config.delta / this.globalBudget.steps;
    this.globalBudget.steps += 1;
    
    // Store updated accountant
    this.privacyBudgets.set(clientId, accountant);
  }

  private checkPrivacyBudget(clientId: string): boolean {
    const accountant = this.getPrivacyBudget(clientId);
    const reserved = this.reservedBudgets.get(clientId) || 0;

    return (
      accountant.epsilon + reserved <= this.config.epsilon &&
      accountant.delta <= this.config.delta
    );
  }

  private computeL2Norm(weights: Float32Array): number {
    let sumSquares = 0;
    for (const weight of weights) {
      sumSquares += weight * weight;
    }
    return Math.sqrt(sumSquares);
  }

  private generateGaussianNoise(mean: number, stdDev: number): number {
    let u1 = 0;
    let u2 = 0;
    
    // Box-Muller transform
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();
    
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + stdDev * z0;
  }

  private computeStepEpsilon(samplingRate: number): number {
    // Compute per-step epsilon using moments accountant
    const c = this.config.noiseMultiplier;
    const q = samplingRate;
    
    // Simplified computation - in practice use more precise bounds
    return Math.sqrt(2 * q * Math.log(1.25 / this.config.delta)) / c;
  }

  private computeOptimalAlpha(
    epsilon: number,
    delta: number,
    steps: number
  ): number {
    // Compute optimal moment using binary search
    let left = 1;
    let right = 100;
    
    while (right - left > 0.01) {
      const mid = (left + right) / 2;
      const eps = this.computeEpsilonForAlpha(mid, delta, steps);
      
      if (eps > epsilon) {
        left = mid;
      } else {
        right = mid;
      }
    }
    
    return (left + right) / 2;
  }

  private computeEpsilonForAlpha(
    alpha: number,
    delta: number,
    steps: number
  ): number {
    const c = this.config.noiseMultiplier;
    const q = this.config.minBatchSize / this.getTotalSamples('global');
    
    // Compute epsilon using Renyi Differential Privacy
    const rdp = (alpha * q * q) / (2 * c * c);
    return rdp * steps + Math.log(1 / delta) / (alpha - 1);
  }

  private getTotalSamples(clientId: string): number {
    // In practice, this should return the actual dataset size
    return clientId === 'global' ? 1000000 : 10000;
  }
} 