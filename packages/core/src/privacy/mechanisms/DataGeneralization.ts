/**
 * Generalization strategy types
 */
export enum GeneralizationStrategy {
  SUPPRESSION = 'suppression',
  ROUNDING = 'rounding',
  BINNING = 'binning',
  MASKING = 'masking',
  CATEGORIZATION = 'categorization'
}

/**
 * Generalization rule interface
 */
export interface GeneralizationRule {
  attribute: string;
  strategy: GeneralizationStrategy;
  params: GeneralizationParams;
}

/**
 * Generalization parameters
 */
export interface GeneralizationParams {
  // Rounding parameters
  precision?: number;
  roundingBase?: number;

  // Binning parameters
  bins?: number[];
  binLabels?: string[];

  // Masking parameters
  maskChar?: string;
  keepFirstN?: number;
  keepLastN?: number;

  // Categorization parameters
  categories?: Map<string, string>;
  defaultCategory?: string;

  // Common parameters
  customFunction?: (value: any) => any;
}

/**
 * Data generalization implementation
 */
export class DataGeneralization {
  private rules: Map<string, GeneralizationRule> = new Map();

  /**
   * Add a generalization rule
   */
  addRule(rule: GeneralizationRule): void {
    this.validateRule(rule);
    this.rules.set(rule.attribute, rule);
  }

  /**
   * Remove a generalization rule
   */
  removeRule(attribute: string): void {
    this.rules.delete(attribute);
  }

  /**
   * Apply generalization to a dataset
   */
  applyGeneralization<T extends Record<string, any>>(data: T[]): T[] {
    return data.map(record => this.generalizeRecord(record));
  }

  /**
   * Generalize a single record
   */
  private generalizeRecord<T extends Record<string, any>>(record: T): T {
    const result = { ...record };
    
    for (const [attribute, rule] of this.rules.entries()) {
      if (attribute in record) {
        result[attribute] = this.applyStrategy(record[attribute], rule);
      }
    }

    return result;
  }

  /**
   * Apply generalization strategy to a value
   */
  private applyStrategy(value: any, rule: GeneralizationRule): any {
    if (rule.params.customFunction) {
      return rule.params.customFunction(value);
    }

    switch (rule.strategy) {
      case GeneralizationStrategy.SUPPRESSION:
        return '*';

      case GeneralizationStrategy.ROUNDING:
        return this.applyRounding(value, rule.params);

      case GeneralizationStrategy.BINNING:
        return this.applyBinning(value, rule.params);

      case GeneralizationStrategy.MASKING:
        return this.applyMasking(value, rule.params);

      case GeneralizationStrategy.CATEGORIZATION:
        return this.applyCategorization(value, rule.params);

      default:
        throw new Error(`Unknown generalization strategy: ${rule.strategy}`);
    }
  }

  /**
   * Apply rounding strategy
   */
  private applyRounding(value: number, params: GeneralizationParams): number {
    if (typeof value !== 'number') {
      throw new Error('Rounding can only be applied to numbers');
    }

    const { precision = 0, roundingBase = 1 } = params;
    const multiplier = Math.pow(10, precision);
    const rounded = Math.round(value / roundingBase) * roundingBase;
    return Math.round(rounded * multiplier) / multiplier;
  }

  /**
   * Apply binning strategy
   */
  private applyBinning(value: number, params: GeneralizationParams): string {
    if (!params.bins || !params.binLabels || params.bins.length + 1 !== params.binLabels.length) {
      throw new Error('Invalid binning parameters');
    }

    let binIndex = 0;
    while (binIndex < params.bins.length && value > params.bins[binIndex]) {
      binIndex++;
    }

    return params.binLabels[binIndex];
  }

  /**
   * Apply masking strategy
   */
  private applyMasking(value: string, params: GeneralizationParams): string {
    if (typeof value !== 'string') {
      throw new Error('Masking can only be applied to strings');
    }

    const {
      maskChar = '*',
      keepFirstN = 0,
      keepLastN = 0
    } = params;

    if (value.length <= keepFirstN + keepLastN) {
      return value;
    }

    const firstPart = value.slice(0, keepFirstN);
    const lastPart = value.slice(-keepLastN);
    const maskedLength = value.length - keepFirstN - keepLastN;
    const maskedPart = maskChar.repeat(maskedLength);

    return `${firstPart}${maskedPart}${lastPart}`;
  }

  /**
   * Apply categorization strategy
   */
  private applyCategorization(value: any, params: GeneralizationParams): string {
    if (!params.categories) {
      throw new Error('Categories map is required for categorization');
    }

    const stringValue = String(value);
    return params.categories.get(stringValue) || params.defaultCategory || stringValue;
  }

  /**
   * Validate generalization rule
   */
  private validateRule(rule: GeneralizationRule): void {
    if (!rule.attribute || !rule.strategy) {
      throw new Error('Invalid generalization rule: missing required fields');
    }

    switch (rule.strategy) {
      case GeneralizationStrategy.ROUNDING:
        if (rule.params.precision !== undefined && rule.params.precision < 0) {
          throw new Error('Precision must be non-negative');
        }
        if (rule.params.roundingBase !== undefined && rule.params.roundingBase <= 0) {
          throw new Error('Rounding base must be positive');
        }
        break;

      case GeneralizationStrategy.BINNING:
        if (!rule.params.bins || !rule.params.binLabels) {
          throw new Error('Binning requires bins and binLabels');
        }
        if (rule.params.bins.length + 1 !== rule.params.binLabels.length) {
          throw new Error('Number of bin labels must be equal to number of bins + 1');
        }
        break;

      case GeneralizationStrategy.MASKING:
        if (rule.params.keepFirstN !== undefined && rule.params.keepFirstN < 0) {
          throw new Error('keepFirstN must be non-negative');
        }
        if (rule.params.keepLastN !== undefined && rule.params.keepLastN < 0) {
          throw new Error('keepLastN must be non-negative');
        }
        break;

      case GeneralizationStrategy.CATEGORIZATION:
        if (!rule.params.categories) {
          throw new Error('Categorization requires a categories map');
        }
        break;
    }
  }
} 