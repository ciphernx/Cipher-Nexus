import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import * as os from 'os';
import * as pidusage from 'pidusage';

export enum MetricType {
  CPU = 'CPU',
  MEMORY = 'MEMORY',
  DISK = 'DISK',
  NETWORK = 'NETWORK',
  TASK = 'TASK'
}

export enum AlertSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

export interface Metric {
  type: MetricType;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metricType: MetricType;
  condition: {
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    threshold: number;
  };
  severity: AlertSeverity;
  enabled: boolean;
  metadata?: Record<string, any>;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: AlertSeverity;
  message: string;
  metric: Metric;
  timestamp: number;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

export interface PerformanceSnapshot {
  metrics: Metric[];
  alerts: Alert[];
  timestamp: number;
}

export class PerformanceMonitor extends EventEmitter {
  private readonly metricsRetentionMs: number;
  private readonly alertRules: Map<string, AlertRule>;
  private readonly activeAlerts: Map<string, Alert>;
  private readonly metrics: Metric[];
  private readonly checkInterval: number;
  private checkTimer: NodeJS.Timer | null;
  private readonly pid: number;

  constructor(
    metricsRetentionMs = 24 * 60 * 60 * 1000,  // 24 hours
    checkInterval = 5000                        // 5 seconds
  ) {
    super();
    this.metricsRetentionMs = metricsRetentionMs;
    this.alertRules = new Map();
    this.activeAlerts = new Map();
    this.metrics = [];
    this.checkInterval = checkInterval;
    this.checkTimer = null;
    this.pid = process.pid;
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // CPU usage alert rule
    this.addAlertRule({
      id: 'cpu_high',
      name: 'High CPU Usage',
      description: 'CPU usage exceeds 80%',
      metricType: MetricType.CPU,
      condition: {
        operator: 'gt',
        threshold: 80
      },
      severity: AlertSeverity.HIGH,
      enabled: true
    });

    // Memory usage alert rule
    this.addAlertRule({
      id: 'memory_high',
      name: 'High Memory Usage',
      description: 'Memory usage exceeds 80%',
      metricType: MetricType.MEMORY,
      condition: {
        operator: 'gt',
        threshold: 80
      },
      severity: AlertSeverity.HIGH,
      enabled: true
    });

    // Disk usage alert rule
    this.addAlertRule({
      id: 'disk_high',
      name: 'High Disk Usage',
      description: 'Disk usage exceeds 90%',
      metricType: MetricType.DISK,
      condition: {
        operator: 'gt',
        threshold: 90
      },
      severity: AlertSeverity.CRITICAL,
      enabled: true
    });
  }

  start(): void {
    if (this.checkTimer) {
      return;
    }

    this.checkTimer = setInterval(() => {
      this.recordMetrics();
      this.checkAlerts();
      this.cleanupOldMetrics();
    }, this.checkInterval);

    logger.info('Performance monitor started', {
      pid: this.pid,
      checkInterval: this.checkInterval
    });
  }

  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    logger.info('Performance monitor stopped');
  }

  addAlertRule(rule: AlertRule): void {
    try {
      this.alertRules.set(rule.id, rule);
      logger.info('Alert rule added', { ruleId: rule.id });
    } catch (error) {
      logger.error('Failed to add alert rule', {
        ruleId: rule.id
      }, error as Error);
    }
  }

  removeAlertRule(ruleId: string): void {
    try {
      this.alertRules.delete(ruleId);
      logger.info('Alert rule removed', { ruleId });
    } catch (error) {
      logger.error('Failed to remove alert rule', {
        ruleId
      }, error as Error);
    }
  }

  acknowledgeAlert(alertId: string): void {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (alert) {
        alert.acknowledged = true;
        logger.info('Alert acknowledged', { alertId });
        this.emit('alertAcknowledged', alert);
      }
    } catch (error) {
      logger.error('Failed to acknowledge alert', {
        alertId
      }, error as Error);
    }
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  getMetrics(
    type?: MetricType,
    startTime?: number,
    endTime?: number
  ): Metric[] {
    try {
      let filtered = this.metrics;

      if (type) {
        filtered = filtered.filter(m => m.type === type);
      }

      if (startTime) {
        filtered = filtered.filter(m => m.timestamp >= startTime);
      }

      if (endTime) {
        filtered = filtered.filter(m => m.timestamp <= endTime);
      }

      return filtered;
    } catch (error) {
      logger.error('Failed to get metrics', {}, error as Error);
      return [];
    }
  }

  getSnapshot(): PerformanceSnapshot {
    return {
      metrics: [...this.metrics],
      alerts: Array.from(this.activeAlerts.values()),
      timestamp: Date.now()
    };
  }

  private async recordMetrics(): Promise<void> {
    try {
      // Record CPU and memory metrics
      const usage = await pidusage(this.pid);
      
      // CPU usage
      this.metrics.push({
        type: MetricType.CPU,
        value: usage.cpu,
        timestamp: Date.now()
      });

      // Memory usage
      const totalMem = os.totalmem();
      const memoryUsagePercent = (usage.memory / totalMem) * 100;
      this.metrics.push({
        type: MetricType.MEMORY,
        value: memoryUsagePercent,
        timestamp: Date.now()
      });

      // Disk usage
      const diskInfo = os.cpus(); // This is a placeholder, actual disk usage monitoring would require additional implementation
      this.metrics.push({
        type: MetricType.DISK,
        value: 0, // Placeholder value
        timestamp: Date.now()
      });

      // Network usage
      // Placeholder for network metrics - would require additional implementation
      this.metrics.push({
        type: MetricType.NETWORK,
        value: 0,
        timestamp: Date.now()
      });

      logger.debug('Metrics recorded', {
        cpu: usage.cpu,
        memory: memoryUsagePercent
      });
    } catch (error) {
      logger.error('Failed to record metrics', {}, error as Error);
    }
  }

  private checkAlerts(): void {
    try {
      // Get latest metrics
      const latestMetrics = new Map<MetricType, Metric>();
      for (const metric of this.metrics.slice(-4)) {
        latestMetrics.set(metric.type, metric);
      }

      // Check each rule
      for (const rule of this.alertRules.values()) {
        if (!rule.enabled) continue;

        const metric = latestMetrics.get(rule.metricType);
        if (!metric) continue;

        const isTriggered = this.evaluateCondition(
          metric.value,
          rule.condition.operator,
          rule.condition.threshold
        );

        if (isTriggered) {
          const alertId = `${rule.id}_${Date.now()}`;
          const alert: Alert = {
            id: alertId,
            ruleId: rule.id,
            severity: rule.severity,
            message: rule.description,
            metric,
            timestamp: Date.now(),
            acknowledged: false,
            metadata: rule.metadata
          };

          this.activeAlerts.set(alertId, alert);
          this.emit('alert', alert);

          logger.warn('Alert triggered', {
            ruleId: rule.id,
            alertId,
            value: metric.value,
            threshold: rule.condition.threshold
          });
        }
      }
    } catch (error) {
      logger.error('Failed to check alerts', {}, error as Error);
    }
  }

  private evaluateCondition(
    value: number,
    operator: string,
    threshold: number
  ): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return value === threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      default:
        return false;
    }
  }

  private cleanupOldMetrics(): void {
    try {
      const cutoffTime = Date.now() - this.metricsRetentionMs;
      const initialLength = this.metrics.length;

      // Remove old metrics
      while (
        this.metrics.length > 0 &&
        this.metrics[0].timestamp < cutoffTime
      ) {
        this.metrics.shift();
      }

      const removedCount = initialLength - this.metrics.length;
      if (removedCount > 0) {
        logger.debug('Cleaned up old metrics', {
          removedCount,
          remaining: this.metrics.length
        });
      }
    } catch (error) {
      logger.error('Failed to cleanup old metrics', {}, error as Error);
    }
  }

  shutdown(): void {
    try {
      this.stop();
      this.metrics.length = 0;
      this.activeAlerts.clear();
      this.alertRules.clear();
      logger.info('Performance monitor shutdown complete');
    } catch (error) {
      logger.error('Failed to shutdown performance monitor', {}, error as Error);
    }
  }
} 