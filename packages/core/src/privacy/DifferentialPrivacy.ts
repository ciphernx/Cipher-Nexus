import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Mechanism types for differential privacy
 */
export enum PrivacyMechanism {
  LAPLACE = 'LAPLACE',
  GAUSSIAN = 'GAUSSIAN',
  EXPONENTIAL = 'EXPONENTIAL'
}

/**
 * Privacy parameters configuration
 */
export interface PrivacyParams {
  epsilon: number;     // Privacy budget
  delta?: number;      // Failure probability (for approximate DP)
  sensitivity: number; // Maximum change in query result
}

/**
 * Privacy budget tracking for multiple queries
 */
export interface PrivacyBudget {
  totalEpsilon: number;
  remainingEpsilon: number;
  queries: {
    queryId: string;
    mechanism: PrivacyMechanism;
    epsilon: number;
    timestamp: Date;
  }[];
}

export class DifferentialPrivacy {
  private budgets: Map<string, PrivacyBudget> = new Map();

  /**
   * Add Laplace noise to numeric data
   * @param value Original value
   * @param params Privacy parameters
   * @returns Noisy value
   */
  addLaplaceNoise(value: number, params: PrivacyParams): number {
    this.validatePrivacyParams(params);
    const scale = params.sensitivity / params.epsilon;
    const noise = this.generateLaplaceNoise(scale);
    return value + noise;
  }

  /**
   * Add Gaussian noise to numeric data
   * @param value Original value
   * @param params Privacy parameters
   * @returns Noisy value
   */
  addGaussianNoise(value: number, params: PrivacyParams): number {
    this.validatePrivacyParams(params);
    if (!params.delta) {
      throw new Error('Delta parameter required for Gaussian mechanism');
    }
    
    const sigma = this.calculateGaussianSigma(params);
    const noise = this.generateGaussianNoise(sigma);
    return value + noise;
  }

  /**
   * Apply exponential mechanism for categorical data
   * @param utilities Utility scores for each option
   * @param params Privacy parameters
   * @returns Selected index
   */
  applyExponentialMechanism(utilities: number[], params: PrivacyParams): number {
    this.validatePrivacyParams(params);
    const scale = 2 * params.sensitivity / params.epsilon;
    
    // Calculate probabilities
    const maxUtility = Math.max(...utilities);
    const probabilities = utilities.map(u => 
      Math.exp((params.epsilon * (u - maxUtility)) / (2 * params.sensitivity))
    );
    
    // Normalize probabilities
    const sum = probabilities.reduce((a, b) => a + b, 0);
    const normalizedProbs = probabilities.map(p => p / sum);
    
    // Sample from distribution
    return this.sampleFromDistribution(normalizedProbs);
  }

  /**
   * Initialize privacy budget for a dataset
   * @param datasetId Unique identifier for the dataset
   * @param totalEpsilon Total privacy budget
   */
  initializePrivacyBudget(datasetId: string, totalEpsilon: number): void {
    if (totalEpsilon <= 0) {
      throw new Error('Total privacy budget must be positive');
    }
    
    this.budgets.set(datasetId, {
      totalEpsilon,
      remainingEpsilon: totalEpsilon,
      queries: []
    });
  }

  /**
   * Check and consume privacy budget for a query
   * @param datasetId Dataset identifier
   * @param queryId Query identifier
   * @param mechanism Privacy mechanism
   * @param epsilon Required privacy budget
   * @returns Whether budget is available
   */
  consumePrivacyBudget(
    datasetId: string,
    queryId: string,
    mechanism: PrivacyMechanism,
    epsilon: number
  ): boolean {
    const budget = this.budgets.get(datasetId);
    if (!budget) {
      throw new Error('Privacy budget not initialized for dataset');
    }
    
    if (epsilon > budget.remainingEpsilon) {
      return false;
    }
    
    budget.remainingEpsilon -= epsilon;
    budget.queries.push({
      queryId,
      mechanism,
      epsilon,
      timestamp: new Date()
    });
    
    return true;
  }

  /**
   * Get remaining privacy budget for a dataset
   * @param datasetId Dataset identifier
   * @returns Remaining privacy budget
   */
  getRemainingBudget(datasetId: string): number {
    const budget = this.budgets.get(datasetId);
    if (!budget) {
      throw new Error('Privacy budget not initialized for dataset');
    }
    return budget.remainingEpsilon;
  }

  /**
   * Validate privacy parameters
   * @param params Privacy parameters to validate
   */
  private validatePrivacyParams(params: PrivacyParams): void {
    if (params.epsilon <= 0) {
      throw new Error('Epsilon must be positive');
    }
    if (params.sensitivity <= 0) {
      throw new Error('Sensitivity must be positive');
    }
    if (params.delta !== undefined && (params.delta <= 0 || params.delta >= 1)) {
      throw new Error('Delta must be in (0,1)');
    }
  }

  /**
   * Generate Laplace noise
   * @param scale Scale parameter
   * @returns Random noise from Laplace distribution
   */
  private generateLaplaceNoise(scale: number): number {
    const u = Math.random() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Generate Gaussian noise
   * @param sigma Standard deviation
   * @returns Random noise from Gaussian distribution
   */
  private generateGaussianNoise(sigma: number): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return sigma * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Calculate sigma for Gaussian mechanism
   * @param params Privacy parameters
   * @returns Sigma value
   */
  private calculateGaussianSigma(params: PrivacyParams): number {
    const delta = params.delta!;
    return (params.sensitivity / params.epsilon) * 
           Math.sqrt(2 * Math.log(1.25 / delta));
  }

  /**
   * Sample from discrete probability distribution
   * @param probabilities Array of probabilities
   * @returns Selected index
   */
  private sampleFromDistribution(probabilities: number[]): number {
    const r = Math.random();
    let sum = 0;
    for (let i = 0; i < probabilities.length; i++) {
      sum += probabilities[i];
      if (r <= sum) return i;
    }
    return probabilities.length - 1;
  }
} 