import { EventEmitter } from 'events';
import { 
  TEEConfig,
  TEEMetrics,
  SecurityMeasurements,
  TEEContext,
  TEERequest,
  TEEResult
} from './types';
import { TrustedExecutionManager } from './TrustedExecutionManager';
import { AdvancedCache } from '../crypto/cache/AdvancedCache';

/**
 * Service for managing TEE operations and resources
 */
export class TrustedExecutionService extends EventEmitter {
  private manager: TrustedExecutionManager;
  private resourceCache: AdvancedCache<TEEMetrics>;
  private monitoringInterval: NodeJS.Timer | null;
  private readonly MONITORING_INTERVAL = 1000; // 1 second
  private readonly METRICS_TTL = 3600; // 1 hour

  constructor(config: TEEConfig) {
    super();
    this.manager = new TrustedExecutionManager(config);
    this.resourceCache = new AdvancedCache({
      maxSize: 100 * 1024 * 1024, // 100MB
      maxEntries: 1000,
      ttl: this.METRICS_TTL * 1000,
      checkPeriod: 60000 // 1 minute
    });
    this.monitoringInterval = null;

    // Initialize monitoring
    this.startMonitoring();

    // Handle cache events
    this.resourceCache.on('memory-pressure', this.handleMemoryPressure.bind(this));
  }

  /**
   * Execute operation in TEE
   */
  async execute<T, R>(request: TEERequest<T>): Promise<TEEResult<R>> {
    try {
      // Check resource availability
      await this.checkResources();

      // Execute in TEE
      const result = await this.manager.execute<T, R>(request);

      // Update metrics
      if (result.metrics) {
        this.updateMetrics(request.context?.id || 'global', result.metrics);
      }

      return result;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get current resource metrics
   */
  async getMetrics(contextId?: string): Promise<TEEMetrics> {
    const key = contextId || 'global';
    const cached = this.resourceCache.get(key);
    if (cached) {
      return cached;
    }

    const metrics = await this.collectMetrics(contextId);
    this.resourceCache.set(key, metrics);
    return metrics;
  }

  /**
   * Get security measurements
   */
  async getMeasurements(contextId: string): Promise<SecurityMeasurements> {
    return this.manager.getMeasurements(contextId);
  }

  /**
   * Stop service and cleanup resources
   */
  async shutdown(): Promise<void> {
    this.stopMonitoring();
    await this.manager.shutdown();
    this.resourceCache.destroy();
  }

  private async checkResources(): Promise<void> {
    const metrics = await this.getMetrics();

    // Check CPU usage
    if (metrics.cpuUsage > 90) {
      throw new Error('CPU usage too high');
    }

    // Check memory usage
    const maxMemory = process.memoryUsage().heapTotal;
    if (metrics.memoryUsage / maxMemory > 0.9) {
      throw new Error('Memory usage too high');
    }

    // Check operation limits
    if (metrics.activeOperations >= 100) {
      throw new Error('Too many active operations');
    }
  }

  private startMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(
      async () => {
        try {
          const metrics = await this.collectMetrics();
          this.updateMetrics('global', metrics);
          this.emit('metrics', metrics);
        } catch (error) {
          this.emit('error', error);
        }
      },
      this.MONITORING_INTERVAL
    );
  }

  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private async collectMetrics(contextId?: string): Promise<TEEMetrics> {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();

    return {
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      memoryUsage: memoryUsage.heapUsed,
      activeOperations: contextId ? 1 : this.getActiveOperations(),
      queuedOperations: this.getQueuedOperations(),
      lastMeasurement: Date.now()
    };
  }

  private updateMetrics(contextId: string, metrics: TEEMetrics): void {
    this.resourceCache.set(contextId, metrics);

    // Emit metrics update event
    this.emit('metrics-update', {
      contextId,
      metrics
    });
  }

  private handleMemoryPressure(): void {
    // Emit memory pressure event
    this.emit('memory-pressure');

    // Clear old metrics
    this.resourceCache.clear();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  private getActiveOperations(): number {
    // TODO: Implement actual active operations counting
    return 0;
  }

  private getQueuedOperations(): number {
    // TODO: Implement actual queued operations counting
    return 0;
  }
} 