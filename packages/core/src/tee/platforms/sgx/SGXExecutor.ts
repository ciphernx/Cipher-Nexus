import { 
  TEERequest,
  TEEContext,
  SecurityMeasurements,
  AttestationReport
} from '../../types';
import { createHash } from 'crypto';
import sgx from '@intel/linux-sgx-sdk';

export class SGXExecutor {
  private enclaveId: number;
  private initialized: boolean = false;

  constructor() {
    this.enclaveId = 0;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize SGX enclave
      const enclaveFile = process.env.SGX_ENCLAVE_PATH || './enclave.signed.so';
      this.enclaveId = await sgx.createEnclave(enclaveFile, true);
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize SGX enclave: ${error}`);
    }
  }

  async executeSecure<T, R>(request: TEERequest<T>, context: TEEContext): Promise<R> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Serialize input data
      const inputData = Buffer.from(JSON.stringify(request.input));

      // Call enclave function
      const result = await sgx.ecall(
        this.enclaveId,
        'secure_operation',
        inputData,
        request.operation
      );

      // Deserialize result
      return JSON.parse(result.toString()) as R;
    } catch (error) {
      throw new Error(`SGX execution failed: ${error}`);
    }
  }

  async measureCode(): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Get enclave measurement (MRENCLAVE)
      const measurement = await sgx.getMeasurement(this.enclaveId);
      return createHash('sha256').update(measurement).digest('hex');
    } catch (error) {
      throw new Error(`Failed to measure enclave code: ${error}`);
    }
  }

  async generateQuote(reportData: Buffer): Promise<Buffer> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Generate enclave quote for remote attestation
      return await sgx.getQuote(this.enclaveId, reportData);
    } catch (error) {
      throw new Error(`Failed to generate quote: ${error}`);
    }
  }

  async verifyQuote(quote: Buffer): Promise<boolean> {
    try {
      // Verify quote using Intel Attestation Service (IAS)
      const iasUrl = process.env.IAS_URL || 'https://api.trustedservices.intel.com/sgx/dev';
      const iasApiKey = process.env.IAS_API_KEY;

      if (!iasApiKey) {
        throw new Error('IAS API key not configured');
      }

      const response = await fetch(`${iasUrl}/attestation/v4/report`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': iasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isvEnclaveQuote: quote.toString('base64') })
      });

      if (!response.ok) {
        throw new Error(`IAS verification failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.isvEnclaveQuoteStatus === 'OK';
    } catch (error) {
      throw new Error(`Quote verification failed: ${error}`);
    }
  }

  async getSecurityMeasurements(): Promise<SecurityMeasurements> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const [cpuSvn, isv] = await Promise.all([
        sgx.getCpuSvn(this.enclaveId),
        sgx.getIsvSvn(this.enclaveId)
      ]);

      return {
        integrityHash: await this.measureCode(),
        securityScore: this.calculateSecurityScore(cpuSvn, isv),
        vulnerabilities: await this.checkVulnerabilities(cpuSvn)
      };
    } catch (error) {
      throw new Error(`Failed to get security measurements: ${error}`);
    }
  }

  private calculateSecurityScore(cpuSvn: number, isvSvn: number): number {
    // Calculate security score based on CPU and ISV security version numbers
    const maxScore = 100;
    const cpuWeight = 0.6;
    const isvWeight = 0.4;

    const cpuScore = (cpuSvn / 0xFF) * maxScore;
    const isvScore = (isvSvn / 0xFF) * maxScore;

    return Math.round(cpuScore * cpuWeight + isvScore * isvWeight);
  }

  private async checkVulnerabilities(cpuSvn: number): Promise<Array<{
    severity: 'low' | 'medium' | 'high';
    description: string;
    location: string;
  }>> {
    const vulnerabilities = [];

    // Check for known vulnerabilities based on CPU SVN
    if (cpuSvn < 0x02) {
      vulnerabilities.push({
        severity: 'high',
        description: 'CPU microcode version is outdated',
        location: 'CPU Microcode'
      });
    }

    // Add more vulnerability checks here

    return vulnerabilities;
  }

  async destroy(): Promise<void> {
    if (this.initialized && this.enclaveId) {
      try {
        await sgx.destroyEnclave(this.enclaveId);
        this.initialized = false;
        this.enclaveId = 0;
      } catch (error) {
        throw new Error(`Failed to destroy enclave: ${error}`);
      }
    }
  }
} 