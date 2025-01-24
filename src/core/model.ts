/**
 * Configuration for model architecture
 */
export interface ModelArchitecture {
  /** Array of layer configurations */
  layers: Array<{
    /** Type of the layer */
    type: 'dense' | 'conv2d' | 'maxpool2d';
    /** Number of units/filters in the layer */
    units?: number;
    /** Activation function for the layer */
    activation?: string;
    /** Kernel size for convolutional layers */
    kernelSize?: [number, number];
    /** Stride for convolutional layers */
    stride?: [number, number];
    /** Padding for convolutional layers */
    padding?: 'valid' | 'same';
  }>;
}

/**
 * Configuration for model training and architecture
 */
export interface ModelConfig {
  /** Model architecture configuration */
  architecture: ModelArchitecture;
  /** Learning rate for training */
  learningRate: number;
  /** Batch size for training */
  batchSize: number;
  /** Number of training epochs */
  epochs: number;
  /** Optimizer type */
  optimizer: 'sgd' | 'adam';
}

/**
 * Training and evaluation metrics
 */
export interface ModelMetrics {
  /** Loss value */
  loss: number;
  /** Accuracy value */
  accuracy: number;
  /** Current epoch */
  epoch: number;
  /** Current step within epoch */
  step: number;
  /** Total steps in epoch */
  totalSteps: number;
  /** Validation loss (optional) */
  validationLoss?: number;
  /** Validation accuracy (optional) */
  validationAccuracy?: number;
}

/**
 * Abstract base class for machine learning models
 * Provides common functionality and interface for different model implementations
 */
export abstract class Model {
  /** Model configuration */
  protected config: ModelConfig;
  /** Model parameters */
  protected parameters: number[] = [];
  /** Current training metrics */
  protected metrics: ModelMetrics = {
    loss: 0,
    accuracy: 0,
    epoch: 0,
    step: 0,
    totalSteps: 0
  };

  /**
   * Creates a new model instance
   * @param config Model configuration
   */
  constructor(config: ModelConfig) {
    this.config = config;
  }

  /**
   * Initializes model parameters and state
   * Must be implemented by derived classes
   */
  abstract initialize(): Promise<void>;

  /**
   * Trains the model on provided dataset
   * Must be implemented by derived classes
   * @param data Training data
   * @param labels Training labels
   * @returns Training metrics
   */
  abstract train(data: number[][], labels: number[][]): Promise<ModelMetrics>;

  /**
   * Makes predictions using the trained model
   * Must be implemented by derived classes
   * @param data Input data
   * @returns Predicted outputs
   */
  abstract predict(data: number[][]): Promise<number[][]>;

  /**
   * Evaluates model performance on test dataset
   * Must be implemented by derived classes
   * @param data Test data
   * @param labels Test labels
   * @returns Evaluation metrics
   */
  abstract evaluate(data: number[][], labels: number[][]): Promise<ModelMetrics>;

  /**
   * Gets current model parameters
   * @returns Array of model parameters
   */
  getParameters(): number[] {
    return this.parameters;
  }

  /**
   * Updates model parameters
   * @param parameters New parameter values
   */
  updateParameters(parameters: number[]): void {
    if (parameters.length !== this.parameters.length) {
      throw new Error('Parameter length mismatch');
    }
    this.parameters = [...parameters];
  }

  /**
   * Gets current training metrics
   * @returns Current metrics
   */
  getMetrics(): ModelMetrics {
    return { ...this.metrics };
  }

  /**
   * Gets model configuration
   * @returns Current configuration
   */
  getConfig(): ModelConfig {
    return { ...this.config };
  }

  /**
   * Computes gradients for parameter updates
   * Must be implemented by derived classes
   * @param data Input data
   * @param labels Target labels
   * @returns Computed gradients
   */
  protected abstract computeGradients(data: number[][], labels: number[][]): Promise<number[]>;

  /**
   * Applies computed gradients to update parameters
   * Must be implemented by derived classes
   * @param gradients Computed gradients
   */
  protected abstract applyGradients(gradients: number[]): Promise<void>;
} 