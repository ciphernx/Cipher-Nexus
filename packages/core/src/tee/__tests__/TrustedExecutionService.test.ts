import { TrustedExecutionService } from '../TrustedExecutionService';
import { 
  TEEConfig, 
  TEESecurityLevel,
  TEERequest,
  TEEMetrics
} from '../types';

describe('TrustedExecutionService', () => {
  let service: TrustedExecutionService;
  let config: TEEConfig;

  beforeEach(() => {
    config = {
      securityLevel: TEESecurityLevel.BASIC,
      memoryLimit: 1024,
      timeLimit: 60,
      enableRemoteAttestation: true,
      trustedServices: ['service1', 'service2']
    };
    service = new TrustedExecutionService(config);
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Operation Execution', () => {
    it('should execute operation successfully', async () => {
      const request: TEERequest<number[]> = {
        operation: 'test',
        input: [1, 2, 3]
      };

      const result = await service.execute(request);
      
      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
    });

    it('should handle operation errors', async () => {
      const request: TEERequest<number[]> = {
        operation: 'invalid',
        input: [1, 2, 3]
      };

      await expect(service.execute(request)).rejects.toThrow();
    });

    it('should emit error events', (done) => {
      const request: TEERequest<number[]> = {
        operation: 'invalid',
        input: [1, 2, 3]
      };

      service.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      service.execute(request).catch(() => {});
    });
  });

  describe('Resource Management', () => {
    it('should get global metrics', async () => {
      const metrics = await service.getMetrics();
      
      expect(metrics.cpuUsage).toBeDefined();
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.activeOperations).toBeDefined();
      expect(metrics.queuedOperations).toBeDefined();
      expect(metrics.lastMeasurement).toBeDefined();
    });

    it('should get context-specific metrics', async () => {
      const request: TEERequest<number[]> = {
        operation: 'test',
        input: [1, 2, 3]
      };

      const result = await service.execute(request);
      const contextId = result.metrics?.contextId;
      
      if (contextId) {
        const metrics = await service.getMetrics(contextId);
        expect(metrics).toBeDefined();
      }
    });

    it('should cache metrics', async () => {
      const metrics1 = await service.getMetrics();
      const metrics2 = await service.getMetrics();
      
      expect(metrics1).toEqual(metrics2);
    });

    it('should emit metrics events', (done) => {
      service.on('metrics', (metrics: TEEMetrics) => {
        expect(metrics).toBeDefined();
        expect(metrics.cpuUsage).toBeDefined();
        expect(metrics.memoryUsage).toBeDefined();
        done();
      });
    });
  });

  describe('Memory Management', () => {
    it('should handle memory pressure', (done) => {
      service.on('memory-pressure', () => {
        done();
      });

      // Simulate memory pressure by filling cache
      const metrics: TEEMetrics = {
        cpuUsage: 0,
        memoryUsage: 0,
        activeOperations: 0,
        queuedOperations: 0,
        lastMeasurement: Date.now()
      };

      for (let i = 0; i < 2000; i++) {
        service['resourceCache'].set(`key${i}`, metrics);
      }
    });

    it('should reject operations when resources are exhausted', async () => {
      // Mock high CPU usage
      jest.spyOn(process, 'cpuUsage').mockReturnValue({
        user: 900000000,
        system: 100000000
      });

      const request: TEERequest<number[]> = {
        operation: 'test',
        input: [1, 2, 3]
      };

      await expect(service.execute(request))
        .rejects.toThrow('CPU usage too high');
    });
  });

  describe('Security Measurements', () => {
    it('should get security measurements', async () => {
      const request: TEERequest<number[]> = {
        operation: 'test',
        input: [1, 2, 3]
      };

      const result = await service.execute(request);
      const contextId = result.metrics?.contextId;
      
      if (contextId) {
        const measurements = await service.getMeasurements(contextId);
        expect(measurements.integrityHash).toBeDefined();
        expect(measurements.securityScore).toBeGreaterThan(0);
      }
    });

    it('should throw error for invalid context', async () => {
      await expect(service.getMeasurements('invalid-id'))
        .rejects.toThrow();
    });
  });

  describe('Service Lifecycle', () => {
    it('should start monitoring on initialization', () => {
      expect(service['monitoringInterval']).toBeDefined();
    });

    it('should stop monitoring on shutdown', async () => {
      await service.shutdown();
      expect(service['monitoringInterval']).toBeNull();
    });

    it('should cleanup resources on shutdown', async () => {
      const request: TEERequest<number[]> = {
        operation: 'test',
        input: [1, 2, 3]
      };

      await service.execute(request);
      await service.shutdown();

      // Try to execute after shutdown
      await expect(service.execute(request))
        .rejects.toThrow();
    });
  });
}); 