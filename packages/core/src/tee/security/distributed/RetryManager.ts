import { EventEmitter } from 'events';

interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  timeout: number;
}

interface RetryState {
  attempts: number;
  lastError: Error | null;
  nextDelay: number;
}

export class RetryManager extends EventEmitter {
  private readonly defaultOptions: RetryOptions = {
    maxAttempts: 3,
    initialDelay: 1000,  // 1 second
    maxDelay: 30000,     // 30 seconds
    backoffFactor: 2,
    timeout: 10000       // 10 seconds
  };

  constructor(private options: Partial<RetryOptions> = {}) {
    super();
    this.options = { ...this.defaultOptions, ...options };
  }

  async retry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    const state: RetryState = {
      attempts: 0,
      lastError: null,
      nextDelay: this.options.initialDelay
    };

    while (state.attempts < this.options.maxAttempts) {
      try {
        // Execute operation with timeout
        const result = await this.withTimeout(
          operation(),
          this.options.timeout
        );
        
        if (state.attempts > 0) {
          this.emit('retry_succeeded', {
            context,
            attempts: state.attempts
          });
        }
        
        return result;
      } catch (error) {
        state.attempts++;
        state.lastError = error as Error;

        if (state.attempts < this.options.maxAttempts) {
          this.emit('retry_failed', {
            context,
            error,
            attempt: state.attempts,
            nextDelay: state.nextDelay
          });

          // Wait before retrying
          await this.delay(state.nextDelay);

          // Calculate next delay with exponential backoff
          state.nextDelay = Math.min(
            state.nextDelay * this.options.backoffFactor,
            this.options.maxDelay
          );
        }
      }
    }

    this.emit('retry_exhausted', {
      context,
      error: state.lastError,
      attempts: state.attempts
    });

    throw new Error(
      `Operation ${context} failed after ${state.attempts} attempts: ${state.lastError}`
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      )
    ]);
  }
} 