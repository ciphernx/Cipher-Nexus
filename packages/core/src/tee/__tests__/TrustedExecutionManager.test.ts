import { TrustedExecutionManager } from '../TrustedExecutionManager';
import { 
  TEEConfig, 
  TEESecurityLevel,
  TEERequest,
  TEEContext
} from '../types';

describe('TrustedExecutionManager', () => {
  let manager: TrustedExecutionManager;
  let config: TEEConfig;

  beforeEach(() => {
    config = {
      securityLevel: TEESecurityLevel.BASIC,
      memoryLimit: 1024,
      timeLimit: 60,
      enableRemoteAttestation: true,
      trustedServices: ['service1', 'service2']
    };
    manager = new TrustedExecutionManager(config);
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  describe('Context Management', () => {
    it('should create new context', async () => {
      const context = await manager.createContext();
      
      expect(context).toBeDefined();
      expect(context.id).toBeDefined();
      expect(context.securityLevel).toBe(config.securityLevel);
      expect(context.attestation).toBeDefined();
    });

    it('should generate valid attestation', async () => {
      const attestation = await manager.generateAttestation();
      
      expect(attestation.timestamp).toBeDefined();
      expect(attestation.enclave).toBeDefined();
      expect(attestation.platform).toBeDefined();
      expect(attestation.signature).toBeDefined();
    });

    it('should verify valid attestation', async () => {
      const attestation = await manager.generateAttestation();
      const isValid = await manager.verifyAttestation(attestation);
      
      expect(isValid).toBe(true);
    });

    it('should reject expired attestation', async () => {
      const attestation = await manager.generateAttestation();
      attestation.timestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      
      const isValid = await manager.verifyAttestation(attestation);
      expect(isValid).toBe(false);
    });
  });

  describe('Operation Execution', () => {
    it('should execute operation in TEE', async () => {
      const request: TEERequest<number[]> = {
        operation: 'test',
        input: [1, 2, 3]
      };

      const result = await manager.execute(request);
      
      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
    });

    it('should handle operation errors', async () => {
      const request: TEERequest<number[]> = {
        operation: 'invalid',
        input: [1, 2, 3]
      };

      const result = await manager.execute(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it('should reuse existing context', async () => {
      const context = await manager.createContext();
      const request: TEERequest<number[]> = {
        operation: 'test',
        input: [1, 2, 3],
        context
      };

      const result = await manager.execute(request);
      
      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
    });
  });

  describe('Security Measurements', () => {
    let context: TEEContext;

    beforeEach(async () => {
      context = await manager.createContext();
    });

    it('should get security measurements', async () => {
      const measurements = await manager.getMeasurements(context.id);
      
      expect(measurements.integrityHash).toBeDefined();
      expect(measurements.securityScore).toBeGreaterThan(0);
      expect(measurements.vulnerabilities).toBeDefined();
    });

    it('should throw error for invalid context', async () => {
      await expect(manager.getMeasurements('invalid-id'))
        .rejects.toThrow('Context not found');
    });
  });

  describe('Configuration Validation', () => {
    it('should reject invalid security level', () => {
      const invalidConfig = {
        ...config,
        securityLevel: 'invalid' as TEESecurityLevel
      };

      expect(() => new TrustedExecutionManager(invalidConfig))
        .toThrow('Security level is required');
    });

    it('should reject invalid memory limit', () => {
      const invalidConfig = {
        ...config,
        memoryLimit: -1
      };

      expect(() => new TrustedExecutionManager(invalidConfig))
        .toThrow('Invalid memory limit');
    });

    it('should reject invalid time limit', () => {
      const invalidConfig = {
        ...config,
        timeLimit: 0
      };

      expect(() => new TrustedExecutionManager(invalidConfig))
        .toThrow('Invalid time limit');
    });
  });
}); 