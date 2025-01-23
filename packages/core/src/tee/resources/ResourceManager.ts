import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import { TEEMetrics } from '../types';
import { MetricsManager } from '../monitoring/MetricsManager';

export interface ResourceQuota {
  maxCpu: number;          // Percentage (0-100)
  maxMemory: number;       // Bytes
  maxOperations: number;   // Concurrent operations
  maxQueueSize: number;    // Maximum queued operations
}

export interface ResourceAllocation {
  cpu: number;
  memory: number;
  operations: number;
  queueSize: number;
}

export interface ResourceRequest {
  minCpu: number;
  minMemory: number;
  preferredCpu: number;
  preferredMemory: number;
  priority: number;
}

export interface TenantResourceInfo {
  tenantId: string;
  quota: ResourceQuota;
  currentAllocation: ResourceAllocation;
  reservations: Map<string, ResourceAllocation>;
}

export class ResourceManager extends EventEmitter {
  private tenants: Map<string, TenantResourceInfo>;
  private metricsManager: MetricsManager;
  private readonly ALLOCATION_CHECK_INTERVAL = 10000; // 10 seconds
  private readonly RESOURCE_BUFFER = 0.1; // 10% buffer

  constructor(metricsManager: MetricsManager) {
    super();
    this.tenants = new Map();
    this.metricsManager = metricsManager;

    // Start periodic allocation check
    setInterval(() => this.checkAndRebalanceAllocations(), this.ALLOCATION_CHECK_INTERVAL);
  }

  async setTenantQuota(
    tenantId: string,
    quota: ResourceQuota
  ): Promise<void> {
    const tenant = this.tenants.get(tenantId) || {
      tenantId,
      quota,
      currentAllocation: {
        cpu: 0,
        memory: 0,
        operations: 0,
        queueSize: 0
      },
      reservations: new Map()
    };

    tenant.quota = quota;
    this.tenants.set(tenantId, tenant);

    logger.info('Updated tenant quota', { tenantId, quota });
  }

  async allocateResources(
    tenantId: string,
    contextId: string,
    request: ResourceRequest
  ): Promise<ResourceAllocation> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    // Check if allocation already exists
    if (tenant.reservations.has(contextId)) {
      return tenant.reservations.get(contextId)!;
    }

    // Calculate available resources
    const available = this.calculateAvailableResources(tenant);

    // Check minimum requirements
    if (!this.checkMinimumRequirements(request, available)) {
      throw new Error('Insufficient resources to meet minimum requirements');
    }

    // Calculate optimal allocation
    const allocation = this.calculateOptimalAllocation(request, available);

    // Update tenant allocations
    tenant.reservations.set(contextId, allocation);
    this.updateTenantAllocation(tenant);

    logger.info('Allocated resources', { tenantId, contextId, allocation });

    return allocation;
  }

  async releaseResources(
    tenantId: string,
    contextId: string
  ): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    if (tenant.reservations.has(contextId)) {
      tenant.reservations.delete(contextId);
      this.updateTenantAllocation(tenant);
      logger.info('Released resources', { tenantId, contextId });
    }
  }

  async getTenantUsage(tenantId: string): Promise<{
    quota: ResourceQuota;
    currentUsage: ResourceAllocation;
    reservations: Map<string, ResourceAllocation>;
  }> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    return {
      quota: tenant.quota,
      currentUsage: tenant.currentAllocation,
      reservations: tenant.reservations
    };
  }

  private calculateAvailableResources(
    tenant: TenantResourceInfo
  ): ResourceAllocation {
    return {
      cpu: Math.max(0, tenant.quota.maxCpu - tenant.currentAllocation.cpu),
      memory: Math.max(0, tenant.quota.maxMemory - tenant.currentAllocation.memory),
      operations: Math.max(0, tenant.quota.maxOperations - tenant.currentAllocation.operations),
      queueSize: Math.max(0, tenant.quota.maxQueueSize - tenant.currentAllocation.queueSize)
    };
  }

  private checkMinimumRequirements(
    request: ResourceRequest,
    available: ResourceAllocation
  ): boolean {
    return (
      available.cpu >= request.minCpu &&
      available.memory >= request.minMemory
    );
  }

  private calculateOptimalAllocation(
    request: ResourceRequest,
    available: ResourceAllocation
  ): ResourceAllocation {
    return {
      cpu: Math.min(request.preferredCpu, available.cpu),
      memory: Math.min(request.preferredMemory, available.memory),
      operations: 1, // Start with 1 operation
      queueSize: Math.floor(available.queueSize * 0.1) // 10% of available queue size
    };
  }

  private updateTenantAllocation(tenant: TenantResourceInfo): void {
    const newAllocation: ResourceAllocation = {
      cpu: 0,
      memory: 0,
      operations: 0,
      queueSize: 0
    };

    // Sum up all reservations
    for (const reservation of tenant.reservations.values()) {
      newAllocation.cpu += reservation.cpu;
      newAllocation.memory += reservation.memory;
      newAllocation.operations += reservation.operations;
      newAllocation.queueSize += reservation.queueSize;
    }

    // Check quota limits
    newAllocation.cpu = Math.min(newAllocation.cpu, tenant.quota.maxCpu);
    newAllocation.memory = Math.min(newAllocation.memory, tenant.quota.maxMemory);
    newAllocation.operations = Math.min(newAllocation.operations, tenant.quota.maxOperations);
    newAllocation.queueSize = Math.min(newAllocation.queueSize, tenant.quota.maxQueueSize);

    tenant.currentAllocation = newAllocation;

    this.emit('allocation-updated', {
      tenantId: tenant.tenantId,
      allocation: newAllocation
    });
  }

  private async checkAndRebalanceAllocations(): Promise<void> {
    try {
      for (const tenant of this.tenants.values()) {
        const metrics = await this.getResourceMetrics(tenant.tenantId);
        const usage = this.calculateResourceUsage(metrics);

        // Check for over-utilization
        if (this.isOverUtilized(usage, tenant.quota)) {
          await this.handleOverUtilization(tenant, usage);
        }

        // Check for under-utilization
        if (this.isUnderUtilized(usage, tenant.quota)) {
          await this.handleUnderUtilization(tenant, usage);
        }
      }
    } catch (error) {
      logger.error('Failed to rebalance allocations', {}, error as Error);
    }
  }

  private async getResourceMetrics(tenantId: string): Promise<TEEMetrics> {
    const endTime = Date.now();
    const startTime = endTime - this.ALLOCATION_CHECK_INTERVAL;

    const metrics = await this.metricsManager.getMetricsHistory(
      'resource_usage',
      startTime,
      endTime,
      { tenantId }
    );

    // Return the latest metrics
    return metrics.length > 0 ? metrics[metrics.length - 1] as any : null;
  }

  private calculateResourceUsage(metrics: TEEMetrics): ResourceAllocation {
    return {
      cpu: metrics.cpuUsage,
      memory: metrics.memoryUsage,
      operations: metrics.activeOperations,
      queueSize: metrics.queuedOperations
    };
  }

  private isOverUtilized(
    usage: ResourceAllocation,
    quota: ResourceQuota
  ): boolean {
    const threshold = 1 - this.RESOURCE_BUFFER;
    return (
      usage.cpu > quota.maxCpu * threshold ||
      usage.memory > quota.maxMemory * threshold ||
      usage.operations > quota.maxOperations * threshold ||
      usage.queueSize > quota.maxQueueSize * threshold
    );
  }

  private isUnderUtilized(
    usage: ResourceAllocation,
    quota: ResourceQuota
  ): boolean {
    const threshold = 0.5; // 50% utilization
    return (
      usage.cpu < quota.maxCpu * threshold &&
      usage.memory < quota.maxMemory * threshold &&
      usage.operations < quota.maxOperations * threshold &&
      usage.queueSize < quota.maxQueueSize * threshold
    );
  }

  private async handleOverUtilization(
    tenant: TenantResourceInfo,
    usage: ResourceAllocation
  ): Promise<void> {
    // Implement scale-down logic
    const scaleFactor = 0.8; // Reduce by 20%
    
    for (const [contextId, reservation] of tenant.reservations) {
      const newAllocation: ResourceAllocation = {
        cpu: Math.floor(reservation.cpu * scaleFactor),
        memory: Math.floor(reservation.memory * scaleFactor),
        operations: Math.floor(reservation.operations * scaleFactor),
        queueSize: Math.floor(reservation.queueSize * scaleFactor)
      };

      tenant.reservations.set(contextId, newAllocation);
    }

    this.updateTenantAllocation(tenant);
    
    logger.warn('Scaled down resources due to over-utilization', {
      tenantId: tenant.tenantId,
      usage
    });
  }

  private async handleUnderUtilization(
    tenant: TenantResourceInfo,
    usage: ResourceAllocation
  ): Promise<void> {
    // Implement scale-up logic
    const scaleFactor = 1.2; // Increase by 20%
    
    for (const [contextId, reservation] of tenant.reservations) {
      const newAllocation: ResourceAllocation = {
        cpu: Math.min(Math.floor(reservation.cpu * scaleFactor), tenant.quota.maxCpu),
        memory: Math.min(Math.floor(reservation.memory * scaleFactor), tenant.quota.maxMemory),
        operations: Math.min(Math.floor(reservation.operations * scaleFactor), tenant.quota.maxOperations),
        queueSize: Math.min(Math.floor(reservation.queueSize * scaleFactor), tenant.quota.maxQueueSize)
      };

      tenant.reservations.set(contextId, newAllocation);
    }

    this.updateTenantAllocation(tenant);
    
    logger.info('Scaled up resources due to under-utilization', {
      tenantId: tenant.tenantId,
      usage
    });
  }
} 