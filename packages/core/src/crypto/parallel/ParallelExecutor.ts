import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { cpus } from 'os';
import { join } from 'path';

/**
 * Task type for parallel execution
 */
export interface ParallelTask<T, R> {
  data: T;
  operation: string;
  params?: any;
}

/**
 * Result type for parallel execution
 */
export interface ParallelResult<R> {
  result: R;
  error?: string;
  duration: number;
}

/**
 * Configuration for parallel execution
 */
export interface ParallelConfig {
  maxWorkers?: number;
  minBatchSize?: number;
  enableThreadPool?: boolean;
}

/**
 * Parallel execution manager for homomorphic operations
 */
export class ParallelExecutor {
  private workers: Worker[];
  private config: ParallelConfig;
  private workerPool: Worker[];
  private taskQueue: Array<{
    task: ParallelTask<any, any>;
    resolve: (result: ParallelResult<any>) => void;
    reject: (error: Error) => void;
  }>;

  constructor(config: ParallelConfig = {}) {
    this.config = {
      maxWorkers: config.maxWorkers || cpus().length,
      minBatchSize: config.minBatchSize || 1000,
      enableThreadPool: config.enableThreadPool ?? true
    };
    
    this.workers = [];
    this.workerPool = [];
    this.taskQueue = [];

    if (this.config.enableThreadPool) {
      this.initializeWorkerPool();
    }
  }

  /**
   * Execute tasks in parallel
   */
  async executeParallel<T, R>(
    tasks: ParallelTask<T, R>[],
    workerScript: string
  ): Promise<ParallelResult<R>[]> {
    // If data size is small, process sequentially
    if (tasks.length < this.config.minBatchSize!) {
      return this.executeSequential(tasks, workerScript);
    }

    // Split tasks into batches
    const batchSize = Math.ceil(tasks.length / this.config.maxWorkers!);
    const batches = this.splitIntoBatches(tasks, batchSize);

    // Execute batches in parallel
    const promises = batches.map(batch => 
      this.executeBatch(batch, workerScript)
    );

    // Wait for all batches to complete
    const results = await Promise.all(promises);
    return results.flat();
  }

  /**
   * Execute a single task using worker pool
   */
  async executeTask<T, R>(
    task: ParallelTask<T, R>
  ): Promise<ParallelResult<R>> {
    return new Promise((resolve, reject) => {
      if (this.workerPool.length > 0) {
        // Get worker from pool
        const worker = this.workerPool.pop()!;
        worker.postMessage({ task });

        worker.once('message', (result: ParallelResult<R>) => {
          this.workerPool.push(worker);
          resolve(result);
        });

        worker.once('error', (error) => {
          this.workerPool.push(worker);
          reject(error);
        });
      } else {
        // Queue task if no workers available
        this.taskQueue.push({ task, resolve, reject });
      }
    });
  }

  /**
   * Clean up workers
   */
  async terminate(): Promise<void> {
    await Promise.all([
      ...this.workers.map(w => w.terminate()),
      ...this.workerPool.map(w => w.terminate())
    ]);
    this.workers = [];
    this.workerPool = [];
    this.taskQueue = [];
  }

  private async executeSequential<T, R>(
    tasks: ParallelTask<T, R>[],
    workerScript: string
  ): Promise<ParallelResult<R>[]> {
    const worker = new Worker(workerScript, {
      workerData: { tasks }
    });

    return new Promise((resolve, reject) => {
      worker.on('message', (results: ParallelResult<R>[]) => {
        worker.terminate();
        resolve(results);
      });

      worker.on('error', (error) => {
        worker.terminate();
        reject(error);
      });
    });
  }

  private async executeBatch<T, R>(
    batch: ParallelTask<T, R>[],
    workerScript: string
  ): Promise<ParallelResult<R>[]> {
    const worker = new Worker(workerScript, {
      workerData: { tasks: batch }
    });
    this.workers.push(worker);

    return new Promise((resolve, reject) => {
      worker.on('message', (results: ParallelResult<R>[]) => {
        const index = this.workers.indexOf(worker);
        if (index > -1) {
          this.workers.splice(index, 1);
        }
        worker.terminate();
        resolve(results);
      });

      worker.on('error', (error) => {
        const index = this.workers.indexOf(worker);
        if (index > -1) {
          this.workers.splice(index, 1);
        }
        worker.terminate();
        reject(error);
      });
    });
  }

  private splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private initializeWorkerPool() {
    for (let i = 0; i < this.config.maxWorkers!; i++) {
      const worker = new Worker(join(__dirname, 'worker.js'));
      
      worker.on('message', (result) => {
        if (this.taskQueue.length > 0) {
          const { task, resolve, reject } = this.taskQueue.shift()!;
          worker.postMessage({ task });
          
          worker.once('message', resolve);
          worker.once('error', reject);
        }
      });

      this.workerPool.push(worker);
    }
  }
} 