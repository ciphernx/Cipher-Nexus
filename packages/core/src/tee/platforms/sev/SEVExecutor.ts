import { 
  TEERequest,
  TEEContext,
  SecurityMeasurements,
  AttestationReport
} from '../../types';
import { createHash } from 'crypto';
import { SEVClient } from '@amd/sev-sdk';

export class SEVExecutor {
  private client: SEVClient;
  private initialized: boolean = false;
  private vmId: string | null = null;

  constructor() {
    this.client = new SEVClient();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize SEV platform and verify firmware
      await this.client.initialize({
        firmwarePath: process.env.SEV_FIRMWARE_PATH || '/usr/sev/firmware.bin',
        policyPath: process.env.SEV_POLICY_PATH || '/etc/sev/policy.json'
      });

      // Create secure VM
      this.vmId = await this.client.createVM({
        memory: 512, // MB
        vcpus: 2,
        encrypted: true,
        measurementRequired: true
      });

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize SEV: ${error}`);
    }
  }

  async executeSecure<T, R>(request: TEERequest<T>, context: TEEContext): Promise<R> {
    if (!this.initialized || !this.vmId) {
      await this.initialize();
    }

    try {
      // Prepare input data
      const inputData = Buffer.from(JSON.stringify(request.input));

      // Launch encrypted VM with input data
      const result = await this.client.executeInVM(
        this.vmId!,
        request.operation,
        inputData,
        {
          securityLevel: context.securityLevel,
          timeoutMs: 30000
        }
      );

      // Verify VM measurement after execution
      const measurement = await this.client.getVMMeasurement(this.vmId!);
      if (!await this.verifyMeasurement(measurement)) {
        throw new Error('VM measurement verification failed');
      }

      // Deserialize and return result
      return JSON.parse(result.toString()) as R;
    } catch (error) {
      throw new Error(`SEV execution failed: ${error}`);
    }
  }

  async measureCode(): Promise<string> {
    if (!this.initialized || !this.vmId) {
      await this.initialize();
    }

    try {
      // Get VM measurement (VMSA and memory contents)
      const measurement = await this.client.getVMMeasurement(this.vmId!);
      return createHash('sha384').update(measurement).digest('hex');
    } catch (error) {
      throw new Error(`Failed to measure VM code: ${error}`);
    }
  }

  async generateQuote(reportData: Buffer): Promise<Buffer> {
    if (!this.initialized || !this.vmId) {
      await this.initialize();
    }

    try {
      // Generate attestation report with AMD's certificate chain
      const report = await this.client.generateAttestationReport(
        this.vmId!,
        reportData,
        {
          includePlatformInfo: true,
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
      // Verify attestation report using AMD's public key
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
    if (!this.initialized || !this.vmId) {
      await this.initialize();
    }

    try {
      // Get platform and VM security information
      const [platformInfo, vmInfo] = await Promise.all([
        this.client.getPlatformStatus(),
        this.client.getVMStatus(this.vmId!)
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
    if (!platformInfo.sevEnabled) score -= 50;
    if (!platformInfo.snpEnabled) score -= 20;
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

    // Check SEV status
    if (!platformInfo.sevEnabled) {
      vulnerabilities.push({
        severity: 'high',
        description: 'AMD SEV is not enabled',
        location: 'Platform Configuration'
      });
    }

    // Check SNP status
    if (!platformInfo.snpEnabled) {
      vulnerabilities.push({
        severity: 'medium',
        description: 'AMD SEV-SNP is not enabled',
        location: 'Platform Security'
      });
    }

    // Check firmware version
    if (!platformInfo.firmwareUpdated) {
      vulnerabilities.push({
        severity: 'medium',
        description: 'SEV firmware is outdated',
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
      const expected = await this.client.getExpectedMeasurement(this.vmId!);
      return measurement.equals(expected);
    } catch (error) {
      throw new Error(`Measurement verification failed: ${error}`);
    }
  }

  private isPlatformSecure(platformInfo: any): boolean {
    return (
      platformInfo.sevEnabled &&
      platformInfo.snpEnabled &&
      platformInfo.firmwareUpdated &&
      platformInfo.knownVulnerabilities === 0
    );
  }

  async destroy(): Promise<void> {
    if (this.initialized && this.vmId) {
      try {
        await this.client.destroyVM(this.vmId);
        await this.client.shutdown();
        this.initialized = false;
        this.vmId = null;
      } catch (error) {
        throw new Error(`Failed to destroy SEV VM: ${error}`);
      }
    }
  }
} 