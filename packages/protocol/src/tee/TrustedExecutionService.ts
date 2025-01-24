import { TrustedExecutionManager } from './TrustedExecutionManager';
import { EventEmitter } from 'events';

interface TEEStats {
  totalEnclaves: number;
  activeEnclaves: number;
  resourceUsage: {
    totalMemory: number;
    usedMemory: number;
    cpuUsage: number;
  };
  securityMetrics: {
    attestationSuccess: number;
    attestationFailure: number;
    integrityViolations: number;
  };
}

interface ExecutionResult {
  success: boolean;
  output: any;
  metrics: {
    executionTime: number;
    memoryUsed: number;
    cpuUsed: number;
  };
  attestation: {
    report: string;
    signature: string;
  };
}

export class TrustedExecutionService extends EventEmitter {
  private manager: TrustedExecutionManager;
  private stats: TEEStats;

  constructor() {
    super();
    this.manager = new TrustedExecutionManager();
    this.stats = this.initializeStats();
    this.setupEventHandlers();
  }

  async createEnclave(
    type: 'sgx' | 'trustzone' | 'cxl',
    memorySize: number,
    threadCount: number,
    securityLevel: 'high' | 'medium' | 'low'
  ): Promise<string> {
    try {
      const enclaveId = await this.manager.initializeEnclave({
        type,
        memorySize,
        threadCount,
        securityLevel
      });

      await this.manager.startEnclave(enclaveId);

      // Verify enclave
      const attestation = await this.manager.verifyAttestation(enclaveId);
      if (!attestation.isValid) {
        await this.manager.stopEnclave(enclaveId);
        throw new Error('Enclave attestation failed');
      }

      this.updateStats('create');
      return enclaveId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async executeCode(
    enclaveId: string,
    code: string,
    input: any
  ): Promise<ExecutionResult> {
    try {
      const startTime = Date.now();

      // Execute code
      const output = await this.manager.executeInEnclave(enclaveId, code, input);

      // Get enclave state after execution
      const state = await this.manager.getEnclaveState(enclaveId);
      if (!state) {
        throw new Error('Failed to get enclave state');
      }

      // Generate execution result
      const result: ExecutionResult = {
        success: true,
        output,
        metrics: {
          executionTime: Date.now() - startTime,
          memoryUsed: state.resources.memoryUsed,
          cpuUsed: state.resources.cpuUsage
        },
        attestation: {
          report: state.attestationReport || '',
          signature: await this.signExecutionResult(output)
        }
      };

      this.emit('executionCompleted', {
        enclaveId,
        result
      });

      return result;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async destroyEnclave(enclaveId: string): Promise<void> {
    try {
      await this.manager.stopEnclave(enclaveId);
      this.updateStats('destroy');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getStats(): Promise<TEEStats> {
    return this.stats;
  }

  private initializeStats(): TEEStats {
    return {
      totalEnclaves: 0,
      activeEnclaves: 0,
      resourceUsage: {
        totalMemory: 0,
        usedMemory: 0,
        cpuUsage: 0
      },
      securityMetrics: {
        attestationSuccess: 0,
        attestationFailure: 0,
        integrityViolations: 0
      }
    };
  }

  private updateStats(action: 'create' | 'destroy' | 'attestation' | 'violation'): void {
    switch (action) {
      case 'create':
        this.stats.totalEnclaves++;
        this.stats.activeEnclaves++;
        break;
      case 'destroy':
        this.stats.activeEnclaves--;
        break;
      case 'attestation':
        this.stats.securityMetrics.attestationSuccess++;
        break;
      case 'violation':
        this.stats.securityMetrics.integrityViolations++;
        break;
    }

    this.emit('statsUpdated', this.stats);
  }

  private async signExecutionResult(result: any): Promise<string> {
    // In actual implementation, TEE's key should be used for signing here
    const { createHash } = await import('crypto');
    const hash = createHash('sha256');
    hash.update(JSON.stringify(result));
    return hash.digest('hex');
  }

  private setupEventHandlers(): void {
    this.manager.on('enclaveInitialized', (event) => {
      this.emit('enclaveCreated', event);
    });

    this.manager.on('enclaveStarted', (event) => {
      this.emit('enclaveStarted', event);
    });

    this.manager.on('enclaveStopped', (event) => {
      this.emit('enclaveStopped', event);
    });

    this.manager.on('attestationVerified', (event) => {
      if (event.result.isValid) {
        this.updateStats('attestation');
      } else {
        this.stats.securityMetrics.attestationFailure++;
      }
      this.emit('attestationVerified', event);
    });

    this.manager.on('error', (error) => {
      this.emit('error', error);
    });
  }
} 