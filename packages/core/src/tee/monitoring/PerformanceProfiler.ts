import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import { MetricsManager } from './MetricsManager';

export interface ProfilerConfig {
  samplingInterval: number;     // milliseconds
  maxProfiles: number;          // maximum number of profiles to keep
  enabledMetrics: {
    cpu: boolean;
    memory: boolean;
    io: boolean;
    network: boolean;
    operations: boolean;
  };
}

export interface OperationProfile {
  operationId: string;
  type: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'completed' | 'failed';
  metrics: {
    cpu: {
      usage: number;
      maxUsage: number;
      avgUsage: number;
    };
    memory: {
      usage: number;
      maxUsage: number;
      avgUsage: number;
      allocations: number;
      frees: number;
    };
    io: {
      reads: number;
      writes: number;
      bytesRead: number;
      bytesWritten: number;
    };
    network: {
      requests: number;
      bytesIn: number;
      bytesOut: number;
      latency: number;
    };
  };
  events: Array<{
    timestamp: number;
    type: string;
    data: any;
  }>;
  metadata?: Record<string, any>;
}

export class PerformanceProfiler extends EventEmitter {
  private config: ProfilerConfig;
  private metricsManager: MetricsManager;
  private activeProfiles: Map<string, OperationProfile>;
  private completedProfiles: OperationProfile[];
  private profilingInterval: NodeJS.Timeout | null = null;

  constructor(config: ProfilerConfig, metricsManager: MetricsManager) {
    super();
    this.config = config;
    this.metricsManager = metricsManager;
    this.activeProfiles = new Map();
    this.completedProfiles = [];

    if (Object.values(config.enabledMetrics).some(enabled => enabled)) {
      this.startProfiling();
    }
  }

  startOperationProfiling(
    operationId: string,
    type: string,
    metadata?: Record<string, any>
  ): void {
    const profile: OperationProfile = {
      operationId,
      type,
      startTime: Date.now(),
      status: 'running',
      metrics: {
        cpu: { usage: 0, maxUsage: 0, avgUsage: 0 },
        memory: { usage: 0, maxUsage: 0, avgUsage: 0, allocations: 0, frees: 0 },
        io: { reads: 0, writes: 0, bytesRead: 0, bytesWritten: 0 },
        network: { requests: 0, bytesIn: 0, bytesOut: 0, latency: 0 }
      },
      events: [],
      metadata
    };

    this.activeProfiles.set(operationId, profile);
    this.emit('operation-started', { operationId, type });
    logger.debug('Started operation profiling', { operationId, type });
  }

  endOperationProfiling(
    operationId: string,
    status: 'completed' | 'failed' = 'completed'
  ): OperationProfile {
    const profile = this.activeProfiles.get(operationId);
    if (!profile) {
      throw new Error(`No active profile found for operation ${operationId}`);
    }

    profile.endTime = Date.now();
    profile.duration = profile.endTime - profile.startTime;
    profile.status = status;

    // Calculate final metrics
    this.calculateFinalMetrics(profile);

    // Move to completed profiles
    this.activeProfiles.delete(operationId);
    this.completedProfiles.push(profile);

    // Trim completed profiles if needed
    while (this.completedProfiles.length > this.config.maxProfiles) {
      this.completedProfiles.shift();
    }

    this.emit('operation-ended', { 
      operationId, 
      status,
      duration: profile.duration,
      metrics: profile.metrics
    });

    logger.debug('Ended operation profiling', { 
      operationId,
      status,
      duration: profile.duration
    });

    return profile;
  }

  recordEvent(
    operationId: string,
    type: string,
    data: any
  ): void {
    const profile = this.activeProfiles.get(operationId);
    if (!profile) {
      logger.warn('Attempted to record event for unknown operation', { operationId, type });
      return;
    }

    profile.events.push({
      timestamp: Date.now(),
      type,
      data
    });
  }

  updateMetrics(
    operationId: string,
    metrics: Partial<OperationProfile['metrics']>
  ): void {
    const profile = this.activeProfiles.get(operationId);
    if (!profile) {
      logger.warn('Attempted to update metrics for unknown operation', { operationId });
      return;
    }

    // Update CPU metrics
    if (metrics.cpu) {
      profile.metrics.cpu.usage = metrics.cpu.usage;
      profile.metrics.cpu.maxUsage = Math.max(
        profile.metrics.cpu.maxUsage,
        metrics.cpu.usage
      );
      this.updateAverageMetric(profile.metrics.cpu, metrics.cpu.usage);
    }

    // Update memory metrics
    if (metrics.memory) {
      profile.metrics.memory.usage = metrics.memory.usage;
      profile.metrics.memory.maxUsage = Math.max(
        profile.metrics.memory.maxUsage,
        metrics.memory.usage
      );
      profile.metrics.memory.allocations += metrics.memory.allocations || 0;
      profile.metrics.memory.frees += metrics.memory.frees || 0;
      this.updateAverageMetric(profile.metrics.memory, metrics.memory.usage);
    }

    // Update IO metrics
    if (metrics.io) {
      profile.metrics.io.reads += metrics.io.reads || 0;
      profile.metrics.io.writes += metrics.io.writes || 0;
      profile.metrics.io.bytesRead += metrics.io.bytesRead || 0;
      profile.metrics.io.bytesWritten += metrics.io.bytesWritten || 0;
    }

    // Update network metrics
    if (metrics.network) {
      profile.metrics.network.requests += metrics.network.requests || 0;
      profile.metrics.network.bytesIn += metrics.network.bytesIn || 0;
      profile.metrics.network.bytesOut += metrics.network.bytesOut || 0;
      if (metrics.network.latency) {
        profile.metrics.network.latency = 
          (profile.metrics.network.latency + metrics.network.latency) / 2;
      }
    }
  }

  getOperationProfile(operationId: string): OperationProfile | undefined {
    return (
      this.activeProfiles.get(operationId) ||
      this.completedProfiles.find(p => p.operationId === operationId)
    );
  }

  getActiveProfiles(): OperationProfile[] {
    return Array.from(this.activeProfiles.values());
  }

  getCompletedProfiles(
    startTime?: number,
    endTime?: number
  ): OperationProfile[] {
    let profiles = this.completedProfiles;

    if (startTime) {
      profiles = profiles.filter(p => p.startTime >= startTime);
    }

    if (endTime) {
      profiles = profiles.filter(p => p.endTime! <= endTime);
    }

    return profiles;
  }

  private startProfiling(): void {
    if (this.profilingInterval) {
      return;
    }

    this.profilingInterval = setInterval(
      () => this.collectMetrics(),
      this.config.samplingInterval
    );
  }

  private async collectMetrics(): Promise<void> {
    if (this.activeProfiles.size === 0) {
      return;
    }

    try {
      // Collect system metrics
      const systemMetrics = await this.collectSystemMetrics();

      // Update each active profile
      for (const profile of this.activeProfiles.values()) {
        this.updateMetrics(profile.operationId, {
          cpu: {
            usage: systemMetrics.cpu / this.activeProfiles.size,
            maxUsage: 0,
            avgUsage: 0
          },
          memory: {
            usage: systemMetrics.memory / this.activeProfiles.size,
            maxUsage: 0,
            avgUsage: 0,
            allocations: 0,
            frees: 0
          }
        });
      }
    } catch (error) {
      logger.error('Failed to collect metrics', {}, error as Error);
    }
  }

  private async collectSystemMetrics(): Promise<{ cpu: number; memory: number }> {
    const metrics = {
      cpu: 0,
      memory: 0
    };

    if (this.config.enabledMetrics.cpu) {
      metrics.cpu = process.cpuUsage().user / 1000000; // Convert to seconds
    }

    if (this.config.enabledMetrics.memory) {
      const memUsage = process.memoryUsage();
      metrics.memory = memUsage.heapUsed;
    }

    return metrics;
  }

  private calculateFinalMetrics(profile: OperationProfile): void {
    // Calculate final averages and rates
    if (profile.duration) {
      // Calculate rates
      profile.metrics.io.reads = profile.metrics.io.reads / (profile.duration / 1000);
      profile.metrics.io.writes = profile.metrics.io.writes / (profile.duration / 1000);
      profile.metrics.network.requests = profile.metrics.network.requests / (profile.duration / 1000);

      // Calculate throughput
      profile.metrics.io.bytesRead = profile.metrics.io.bytesRead / (profile.duration / 1000);
      profile.metrics.io.bytesWritten = profile.metrics.io.bytesWritten / (profile.duration / 1000);
      profile.metrics.network.bytesIn = profile.metrics.network.bytesIn / (profile.duration / 1000);
      profile.metrics.network.bytesOut = profile.metrics.network.bytesOut / (profile.duration / 1000);
    }
  }

  private updateAverageMetric(
    metric: { avgUsage: number },
    newValue: number
  ): void {
    metric.avgUsage = metric.avgUsage === 0 
      ? newValue 
      : (metric.avgUsage + newValue) / 2;
  }

  shutdown(): void {
    if (this.profilingInterval) {
      clearInterval(this.profilingInterval);
      this.profilingInterval = null;
    }

    // End all active profiles
    for (const [operationId] of this.activeProfiles) {
      this.endOperationProfiling(operationId, 'failed');
    }
  }
} 