import { PrivacyMechanism } from './DifferentialPrivacy';

/**
 * Privacy budget allocation strategy
 */
export enum BudgetStrategy {
  FIXED = 'FIXED',           // Fixed budget per query
  PROPORTIONAL = 'PROPORTIONAL', // Budget proportional to query sensitivity
  ADAPTIVE = 'ADAPTIVE',      // Adaptive budget based on query history
  COMPOSITION = 'COMPOSITION'  // Advanced composition theorems
}

/**
 * Budget allocation configuration
 */
export interface BudgetConfig {
  strategy: BudgetStrategy;
  totalEpsilon: number;
  minQueryEpsilon?: number;
  maxQueryEpsilon?: number;
  adaptiveParams?: {
    decayFactor: number;
    windowSize: number;
  };
  compositionParams?: {
    delta: number;
    k: number;  // Number of queries
  };
}

/**
 * Query metadata for budget tracking
 */
export interface QueryMetadata {
  queryId: string;
  mechanism: PrivacyMechanism;
  sensitivity: number;
  epsilon: number;
  timestamp: Date;
  success: boolean;
}

export class BudgetManager {
  private budgets: Map<string, {
    config: BudgetConfig;
    remainingEpsilon: number;
    queries: QueryMetadata[];
  }> = new Map();

  /**
   * Initialize privacy budget for a dataset
   * @param datasetId Dataset identifier
   * @param config Budget configuration
   */
  initializeBudget(datasetId: string, config: BudgetConfig): void {
    if (config.totalEpsilon <= 0) {
      throw new Error('Total privacy budget must be positive');
    }

    this.validateBudgetConfig(config);

    this.budgets.set(datasetId, {
      config,
      remainingEpsilon: config.totalEpsilon,
      queries: []
    });
  }

  /**
   * Request privacy budget for a query
   * @param datasetId Dataset identifier
   * @param queryId Query identifier
   * @param mechanism Privacy mechanism
   * @param sensitivity Query sensitivity
   * @returns Allocated privacy budget (epsilon)
   */
  requestBudget(
    datasetId: string,
    queryId: string,
    mechanism: PrivacyMechanism,
    sensitivity: number
  ): number {
    const budget = this.budgets.get(datasetId);
    if (!budget) {
      throw new Error('Privacy budget not initialized for dataset');
    }

    const epsilon = this.calculateQueryBudget(budget, sensitivity);
    if (epsilon > budget.remainingEpsilon) {
      throw new Error('Insufficient privacy budget');
    }

    return epsilon;
  }

  /**
   * Record query execution and update budget
   * @param datasetId Dataset identifier
   * @param query Query metadata
   */
  recordQuery(datasetId: string, query: QueryMetadata): void {
    const budget = this.budgets.get(datasetId);
    if (!budget) {
      throw new Error('Privacy budget not initialized for dataset');
    }

    budget.remainingEpsilon -= query.epsilon;
    budget.queries.push(query);

    // Update adaptive parameters if using adaptive strategy
    if (budget.config.strategy === BudgetStrategy.ADAPTIVE) {
      this.updateAdaptiveParams(budget);
    }
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
   * Get query history for a dataset
   * @param datasetId Dataset identifier
   * @returns Array of query metadata
   */
  getQueryHistory(datasetId: string): QueryMetadata[] {
    const budget = this.budgets.get(datasetId);
    if (!budget) {
      throw new Error('Privacy budget not initialized for dataset');
    }
    return [...budget.queries];
  }

  /**
   * Calculate budget for a query based on strategy
   */
  private calculateQueryBudget(
    budget: {
      config: BudgetConfig;
      remainingEpsilon: number;
      queries: QueryMetadata[];
    },
    sensitivity: number
  ): number {
    switch (budget.config.strategy) {
      case BudgetStrategy.FIXED:
        return this.calculateFixedBudget(budget);
      
      case BudgetStrategy.PROPORTIONAL:
        return this.calculateProportionalBudget(budget, sensitivity);
      
      case BudgetStrategy.ADAPTIVE:
        return this.calculateAdaptiveBudget(budget, sensitivity);
      
      case BudgetStrategy.COMPOSITION:
        return this.calculateCompositionBudget(budget);
      
      default:
        throw new Error('Unknown budget strategy');
    }
  }

  /**
   * Calculate fixed budget per query
   */
  private calculateFixedBudget(budget: {
    config: BudgetConfig;
    remainingEpsilon: number;
    queries: QueryMetadata[];
  }): number {
    const { minQueryEpsilon = 0.01 } = budget.config;
    return Math.max(minQueryEpsilon, budget.remainingEpsilon / 10);
  }

  /**
   * Calculate budget proportional to query sensitivity
   */
  private calculateProportionalBudget(
    budget: {
      config: BudgetConfig;
      remainingEpsilon: number;
      queries: QueryMetadata[];
    },
    sensitivity: number
  ): number {
    const { minQueryEpsilon = 0.01, maxQueryEpsilon } = budget.config;
    const proportionalEpsilon = (sensitivity * budget.remainingEpsilon) / 100;
    
    if (maxQueryEpsilon !== undefined) {
      return Math.min(
        Math.max(minQueryEpsilon, proportionalEpsilon),
        maxQueryEpsilon
      );
    }
    
    return Math.max(minQueryEpsilon, proportionalEpsilon);
  }

  /**
   * Calculate adaptive budget based on query history
   */
  private calculateAdaptiveBudget(
    budget: {
      config: BudgetConfig;
      remainingEpsilon: number;
      queries: QueryMetadata[];
    },
    sensitivity: number
  ): number {
    const { adaptiveParams } = budget.config;
    if (!adaptiveParams) {
      throw new Error('Adaptive parameters not configured');
    }

    const { decayFactor, windowSize } = adaptiveParams;
    const recentQueries = budget.queries
      .slice(-windowSize)
      .filter(q => q.success);

    // Calculate average epsilon usage
    const avgEpsilon = recentQueries.length > 0
      ? recentQueries.reduce((sum, q) => sum + q.epsilon, 0) / recentQueries.length
      : budget.remainingEpsilon / 10;

    // Apply decay factor based on remaining budget
    const decayedEpsilon = avgEpsilon * Math.pow(decayFactor, 
      1 - budget.remainingEpsilon / budget.config.totalEpsilon);

    return Math.min(decayedEpsilon, budget.remainingEpsilon / 2);
  }

  /**
   * Calculate budget using advanced composition theorems
   */
  private calculateCompositionBudget(
    budget: {
      config: BudgetConfig;
      remainingEpsilon: number;
      queries: QueryMetadata[];
    }
  ): number {
    const { compositionParams } = budget.config;
    if (!compositionParams) {
      throw new Error('Composition parameters not configured');
    }

    const { delta, k } = compositionParams;
    const remainingQueries = k - budget.queries.length;
    
    if (remainingQueries <= 0) {
      throw new Error('Query limit exceeded');
    }

    // Use advanced composition theorem
    const compositionEpsilon = Math.sqrt(2 * Math.log(1/delta)) * 
      Math.sqrt(remainingQueries) * (budget.remainingEpsilon / remainingQueries);

    return Math.min(compositionEpsilon, budget.remainingEpsilon / 2);
  }

  /**
   * Update adaptive parameters based on query history
   */
  private updateAdaptiveParams(
    budget: {
      config: BudgetConfig;
      remainingEpsilon: number;
      queries: QueryMetadata[];
    }
  ): void {
    const { adaptiveParams } = budget.config;
    if (!adaptiveParams) return;

    const { windowSize } = adaptiveParams;
    const recentQueries = budget.queries.slice(-windowSize);

    // Update decay factor based on query success rate
    const successRate = recentQueries.filter(q => q.success).length / 
      recentQueries.length;
    
    adaptiveParams.decayFactor = Math.max(0.1, 
      Math.min(0.9, successRate));
  }

  /**
   * Validate budget configuration
   */
  private validateBudgetConfig(config: BudgetConfig): void {
    if (config.totalEpsilon <= 0) {
      throw new Error('Total epsilon must be positive');
    }

    if (config.minQueryEpsilon !== undefined && config.minQueryEpsilon <= 0) {
      throw new Error('Minimum query epsilon must be positive');
    }

    if (config.maxQueryEpsilon !== undefined && 
        config.maxQueryEpsilon <= (config.minQueryEpsilon || 0)) {
      throw new Error('Maximum query epsilon must be greater than minimum');
    }

    if (config.strategy === BudgetStrategy.ADAPTIVE) {
      if (!config.adaptiveParams) {
        throw new Error('Adaptive parameters required for adaptive strategy');
      }
      if (config.adaptiveParams.decayFactor <= 0 || 
          config.adaptiveParams.decayFactor >= 1) {
        throw new Error('Decay factor must be in (0,1)');
      }
      if (config.adaptiveParams.windowSize <= 0) {
        throw new Error('Window size must be positive');
      }
    }

    if (config.strategy === BudgetStrategy.COMPOSITION) {
      if (!config.compositionParams) {
        throw new Error('Composition parameters required for composition strategy');
      }
      if (config.compositionParams.delta <= 0 || 
          config.compositionParams.delta >= 1) {
        throw new Error('Delta must be in (0,1)');
      }
      if (config.compositionParams.k <= 0) {
        throw new Error('Number of queries must be positive');
      }
    }
  }
} 