import {
  PerformanceMonitor,
  MetricType,
  Metric,
  AlertThreshold
} from '../monitoring/PerformanceMonitor';

describe('Performance Monitor Tests', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('Metric Recording', () => {
    test('should record and retrieve metrics', () => {
      const metric: Metric = {
        type: MetricType.LATENCY,
        value: 100,
        timestamp: Date.now(),
        labels: { operation: 'test' }
      };

      monitor.recordMetric(metric);
      const stats = monitor.getStats(MetricType.LATENCY);

      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(1);
      expect(stats!.min).toBe(100);
      expect(stats!.max).toBe(100);
      expect(stats!.mean).toBe(100);
    });

    test('should calculate statistics correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const now = Date.now();

      values.forEach(value => {
        monitor.recordMetric({
          type: MetricType.THROUGHPUT,
          value,
          timestamp: now,
          labels: {}
        });
      });

      const stats = monitor.getStats(MetricType.THROUGHPUT)!;
      expect(stats.count).toBe(10);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(10);
      expect(stats.mean).toBe(5.5);
      expect(stats.median).toBe(5.5);
      expect(stats.percentile95).toBe(10);
      expect(stats.stdDev).toBeCloseTo(2.872, 3);
    });
  });

  describe('Alert Thresholds', () => {
    test('should trigger alerts when threshold is exceeded', () => {
      const threshold: AlertThreshold = {
        metric: MetricType.ERROR_RATE,
        operator: '>',
        value: 5
      };

      const alertHandler = jest.fn();
      monitor.on('alert', alertHandler);

      monitor.addThreshold(threshold);

      // Should not trigger alert
      monitor.recordMetric({
        type: MetricType.ERROR_RATE,
        value: 3,
        timestamp: Date.now(),
        labels: {}
      });

      expect(alertHandler).not.toHaveBeenCalled();

      // Should trigger alert
      monitor.recordMetric({
        type: MetricType.ERROR_RATE,
        value: 7,
        timestamp: Date.now(),
        labels: {}
      });

      expect(alertHandler).toHaveBeenCalledTimes(1);
    });

    test('should handle duration-based alerts', () => {
      jest.useFakeTimers();

      const threshold: AlertThreshold = {
        metric: MetricType.CPU_USAGE,
        operator: '>=',
        value: 90,
        duration: 5000 // 5 seconds
      };

      const alertHandler = jest.fn();
      monitor.on('alert', alertHandler);

      monitor.addThreshold(threshold);

      // Record high CPU usage
      monitor.recordMetric({
        type: MetricType.CPU_USAGE,
        value: 95,
        timestamp: Date.now(),
        labels: {}
      });

      // Should not trigger alert immediately
      expect(alertHandler).not.toHaveBeenCalled();

      // Advance time by 3 seconds
      jest.advanceTimersByTime(3000);

      // Still high CPU usage
      monitor.recordMetric({
        type: MetricType.CPU_USAGE,
        value: 95,
        timestamp: Date.now(),
        labels: {}
      });

      // Should not trigger alert yet
      expect(alertHandler).not.toHaveBeenCalled();

      // Advance time by 3 more seconds
      jest.advanceTimersByTime(3000);

      // Still high CPU usage
      monitor.recordMetric({
        type: MetricType.CPU_USAGE,
        value: 95,
        timestamp: Date.now(),
        labels: {}
      });

      // Should trigger alert now
      expect(alertHandler).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    test('should emit recovery events', () => {
      const threshold: AlertThreshold = {
        metric: MetricType.MEMORY_USAGE,
        operator: '>',
        value: 80
      };

      const alertHandler = jest.fn();
      const recoveryHandler = jest.fn();

      monitor.on('alert', alertHandler);
      monitor.on('recovery', recoveryHandler);

      monitor.addThreshold(threshold);

      // Trigger alert
      monitor.recordMetric({
        type: MetricType.MEMORY_USAGE,
        value: 85,
        timestamp: Date.now(),
        labels: {}
      });

      expect(alertHandler).toHaveBeenCalledTimes(1);
      expect(recoveryHandler).not.toHaveBeenCalled();

      // Trigger recovery
      monitor.recordMetric({
        type: MetricType.MEMORY_USAGE,
        value: 75,
        timestamp: Date.now(),
        labels: {}
      });

      expect(alertHandler).toHaveBeenCalledTimes(1);
      expect(recoveryHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Metric Management', () => {
    test('should clear old metrics', () => {
      const now = Date.now();
      
      // Add old metric
      monitor.recordMetric({
        type: MetricType.LATENCY,
        value: 100,
        timestamp: now - 10000,
        labels: {}
      });

      // Add recent metric
      monitor.recordMetric({
        type: MetricType.LATENCY,
        value: 200,
        timestamp: now,
        labels: {}
      });

      monitor.clearOldMetrics(5000); // Clear metrics older than 5 seconds

      const stats = monitor.getStats(MetricType.LATENCY)!;
      expect(stats.count).toBe(1);
      expect(stats.mean).toBe(200);
    });

    test('should generate performance report', () => {
      const metrics = [
        { type: MetricType.LATENCY, value: 100 },
        { type: MetricType.LATENCY, value: 200 },
        { type: MetricType.ERROR_RATE, value: 5 }
      ];

      metrics.forEach(m => monitor.recordMetric({
        ...m,
        timestamp: Date.now(),
        labels: {}
      }));

      const report = monitor.generateReport(60000); // Last minute

      expect(report).toHaveProperty(MetricType.LATENCY);
      expect(report).toHaveProperty(MetricType.ERROR_RATE);
      expect(report[MetricType.LATENCY].mean).toBe(150);
      expect(report[MetricType.ERROR_RATE].mean).toBe(5);
    });
  });

  describe('Label Handling', () => {
    test('should handle metrics with different labels separately', () => {
      monitor.recordMetric({
        type: MetricType.LATENCY,
        value: 100,
        timestamp: Date.now(),
        labels: { service: 'A' }
      });

      monitor.recordMetric({
        type: MetricType.LATENCY,
        value: 200,
        timestamp: Date.now(),
        labels: { service: 'B' }
      });

      const statsA = monitor.getStats(MetricType.LATENCY, { service: 'A' })!;
      const statsB = monitor.getStats(MetricType.LATENCY, { service: 'B' })!;

      expect(statsA.mean).toBe(100);
      expect(statsB.mean).toBe(200);
    });

    test('should match alert thresholds with labels', () => {
      const threshold: AlertThreshold = {
        metric: MetricType.ERROR_RATE,
        operator: '>',
        value: 5,
        labels: { service: 'critical' }
      };

      const alertHandler = jest.fn();
      monitor.on('alert', alertHandler);
      monitor.addThreshold(threshold);

      // Should not trigger alert (different service)
      monitor.recordMetric({
        type: MetricType.ERROR_RATE,
        value: 10,
        timestamp: Date.now(),
        labels: { service: 'non-critical' }
      });

      expect(alertHandler).not.toHaveBeenCalled();

      // Should trigger alert (matching service)
      monitor.recordMetric({
        type: MetricType.ERROR_RATE,
        value: 10,
        timestamp: Date.now(),
        labels: { service: 'critical' }
      });

      expect(alertHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Statistical Edge Cases', () => {
    test('should handle single value metrics', () => {
      monitor.recordMetric({
        type: MetricType.LATENCY,
        value: 100,
        timestamp: Date.now(),
        labels: {}
      });

      const stats = monitor.getStats(MetricType.LATENCY)!;
      expect(stats.count).toBe(1);
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(100);
      expect(stats.mean).toBe(100);
      expect(stats.median).toBe(100);
      expect(stats.stdDev).toBe(0);
    });

    test('should handle zero values', () => {
      monitor.recordMetric({
        type: MetricType.ERROR_RATE,
        value: 0,
        timestamp: Date.now(),
        labels: {}
      });

      const stats = monitor.getStats(MetricType.ERROR_RATE)!;
      expect(stats.count).toBe(1);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.mean).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.stdDev).toBe(0);
    });

    test('should handle negative values', () => {
      const values = [-10, -5, 0, 5, 10];
      values.forEach(value => {
        monitor.recordMetric({
          type: MetricType.THROUGHPUT,
          value,
          timestamp: Date.now(),
          labels: {}
        });
      });

      const stats = monitor.getStats(MetricType.THROUGHPUT)!;
      expect(stats.min).toBe(-10);
      expect(stats.max).toBe(10);
      expect(stats.mean).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.stdDev).toBeCloseTo(7.071, 3);
    });
  });

  describe('Metric Filtering and Querying', () => {
    test('should filter metrics by time range', () => {
      const now = Date.now();
      const metrics = [
        { timestamp: now - 10000, value: 100 },
        { timestamp: now - 5000, value: 200 },
        { timestamp: now, value: 300 }
      ];

      metrics.forEach(m => {
        monitor.recordMetric({
          type: MetricType.LATENCY,
          value: m.value,
          timestamp: m.timestamp,
          labels: {}
        });
      });

      const recentMetrics = monitor.getRecentMetrics(MetricType.LATENCY, {}, 7000);
      expect(recentMetrics).toHaveLength(2);
      expect(recentMetrics[0].value).toBe(200);
      expect(recentMetrics[1].value).toBe(300);
    });

    test('should filter metrics by multiple labels', () => {
      const metrics = [
        { service: 'A', region: 'us', value: 100 },
        { service: 'A', region: 'eu', value: 200 },
        { service: 'B', region: 'us', value: 300 }
      ];

      metrics.forEach(m => {
        monitor.recordMetric({
          type: MetricType.LATENCY,
          value: m.value,
          timestamp: Date.now(),
          labels: { service: m.service, region: m.region }
        });
      });

      const statsA_US = monitor.getStats(MetricType.LATENCY, { service: 'A', region: 'us' })!;
      expect(statsA_US.mean).toBe(100);

      const statsA_EU = monitor.getStats(MetricType.LATENCY, { service: 'A', region: 'eu' })!;
      expect(statsA_EU.mean).toBe(200);
    });
  });

  describe('Complex Alert Scenarios', () => {
    test('should handle multiple thresholds for same metric', () => {
      const warningThreshold: AlertThreshold = {
        metric: MetricType.CPU_USAGE,
        operator: '>',
        value: 70
      };

      const criticalThreshold: AlertThreshold = {
        metric: MetricType.CPU_USAGE,
        operator: '>',
        value: 90
      };

      const warningHandler = jest.fn();
      const criticalHandler = jest.fn();

      monitor.on('alert', (event) => {
        if (event.threshold.value === 70) warningHandler();
        if (event.threshold.value === 90) criticalHandler();
      });

      monitor.addThreshold(warningThreshold);
      monitor.addThreshold(criticalThreshold);

      // Should trigger warning only
      monitor.recordMetric({
        type: MetricType.CPU_USAGE,
        value: 80,
        timestamp: Date.now(),
        labels: {}
      });

      expect(warningHandler).toHaveBeenCalledTimes(1);
      expect(criticalHandler).not.toHaveBeenCalled();

      // Should trigger both
      monitor.recordMetric({
        type: MetricType.CPU_USAGE,
        value: 95,
        timestamp: Date.now(),
        labels: {}
      });

      expect(warningHandler).toHaveBeenCalledTimes(1); // Still 1 because already in warning state
      expect(criticalHandler).toHaveBeenCalledTimes(1);
    });

    test('should handle alert recovery order correctly', () => {
      const threshold: AlertThreshold = {
        metric: MetricType.MEMORY_USAGE,
        operator: '>',
        value: 80
      };

      const events: string[] = [];
      monitor.on('alert', () => events.push('alert'));
      monitor.on('recovery', () => events.push('recovery'));

      monitor.addThreshold(threshold);

      // Trigger alert
      monitor.recordMetric({
        type: MetricType.MEMORY_USAGE,
        value: 85,
        timestamp: Date.now(),
        labels: {}
      });

      // Multiple high values shouldn't trigger multiple alerts
      monitor.recordMetric({
        type: MetricType.MEMORY_USAGE,
        value: 90,
        timestamp: Date.now(),
        labels: {}
      });

      // Recovery
      monitor.recordMetric({
        type: MetricType.MEMORY_USAGE,
        value: 75,
        timestamp: Date.now(),
        labels: {}
      });

      expect(events).toEqual(['alert', 'recovery']);
    });
  });

  describe('Performance Report Generation', () => {
    test('should generate detailed report with all metrics', () => {
      const metricTypes = [
        MetricType.LATENCY,
        MetricType.THROUGHPUT,
        MetricType.ERROR_RATE,
        MetricType.CPU_USAGE,
        MetricType.MEMORY_USAGE
      ];

      // Record some metrics for each type
      metricTypes.forEach(type => {
        [10, 20, 30].forEach(value => {
          monitor.recordMetric({
            type,
            value,
            timestamp: Date.now(),
            labels: {}
          });
        });
      });

      const report = monitor.generateReport(60000);

      metricTypes.forEach(type => {
        expect(report).toHaveProperty(type);
        expect(report[type].count).toBe(3);
        expect(report[type].mean).toBe(20);
        expect(report[type].min).toBe(10);
        expect(report[type].max).toBe(30);
      });
    });

    test('should handle empty metrics in report', () => {
      const report = monitor.generateReport(60000);
      expect(Object.keys(report)).toHaveLength(0);
    });

    test('should generate report with specific time window', () => {
      const now = Date.now();
      
      // Add old metrics
      monitor.recordMetric({
        type: MetricType.LATENCY,
        value: 100,
        timestamp: now - 10000,
        labels: {}
      });

      // Add recent metrics
      monitor.recordMetric({
        type: MetricType.LATENCY,
        value: 200,
        timestamp: now,
        labels: {}
      });

      const report = monitor.generateReport(5000); // Last 5 seconds
      expect(report[MetricType.LATENCY].count).toBe(1);
      expect(report[MetricType.LATENCY].mean).toBe(200);
    });
  });

  describe('Advanced Metric Aggregation', () => {
    test('should calculate moving averages', () => {
      const now = Date.now();
      const values = [10, 20, 30, 40, 50];
      
      values.forEach((value, index) => {
        monitor.recordMetric({
          type: MetricType.LATENCY,
          value,
          timestamp: now + index * 1000, // 1 second intervals
          labels: {}
        });
      });

      // 3-point moving average
      const movingAvgs = monitor.calculateMovingAverage(MetricType.LATENCY, 3);
      expect(movingAvgs).toHaveLength(3);
      expect(movingAvgs[0].value).toBe(20); // (10 + 20 + 30) / 3
      expect(movingAvgs[1].value).toBe(30); // (20 + 30 + 40) / 3
      expect(movingAvgs[2].value).toBe(40); // (30 + 40 + 50) / 3
    });

    test('should calculate rate of change', () => {
      const now = Date.now();
      
      // Record increasing error rates
      [1, 3, 7, 15].forEach((value, index) => {
        monitor.recordMetric({
          type: MetricType.ERROR_RATE,
          value,
          timestamp: now + index * 1000,
          labels: {}
        });
      });

      const rateOfChange = monitor.calculateRateOfChange(MetricType.ERROR_RATE, 2000); // 2 second window
      expect(rateOfChange).toBe(6); // (15 - 3) / 2 = 6 errors/second
    });

    test('should aggregate metrics across different dimensions', () => {
      const metrics = [
        { service: 'A', region: 'us', value: 100 },
        { service: 'A', region: 'eu', value: 200 },
        { service: 'B', region: 'us', value: 300 },
        { service: 'B', region: 'eu', value: 400 }
      ];

      metrics.forEach(m => {
        monitor.recordMetric({
          type: MetricType.LATENCY,
          value: m.value,
          timestamp: Date.now(),
          labels: { service: m.service, region: m.region }
        });
      });

      // Aggregate by service
      const serviceStats = monitor.aggregateByDimension(MetricType.LATENCY, 'service');
      expect(serviceStats.get('A')!.mean).toBe(150); // (100 + 200) / 2
      expect(serviceStats.get('B')!.mean).toBe(350); // (300 + 400) / 2

      // Aggregate by region
      const regionStats = monitor.aggregateByDimension(MetricType.LATENCY, 'region');
      expect(regionStats.get('us')!.mean).toBe(200); // (100 + 300) / 2
      expect(regionStats.get('eu')!.mean).toBe(300); // (200 + 400) / 2
    });
  });

  describe('Complex Label Matching', () => {
    test('should support wildcard label matching', () => {
      const threshold: AlertThreshold = {
        metric: MetricType.ERROR_RATE,
        operator: '>',
        value: 5,
        labels: { service: '*-api', environment: 'prod' }
      };

      monitor.addThreshold(threshold);
      const alertHandler = jest.fn();
      monitor.on('alert', alertHandler);

      // Should match
      monitor.recordMetric({
        type: MetricType.ERROR_RATE,
        value: 10,
        timestamp: Date.now(),
        labels: { service: 'user-api', environment: 'prod' }
      });

      // Should not match
      monitor.recordMetric({
        type: MetricType.ERROR_RATE,
        value: 10,
        timestamp: Date.now(),
        labels: { service: 'user-api', environment: 'dev' }
      });

      expect(alertHandler).toHaveBeenCalledTimes(1);
    });

    test('should support regex label matching', () => {
      const threshold: AlertThreshold = {
        metric: MetricType.LATENCY,
        operator: '>',
        value: 1000,
        labels: { service: /^(user|auth)-service$/ }
      };

      monitor.addThreshold(threshold);
      const alertHandler = jest.fn();
      monitor.on('alert', alertHandler);

      // Should match
      monitor.recordMetric({
        type: MetricType.LATENCY,
        value: 1500,
        timestamp: Date.now(),
        labels: { service: 'user-service' }
      });

      // Should not match
      monitor.recordMetric({
        type: MetricType.LATENCY,
        value: 1500,
        timestamp: Date.now(),
        labels: { service: 'payment-service' }
      });

      expect(alertHandler).toHaveBeenCalledTimes(1);
    });

    test('should support hierarchical label matching', () => {
      const metrics = [
        { path: '/api/v1/users', value: 100 },
        { path: '/api/v1/auth', value: 200 },
        { path: '/api/v2/users', value: 300 }
      ];

      metrics.forEach(m => {
        monitor.recordMetric({
          type: MetricType.LATENCY,
          value: m.value,
          timestamp: Date.now(),
          labels: { path: m.path }
        });
      });

      const v1Stats = monitor.getStats(MetricType.LATENCY, { path: '/api/v1/*' })!;
      expect(v1Stats.mean).toBe(150); // (100 + 200) / 2

      const userStats = monitor.getStats(MetricType.LATENCY, { path: '*/users' })!;
      expect(userStats.mean).toBe(200); // (100 + 300) / 2
    });
  });

  describe('Advanced Alert Scenarios', () => {
    test('should support alert suppression during maintenance windows', () => {
      const threshold: AlertThreshold = {
        metric: MetricType.ERROR_RATE,
        operator: '>',
        value: 5,
        suppressDuring: {
          start: Date.now(),
          end: Date.now() + 3600000 // 1 hour
        }
      };

      monitor.addThreshold(threshold);
      const alertHandler = jest.fn();
      monitor.on('alert', alertHandler);

      monitor.recordMetric({
        type: MetricType.ERROR_RATE,
        value: 10,
        timestamp: Date.now(),
        labels: {}
      });

      expect(alertHandler).not.toHaveBeenCalled();
    });

    test('should handle alert flapping detection', () => {
      const threshold: AlertThreshold = {
        metric: MetricType.CPU_USAGE,
        operator: '>',
        value: 90,
        flappingWindow: 60000, // 1 minute
        flappingThreshold: 3 // Max state changes
      };

      monitor.addThreshold(threshold);
      const alertHandler = jest.fn();
      monitor.on('alert', alertHandler);

      // Simulate flapping
      [95, 85, 95, 85, 95].forEach(value => {
        monitor.recordMetric({
          type: MetricType.CPU_USAGE,
          value,
          timestamp: Date.now(),
          labels: {}
        });
      });

      expect(alertHandler).toHaveBeenCalledTimes(1); // Only first alert should be sent
    });

    test('should support composite alert conditions', () => {
      const threshold: AlertThreshold = {
        conditions: [
          {
            metric: MetricType.CPU_USAGE,
            operator: '>',
            value: 90
          },
          {
            metric: MetricType.MEMORY_USAGE,
            operator: '>',
            value: 85
          }
        ],
        operator: 'AND',
        duration: 5000 // Must be true for 5 seconds
      };

      monitor.addThreshold(threshold);
      const alertHandler = jest.fn();
      monitor.on('alert', alertHandler);

      // Record high CPU and memory usage
      monitor.recordMetric({
        type: MetricType.CPU_USAGE,
        value: 95,
        timestamp: Date.now(),
        labels: {}
      });

      monitor.recordMetric({
        type: MetricType.MEMORY_USAGE,
        value: 90,
        timestamp: Date.now(),
        labels: {}
      });

      expect(alertHandler).not.toHaveBeenCalled();

      // Advance time and record again
      jest.advanceTimersByTime(6000);
      
      monitor.recordMetric({
        type: MetricType.CPU_USAGE,
        value: 95,
        timestamp: Date.now(),
        labels: {}
      });

      monitor.recordMetric({
        type: MetricType.MEMORY_USAGE,
        value: 90,
        timestamp: Date.now(),
        labels: {}
      });

      expect(alertHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Report Formats', () => {
    test('should generate hierarchical reports', () => {
      const metrics = [
        { service: 'api', endpoint: '/users', value: 100 },
        { service: 'api', endpoint: '/auth', value: 200 },
        { service: 'web', endpoint: '/home', value: 300 }
      ];

      metrics.forEach(m => {
        monitor.recordMetric({
          type: MetricType.LATENCY,
          value: m.value,
          timestamp: Date.now(),
          labels: { service: m.service, endpoint: m.endpoint }
        });
      });

      const report = monitor.generateHierarchicalReport(['service', 'endpoint']);
      expect(report.api.mean).toBe(150);
      expect(report.api.endpoints['/users'].mean).toBe(100);
      expect(report.web.endpoints['/home'].mean).toBe(300);
    });

    test('should generate trend analysis report', () => {
      const now = Date.now();
      [10, 20, 30, 40, 50].forEach((value, index) => {
        monitor.recordMetric({
          type: MetricType.LATENCY,
          value,
          timestamp: now + index * 1000,
          labels: {}
        });
      });

      const trend = monitor.generateTrendReport(MetricType.LATENCY, {
        window: 5000,
        intervals: 5
      });

      expect(trend.slope).toBeGreaterThan(0);
      expect(trend.correlation).toBeCloseTo(1, 2);
      expect(trend.forecast[0]).toBeCloseTo(60, 1);
    });

    test('should generate percentile-based reports', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      values.forEach(value => {
        monitor.recordMetric({
          type: MetricType.LATENCY,
          value,
          timestamp: Date.now(),
          labels: {}
        });
      });

      const report = monitor.generatePercentileReport(MetricType.LATENCY, [50, 90, 95, 99]);
      expect(report.p50).toBe(50);
      expect(report.p90).toBe(90);
      expect(report.p95).toBe(95);
      expect(report.p99).toBe(99);
    });
  });
}); 