import { 
  TEERequest,
  TEEContext,
  SecurityMeasurements,
  AttestationReport
} from '../../types';
import { createHash } from 'crypto';
import { TrustZoneClient } from '@arm/trustzone-sdk';

export class TrustZoneExecutor {
  private client: TrustZoneClient;
  private initialized: boolean = false;
  private sessionId: string | null = null;

  constructor() {
    this.client = new TrustZoneClient();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize TrustZone client and establish secure session
      await this.client.initialize({
        trustletPath: process.env.TRUSTZONE_TRUSTLET_PATH || './trustlet.ta',
        secureStorage: process.env.TRUSTZONE_STORAGE_PATH || './secure_storage'
      });

      // Open session with trustlet
      this.sessionId = await this.client.openSession();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize TrustZone: ${error}`);
    }
  }

  async executeSecure<T, R>(request: TEERequest<T>, context: TEEContext): Promise<R> {
    if (!this.initialized || !this.sessionId) {
      await this.initialize();
    }

    try {
      // Prepare command parameters
      const params = {
        operation: request.operation,
        input: Buffer.from(JSON.stringify(request.input)),
        context: {
          id: context.id,
          securityLevel: context.securityLevel
        }
      };

      // Execute command in secure world
      const result = await this.client.invokeCommand(
        this.sessionId!,
        'TRUSTLET_CMD_EXECUTE',
        params
      );

      // Deserialize and return result
      return JSON.parse(result.toString()) as R;
    } catch (error) {
      throw new Error(`TrustZone execution failed: ${error}`);
    }
  }

  async measureCode(): Promise<string> {
    if (!this.initialized || !this.sessionId) {
      await this.initialize();
    }

    try {
      // Get trustlet measurement
      const measurement = await this.client.getMeasurement(this.sessionId!);
      return createHash('sha256').update(measurement).digest('hex');
    } catch (error) {
      throw new Error(`Failed to measure trustlet code: ${error}`);
    }
  }

  async generateQuote(reportData: Buffer): Promise<Buffer> {
    if (!this.initialized || !this.sessionId) {
      await this.initialize();
    }

    try {
      // Generate attestation token
      return await this.client.generateAttestationToken(
        this.sessionId!,
        reportData
      );
    } catch (error) {
      throw new Error(`Failed to generate attestation token: ${error}`);
    }
  }

  async verifyQuote(quote: Buffer): Promise<boolean> {
    try {
      // Verify attestation token using platform security services
      const verificationResult = await this.client.verifyAttestationToken(quote);
      
      if (!verificationResult.isValid) {
        throw new Error(verificationResult.error || 'Invalid attestation token');
      }

      // Additional security checks
      const securityState = await this.client.getSecurityState();
      if (!this.isSecurityStateValid(securityState)) {
        throw new Error('Invalid platform security state');
      }

      return true;
    } catch (error) {
      throw new Error(`Quote verification failed: ${error}`);
    }
  }

  async getSecurityMeasurements(): Promise<SecurityMeasurements> {
    if (!this.initialized || !this.sessionId) {
      await this.initialize();
    }

    try {
      // Get platform security state
      const securityState = await this.client.getSecurityState();
      
      // Get trustlet version info
      const versionInfo = await this.client.getTrustletVersion(this.sessionId!);

      return {
        integrityHash: await this.measureCode(),
        securityScore: this.calculateSecurityScore(securityState),
        vulnerabilities: await this.checkVulnerabilities(securityState, versionInfo)
      };
    } catch (error) {
      throw new Error(`Failed to get security measurements: ${error}`);
    }
  }

  private calculateSecurityScore(securityState: any): number {
    const maxScore = 100;
    let score = maxScore;

    // Deduct points for security issues
    if (!securityState.secureBootEnabled) score -= 30;
    if (!securityState.debugLocked) score -= 20;
    if (!securityState.antiRollbackEnabled) score -= 20;
    if (securityState.knownVulnerabilities > 0) {
      score -= securityState.knownVulnerabilities * 10;
    }

    return Math.max(0, Math.min(score, maxScore));
  }

  private async checkVulnerabilities(securityState: any, versionInfo: any): Promise<Array<{
    severity: 'low' | 'medium' | 'high';
    description: string;
    location: string;
  }>> {
    const vulnerabilities = [];

    // Check secure boot status
    if (!securityState.secureBootEnabled) {
      vulnerabilities.push({
        severity: 'high',
        description: 'Secure boot is not enabled',
        location: 'Platform Configuration'
      });
    }

    // Check debug status
    if (!securityState.debugLocked) {
      vulnerabilities.push({
        severity: 'high',
        description: 'Debug interface is not locked',
        location: 'Platform Security'
      });
    }

    // Check anti-rollback protection
    if (!securityState.antiRollbackEnabled) {
      vulnerabilities.push({
        severity: 'medium',
        description: 'Anti-rollback protection is not enabled',
        location: 'Platform Security'
      });
    }

    // Check trustlet version
    if (versionInfo.needsUpdate) {
      vulnerabilities.push({
        severity: 'medium',
        description: 'Trustlet version is outdated',
        location: 'Trustlet'
      });
    }

    return vulnerabilities;
  }

  private isSecurityStateValid(securityState: any): boolean {
    // Check minimum security requirements
    return (
      securityState.secureBootEnabled &&
      securityState.debugLocked &&
      securityState.antiRollbackEnabled &&
      securityState.knownVulnerabilities === 0
    );
  }

  async destroy(): Promise<void> {
    if (this.initialized && this.sessionId) {
      try {
        await this.client.closeSession(this.sessionId);
        await this.client.shutdown();
        this.initialized = false;
        this.sessionId = null;
      } catch (error) {
        throw new Error(`Failed to destroy TrustZone session: ${error}`);
      }
    }
  }
} 