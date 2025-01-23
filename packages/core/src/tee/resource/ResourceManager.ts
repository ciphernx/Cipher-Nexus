import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import { ExecutionContext } from '../sdk/TEEExecutor';

// Enhanced resource quota with more granular controls
export interface ResourceQuota {
  maxCpu: number;      // Maximum CPU cores
  maxMemory: number;   // Maximum memory in MB
  maxStorage: number;  // Maximum storage in MB
  maxNetwork: number;  // Maximum network bandwidth in Mbps
  maxActiveWorkloads: number;
  // Added granular controls
  cpuBurst: number;    // Allowed CPU burst
  memoryBurst: number; // Allowed memory burst
  iopsLimit: number;   // IO operations per second
  networkQoS: {
    guaranteed: number;
    maximum: number;
    priority: number;
  };
  priorityLevels: {
    high: number;
    medium: number;
    low: number;
  };
}

// Enhanced allocation tracking
export interface ResourceAllocation {
  tenantId: string;
  cpu: {
    used: number;
    reserved: number;
    burst: number;
  };
  memory: {
    used: number;
    reserved: number;
    burst: number;
  };
  storage: {
    used: number;
    iops: number;
  };
  network: {
    bandwidth: number;
    priority: number;
  };
  workloadCount: number;
  priority: number;
}

// Dynamic resource request
export interface ResourceRequest {
  tenantId: string;
  cpu: {
    minimum: number;
    target: number;
    burst?: number;
  };
  memory: {
    minimum: number;
    target: number;
    burst?: number;
  };
  storage: {
    size: number;
    iops?: number;
  };
  network: {
    bandwidth: number;
    priority?: number;
  };
  priority: number;
  elasticity: {
    enabled: boolean;
    scaleUpThreshold: number;
    scaleDownThreshold: number;
  };
}

export interface TenantResourceInfo {
  quota: ResourceQuota;
  allocated: ResourceAllocation;
  available: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
    workloadSlots: number;
  };
}

export interface ResourceUsage {
  activeTasks: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  diskUsageMB: number;
  networkUsageMBps: number;
}

export interface TaskScheduleConfig {
  priority: number;
  estimatedDuration: number;
  requiredResources: {
    minMemoryMB: number;
    minCpuPercent: number;
    minDiskSpaceMB: number;
    minNetworkBandwidthMBps: number;
  };
}

export interface QueuedTask {
  context: ExecutionContext;
  config: TaskScheduleConfig;
  queueTime: number;
  startTime?: number;
  endTime?: number;
  status: 'queued' | 'running' | 'completed' | 'failed';
  error?: Error;
}

export class ResourceManager extends EventEmitter {
  private readonly tenantQuotas: Map<string, ResourceQuota>;
  private readonly tenantAllocations: Map<string, ResourceAllocation>;
  private readonly allocationInterval: number;
  private readonly resourceBuffer: number;
  private allocationTimer: NodeJS.Timer | null;
  private currentUsage: ResourceUsage;
  private taskQueue: QueuedTask[];
  private runningTasks: Map<string, QueuedTask>;
  private readonly checkInterval: number;
  private checkTimer: NodeJS.Timer | null;
  private readonly elasticityEnabled: boolean;
  private readonly monitoringInterval: number;
  private monitoringTimer: NodeJS.Timer | null;

  constructor(
    allocationInterval = 5000,  // 5 seconds
    resourceBuffer = 0.1,       // 10% buffer
    elasticityEnabled = true,
    monitoringInterval = 5000,  // 5 seconds
  ) {
    super();
    this.tenantQuotas = new Map();
    this.tenantAllocations = new Map();
    this.allocationInterval = allocationInterval;
    this.resourceBuffer = resourceBuffer;
    this.allocationTimer = null;
    this.currentUsage = {
      activeTasks: 0,
      memoryUsageMB: 0,
      cpuUsagePercent: 0,
      diskUsageMB: 0,
      networkUsageMBps: 0
    };
    this.taskQueue = [];
    this.runningTasks = new Map();
    this.checkInterval = 1000;
    this.checkTimer = null;
    this.elasticityEnabled = elasticityEnabled;
    this.monitoringInterval = monitoringInterval;
    this.startAllocationCheck();
    this.startResourceCheck();
    this.startMonitoring();
  }

  private startAllocationCheck(): void {
    this.allocationTimer = setInterval(() => {
      this.checkAndRebalanceAllocations();
    }, this.allocationInterval);
  }

  private startResourceCheck(): void {
    if (this.checkTimer) {
      return;
    }
    this.checkTimer = setInterval(() => this.checkAndScheduleTasks(), this.checkInterval);
  }

  private startMonitoring(): void {
    if (this.elasticityEnabled) {
      this.monitoringTimer = setInterval(
        () => this.monitorResourceUsage(),
        this.monitoringInterval
      );
    }
  }

  async setTenantQuota(tenantId: string, quota: ResourceQuota): Promise<void> {
    try {
      // Validate quota values
      if (
        quota.maxCpu <= 0 ||
        quota.maxMemory <= 0 ||
        quota.maxStorage <= 0 ||
        quota.maxNetwork <= 0 ||
        quota.maxActiveWorkloads <= 0
      ) {
        throw new Error('Invalid quota values');
      }

      // Initialize or update quota
      this.tenantQuotas.set(tenantId, quota);

      // Initialize allocation if not exists
      if (!this.tenantAllocations.has(tenantId)) {
        this.tenantAllocations.set(tenantId, {
          tenantId,
          cpu: { used: 0, reserved: 0, burst: 0 },
          memory: { used: 0, reserved: 0, burst: 0 },
          storage: { used: 0, iops: 0 },
          network: { bandwidth: 0, priority: 0 },
          workloadCount: 0,
          priority: 0
        });
      }

      logger.info('Tenant quota set', {
        tenantId,
        quota
      });

      // Emit quota update event
      this.emit('quotaUpdate', {
        tenantId,
        quota
      });
    } catch (error) {
      logger.error('Failed to set tenant quota', {
        tenantId
      }, error as Error);
      throw error;
    }
  }

  async allocateResources(request: ResourceRequest): Promise<boolean> {
    try {
      // Get tenant quota and current allocation
      const quota = this.tenantQuotas.get(request.tenantId);
      const allocation = this.tenantAllocations.get(request.tenantId);

      if (!quota || !allocation) {
        throw new Error('Tenant not found');
      }

      // Check if allocation would exceed quota
      const newAllocation = {
        cpu: {
          used: allocation.cpu.used + request.cpu.target,
          reserved: allocation.cpu.reserved,
          burst: allocation.cpu.burst
        },
        memory: {
          used: allocation.memory.used + request.memory.target,
          reserved: allocation.memory.reserved,
          burst: allocation.memory.burst
        },
        storage: {
          used: allocation.storage.used + request.storage.size,
          iops: allocation.storage.iops
        },
        network: {
          bandwidth: allocation.network.bandwidth + request.network.bandwidth,
          priority: allocation.network.priority
        },
        workloadCount: allocation.workloadCount + 1,
        priority: request.priority
      };

      if (
        newAllocation.cpu.used > quota.maxCpu ||
        newAllocation.memory.used > quota.maxMemory ||
        newAllocation.storage.used > quota.maxStorage ||
        newAllocation.network.bandwidth > quota.maxNetwork ||
        newAllocation.workloadCount > quota.maxActiveWorkloads
      ) {
        logger.warn('Resource allocation would exceed quota', {
          tenantId: request.tenantId,
          request,
          quota
        });
        return false;
      }

      // Update allocation
      this.tenantAllocations.set(request.tenantId, {
        ...allocation,
        ...newAllocation
      });

      logger.info('Resources allocated', {
        tenantId: request.tenantId,
        allocation: newAllocation
      });

      // Emit allocation event
      this.emit('resourceAllocation', {
        tenantId: request.tenantId,
        allocation: newAllocation
      });

      return true;
    } catch (error) {
      logger.error('Failed to allocate resources', {
        tenantId: request.tenantId
      }, error as Error);
      throw error;
    }
  }

  async releaseResources(request: ResourceRequest): Promise<void> {
    try {
      // Get current allocation
      const allocation = this.tenantAllocations.get(request.tenantId);
      if (!allocation) {
        throw new Error('Tenant not found');
      }

      // Calculate new allocation
      const newAllocation = {
        cpu: {
          used: Math.max(0, allocation.cpu.used - request.cpu.target),
          reserved: allocation.cpu.reserved,
          burst: allocation.cpu.burst
        },
        memory: {
          used: Math.max(0, allocation.memory.used - request.memory.target),
          reserved: allocation.memory.reserved,
          burst: allocation.memory.burst
        },
        storage: {
          used: Math.max(0, allocation.storage.used - request.storage.size),
          iops: allocation.storage.iops
        },
        network: {
          bandwidth: Math.max(0, allocation.network.bandwidth - request.network.bandwidth),
          priority: allocation.network.priority
        },
        workloadCount: Math.max(0, allocation.workloadCount - 1),
        priority: allocation.priority
      };

      // Update allocation
      this.tenantAllocations.set(request.tenantId, {
        ...allocation,
        ...newAllocation
      });

      logger.info('Resources released', {
        tenantId: request.tenantId,
        allocation: newAllocation
      });

      // Emit release event
      this.emit('resourceRelease', {
        tenantId: request.tenantId,
        allocation: newAllocation
      });
    } catch (error) {
      logger.error('Failed to release resources', {
        tenantId: request.tenantId
      }, error as Error);
      throw error;
    }
  }

  getTenantUsage(tenantId: string): TenantResourceInfo | null {
    try {
      const quota = this.tenantQuotas.get(tenantId);
      const allocation = this.tenantAllocations.get(tenantId);

      if (!quota || !allocation) {
        return null;
      }

      return {
        quota,
        allocated: allocation,
        available: {
          cpu: quota.maxCpu - allocation.cpu.used,
          memory: quota.maxMemory - allocation.memory.used,
          storage: quota.maxStorage - allocation.storage.used,
          network: quota.maxNetwork - allocation.network.bandwidth,
          workloadSlots: quota.maxActiveWorkloads - allocation.workloadCount
        }
      };
    } catch (error) {
      logger.error('Failed to get tenant usage', {
        tenantId
      }, error as Error);
      throw error;
    }
  }

  private async checkAndRebalanceAllocations(): Promise<void> {
    try {
      for (const [tenantId, allocation] of this.tenantAllocations) {
        const quota = this.tenantQuotas.get(tenantId);
        if (!quota) continue;

        // Check for over-utilization
        const isOverUtilized =
          allocation.cpu.used > quota.maxCpu * (1 + this.resourceBuffer) ||
          allocation.memory.used > quota.maxMemory * (1 + this.resourceBuffer) ||
          allocation.storage.used > quota.maxStorage * (1 + this.resourceBuffer) ||
          allocation.network.bandwidth > quota.maxNetwork * (1 + this.resourceBuffer);

        if (isOverUtilized) {
          logger.warn('Tenant resources over-utilized', {
            tenantId,
            allocation,
            quota
          });

          // Emit over-utilization event
          this.emit('resourceOverUtilization', {
            tenantId,
            allocation,
            quota
          });
        }

        // Check for under-utilization
        const isUnderUtilized =
          allocation.cpu.used < quota.maxCpu * this.resourceBuffer &&
          allocation.memory.used < quota.maxMemory * this.resourceBuffer &&
          allocation.storage.used < quota.maxStorage * this.resourceBuffer &&
          allocation.network.bandwidth < quota.maxNetwork * this.resourceBuffer;

        if (isUnderUtilized) {
          logger.info('Tenant resources under-utilized', {
            tenantId,
            allocation,
            quota
          });

          // Emit under-utilization event
          this.emit('resourceUnderUtilization', {
            tenantId,
            allocation,
            quota
          });
        }
      }
    } catch (error) {
      logger.error('Failed to check and rebalance allocations', {}, error as Error);
    }
  }

  async queueTask(context: ExecutionContext, config: TaskScheduleConfig): Promise<void> {
    const task: QueuedTask = {
      context,
      config,
      queueTime: Date.now(),
      status: 'queued'
    };

    // Validate resource requirements
    if (!this.validateResourceRequirements(config.requiredResources)) {
      throw new Error('Task resource requirements exceed quota limits');
    }

    // Add task to queue
    this.taskQueue.push(task);
    logger.info('Task queued', {
      contextId: context.id,
      priority: config.priority,
      queueLength: this.taskQueue.length
    });

    // Sort queue by priority
    this.taskQueue.sort((a, b) => b.config.priority - a.config.priority);

    // Trigger immediate schedule check
    this.checkAndScheduleTasks();
  }

  private async checkAndScheduleTasks(): Promise<void> {
    try {
      // Update current resource usage
      await this.updateResourceUsage();

      // Check for completed tasks
      for (const [contextId, task] of this.runningTasks) {
        if (task.endTime && Date.now() - task.endTime > 5000) {
          this.runningTasks.delete(contextId);
          this.releaseResources(task.config.requiredResources);
        }
      }

      // Try to schedule queued tasks
      while (this.taskQueue.length > 0) {
        const nextTask = this.taskQueue[0];
        
        // Check if we have enough resources
        if (!this.hasAvailableResources(nextTask.config.requiredResources)) {
          break;
        }

        // Remove from queue and start task
        this.taskQueue.shift();
        await this.startTask(nextTask);
      }
    } catch (error) {
      logger.error('Task scheduling check failed', {}, error as Error);
    }
  }

  private async startTask(task: QueuedTask): Promise<void> {
    try {
      // Allocate resources
      this.allocateResources(task.config.requiredResources);

      // Update task status
      task.status = 'running';
      task.startTime = Date.now();
      this.runningTasks.set(task.context.id, task);

      logger.info('Starting task execution', {
        contextId: task.context.id,
        queueTime: Date.now() - task.queueTime
      });

      // Emit task start event
      this.emit('taskStart', task);
    } catch (error) {
      task.status = 'failed';
      task.error = error as Error;
      logger.error('Task start failed', {
        contextId: task.context.id
      }, error as Error);
      this.emit('taskError', task);
    }
  }

  private validateResourceRequirements(required: TaskScheduleConfig['requiredResources']): boolean {
    return (
      required.minMemoryMB <= this.currentUsage.memoryUsageMB &&
      required.minCpuPercent <= this.currentUsage.cpuUsagePercent &&
      required.minDiskSpaceMB <= this.currentUsage.diskUsageMB &&
      required.minNetworkBandwidthMBps <= this.currentUsage.networkUsageMBps
    );
  }

  private hasAvailableResources(required: TaskScheduleConfig['requiredResources']): boolean {
    const availableMemory = this.currentUsage.memoryUsageMB - required.minMemoryMB;
    const availableCpu = this.currentUsage.cpuUsagePercent - required.minCpuPercent;
    const availableDisk = this.currentUsage.diskUsageMB - required.minDiskSpaceMB;
    const availableNetwork = this.currentUsage.networkUsageMBps - required.minNetworkBandwidthMBps;

    return (
      this.currentUsage.activeTasks < this.currentUsage.memoryUsageMB &&
      required.minMemoryMB <= availableMemory &&
      required.minCpuPercent <= availableCpu &&
      required.minDiskSpaceMB <= availableDisk &&
      required.minNetworkBandwidthMBps <= availableNetwork
    );
  }

  private allocateResources(required: TaskScheduleConfig['requiredResources']): void {
    this.currentUsage.activeTasks++;
    this.currentUsage.memoryUsageMB += required.minMemoryMB;
    this.currentUsage.cpuUsagePercent += required.minCpuPercent;
    this.currentUsage.diskUsageMB += required.minDiskSpaceMB;
    this.currentUsage.networkUsageMBps += required.minNetworkBandwidthMBps;
  }

  private releaseResources(required: TaskScheduleConfig['requiredResources']): void {
    this.currentUsage.activeTasks--;
    this.currentUsage.memoryUsageMB -= required.minMemoryMB;
    this.currentUsage.cpuUsagePercent -= required.minCpuPercent;
    this.currentUsage.diskUsageMB -= required.minDiskSpaceMB;
    this.currentUsage.networkUsageMBps -= required.minNetworkBandwidthMBps;
  }

  private async updateResourceUsage(): Promise<void> {
    try {
      // TODO: Implement actual resource usage monitoring
      // This would involve platform-specific APIs to get real resource usage
      
      // For now, we'll use the sum of allocated resources
      const usage: ResourceUsage = {
        activeTasks: this.runningTasks.size,
        memoryUsageMB: 0,
        cpuUsagePercent: 0,
        diskUsageMB: 0,
        networkUsageMBps: 0
      };

      for (const task of this.runningTasks.values()) {
        const required = task.config.requiredResources;
        usage.memoryUsageMB += required.minMemoryMB;
        usage.cpuUsagePercent += required.minCpuPercent;
        usage.diskUsageMB += required.minDiskSpaceMB;
        usage.networkUsageMBps += required.minNetworkBandwidthMBps;
      }

      this.currentUsage = usage;
    } catch (error) {
      logger.error('Failed to update resource usage', {}, error as Error);
    }
  }

  getResourceUsage(): ResourceUsage {
    return { ...this.currentUsage };
  }

  getQueueStatus(): {
    queueLength: number;
    runningTasks: number;
    resourceUtilization: ResourceUsage;
  } {
    return {
      queueLength: this.taskQueue.length,
      runningTasks: this.runningTasks.size,
      resourceUtilization: this.getResourceUsage()
    };
  }

  private async monitorResourceUsage(): Promise<void> {
    try {
      for (const [tenantId, allocation] of this.tenantAllocations.entries()) {
        const quota = this.tenantQuotas.get(tenantId);
        if (!quota) continue;

        // Check for overutilization
        if (allocation.cpu.used > quota.maxCpu * 0.8) {
          await this.handleResourcePressure(tenantId, 'cpu');
        }
        if (allocation.memory.used > quota.maxMemory * 0.8) {
          await this.handleResourcePressure(tenantId, 'memory');
        }

        // Check for underutilization
        if (allocation.cpu.used < quota.maxCpu * 0.3) {
          await this.handleResourceUnderuse(tenantId, 'cpu');
        }
        if (allocation.memory.used < quota.maxMemory * 0.3) {
          await this.handleResourceUnderuse(tenantId, 'memory');
        }
      }
    } catch (error) {
      logger.error('Resource monitoring failed', {}, error as Error);
    }
  }

  private async handleResourcePressure(
    tenantId: string,
    resourceType: 'cpu' | 'memory'
  ): Promise<void> {
    const allocation = this.tenantAllocations.get(tenantId);
    const quota = this.tenantQuotas.get(tenantId);
    if (!allocation || !quota) return;

    // Try to allocate burst capacity
    if (resourceType === 'cpu' && allocation.cpu.used < quota.cpuBurst) {
      allocation.cpu.burst = Math.min(
        quota.cpuBurst,
        allocation.cpu.used * 1.2
      );
      this.emit('resource-burst-allocated', {
        tenantId,
        resourceType,
        amount: allocation.cpu.burst
      });
    }

    // Consider workload migration or scaling
    await this.considerWorkloadMigration(tenantId, resourceType);
  }

  private async handleResourceUnderuse(
    tenantId: string,
    resourceType: 'cpu' | 'memory'
  ): Promise<void> {
    const allocation = this.tenantAllocations.get(tenantId);
    if (!allocation) return;

    // Reset burst allocation
    if (resourceType === 'cpu') {
      allocation.cpu.burst = 0;
    }

    // Consider resource reallocation
    await this.optimizeResourceAllocation(tenantId, resourceType);
  }

  private async considerWorkloadMigration(
    tenantId: string,
    resourceType: 'cpu' | 'memory'
  ): Promise<void> {
    // Implement workload migration logic
    // This could involve moving workloads to different nodes
    // or scaling resources based on priority
  }

  private async optimizeResourceAllocation(
    tenantId: string,
    resourceType: 'cpu' | 'memory'
  ): Promise<void> {
    // Implement resource optimization logic
    // This could involve reducing allocated resources
    // or reallocating them to other tenants
  }

  shutdown(): void {
    if (this.allocationTimer) {
      clearInterval(this.allocationTimer);
      this.allocationTimer = null;
    }

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    // Cancel all queued tasks
    this.taskQueue = [];

    // Mark all running tasks as failed
    for (const task of this.runningTasks.values()) {
      task.status = 'failed';
      task.error = new Error('Resource manager shutdown');
      this.emit('taskError', task);
    }
    this.runningTasks.clear();

    // Clear all allocations
    this.tenantAllocations.clear();
    this.tenantQuotas.clear();

    logger.info('Resource manager shutdown complete');
  }
} 
} 