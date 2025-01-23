import { TEESecurityLevel } from '../types';
import { SGXExecutor } from './sgx/SGXExecutor';
import { TrustZoneExecutor } from './trustzone/TrustZoneExecutor';
import { SEVExecutor } from './sev/SEVExecutor';
import { KeystoneExecutor } from './keystone/KeystoneExecutor';
import { PEFExecutor } from './pef/PEFExecutor';

export type TEEPlatform = 'sgx' | 'trustzone' | 'sev' | 'keystone' | 'pef';

export interface TEEExecutorInterface {
  initialize(): Promise<void>;
  executeSecure<T, R>(request: any, context: any): Promise<R>;
  measureCode(): Promise<string>;
  generateQuote(reportData: Buffer): Promise<Buffer>;
  verifyQuote(quote: Buffer): Promise<boolean>;
  getSecurityMeasurements(): Promise<any>;
  destroy(): Promise<void>;
}

export class TEEExecutorFactory {
  private static instance: TEEExecutorFactory;
  private executors: Map<TEEPlatform, TEEExecutorInterface>;

  private constructor() {
    this.executors = new Map();
  }

  static getInstance(): TEEExecutorFactory {
    if (!TEEExecutorFactory.instance) {
      TEEExecutorFactory.instance = new TEEExecutorFactory();
    }
    return TEEExecutorFactory.instance;
  }

  async getExecutor(platform: TEEPlatform): Promise<TEEExecutorInterface> {
    if (this.executors.has(platform)) {
      return this.executors.get(platform)!;
    }

    const executor = await this.createExecutor(platform);
    this.executors.set(platform, executor);
    return executor;
  }

  private async createExecutor(platform: TEEPlatform): Promise<TEEExecutorInterface> {
    let executor: TEEExecutorInterface;

    switch (platform) {
      case 'sgx':
        executor = new SGXExecutor();
        break;
      case 'trustzone':
        executor = new TrustZoneExecutor();
        break;
      case 'sev':
        executor = new SEVExecutor();
        break;
      case 'keystone':
        executor = new KeystoneExecutor();
        break;
      case 'pef':
        executor = new PEFExecutor();
        break;
      default:
        throw new Error(`Unsupported TEE platform: ${platform}`);
    }

    await executor.initialize();
    return executor;
  }

  static getPlatformBySecurityLevel(securityLevel: TEESecurityLevel): TEEPlatform {
    switch (securityLevel) {
      case TEESecurityLevel.HIGH:
        // For high security, prefer SGX if available
        if (this.isIntelSGXAvailable()) {
          return 'sgx';
        }
        // Fall back to SEV if SGX is not available
        if (this.isAMDSEVAvailable()) {
          return 'sev';
        }
        // Try PEF if SEV is not available
        if (this.isIBMPEFAvailable()) {
          return 'pef';
        }
        // Try Keystone if PEF is not available
        if (this.isKeystoneAvailable()) {
          return 'keystone';
        }
        throw new Error('No high-security TEE platform available');

      case TEESecurityLevel.MEDIUM:
        // For medium security, any platform is acceptable
        if (this.isIntelSGXAvailable()) {
          return 'sgx';
        }
        if (this.isAMDSEVAvailable()) {
          return 'sev';
        }
        if (this.isIBMPEFAvailable()) {
          return 'pef';
        }
        if (this.isKeystoneAvailable()) {
          return 'keystone';
        }
        if (this.isARMTrustZoneAvailable()) {
          return 'trustzone';
        }
        throw new Error('No TEE platform available');

      default:
        throw new Error(`Unsupported security level: ${securityLevel}`);
    }
  }

  private static isIntelSGXAvailable(): boolean {
    try {
      // Check if SGX device is available
      const sgxDevice = require('fs').existsSync('/dev/sgx_enclave');
      if (!sgxDevice) return false;

      // Check if SGX driver is loaded
      const sgxDriver = require('fs').readFileSync('/sys/module/intel_sgx/version', 'utf8');
      return !!sgxDriver;
    } catch {
      return false;
    }
  }

  private static isAMDSEVAvailable(): boolean {
    try {
      // Check if SEV device is available
      const sevDevice = require('fs').existsSync('/dev/sev');
      if (!sevDevice) return false;

      // Check if SEV is enabled in BIOS/firmware
      const sevEnabled = require('fs').readFileSync('/sys/module/kvm_amd/parameters/sev', 'utf8');
      return sevEnabled.trim() === '1';
    } catch {
      return false;
    }
  }

  private static isARMTrustZoneAvailable(): boolean {
    try {
      // Check if TrustZone device is available
      const tzDevice = require('fs').existsSync('/dev/trustzone');
      if (!tzDevice) return false;

      // Check if secure world is accessible
      const tzAccess = require('fs').readFileSync('/sys/firmware/devicetree/base/firmware/trustzone/status', 'utf8');
      return tzAccess.includes('enabled');
    } catch {
      return false;
    }
  }

  private static isKeystoneAvailable(): boolean {
    try {
      // Check if Keystone device is available
      const keystoneDevice = require('fs').existsSync('/dev/keystone');
      if (!keystoneDevice) return false;

      // Check if security monitor is loaded
      const smStatus = require('fs').readFileSync('/sys/module/keystone_driver/sm_status', 'utf8');
      return smStatus.includes('initialized');
    } catch {
      return false;
    }
  }

  private static isIBMPEFAvailable(): boolean {
    try {
      // Check if PEF device is available
      const pefDevice = require('fs').existsSync('/dev/pef');
      if (!pefDevice) return false;

      // Check if Ultravisor is enabled
      const uvStatus = require('fs').readFileSync('/sys/firmware/ultravisor/status', 'utf8');
      return uvStatus.includes('enabled');
    } catch {
      return false;
    }
  }

  async destroyAll(): Promise<void> {
    const destroyPromises = Array.from(this.executors.values()).map(
      executor => executor.destroy()
    );
    await Promise.all(destroyPromises);
    this.executors.clear();
  }
} 