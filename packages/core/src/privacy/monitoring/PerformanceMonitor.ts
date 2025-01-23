import { EventEmitter } from 'events';

/**
 * Performance metric types
 */
export enum MetricType {
  LATENCY = 'latency',
  THROUGHPUT = 'throughput',
  ERROR_RATE = 'error_rate',
  MEMORY_USAGE = 'memory_usage',
  CPU_USAGE = 'cpu_usage'
}

/**
 * Performance metric interface
 */
export interface Metric {
  type: MetricType;
  value: number;
  timestamp: number;
  labels: Record<string, string>;
}

/**
 * Statistics for a metric
 */
export interface MetricStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  percentile95: number;
  percentile99: number;
  stdDev: number;
}

/**
 * Alert threshold configuration
 */
export interface AlertThreshold {
  metric: MetricType;
  operator: '>' | '<' | '>=' | '<=' | '==';
  value: number;
  duration?: number; // Duration in ms to exceed threshold before alerting
  labels?: Record<string, string>;
}

/**
 * Performance monitor implementation
 */
export class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, Metric[]> = new Map();
  private thresholds: AlertThreshold[] = [];
  private alertStates: Map<string, {
    isAlerted: boolean;
    exceededSince?: number;
  }> = new Map();

  /**
   * Record a metric
   */
  recordMetric(metric: Metric): void {
    const key = this.getMetricKey(metric);
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(metric);

    // Check thresholds
    this.checkThresholds(metric);

    // Emit metric event
    this.emit('metric', metric);
  }

  /**
   * Add an alert threshold
   */
  addThreshold(threshold: AlertThreshold): void {
    this.thresholds.push(threshold);
  }

  /**
   * Remove an alert threshold
   */
  removeThreshold(threshold: AlertThreshold): void {
    const index = this.thresholds.indexOf(threshold);
    if (index !== -1) {
      this.thresholds.splice(index, 1);
    }
  }

  /**
   * Get statistics for a metric type and optional labels
   */
  getStats(type: MetricType, labels?: Record<string, string>): MetricStats | null {
    const key = this.getMetricKey({ type, labels: labels || {}, value: 0, timestamp: 0 });
    const metrics = this.metrics.get(key);
    
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const count = values.length;
    const min = values[0];
    const max = values[count - 1];
    const mean = values.reduce((a, b) => a + b) / count;

    const median = this.calculatePercentile(values, 0.5);
    const percentile95 = this.calculatePercentile(values, 0.95);
    const percentile99 = this.calculatePercentile(values, 0.99);
    const stdDev = this.calculateStdDev(values, mean);

    return {
      count,
      min,
      max,
      mean,
      median,
      percentile95,
      percentile99,
      stdDev
    };
  }

  /**
   * Get recent metrics for a type and optional labels
   */
  getRecentMetrics(
    type: MetricType,
    labels?: Record<string, string>,
    duration?: number
  ): Metric[] {
    const key = this.getMetricKey({ type, labels: labels || {}, value: 0, timestamp: 0 });
    const metrics = this.metrics.get(key);

    if (!metrics) {
      return [];
    }

    if (!duration) {
      return metrics;
    }

    const cutoff = Date.now() - duration;
    return metrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(maxAge: number): void {
    const cutoff = Date.now() - maxAge;
    
    for (const [key, metrics] of this.metrics.entries()) {
      this.metrics.set(
        key,
        metrics.filter(m => m.timestamp >= cutoff)
      );
    }
  }

  /**
   * Generate a performance report
   */
  generateReport(duration: number): Record<string, MetricStats> {
    const report: Record<string, MetricStats> = {};
    const types = new Set(Array.from(this.metrics.values()).flat().map(m => m.type));

    for (const type of types) {
      const stats = this.getStats(type);
      if (stats) {
        report[type] = stats;
      }
    }

    return report;
  }

  /**
   * Get metric key
   */
  private getMetricKey(metric: Metric): string {
    const labelString = Object.entries(metric.labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${metric.type}${labelString ? `:${labelString}` : ''}`;
  }

  /**
   * Check alert thresholds
   */
  private checkThresholds(metric: Metric): void {
    const now = Date.now();

    for (const threshold of this.thresholds) {
      if (threshold.metric !== metric.type) continue;
      
      if (threshold.labels) {
        const labelsMatch = Object.entries(threshold.labels).every(
          ([k, v]) => metric.labels[k] === v
        );
        if (!labelsMatch) continue;
      }

      const thresholdKey = JSON.stringify(threshold);
      const state = this.alertStates.get(thresholdKey) || { isAlerted: false };

      const isExceeded = this.evaluateThreshold(metric.value, threshold);

      if (isExceeded && !state.isAlerted) {
        if (threshold.duration) {
          if (!state.exceededSince) {
            state.exceededSince = now;
          } else if (now - state.exceededSince >= threshold.duration) {
            this.emitAlert(threshold, metric);
            state.isAlerted = true;
          }
        } else {
          this.emitAlert(threshold, metric);
          state.isAlerted = true;
        }
      } else if (!isExceeded && state.isAlerted) {
        this.emitRecovery(threshold, metric);
        state.isAlerted = false;
        state.exceededSince = undefined;
      } else if (!isExceeded) {
        state.exceededSince = undefined;
      }

      this.alertStates.set(thresholdKey, state);
    }
  }

  /**
   * Evaluate threshold condition
   */
  private evaluateThreshold(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case '>': return value > threshold.value;
      case '<': return value < threshold.value;
      case '>=': return value >= threshold.value;
      case '<=': return value <= threshold.value;
      case '==': return value === threshold.value;
      default: return false;
    }
  }

  /**
   * Emit alert event
   */
  private emitAlert(threshold: AlertThreshold, metric: Metric): void {
    this.emit('alert', {
      threshold,
      metric,
      timestamp: Date.now()
    });
  }

  /**
   * Emit recovery event
   */
  private emitRecovery(threshold: AlertThreshold, metric: Metric): void {
    this.emit('recovery', {
      threshold,
      metric,
      timestamp: Date.now()
    });
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[index];
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    const squareDiffs = values.map(value => {
      const diff = value - mean;
      return diff * diff;
    });
    
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b) / values.length;
    return Math.sqrt(avgSquareDiff);
  }
} 