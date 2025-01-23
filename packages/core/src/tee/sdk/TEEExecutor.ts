import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';

export enum TEEPlatform {
  INTEL_SGX = 'INTEL_SGX',
  ARM_TRUSTZONE = 'ARM_TRUSTZONE',
  AMD_SEV = 'AMD_SEV'
}

export interface TEEConfig {
  platform: TEEPlatform;
  securityLevel: 'high' | 'medium' | 'low';
  enclaveHeapSize: number;
  enclaveStackSize: number;
  maxThreads: number;
  // TrustZone specific
  worldSize?: number;
  sharedMemSize?: number;
  maxSessions?: number;
  // SGX specific
  spid?: string;
  attestationKey?: string;
  quotingType?: string;
  // Common measurement config
  measurementPolicy: {
    required: boolean;
    verifyBefore: boolean;
    trustedHashes?: string[];
    minimumSecurityLevel?: string;
  };
}

export interface ExecutionContext {
  id: string;
  code: Buffer;
  input: Buffer;
  timeoutMs?: number;
  securityLevel?: string;
  measurementRequired?: boolean;
  attestationRequired?: boolean;
}

export interface MeasurementResult {
  hash: Buffer;
  signature: Buffer;
  timestamp: number;
  platform: TEEPlatform;
}

export interface AttestationReport {
  measurements: MeasurementResult[];
  platformInfo: Record<string, any>;
  timestamp: number;
  signature: Buffer;
}

export class TEEExecutor extends EventEmitter {
  private readonly config: TEEConfig;
  private readonly platforms: Map<TEEPlatform, any>;

  constructor(config: TEEConfig) {
    super();
    this.config = config;
    this.platforms = new Map();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize platform based on config
      switch (this.config.platform) {
        case TEEPlatform.INTEL_SGX:
          const { SGXPlatform } = await import('./platforms/SGXPlatform');
          this.platforms.set(
            TEEPlatform.INTEL_SGX,
            new SGXPlatform(this.config)
          );
          break;
        case TEEPlatform.ARM_TRUSTZONE:
          const { TrustZonePlatform } = await import('./platforms/TrustZonePlatform');
          this.platforms.set(
            TEEPlatform.ARM_TRUSTZONE,
            new TrustZonePlatform(this.config)
          );
          break;
        case TEEPlatform.AMD_SEV:
          // TODO: Add AMD SEV platform support
          throw new Error('AMD SEV platform not yet supported');
        default:
          throw new Error(`Unsupported TEE platform: ${this.config.platform}`);
      }

      logger.info('TEE executor initialized', {
        platform: this.config.platform,
        securityLevel: this.config.securityLevel
      });
    } catch (error) {
      logger.error('Failed to initialize TEE executor', {}, error as Error);
      throw error;
    }
  }

  async executeSecure(context: ExecutionContext): Promise<Buffer> {
    try {
      const platform = this.platforms.get(this.config.platform);
      if (!platform) {
        throw new Error('TEE platform not initialized');
      }

      // Measure code if required
      if (this.config.measurementPolicy.required || context.measurementRequired) {
        const measurement = await platform.measureCode(context.code);
        
        // Verify measurement if required
        if (this.config.measurementPolicy.verifyBefore) {
          const isValid = await platform.verifyMeasurement(measurement);
          if (!isValid) {
            throw new Error('Code measurement verification failed');
          }
        }
      }

      // Create secure execution environment
      const secureEnv = await platform.createSecureWorld(context);

      // Execute code
      const result = await platform.executeInSecureWorld(
        secureEnv,
        context
      );

      // Generate attestation if required
      if (context.attestationRequired) {
        const attestation = await platform.generateAttestationReport();
        this.emit('attestation', attestation);
      }

      return result;
    } catch (error) {
      logger.error('Secure execution failed', {
        contextId: context.id
      }, error as Error);
      throw error;
    }
  }

  async verifyAttestation(report: AttestationReport): Promise<boolean> {
    try {
      const platform = this.platforms.get(this.config.platform);
      if (!platform) {
        throw new Error('TEE platform not initialized');
      }

      return await platform.verifyAttestationReport(report);
    } catch (error) {
      logger.error('Attestation verification failed', {}, error as Error);
      throw error;
    }
  }

  shutdown(): void {
    try {
      // Shutdown all platforms
      for (const platform of this.platforms.values()) {
        platform.shutdown();
      }

      this.platforms.clear();
      logger.info('TEE executor shutdown complete');
    } catch (error) {
      logger.error('TEE executor shutdown failed', {}, error as Error);
    }
  }
} 