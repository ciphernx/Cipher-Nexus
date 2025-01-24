/**
 * Interface for data preprocessing configuration
 */
export interface PreprocessingConfig {
  /** Whether to standardize features */
  standardize?: boolean;
  /** Whether to normalize features */
  normalize?: boolean;
  /** Whether to one-hot encode categorical features */
  oneHotEncode?: boolean;
  /** Whether to handle missing values */
  handleMissing?: boolean;
  /** Strategy for handling missing values ('mean' | 'median' | 'constant') */
  missingStrategy?: 'mean' | 'median' | 'constant';
  /** Constant value to fill missing values with */
  fillValue?: number;
}

/**
 * Class for data preprocessing operations
 */
export class DataPreprocessor {
  private config: PreprocessingConfig;
  private mean: number[] = [];
  private std: number[] = [];
  private min: number[] = [];
  private max: number[] = [];
  private categories: Map<number, Set<number>> = new Map();
  private initialized: boolean = false;

  /**
   * Creates a new data preprocessor instance
   * @param config Preprocessing configuration
   */
  constructor(config: PreprocessingConfig = {}) {
    this.config = config;
  }

  /**
   * Fits preprocessor to training data
   * @param data Training data
   */
  fit(data: number[][]): void {
    const n = data.length;
    const d = data[0].length;

    // Calculate statistics for each feature
    for (let j = 0; j < d; j++) {
      const values = data.map(row => row[j]).filter(v => !isNaN(v));

      if (this.config.standardize) {
        // Calculate mean and standard deviation
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(
          values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
        );
        this.mean[j] = mean;
        this.std[j] = std;
      }

      if (this.config.normalize) {
        // Calculate min and max
        const min = Math.min(...values);
        const max = Math.max(...values);
        this.min[j] = min;
        this.max[j] = max;
      }

      if (this.config.oneHotEncode) {
        // Collect unique categories
        const uniqueValues = new Set(values);
        this.categories.set(j, uniqueValues);
      }
    }

    this.initialized = true;
  }

  /**
   * Transforms data using fitted parameters
   * @param data Input data
   * @returns Transformed data
   */
  transform(data: number[][]): number[][] {
    if (!this.initialized) {
      throw new Error('Preprocessor not initialized. Call fit() first.');
    }

    let transformed = [...data.map(row => [...row])];

    // Handle missing values
    if (this.config.handleMissing) {
      transformed = this.handleMissingValues(transformed);
    }

    // Apply standardization
    if (this.config.standardize) {
      transformed = this.standardize(transformed);
    }

    // Apply normalization
    if (this.config.normalize) {
      transformed = this.normalize(transformed);
    }

    // Apply one-hot encoding
    if (this.config.oneHotEncode) {
      transformed = this.oneHotEncode(transformed);
    }

    return transformed;
  }

  /**
   * Fits preprocessor to data and transforms it
   * @param data Input data
   * @returns Transformed data
   */
  fitTransform(data: number[][]): number[][] {
    this.fit(data);
    return this.transform(data);
  }

  /**
   * Handles missing values in the data
   * @param data Input data
   * @returns Data with handled missing values
   */
  private handleMissingValues(data: number[][]): number[][] {
    const d = data[0].length;
    const result = [...data.map(row => [...row])];

    for (let j = 0; j < d; j++) {
      const values = data.map(row => row[j]).filter(v => !isNaN(v));
      let fillValue: number;

      switch (this.config.missingStrategy) {
        case 'mean':
          fillValue = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'median':
          const sorted = [...values].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          fillValue = sorted.length % 2 === 0 ?
            (sorted[mid - 1] + sorted[mid]) / 2 :
            sorted[mid];
          break;
        case 'constant':
          fillValue = this.config.fillValue || 0;
          break;
        default:
          fillValue = 0;
      }

      for (let i = 0; i < data.length; i++) {
        if (isNaN(data[i][j])) {
          result[i][j] = fillValue;
        }
      }
    }

    return result;
  }

  /**
   * Standardizes the data (zero mean, unit variance)
   * @param data Input data
   * @returns Standardized data
   */
  private standardize(data: number[][]): number[][] {
    return data.map(row =>
      row.map((value, j) =>
        (value - this.mean[j]) / (this.std[j] || 1)
      )
    );
  }

  /**
   * Normalizes the data to [0, 1] range
   * @param data Input data
   * @returns Normalized data
   */
  private normalize(data: number[][]): number[][] {
    return data.map(row =>
      row.map((value, j) => {
        const range = this.max[j] - this.min[j];
        return range === 0 ? 0 : (value - this.min[j]) / range;
      })
    );
  }

  /**
   * Applies one-hot encoding to categorical features
   * @param data Input data
   * @returns One-hot encoded data
   */
  private oneHotEncode(data: number[][]): number[][] {
    const result: number[][] = [];

    for (const row of data) {
      const encoded: number[] = [];
      
      for (let j = 0; j < row.length; j++) {
        const categories = this.categories.get(j);
        if (categories) {
          // One-hot encode this feature
          for (const category of categories) {
            encoded.push(row[j] === category ? 1 : 0);
          }
        } else {
          // Keep numeric feature as is
          encoded.push(row[j]);
        }
      }

      result.push(encoded);
    }

    return result;
  }

  /**
   * Gets preprocessor configuration
   * @returns Current configuration
   */
  getConfig(): PreprocessingConfig {
    return { ...this.config };
  }
} 