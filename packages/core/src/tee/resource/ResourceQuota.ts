import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';

export interface QuotaConfig {
  cpu: {
    limit: number;      // CPU cores
    burst: number;      // Maximum burst CPU cores
    throttling: number; // Throttling period in ms
  };
  memory: {
    limit: number;      // Memory in MB
    swap: number;       // Swap in MB
    reservation: number; // Minimum guaranteed memory in MB
  };
  storage: {
    limit: number;      // Storage in MB
    iops: number;       // IOPS limit
    bandwidth: number;  // Bandwidth in MB/s
  };
  network: {
    bandwidth: number;  // Bandwidth in MB/s
    packets: number;    // Packets per second
    connections: number; // Maximum concurrent connections
  };
}

export interface ResourceUsage {
  cpu: {
    used: number;
    percent: number;
  };
  memory: {
    used: number;
    percent: number;
    swap: number;
  };
  storage: {
    used: number;
    iops: number;
    bandwidth: number;
  };
  network: {
    bandwidth: number;
    packets: number;
    connections: number;
  };
}

export class ResourceQuota extends EventEmitter {
  private readonly config: QuotaConfig;
  private usage: ResourceUsage;
  private throttleTimers: Map<string, NodeJS.Timeout>;

  constructor(config: QuotaConfig) {
    super();
    this.config = config;
    this.usage = this.initializeUsage();
    this.throttleTimers = new Map();
  }

  private initializeUsage(): ResourceUsage {
    return {
      cpu: { used: 0, percent: 0 },
      memory: { used: 0, percent: 0, swap: 0 },
      storage: { used: 0, iops: 0, bandwidth: 0 },
      network: { bandwidth: 0, packets: 0, connections: 0 }
    };
  }

  async allocateResources(request: Partial<ResourceUsage>): Promise<boolean> {
    try {
      // Check if allocation is within limits
      if (!this.checkAllocationLimits(request)) {
        logger.warn('Resource allocation exceeds limits', { request });
        return false;
      }

      // Update usage
      this.updateUsage(request);

      // Check if throttling is needed
      await this.checkAndApplyThrottling();

      return true;
    } catch (error) {
      logger.error('Failed to allocate resources', {}, error as Error);
      return false;
    }
  }

  private checkAllocationLimits(request: Partial<ResourceUsage>): boolean {
    // Check CPU limits
    if (request.cpu) {
      const totalCpu = this.usage.cpu.used + request.cpu.used;
      if (totalCpu > this.config.cpu.limit) {
        return false;
      }
    }

    // Check memory limits
    if (request.memory) {
      const totalMemory = this.usage.memory.used + request.memory.used;
      if (totalMemory > this.config.memory.limit) {
        return false;
      }
    }

    // Check storage limits
    if (request.storage) {
      const totalStorage = this.usage.storage.used + request.storage.used;
      if (totalStorage > this.config.storage.limit) {
        return false;
      }
    }

    // Check network limits
    if (request.network) {
      const totalBandwidth = this.usage.network.bandwidth + request.network.bandwidth;
      if (totalBandwidth > this.config.network.bandwidth) {
        return false;
      }
    }

    return true;
  }

  private updateUsage(request: Partial<ResourceUsage>): void {
    // Update CPU usage
    if (request.cpu) {
      this.usage.cpu.used += request.cpu.used;
      this.usage.cpu.percent = (this.usage.cpu.used / this.config.cpu.limit) * 100;
    }

    // Update memory usage
    if (request.memory) {
      this.usage.memory.used += request.memory.used;
      this.usage.memory.percent = (this.usage.memory.used / this.config.memory.limit) * 100;
      if (request.memory.swap) {
        this.usage.memory.swap += request.memory.swap;
      }
    }

    // Update storage usage
    if (request.storage) {
      this.usage.storage.used += request.storage.used;
      this.usage.storage.iops = request.storage.iops || this.usage.storage.iops;
      this.usage.storage.bandwidth = request.storage.bandwidth || this.usage.storage.bandwidth;
    }

    // Update network usage
    if (request.network) {
      this.usage.network.bandwidth = request.network.bandwidth || this.usage.network.bandwidth;
      this.usage.network.packets = request.network.packets || this.usage.network.packets;
      this.usage.network.connections = request.network.connections || this.usage.network.connections;
    }

    this.emit('usage-updated', this.usage);
  }

  private async checkAndApplyThrottling(): Promise<void> {
    // Check CPU throttling
    if (this.usage.cpu.used > this.config.cpu.burst) {
      await this.applyThrottling('cpu', this.config.cpu.throttling);
    }

    // Check network throttling
    if (this.usage.network.bandwidth > this.config.network.bandwidth) {
      await this.applyThrottling('network', 1000); // 1 second throttling
    }
  }

  private async applyThrottling(resource: string, duration: number): Promise<void> {
    // Clear existing throttle timer
    const existingTimer = this.throttleTimers.get(resource);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Apply new throttling
    const timer = setTimeout(() => {
      this.throttleTimers.delete(resource);
      this.emit('throttling-ended', { resource });
    }, duration);

    this.throttleTimers.set(resource, timer);
    this.emit('throttling-started', { resource, duration });
  }

  getUsage(): ResourceUsage {
    return { ...this.usage };
  }

  reset(): void {
    this.usage = this.initializeUsage();
    // Clear all throttle timers
    for (const timer of this.throttleTimers.values()) {
      clearTimeout(timer);
    }
    this.throttleTimers.clear();
    this.emit('usage-reset');
  }
} 