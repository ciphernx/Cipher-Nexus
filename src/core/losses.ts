/**
 * Abstract base class for loss functions
 */
export abstract class Loss {
  /**
   * Computes the loss between predictions and targets
   * @param predictions Model predictions
   * @param targets Target values
   * @returns Computed loss value
   */
  abstract compute(predictions: number[][], targets: number[][]): number;

  /**
   * Computes the gradient of the loss with respect to predictions
   * @param predictions Model predictions
   * @param targets Target values
   * @returns Loss gradients
   */
  abstract gradient(predictions: number[][], targets: number[][]): number[][];
}

/**
 * Mean Squared Error loss implementation
 */
export class MSE extends Loss {
  /**
   * Computes MSE loss between predictions and targets
   * @param predictions Model predictions
   * @param targets Target values
   * @returns MSE loss value
   */
  compute(predictions: number[][], targets: number[][]): number {
    let loss = 0;
    const n = predictions.length;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < predictions[i].length; j++) {
        loss += Math.pow(predictions[i][j] - targets[i][j], 2);
      }
    }

    return loss / (2 * n);
  }

  /**
   * Computes gradient of MSE loss
   * @param predictions Model predictions
   * @param targets Target values
   * @returns MSE loss gradients
   */
  gradient(predictions: number[][], targets: number[][]): number[][] {
    const n = predictions.length;
    return predictions.map((pred, i) =>
      pred.map((p, j) => (p - targets[i][j]) / n)
    );
  }
}

/**
 * Binary Cross Entropy loss implementation
 */
export class BCE extends Loss {
  private readonly epsilon: number = 1e-7;

  /**
   * Computes BCE loss between predictions and targets
   * @param predictions Model predictions (must be between 0 and 1)
   * @param targets Target values (must be 0 or 1)
   * @returns BCE loss value
   */
  compute(predictions: number[][], targets: number[][]): number {
    let loss = 0;
    const n = predictions.length;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < predictions[i].length; j++) {
        const p = Math.max(Math.min(predictions[i][j], 1 - this.epsilon), this.epsilon);
        loss += -(targets[i][j] * Math.log(p) + (1 - targets[i][j]) * Math.log(1 - p));
      }
    }

    return loss / n;
  }

  /**
   * Computes gradient of BCE loss
   * @param predictions Model predictions (must be between 0 and 1)
   * @param targets Target values (must be 0 or 1)
   * @returns BCE loss gradients
   */
  gradient(predictions: number[][], targets: number[][]): number[][] {
    const n = predictions.length;
    return predictions.map((pred, i) =>
      pred.map((p, j) => {
        const clipped = Math.max(Math.min(p, 1 - this.epsilon), this.epsilon);
        return (clipped - targets[i][j]) / (clipped * (1 - clipped) * n);
      })
    );
  }
}

/**
 * Categorical Cross Entropy loss implementation
 */
export class CCE extends Loss {
  private readonly epsilon: number = 1e-7;

  /**
   * Computes CCE loss between predictions and targets
   * @param predictions Model predictions (must be probabilities that sum to 1)
   * @param targets Target values (one-hot encoded)
   * @returns CCE loss value
   */
  compute(predictions: number[][], targets: number[][]): number {
    let loss = 0;
    const n = predictions.length;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < predictions[i].length; j++) {
        const p = Math.max(predictions[i][j], this.epsilon);
        loss += -targets[i][j] * Math.log(p);
      }
    }

    return loss / n;
  }

  /**
   * Computes gradient of CCE loss
   * @param predictions Model predictions (must be probabilities that sum to 1)
   * @param targets Target values (one-hot encoded)
   * @returns CCE loss gradients
   */
  gradient(predictions: number[][], targets: number[][]): number[][] {
    const n = predictions.length;
    return predictions.map((pred, i) =>
      pred.map((p, j) => (p - targets[i][j]) / n)
    );
  }
}

/**
 * Huber loss implementation
 */
export class Huber extends Loss {
  private readonly delta: number;

  /**
   * Creates a new Huber loss instance
   * @param delta Threshold for switching between L1 and L2 loss
   */
  constructor(delta: number = 1.0) {
    super();
    this.delta = delta;
  }

  /**
   * Computes Huber loss between predictions and targets
   * @param predictions Model predictions
   * @param targets Target values
   * @returns Huber loss value
   */
  compute(predictions: number[][], targets: number[][]): number {
    let loss = 0;
    const n = predictions.length;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < predictions[i].length; j++) {
        const error = Math.abs(predictions[i][j] - targets[i][j]);
        loss += error <= this.delta ?
          0.5 * error * error :
          this.delta * error - 0.5 * this.delta * this.delta;
      }
    }

    return loss / n;
  }

  /**
   * Computes gradient of Huber loss
   * @param predictions Model predictions
   * @param targets Target values
   * @returns Huber loss gradients
   */
  gradient(predictions: number[][], targets: number[][]): number[][] {
    const n = predictions.length;
    return predictions.map((pred, i) =>
      pred.map((p, j) => {
        const error = p - targets[i][j];
        return (Math.abs(error) <= this.delta ?
          error :
          this.delta * Math.sign(error)) / n;
      })
    );
  }
} 