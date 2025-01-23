import { EventEmitter } from 'events';
import { TEEMetrics, SecurityMeasurements } from '../types';
import { logger } from '../logging/Logger';
import { InfluxDB, Point } from '@influxdata/influxdb-client';

export interface MetricDataPoint {
  timestamp: number;
  value: number;
  tags: Record<string, string>;
}

export interface MetricsConfig {
  influxUrl: string;
  influxToken: string;
  influxOrg: string;
  influxBucket: string;
  retentionDays: number;
  aggregationInterval: number;
}

export class MetricsManager extends EventEmitter {
  private influx: InfluxDB;
  private config: MetricsConfig;
  private metricsBuffer: Map<string, MetricDataPoint[]>;
  private readonly BUFFER_FLUSH_INTERVAL = 10000; // 10 seconds
  private readonly BUFFER_SIZE_LIMIT = 1000;

  constructor(config: MetricsConfig) {
    super();
    this.config = config;
    this.metricsBuffer = new Map();
    
    this.influx = new InfluxDB({
      url: config.influxUrl,
      token: config.influxToken
    });

    // Start buffer flush interval
    setInterval(() => this.flushMetricsBuffer(), this.BUFFER_FLUSH_INTERVAL);
  }

  async recordMetrics(contextId: string, metrics: TEEMetrics): Promise<void> {
    try {
      this.bufferMetric('cpu_usage', metrics.cpuUsage, { contextId });
      this.bufferMetric('memory_usage', metrics.memoryUsage, { contextId });
      this.bufferMetric('active_operations', metrics.activeOperations, { contextId });
      this.bufferMetric('queued_operations', metrics.queuedOperations, { contextId });

      // Check if buffer needs to be flushed
      if (this.shouldFlushBuffer()) {
        await this.flushMetricsBuffer();
      }
    } catch (error) {
      logger.error('Failed to record metrics', { contextId }, error as Error);
    }
  }

  async recordSecurityMeasurements(
    contextId: string,
    measurements: SecurityMeasurements
  ): Promise<void> {
    try {
      this.bufferMetric('security_score', measurements.securityScore, { contextId });
      
      // Record vulnerability counts by severity
      const vulnCounts = this.countVulnerabilities(measurements.vulnerabilities);
      Object.entries(vulnCounts).forEach(([severity, count]) => {
        this.bufferMetric('vulnerabilities', count, { contextId, severity });
      });
    } catch (error) {
      logger.error('Failed to record security measurements', { contextId }, error as Error);
    }
  }

  async getMetricsHistory(
    metricName: string,
    startTime: number,
    endTime: number,
    tags?: Record<string, string>
  ): Promise<MetricDataPoint[]> {
    const queryApi = this.influx.getQueryApi(this.config.influxOrg);
    
    let fluxQuery = `from(bucket: "${this.config.influxBucket}")
      |> range(start: ${new Date(startTime).toISOString()}, stop: ${new Date(endTime).toISOString()})
      |> filter(fn: (r) => r._measurement == "${metricName}")`;

    if (tags) {
      Object.entries(tags).forEach(([key, value]) => {
        fluxQuery += `\n  |> filter(fn: (r) => r.${key} == "${value}")`;
      });
    }

    fluxQuery += '\n  |> aggregateWindow(every: 1m, fn: mean)';

    try {
      const results: MetricDataPoint[] = [];
      for await (const row of queryApi.queryRows(fluxQuery)) {
        results.push({
          timestamp: new Date(row.getTime()).getTime(),
          value: row.getValue(),
          tags: this.extractTags(row)
        });
      }
      return results;
    } catch (error) {
      logger.error('Failed to query metrics history', { metricName, startTime, endTime }, error as Error);
      throw error;
    }
  }

  private bufferMetric(
    name: string,
    value: number,
    tags: Record<string, string>
  ): void {
    const key = this.getMetricKey(name, tags);
    if (!this.metricsBuffer.has(key)) {
      this.metricsBuffer.set(key, []);
    }
    
    this.metricsBuffer.get(key)!.push({
      timestamp: Date.now(),
      value,
      tags
    });
  }

  private async flushMetricsBuffer(): Promise<void> {
    if (this.metricsBuffer.size === 0) return;

    const writeApi = this.influx.getWriteApi(
      this.config.influxOrg,
      this.config.influxBucket
    );

    try {
      for (const [key, points] of this.metricsBuffer.entries()) {
        const [name] = key.split('|');
        
        points.forEach(point => {
          const influxPoint = new Point(name)
            .timestamp(new Date(point.timestamp))
            .floatField('value', point.value);
          
          // Add tags
          Object.entries(point.tags).forEach(([key, value]) => {
            influxPoint.tag(key, value);
          });

          writeApi.writePoint(influxPoint);
        });
      }

      await writeApi.close();
      this.metricsBuffer.clear();
      
      logger.debug('Successfully flushed metrics buffer');
    } catch (error) {
      logger.error('Failed to flush metrics buffer', {}, error as Error);
      throw error;
    }
  }

  private shouldFlushBuffer(): boolean {
    let totalPoints = 0;
    for (const points of this.metricsBuffer.values()) {
      totalPoints += points.length;
      if (totalPoints >= this.BUFFER_SIZE_LIMIT) {
        return true;
      }
    }
    return false;
  }

  private getMetricKey(name: string, tags: Record<string, string>): string {
    const sortedTags = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}|${sortedTags}`;
  }

  private countVulnerabilities(vulnerabilities: SecurityMeasurements['vulnerabilities']): Record<string, number> {
    return vulnerabilities.reduce((acc, vuln) => {
      acc[vuln.severity] = (acc[vuln.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private extractTags(row: any): Record<string, string> {
    const tags: Record<string, string> = {};
    Object.entries(row).forEach(([key, value]) => {
      if (typeof value === 'string' && !key.startsWith('_')) {
        tags[key] = value;
      }
    });
    return tags;
  }
} 