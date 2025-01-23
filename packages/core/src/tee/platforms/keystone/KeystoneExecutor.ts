import { 
  TEERequest,
  TEEContext,
  SecurityMeasurements,
  AttestationReport
} from '../../types';
import { createHash } from 'crypto';
import { KeystoneClient } from '@keystone-enclave/sdk';

export class KeystoneExecutor {
  private client: KeystoneClient;
  private initialized: boolean = false;
  private enclaveId: string | null = null;

  constructor() {
    this.client = new KeystoneClient();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize Keystone platform and verify security monitor
      await this.client.initialize({
        securityMonitorPath: process.env.KEYSTONE_SM_PATH || '/usr/keystone/security_monitor.bin',
        runtimePath: process.env.KEYSTONE_RUNTIME_PATH || '/usr/keystone/eyrie-rt'
      });

      // Create secure enclave
      this.enclaveId = await this.client.createEnclave({
        memorySize: 512 * 1024 * 1024, // 512 MB
        stackSize: 4 * 1024 * 1024,    // 4 MB
        measurementRequired: true
      });

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Keystone: ${error}`);
    }
  }

  async executeSecure<T, R>(request: TEERequest<T>, context: TEEContext): Promise<R> {
    if (!this.initialized || !this.enclaveId) {
      await this.initialize();
    }

    try {
      // Prepare input data
      const inputData = Buffer.from(JSON.stringify(request.input));

      // Execute operation in enclave
      const result = await this.client.executeInEnclave(
        this.enclaveId!,
        request.operation,
        inputData,
        {
          securityLevel: context.securityLevel,
          timeoutMs: 30000
        }
      );

      // Verify enclave measurement after execution
      const measurement = await this.client.getEnclaveMeasurement(this.enclaveId!);
      if (!await this.verifyMeasurement(measurement)) {
        throw new Error('Enclave measurement verification failed');
      }

      // Deserialize and return result
      return JSON.parse(result.toString()) as R;
    } catch (error) {
      throw new Error(`Keystone execution failed: ${error}`);
    }
  }

  async measureCode(): Promise<string> {
    if (!this.initialized || !this.enclaveId) {
      await this.initialize();
    }

    try {
      // Get enclave measurement (includes security monitor and runtime hash)
      const measurement = await this.client.getEnclaveMeasurement(this.enclaveId!);
      return createHash('sha512').update(measurement).digest('hex');
    } catch (error) {
      throw new Error(`Failed to measure enclave code: ${error}`);
    }
  }

  async generateQuote(reportData: Buffer): Promise<Buffer> {
    if (!this.initialized || !this.enclaveId) {
      await this.initialize();
    }

    try {
      // Generate attestation report with Keystone's certificate chain
      const report = await this.client.generateAttestationReport(
        this.enclaveId!,
        reportData,
        {
          includePlatformInfo: true,
          includeEnclaveState: true
        }
      );

      return Buffer.from(report);
    } catch (error) {
      throw new Error(`Failed to generate attestation report: ${error}`);
    }
  }

  async verifyQuote(quote: Buffer): Promise<boolean> {
    try {
      // Verify attestation report using Keystone's public key
      const verificationResult = await this.client.verifyAttestationReport(quote);

      if (!verificationResult.isValid) {
        throw new Error(verificationResult.error || 'Invalid attestation report');
      }

      // Additional security checks
      const platformInfo = await this.client.getPlatformStatus();
      if (!this.isPlatformSecure(platformInfo)) {
        throw new Error('Platform security requirements not met');
      }

      return true;
    } catch (error) {
      throw new Error(`Quote verification failed: ${error}`);
    }
  }

  async getSecurityMeasurements(): Promise<SecurityMeasurements> {
    if (!this.initialized || !this.enclaveId) {
      await this.initialize();
    }

    try {
      // Get platform and enclave security information
      const [platformInfo, enclaveInfo] = await Promise.all([
        this.client.getPlatformStatus(),
        this.client.getEnclaveStatus(this.enclaveId!)
      ]);

      return {
        integrityHash: await this.measureCode(),
        securityScore: this.calculateSecurityScore(platformInfo, enclaveInfo),
        vulnerabilities: await this.checkVulnerabilities(platformInfo)
      };
    } catch (error) {
      throw new Error(`Failed to get security measurements: ${error}`);
    }
  }

  private calculateSecurityScore(platformInfo: any, enclaveInfo: any): number {
    const maxScore = 100;
    let score = maxScore;

    // Deduct points for security issues
    if (!platformInfo.securityMonitorVerified) score -= 50;
    if (!platformInfo.runtimeVerified) score -= 20;
    if (!platformInfo.firmwareUpdated) score -= 15;
    if (!enclaveInfo.measured) score -= 30;
    if (!enclaveInfo.isolated) score -= 20;
    if (platformInfo.knownVulnerabilities > 0) {
      score -= platformInfo.knownVulnerabilities * 10;
    }

    return Math.max(0, Math.min(score, maxScore));
  }

  private async checkVulnerabilities(platformInfo: any): Promise<Array<{
    severity: 'low' | 'medium' | 'high';
    description: string;
    location: string;
  }>> {
    const vulnerabilities = [];

    // Check security monitor status
    if (!platformInfo.securityMonitorVerified) {
      vulnerabilities.push({
        severity: 'high',
        description: 'Security monitor verification failed',
        location: 'Security Monitor'
      });
    }

    // Check runtime status
    if (!platformInfo.runtimeVerified) {
      vulnerabilities.push({
        severity: 'medium',
        description: 'Runtime verification failed',
        location: 'Eyrie Runtime'
      });
    }

    // Check firmware version
    if (!platformInfo.firmwareUpdated) {
      vulnerabilities.push({
        severity: 'medium',
        description: 'Firmware is outdated',
        location: 'Firmware'
      });
    }

    // Check for known CVEs
    for (const cve of platformInfo.knownCVEs || []) {
      vulnerabilities.push({
        severity: cve.severity,
        description: `Known vulnerability: ${cve.id} - ${cve.description}`,
        location: 'Platform Security'
      });
    }

    return vulnerabilities;
  }

  private async verifyMeasurement(measurement: Buffer): Promise<boolean> {
    try {
      // Verify enclave measurement against expected value
      const expected = await this.client.getExpectedMeasurement(this.enclaveId!);
      return measurement.equals(expected);
    } catch (error) {
      throw new Error(`Measurement verification failed: ${error}`);
    }
  }

  private isPlatformSecure(platformInfo: any): boolean {
    return (
      platformInfo.securityMonitorVerified &&
      platformInfo.runtimeVerified &&
      platformInfo.firmwareUpdated &&
      platformInfo.knownVulnerabilities === 0
    );
  }

  async destroy(): Promise<void> {
    if (this.initialized && this.enclaveId) {
      try {
        await this.client.destroyEnclave(this.enclaveId);
        await this.client.shutdown();
        this.initialized = false;
        this.enclaveId = null;
      } catch (error) {
        throw new Error(`Failed to destroy Keystone enclave: ${error}`);
      }
    }
  }
} 