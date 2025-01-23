import { EventEmitter } from 'events';
import { TEEConfiguration } from '../config/tee.config';
import { SecurityMeasurements, TEEMetrics } from '../types';

interface SecurityEvent {
  timestamp: number;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  details: any;
  context?: {
    contextId?: string;
    operation?: string;
    measurements?: SecurityMeasurements;
  };
}

interface ErrorMetrics {
  total: number;
  byType: Map<string, number>;
  byContext: Map<string, number>;
  rate: number;
  lastReset: number;
}

export class SecurityMonitor extends EventEmitter {
  private config: TEEConfiguration;
  private events: SecurityEvent[] = [];
  private errorMetrics: ErrorMetrics;
  private readonly metricsWindow = 3600000; // 1 hour in milliseconds

  constructor(config: TEEConfiguration) {
    super();
    this.config = config;
    this.errorMetrics = this.initializeErrorMetrics();
  }

  private initializeErrorMetrics(): ErrorMetrics {
    return {
      total: 0,
      byType: new Map(),
      byContext: new Map(),
      rate: 0,
      lastReset: Date.now()
    };
  }

  trackError(error: Error, context?: { contextId?: string; operation?: string }): void {
    const errorType = error.constructor.name;
    
    // Update error metrics
    this.errorMetrics.total++;
    this.errorMetrics.byType.set(
      errorType,
      (this.errorMetrics.byType.get(errorType) || 0) + 1
    );

    if (context?.contextId) {
      this.errorMetrics.byContext.set(
        context.contextId,
        (this.errorMetrics.byContext.get(context.contextId) || 0) + 1
      );
    }

    // Calculate error rate
    const timeWindow = Date.now() - this.errorMetrics.lastReset;
    this.errorMetrics.rate = (this.errorMetrics.total / timeWindow) * this.metricsWindow;

    // Log security event
    this.logSecurityEvent({
      timestamp: Date.now(),
      type: 'error',
      severity: this.calculateErrorSeverity(error),
      details: {
        message: error.message,
        type: errorType,
        stack: error.stack
      },
      context
    });

    // Check if error rate exceeds threshold
    if (this.errorMetrics.rate > this.config.monitoring.alertThresholds.errorRate) {
      this.emit('error-threshold-exceeded', {
        currentRate: this.errorMetrics.rate,
        threshold: this.config.monitoring.alertThresholds.errorRate,
        metrics: this.errorMetrics
      });
    }
  }

  detectIntrusion(measurements: SecurityMeasurements, metrics: TEEMetrics): void {
    const anomalies = [];

    // Check security score
    if (measurements.securityScore < 70) {
      anomalies.push({
        type: 'low-security-score',
        score: measurements.securityScore,
        threshold: 70
      });
    }

    // Check for critical vulnerabilities
    const criticalVulnerabilities = measurements.vulnerabilities.filter(
      v => v.severity === 'high'
    );
    if (criticalVulnerabilities.length > 0) {
      anomalies.push({
        type: 'critical-vulnerabilities',
        vulnerabilities: criticalVulnerabilities
      });
    }

    // Check resource usage anomalies
    if (metrics.cpuUsage > this.config.resources.maxCpuPerContext * 1.5) {
      anomalies.push({
        type: 'high-cpu-usage',
        usage: metrics.cpuUsage,
        threshold: this.config.resources.maxCpuPerContext * 1.5
      });
    }

    if (metrics.memoryUsage > this.config.resources.maxMemoryPerContext * 1024 * 1024 * 1.5) {
      anomalies.push({
        type: 'high-memory-usage',
        usage: metrics.memoryUsage,
        threshold: this.config.resources.maxMemoryPerContext * 1024 * 1024 * 1.5
      });
    }

    // Log anomalies as security events
    if (anomalies.length > 0) {
      this.logSecurityEvent({
        timestamp: Date.now(),
        type: 'intrusion-detection',
        severity: 'critical',
        details: { anomalies }
      });

      this.emit('intrusion-detected', { anomalies });
    }
  }

  private calculateErrorSeverity(error: Error): SecurityEvent['severity'] {
    if (error.message.includes('attestation') || error.message.includes('integrity')) {
      return 'critical';
    }
    if (error.message.includes('security') || error.message.includes('unauthorized')) {
      return 'error';
    }
    if (error.message.includes('resource') || error.message.includes('timeout')) {
      return 'warning';
    }
    return 'info';
  }

  private logSecurityEvent(event: SecurityEvent): void {
    this.events.push(event);
    this.emit('security-event', event);

    // Cleanup old events
    const retentionTime = this.config.monitoring.retentionPeriod * 1000;
    const cutoffTime = Date.now() - retentionTime;
    this.events = this.events.filter(e => e.timestamp > cutoffTime);
  }

  getSecurityAudit(startTime: number, endTime: number = Date.now()): {
    events: SecurityEvent[];
    summary: {
      totalEvents: number;
      bySeverity: Map<string, number>;
      byType: Map<string, number>;
      errorRate: number;
    };
  } {
    const filteredEvents = this.events.filter(
      e => e.timestamp >= startTime && e.timestamp <= endTime
    );

    const summary = {
      totalEvents: filteredEvents.length,
      bySeverity: new Map<string, number>(),
      byType: new Map<string, number>(),
      errorRate: this.errorMetrics.rate
    };

    // Calculate event statistics
    filteredEvents.forEach(event => {
      summary.bySeverity.set(
        event.severity,
        (summary.bySeverity.get(event.severity) || 0) + 1
      );
      summary.byType.set(
        event.type,
        (summary.byType.get(event.type) || 0) + 1
      );
    });

    return { events: filteredEvents, summary };
  }

  resetErrorMetrics(): void {
    this.errorMetrics = this.initializeErrorMetrics();
  }
} 