import { EventEmitter } from 'events';
import { TEERequest, TEEContext, TEEResult } from '../types';
import { TEEConfiguration } from '../config/tee.config';

interface QueuedTask<T, R> {
  id: string;
  request: TEERequest<T>;
  context?: TEEContext;
  priority: number;
  timestamp: number;
  execute: () => Promise<TEEResult<R>>;
  resolve: (result: TEEResult<R>) => void;
  reject: (error: Error) => void;
}

export class TaskQueue extends EventEmitter {
  private queue: Array<QueuedTask<any, any>>;
  private activeTaskCount: number;
  private config: TEEConfiguration;
  private isProcessing: boolean;

  constructor(config: TEEConfiguration) {
    super();
    this.queue = [];
    this.activeTaskCount = 0;
    this.config = config;
    this.isProcessing = false;
  }

  async enqueue<T, R>(
    request: TEERequest<T>,
    context: TEEContext | undefined,
    execute: () => Promise<TEEResult<R>>,
    priority: number = 0
  ): Promise<TEEResult<R>> {
    return new Promise((resolve, reject) => {
      const task: QueuedTask<T, R> = {
        id: this.generateTaskId(),
        request,
        context,
        priority,
        timestamp: Date.now(),
        execute,
        resolve,
        reject
      };

      this.addToQueue(task);
      this.emit('task-queued', {
        taskId: task.id,
        queueLength: this.queue.length
      });

      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private addToQueue<T, R>(task: QueuedTask<T, R>): void {
    // Check queue size limit
    if (this.queue.length >= this.config.resources.maxQueuedRequests) {
      throw new Error('Queue size limit exceeded');
    }

    // Insert task in priority order
    const index = this.queue.findIndex(t => t.priority < task.priority);
    if (index === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(index, 0, task);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      if (this.activeTaskCount >= this.config.resources.maxActiveContexts) {
        // Wait for active tasks to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      const task = this.queue.shift();
      if (!task) continue;

      this.activeTaskCount++;
      this.emit('task-started', {
        taskId: task.id,
        activeTaskCount: this.activeTaskCount
      });

      try {
        // Execute task with timeout
        const result = await Promise.race([
          task.execute(),
          this.createTimeout(task)
        ]);

        task.resolve(result);
      } catch (error) {
        task.reject(error instanceof Error ? error : new Error(String(error)));
        this.emit('task-error', {
          taskId: task.id,
          error: error instanceof Error ? error : new Error(String(error))
        });
      } finally {
        this.activeTaskCount--;
        this.emit('task-completed', {
          taskId: task.id,
          activeTaskCount: this.activeTaskCount,
          queueLength: this.queue.length
        });
      }
    }

    this.isProcessing = false;
  }

  private createTimeout<T, R>(task: QueuedTask<T, R>): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${this.config.resources.contextTimeout} seconds`));
      }, this.config.resources.contextTimeout * 1000);
    });
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getActiveTaskCount(): number {
    return this.activeTaskCount;
  }

  clear(): void {
    const queuedTasks = this.queue.length;
    this.queue.forEach(task => {
      task.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    this.emit('queue-cleared', { queuedTasks });
  }
} 