/**
 * Base interface for optimizer configuration
 */
export interface OptimizerConfig {
  /** Learning rate */
  learningRate: number;
}

/**
 * Configuration for SGD optimizer
 */
export interface SGDConfig extends OptimizerConfig {
  /** Momentum coefficient */
  momentum?: number;
  /** Whether to use Nesterov momentum */
  nesterov?: boolean;
}

/**
 * Configuration for Adam optimizer
 */
export interface AdamConfig extends OptimizerConfig {
  /** Exponential decay rate for first moment estimates */
  beta1?: number;
  /** Exponential decay rate for second moment estimates */
  beta2?: number;
  /** Small constant for numerical stability */
  epsilon?: number;
}

/**
 * Configuration for RMSprop optimizer
 */
export interface RMSpropConfig extends OptimizerConfig {
  /** Decay rate for moving average of squared gradients */
  rho?: number;
  /** Small constant for numerical stability */
  epsilon?: number;
}

/**
 * Configuration for Adagrad optimizer
 */
export interface AdagradConfig extends OptimizerConfig {
  /** Initial accumulator value */
  initialAccumulatorValue?: number;
  /** Small constant for numerical stability */
  epsilon?: number;
}

/**
 * Abstract base class for optimizers
 */
export abstract class Optimizer {
  protected config: OptimizerConfig;

  /**
   * Creates a new optimizer instance
   * @param config Optimizer configuration
   */
  constructor(config: OptimizerConfig) {
    this.config = config;
  }

  /**
   * Updates parameters using computed gradients
   * @param parameters Current parameters
   * @param gradients Computed gradients
   * @returns Updated parameters
   */
  abstract update(parameters: number[], gradients: number[]): number[];

  /**
   * Gets optimizer configuration
   * @returns Current configuration
   */
  getConfig(): OptimizerConfig {
    return { ...this.config };
  }
}

/**
 * SGD optimizer implementation with momentum support
 */
export class SGD extends Optimizer {
  private readonly momentum: number;
  private readonly nesterov: boolean;
  private velocity: number[] = [];

  /**
   * Creates a new SGD optimizer instance
   * @param config SGD configuration
   */
  constructor(config: SGDConfig) {
    super(config);
    this.momentum = config.momentum || 0.0;
    this.nesterov = config.nesterov || false;
  }

  /**
   * Updates parameters using SGD with momentum
   * @param parameters Current parameters
   * @param gradients Computed gradients
   * @returns Updated parameters
   */
  update(parameters: number[], gradients: number[]): number[] {
    if (this.velocity.length === 0) {
      this.velocity = Array(parameters.length).fill(0);
    }

    const updated = parameters.map((param, i) => {
      // Update velocity
      this.velocity[i] = this.momentum * this.velocity[i] -
        this.config.learningRate * gradients[i];

      // Apply Nesterov momentum if enabled
      if (this.nesterov) {
        return param + this.momentum * this.velocity[i] -
          this.config.learningRate * gradients[i];
      }

      return param + this.velocity[i];
    });

    return updated;
  }
}

/**
 * Adam optimizer implementation
 */
export class Adam extends Optimizer {
  private readonly beta1: number;
  private readonly beta2: number;
  private readonly epsilon: number;
  private moment1: number[] = [];
  private moment2: number[] = [];
  private iteration: number = 0;

  /**
   * Creates a new Adam optimizer instance
   * @param config Adam configuration
   */
  constructor(config: AdamConfig) {
    super(config);
    this.beta1 = config.beta1 || 0.9;
    this.beta2 = config.beta2 || 0.999;
    this.epsilon = config.epsilon || 1e-8;
  }

  /**
   * Updates parameters using Adam optimization
   * @param parameters Current parameters
   * @param gradients Computed gradients
   * @returns Updated parameters
   */
  update(parameters: number[], gradients: number[]): number[] {
    if (this.moment1.length === 0) {
      this.moment1 = Array(parameters.length).fill(0);
      this.moment2 = Array(parameters.length).fill(0);
    }

    this.iteration++;

    const updated = parameters.map((param, i) => {
      // Update biased first moment estimate
      this.moment1[i] = this.beta1 * this.moment1[i] +
        (1 - this.beta1) * gradients[i];

      // Update biased second raw moment estimate
      this.moment2[i] = this.beta2 * this.moment2[i] +
        (1 - this.beta2) * gradients[i] * gradients[i];

      // Compute bias-corrected first moment estimate
      const m_hat = this.moment1[i] / (1 - Math.pow(this.beta1, this.iteration));

      // Compute bias-corrected second raw moment estimate
      const v_hat = this.moment2[i] / (1 - Math.pow(this.beta2, this.iteration));

      // Update parameters
      return param - this.config.learningRate * m_hat /
        (Math.sqrt(v_hat) + this.epsilon);
    });

    return updated;
  }
}

/**
 * RMSprop optimizer implementation
 */
export class RMSprop extends Optimizer {
  private readonly rho: number;
  private readonly epsilon: number;
  private cache: number[] = [];

  /**
   * Creates a new RMSprop optimizer instance
   * @param config RMSprop configuration
   */
  constructor(config: RMSpropConfig) {
    super(config);
    this.rho = config.rho || 0.9;
    this.epsilon = config.epsilon || 1e-8;
  }

  /**
   * Updates parameters using RMSprop optimization
   * @param parameters Current parameters
   * @param gradients Computed gradients
   * @returns Updated parameters
   */
  update(parameters: number[], gradients: number[]): number[] {
    if (this.cache.length === 0) {
      this.cache = Array(parameters.length).fill(0);
    }

    const updated = parameters.map((param, i) => {
      this.cache[i] = this.rho * this.cache[i] +
        (1 - this.rho) * gradients[i] * gradients[i];

      return param - this.config.learningRate * gradients[i] /
        (Math.sqrt(this.cache[i]) + this.epsilon);
    });

    return updated;
  }
}

/**
 * Adagrad optimizer implementation
 */
export class Adagrad extends Optimizer {
  private readonly initialAccumulatorValue: number;
  private readonly epsilon: number;
  private cache: number[] = [];

  /**
   * Creates a new Adagrad optimizer instance
   * @param config Adagrad configuration
   */
  constructor(config: AdagradConfig) {
    super(config);
    this.initialAccumulatorValue = config.initialAccumulatorValue || 0.1;
    this.epsilon = config.epsilon || 1e-8;
  }

  /**
   * Updates parameters using Adagrad optimization
   * @param parameters Current parameters
   * @param gradients Computed gradients
   * @returns Updated parameters
   */
  update(parameters: number[], gradients: number[]): number[] {
    if (this.cache.length === 0) {
      this.cache = Array(parameters.length).fill(this.initialAccumulatorValue);
    }

    const updated = parameters.map((param, i) => {
      this.cache[i] += gradients[i] * gradients[i];

      return param - this.config.learningRate * gradients[i] /
        (Math.sqrt(this.cache[i]) + this.epsilon);
    });

    return updated;
  }
} 