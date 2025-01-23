import { randomBytes } from 'crypto';

/**
 * Base interface for privacy mechanism parameters
 */
export interface PrivacyParams {
  epsilon: number;
  delta?: number;
  sensitivity: number;
}

/**
 * Parameters for randomized response
 */
export interface RandomizedResponseParams extends PrivacyParams {
  probability: number;
}

/**
 * Parameters for k-anonymity
 */
export interface KAnonymityParams {
  k: number;
  quasiIdentifiers: string[];
}

/**
 * Parameters for l-diversity
 */
export interface LDiversityParams extends KAnonymityParams {
  l: number;
  sensitiveAttributes: string[];
}

/**
 * Parameters for t-closeness
 */
export interface TClosenessParams extends LDiversityParams {
  t: number;
}

/**
 * Privacy mechanism implementations
 */
export class PrivacyMechanisms {
  /**
   * Add Laplace noise to numeric data
   */
  addLaplaceNoise(value: number, params: PrivacyParams): number {
    this.validateEpsilon(params.epsilon);
    this.validateSensitivity(params.sensitivity);

    const scale = params.sensitivity / params.epsilon;
    return value + this.generateLaplaceNoise(scale);
  }

  /**
   * Add Gaussian noise to numeric data
   */
  addGaussianNoise(value: number, params: PrivacyParams): number {
    this.validateEpsilon(params.epsilon);
    this.validateDelta(params.delta);
    this.validateSensitivity(params.sensitivity);

    const sigma = this.calculateGaussianSigma(params);
    return value + this.generateGaussianNoise(sigma);
  }

  /**
   * Apply randomized response to boolean data
   */
  applyRandomizedResponse(value: boolean, params: RandomizedResponseParams): boolean {
    this.validateProbability(params.probability);

    if (Math.random() < params.probability) {
      return value;
    }
    return Math.random() < 0.5;
  }

  /**
   * Apply exponential mechanism for categorical data
   */
  applyExponentialMechanism<T>(
    utilities: Map<T, number>,
    params: PrivacyParams
  ): T {
    this.validateEpsilon(params.epsilon);
    this.validateSensitivity(params.sensitivity);

    const scores = new Map<T, number>();
    let maxScore = -Infinity;

    // Calculate scores
    for (const [item, utility] of utilities.entries()) {
      const score = Math.exp(
        (params.epsilon * utility) / (2 * params.sensitivity)
      );
      scores.set(item, score);
      maxScore = Math.max(maxScore, score);
    }

    // Normalize scores
    let totalScore = 0;
    for (const score of scores.values()) {
      totalScore += score;
    }

    // Select item based on probability
    let random = Math.random() * totalScore;
    for (const [item, score] of scores.entries()) {
      random -= score;
      if (random <= 0) {
        return item;
      }
    }

    // Fallback to first item (should never happen)
    return utilities.keys().next().value;
  }

  /**
   * Apply k-anonymity to a dataset
   */
  applyKAnonymity<T extends Record<string, any>>(
    data: T[],
    params: KAnonymityParams
  ): T[] {
    this.validateK(params.k);

    const groups = new Map<string, T[]>();

    // Group records by quasi-identifiers
    for (const record of data) {
      const key = this.getQuasiIdentifierKey(record, params.quasiIdentifiers);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    // Apply suppression or generalization to small groups
    const result: T[] = [];
    for (const group of groups.values()) {
      if (group.length >= params.k) {
        result.push(...group);
      } else {
        // Suppress or generalize records in small groups
        result.push(...this.generalizeRecords(group, params.quasiIdentifiers));
      }
    }

    return result;
  }

  /**
   * Apply l-diversity to a dataset
   */
  applyLDiversity<T extends Record<string, any>>(
    data: T[],
    params: LDiversityParams
  ): T[] {
    this.validateK(params.k);
    this.validateL(params.l);

    // First apply k-anonymity
    const kAnonymized = this.applyKAnonymity(data, params);
    const groups = new Map<string, T[]>();

    // Group records by quasi-identifiers
    for (const record of kAnonymized) {
      const key = this.getQuasiIdentifierKey(record, params.quasiIdentifiers);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    // Check l-diversity for each group
    const result: T[] = [];
    for (const group of groups.values()) {
      if (this.checkLDiversity(group, params)) {
        result.push(...group);
      } else {
        // Suppress or further generalize non-diverse groups
        result.push(...this.generalizeRecords(group, [
          ...params.quasiIdentifiers,
          ...params.sensitiveAttributes
        ]));
      }
    }

    return result;
  }

  /**
   * Apply t-closeness to a dataset
   */
  applyTCloseness<T extends Record<string, any>>(
    data: T[],
    params: TClosenessParams
  ): T[] {
    this.validateK(params.k);
    this.validateL(params.l);
    this.validateT(params.t);

    // First apply l-diversity
    const lDiverse = this.applyLDiversity(data, params);
    const groups = new Map<string, T[]>();

    // Group records by quasi-identifiers
    for (const record of lDiverse) {
      const key = this.getQuasiIdentifierKey(record, params.quasiIdentifiers);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    // Check t-closeness for each group
    const result: T[] = [];
    const globalDistribution = this.calculateDistribution(data, params.sensitiveAttributes);

    for (const group of groups.values()) {
      const groupDistribution = this.calculateDistribution(group, params.sensitiveAttributes);
      if (this.checkTCloseness(groupDistribution, globalDistribution, params.t)) {
        result.push(...group);
      } else {
        // Suppress or further generalize non-compliant groups
        result.push(...this.generalizeRecords(group, [
          ...params.quasiIdentifiers,
          ...params.sensitiveAttributes
        ]));
      }
    }

    return result;
  }

  /**
   * Generate Laplace noise
   */
  private generateLaplaceNoise(scale: number): number {
    const u = Math.random() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Generate Gaussian noise
   */
  private generateGaussianNoise(sigma: number): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return sigma * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Calculate sigma for Gaussian mechanism
   */
  private calculateGaussianSigma(params: PrivacyParams): number {
    const delta = params.delta || 0;
    return (params.sensitivity / params.epsilon) *
           Math.sqrt(2 * Math.log(1.25 / delta));
  }

  /**
   * Get key for quasi-identifiers
   */
  private getQuasiIdentifierKey(
    record: Record<string, any>,
    quasiIdentifiers: string[]
  ): string {
    return quasiIdentifiers
      .map(qi => String(record[qi]))
      .join('|');
  }

  /**
   * Generalize records by suppressing or generalizing values
   */
  private generalizeRecords<T extends Record<string, any>>(
    records: T[],
    attributes: string[]
  ): T[] {
    return records.map(record => {
      const generalized = { ...record };
      for (const attr of attributes) {
        generalized[attr] = '*'; // Simple suppression
      }
      return generalized;
    });
  }

  /**
   * Check if a group satisfies l-diversity
   */
  private checkLDiversity<T extends Record<string, any>>(
    group: T[],
    params: LDiversityParams
  ): boolean {
    for (const attr of params.sensitiveAttributes) {
      const values = new Set(group.map(r => r[attr]));
      if (values.size < params.l) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculate distribution of sensitive attributes
   */
  private calculateDistribution<T extends Record<string, any>>(
    records: T[],
    sensitiveAttributes: string[]
  ): Map<string, Map<any, number>> {
    const distribution = new Map<string, Map<any, number>>();

    for (const attr of sensitiveAttributes) {
      const valueMap = new Map<any, number>();
      distribution.set(attr, valueMap);

      for (const record of records) {
        const value = record[attr];
        valueMap.set(value, (valueMap.get(value) || 0) + 1);
      }

      // Normalize to probabilities
      for (const [value, count] of valueMap.entries()) {
        valueMap.set(value, count / records.length);
      }
    }

    return distribution;
  }

  /**
   * Check if distributions satisfy t-closeness
   */
  private checkTCloseness(
    groupDist: Map<string, Map<any, number>>,
    globalDist: Map<string, Map<any, number>>,
    t: number
  ): boolean {
    for (const [attr, groupValues] of groupDist.entries()) {
      const globalValues = globalDist.get(attr)!;
      let maxDiff = 0;

      for (const [value, prob] of groupValues.entries()) {
        const globalProb = globalValues.get(value) || 0;
        maxDiff = Math.max(maxDiff, Math.abs(prob - globalProb));
      }

      if (maxDiff > t) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate epsilon parameter
   */
  private validateEpsilon(epsilon: number): void {
    if (epsilon <= 0) {
      throw new Error('Epsilon must be positive');
    }
  }

  /**
   * Validate delta parameter
   */
  private validateDelta(delta?: number): void {
    if (delta !== undefined && (delta <= 0 || delta >= 1)) {
      throw new Error('Delta must be in (0,1)');
    }
  }

  /**
   * Validate sensitivity parameter
   */
  private validateSensitivity(sensitivity: number): void {
    if (sensitivity <= 0) {
      throw new Error('Sensitivity must be positive');
    }
  }

  /**
   * Validate probability parameter
   */
  private validateProbability(probability: number): void {
    if (probability <= 0 || probability >= 1) {
      throw new Error('Probability must be in (0,1)');
    }
  }

  /**
   * Validate k parameter
   */
  private validateK(k: number): void {
    if (k <= 1 || !Number.isInteger(k)) {
      throw new Error('k must be an integer greater than 1');
    }
  }

  /**
   * Validate l parameter
   */
  private validateL(l: number): void {
    if (l <= 1 || !Number.isInteger(l)) {
      throw new Error('l must be an integer greater than 1');
    }
  }

  /**
   * Validate t parameter
   */
  private validateT(t: number): void {
    if (t <= 0 || t >= 1) {
      throw new Error('t must be in (0,1)');
    }
  }
} 