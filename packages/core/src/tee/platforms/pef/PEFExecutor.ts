import { 
  TEERequest,
  TEEContext,
  SecurityMeasurements,
  AttestationReport
} from '../../types';
import { createHash } from 'crypto';
import { PEFClient } from '@ibm/pef-sdk';

export class PEFExecutor {
  private client: PEFClient;
  private initialized: boolean = false;
  private secureVMId: string | null = null;

  constructor() {
    this.client = new PEFClient();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize PEF platform and verify hypervisor
      await this.client.initialize({
        hypervisorPath: process.env.PEF_HYPERVISOR_PATH || '/usr/pef/hypervisor.bin',
        firmwarePath: process.env.PEF_FIRMWARE_PATH || '/usr/pef/firmware.bin',
        useUV: true  // Enable Ultravisor support
      });

      // Create secure VM
      this.secureVMId = await this.client.createSecureVM({
        memory: 512 * 1024 * 1024, // 512 MB
        vcpus: 2,
        encrypted: true,
        uvEnabled: true,           // Enable Ultravisor protection
        measurementRequired: true
      });

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize PEF: ${error}`);
    }
  }

  async executeSecure<T, R>(request: TEERequest<T>, context: TEEContext): Promise<R> {
    if (!this.initialized || !this.secureVMId) {
      await this.initialize();
    }

    try {
      // Prepare input data
      const inputData = Buffer.from(JSON.stringify(request.input));

      // Execute operation in secure VM
      const result = await this.client.executeInSecureVM(
        this.secureVMId!,
        request.operation,
        inputData,
        {
          securityLevel: context.securityLevel,
          timeoutMs: 30000,
          uvVerification: true     // Enable Ultravisor verification
        }
      );

      // Verify VM measurement after execution
      const measurement = await this.client.getVMMeasurement(this.secureVMId!);
      if (!await this.verifyMeasurement(measurement)) {
        throw new Error('VM measurement verification failed');
      }

      // Deserialize and return result
      return JSON.parse(result.toString()) as R;
    } catch (error) {
      throw new Error(`PEF execution failed: ${error}`);
    }
  }

  async measureCode(): Promise<string> {
    if (!this.initialized || !this.secureVMId) {
      await this.initialize();
    }

    try {
      // Get VM measurement (includes hypervisor and UV measurements)
      const measurement = await this.client.getVMMeasurement(this.secureVMId!);
      return createHash('sha512').update(measurement).digest('hex');
    } catch (error) {
      throw new Error(`Failed to measure VM code: ${error}`);
    }
  }

  async generateQuote(reportData: Buffer): Promise<Buffer> {
    if (!this.initialized || !this.secureVMId) {
      await this.initialize();
    }

    try {
      // Generate attestation report with IBM's certificate chain
      const report = await this.client.generateAttestationReport(
        this.secureVMId!,
        reportData,
        {
          includePlatformInfo: true,
          includeUVState: true,    // Include Ultravisor state
          includeVMState: true
        }
      );

      return Buffer.from(report);
    } catch (error) {
      throw new Error(`Failed to generate attestation report: ${error}`);
    }
  }

  async verifyQuote(quote: Buffer): Promise<boolean> {
    try {
      // Verify attestation report using IBM's public key
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
    if (!this.initialized || !this.secureVMId) {
      await this.initialize();
    }

    try {
      // Get platform, UV, and VM security information
      const [platformInfo, vmInfo] = await Promise.all([
        this.client.getPlatformStatus(),
        this.client.getVMStatus(this.secureVMId!)
      ]);

      return {
        integrityHash: await this.measureCode(),
        securityScore: this.calculateSecurityScore(platformInfo, vmInfo),
        vulnerabilities: await this.checkVulnerabilities(platformInfo)
      };
    } catch (error) {
      throw new Error(`Failed to get security measurements: ${error}`);
    }
  }

  private calculateSecurityScore(platformInfo: any, vmInfo: any): number {
    const maxScore = 100;
    let score = maxScore;

    // Deduct points for security issues
    if (!platformInfo.pefEnabled) score -= 50;
    if (!platformInfo.uvEnabled) score -= 30;
    if (!platformInfo.firmwareUpdated) score -= 15;
    if (!vmInfo.encrypted) score -= 30;
    if (!vmInfo.measured) score -= 20;
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

    // Check PEF status
    if (!platformInfo.pefEnabled) {
      vulnerabilities.push({
        severity: 'high',
        description: 'IBM PEF is not enabled',
        location: 'Platform Configuration'
      });
    }

    // Check Ultravisor status
    if (!platformInfo.uvEnabled) {
      vulnerabilities.push({
        severity: 'high',
        description: 'Ultravisor is not enabled',
        location: 'Platform Security'
      });
    }

    // Check firmware version
    if (!platformInfo.firmwareUpdated) {
      vulnerabilities.push({
        severity: 'medium',
        description: 'PEF firmware is outdated',
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
      // Verify VM measurement against expected value
      const expected = await this.client.getExpectedMeasurement(this.secureVMId!);
      return measurement.equals(expected);
    } catch (error) {
      throw new Error(`Measurement verification failed: ${error}`);
    }
  }

  private isPlatformSecure(platformInfo: any): boolean {
    return (
      platformInfo.pefEnabled &&
      platformInfo.uvEnabled &&
      platformInfo.firmwareUpdated &&
      platformInfo.knownVulnerabilities === 0
    );
  }

  async destroy(): Promise<void> {
    if (this.initialized && this.secureVMId) {
      try {
        await this.client.destroySecureVM(this.secureVMId);
        await this.client.shutdown();
        this.initialized = false;
        this.secureVMId = null;
      } catch (error) {
        throw new Error(`Failed to destroy PEF secure VM: ${error}`);
      }
    }
  }
} 