import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import { ResourceManager } from '../resource/ResourceManager';
import { MetricsManager } from '../monitoring/MetricsManager';
import { MLAnomalyDetector } from '../monitoring/MLAnomalyDetector';

export interface WorkloadConfig {
  id: string;
  type: string;
  priority: number;
  resourceRequirements: {
    cpu: number;
    memory: number;
    timeLimit: number;
  };
  dependencies?: string[];
  metadata?: Record<string, any>;
}

export interface SchedulerConfig {
  maxConcurrentWorkloads: number;
  queueSize: number;
  schedulingInterval: number;
  preemptionEnabled: boolean;
  fairnessWeight: number;
  resourceBuffer: number;
}

export interface WorkloadState {
  status: 'queued' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  priority: number;
  resourceUsage?: {
    cpu: number;
    memory: number;
    duration: number;
  };
  error?: Error;
}

export class WorkloadScheduler extends EventEmitter {
  private readonly config: SchedulerConfig;
  private readonly resourceManager: ResourceManager;
  private readonly metricsManager: MetricsManager;
  private readonly anomalyDetector: MLAnomalyDetector;
  private workloadQueue: WorkloadConfig[] = [];
  private runningWorkloads: Map<string, WorkloadState> = new Map();
  private workloadHistory: Map<string, WorkloadState> = new Map();
  private schedulingInterval: NodeJS.Timeout | null = null;

  constructor(
    config: SchedulerConfig,
    resourceManager: ResourceManager,
    metricsManager: MetricsManager,
    anomalyDetector: MLAnomalyDetector
  ) {
    super();
    this.config = config;
    this.resourceManager = resourceManager;
    this.metricsManager = metricsManager;
    this.anomalyDetector = anomalyDetector;

    // Start scheduling loop
    this.startScheduling();
  }

  async submitWorkload(workload: WorkloadConfig): Promise<void> {
    try {
      // Validate workload configuration
      this.validateWorkload(workload);

      // Check queue capacity
      if (this.workloadQueue.length >= this.config.queueSize) {
        throw new Error('Workload queue is full');
      }

      // Add to queue
      this.workloadQueue.push(workload);
      this.workloadHistory.set(workload.id, {
        status: 'queued'
      });

      this.emit('workload-queued', { workloadId: workload.id });
      logger.info('Workload queued', { workloadId: workload.id });

      // Trigger immediate scheduling if possible
      this.scheduleWorkloads();

    } catch (error) {
      logger.error('Failed to submit workload', { workload }, error as Error);
      this.emit('workload-error', { workloadId: workload.id, error });
      throw error;
    }
  }

  async cancelWorkload(workloadId: string): Promise<void> {
    try {
      // Check if workload is queued
      const queueIndex = this.workloadQueue.findIndex(w => w.id === workloadId);
      if (queueIndex !== -1) {
        this.workloadQueue.splice(queueIndex, 1);
        this.workloadHistory.set(workloadId, {
          status: 'failed',
          error: new Error('Workload cancelled')
        });
        this.emit('workload-cancelled', { workloadId });
        return;
      }

      // Check if workload is running
      if (this.runningWorkloads.has(workloadId)) {
        // Stop workload and release resources
        await this.stopWorkload(workloadId);
        this.emit('workload-cancelled', { workloadId });
      }

    } catch (error) {
      logger.error('Failed to cancel workload', { workloadId }, error as Error);
      this.emit('workload-error', { workloadId, error });
      throw error;
    }
  }

  getWorkloadState(workloadId: string): WorkloadState | undefined {
    return (
      this.runningWorkloads.get(workloadId) ||
      this.workloadHistory.get(workloadId)
    );
  }

  getQueuedWorkloads(): WorkloadConfig[] {
    return [...this.workloadQueue];
  }

  getRunningWorkloads(): Map<string, WorkloadState> {
    return new Map(this.runningWorkloads);
  }

  private startScheduling(): void {
    if (this.schedulingInterval) {
      return;
    }

    this.schedulingInterval = setInterval(
      () => this.scheduleWorkloads(),
      this.config.schedulingInterval
    );
  }

  private async scheduleWorkloads(): Promise<void> {
    try {
      // Sort queue by priority
      this.workloadQueue.sort((a, b) => b.priority - a.priority);

      // Check resource availability and dependencies
      for (const workload of this.workloadQueue) {
        if (this.runningWorkloads.size >= this.config.maxConcurrentWorkloads) {
          break;
        }

        if (await this.canScheduleWorkload(workload)) {
          // Remove from queue
          this.workloadQueue = this.workloadQueue.filter(w => w.id !== workload.id);

          // Start workload
          await this.startWorkload(workload);
        }
      }

      // Check for preemption if enabled
      if (this.config.preemptionEnabled) {
        await this.checkPreemption();
      }

    } catch (error) {
      logger.error('Error during workload scheduling', {}, error as Error);
      this.emit('scheduling-error', { error });
    }
  }

  private async canScheduleWorkload(workload: WorkloadConfig): Promise<boolean> {
    // Check dependencies
    if (workload.dependencies?.length) {
      const unfinishedDeps = workload.dependencies.filter(depId => {
        const depState = this.workloadHistory.get(depId);
        return !depState || depState.status !== 'completed';
      });

      if (unfinishedDeps.length > 0) {
        return false;
      }
    }

    // Check resource availability
    const availableResources = await this.resourceManager.getTenantUsage('default');
    const requiredResources = this.calculateResourceRequirements(workload);

    return (
      availableResources.cpu >= requiredResources.cpu &&
      availableResources.memory >= requiredResources.memory
    );
  }

  private async startWorkload(workload: WorkloadConfig): Promise<void> {
    try {
      // Allocate resources
      const resources = this.calculateResourceRequirements(workload);
      await this.resourceManager.allocateResources({
        tenantId: 'default',
        cpu: resources.cpu,
        memory: resources.memory
      });

      // Update state
      const state: WorkloadState = {
        status: 'running',
        startTime: Date.now(),
        priority: workload.priority,
        resourceUsage: {
          cpu: 0,
          memory: 0,
          duration: 0
        }
      };

      this.runningWorkloads.set(workload.id, state);
      this.workloadHistory.set(workload.id, state);

      // Start monitoring
      this.monitorWorkload(workload);

      this.emit('workload-started', {
        workloadId: workload.id,
        resources
      });

      logger.info('Workload started', {
        workloadId: workload.id,
        resources
      });

    } catch (error) {
      logger.error('Failed to start workload', { workload }, error as Error);
      this.emit('workload-error', { workloadId: workload.id, error });
      throw error;
    }
  }

  private async stopWorkload(
    workloadId: string,
    error?: Error
  ): Promise<void> {
    const state = this.runningWorkloads.get(workloadId);
    if (!state) {
      return;
    }

    try {
      // Release resources
      await this.resourceManager.releaseResources({
        tenantId: 'default',
        cpu: state.resourceUsage?.cpu || 0,
        memory: state.resourceUsage?.memory || 0
      });

      // Update state
      state.status = error ? 'failed' : 'completed';
      state.endTime = Date.now();
      state.error = error;

      // Move to history
      this.runningWorkloads.delete(workloadId);
      this.workloadHistory.set(workloadId, state);

      this.emit('workload-stopped', {
        workloadId,
        status: state.status,
        error
      });

      logger.info('Workload stopped', {
        workloadId,
        status: state.status,
        duration: state.endTime - (state.startTime || 0)
      });

    } catch (error) {
      logger.error('Failed to stop workload', { workloadId }, error as Error);
      this.emit('workload-error', { workloadId, error });
      throw error;
    }
  }

  private async checkPreemption(): Promise<void> {
    const runningWorkloads = Array.from(this.runningWorkloads.entries());
    const queuedHighPriorityWorkloads = this.workloadQueue.filter(w =>
      w.priority > Math.max(...runningWorkloads.map(([_, w]) => w.priority))
    );

    for (const highPriorityWorkload of queuedHighPriorityWorkloads) {
      // Find lowest priority running workload
      const [lowPriorityId] = runningWorkloads
        .sort(([_, a], [__, b]) => a.priority - b.priority)[0];

      // Preempt low priority workload
      await this.stopWorkload(
        lowPriorityId,
        new Error('Preempted by higher priority workload')
      );

      // Schedule high priority workload
      await this.startWorkload(highPriorityWorkload);
    }
  }

  private monitorWorkload(workload: WorkloadConfig): void {
    const state = this.runningWorkloads.get(workload.id);
    if (!state || !state.resourceUsage) {
      return;
    }

    const monitoringInterval = setInterval(async () => {
      try {
        // Get current resource usage
        const usage = await this.resourceManager.getTenantUsage('default');
        
        // Update state
        state.resourceUsage.cpu = usage.cpu;
        state.resourceUsage.memory = usage.memory;
        state.resourceUsage.duration = Date.now() - (state.startTime || 0);

        // Check for anomalies
        const anomaly = await this.anomalyDetector.detectAnomalies([{
          timestamp: Date.now(),
          metrics: {
            cpu: usage.cpu,
            memory: usage.memory,
            duration: state.resourceUsage.duration
          }
        }]);

        if (anomaly.length > 0 && anomaly[0].isAnomaly) {
          logger.warn('Workload anomaly detected', {
            workloadId: workload.id,
            anomaly: anomaly[0]
          });
          this.emit('workload-anomaly', {
            workloadId: workload.id,
            anomaly: anomaly[0]
          });
        }

        // Check time limit
        if (state.resourceUsage.duration > workload.resourceRequirements.timeLimit) {
          await this.stopWorkload(
            workload.id,
            new Error('Workload exceeded time limit')
          );
          clearInterval(monitoringInterval);
        }

      } catch (error) {
        logger.error('Error monitoring workload', { workload }, error as Error);
      }
    }, 1000);

    // Cleanup monitoring when workload stops
    this.once('workload-stopped', ({ workloadId }) => {
      if (workloadId === workload.id) {
        clearInterval(monitoringInterval);
      }
    });
  }

  private calculateResourceRequirements(
    workload: WorkloadConfig
  ): { cpu: number; memory: number } {
    const buffer = 1 + this.config.resourceBuffer;
    return {
      cpu: workload.resourceRequirements.cpu * buffer,
      memory: workload.resourceRequirements.memory * buffer
    };
  }

  private validateWorkload(workload: WorkloadConfig): void {
    if (!workload.id) {
      throw new Error('Workload ID is required');
    }

    if (!workload.type) {
      throw new Error('Workload type is required');
    }

    if (workload.priority < 0) {
      throw new Error('Priority must be non-negative');
    }

    if (!workload.resourceRequirements) {
      throw new Error('Resource requirements are required');
    }

    if (workload.resourceRequirements.cpu <= 0) {
      throw new Error('CPU requirement must be positive');
    }

    if (workload.resourceRequirements.memory <= 0) {
      throw new Error('Memory requirement must be positive');
    }

    if (workload.resourceRequirements.timeLimit <= 0) {
      throw new Error('Time limit must be positive');
    }
  }

  shutdown(): void {
    if (this.schedulingInterval) {
      clearInterval(this.schedulingInterval);
      this.schedulingInterval = null;
    }

    // Stop all running workloads
    for (const [workloadId] of this.runningWorkloads) {
      this.stopWorkload(
        workloadId,
        new Error('Scheduler shutdown')
      ).catch(error => {
        logger.error('Error stopping workload during shutdown', { workloadId }, error);
      });
    }
  }
} 