import { TEESecurityLevel } from '../types';

export interface TEEConfiguration {
  // SGX Configuration
  sgx: {
    enclavePath: string;
    iasUrl: string;
    iasApiKey?: string;
    launchToken?: string;
    useProductionIas: boolean;
  };

  // TrustZone Configuration
  trustzone: {
    trustletPath: string;
    secureStorage: string;
  };

  // SEV Configuration
  sev: {
    firmwarePath: string;
    policyPath: string;
    vmConfig: {
      memory: number;      // in MB
      vcpus: number;
      encrypted: boolean;
      measurementRequired: boolean;
      snpRequired: boolean;
    };
    attestation: {
      apiUrl: string;
      apiKey?: string;
      certificatePath?: string;
      useProduction: boolean;
    };
  };

  // Keystone Configuration
  keystone: {
    securityMonitorPath: string;
    runtimePath: string;
    enclaveConfig: {
      memorySize: number;      // in MB
      stackSize: number;       // in MB
      measurementRequired: boolean;
    };
    attestation: {
      apiUrl: string;
      apiKey?: string;
      certificatePath?: string;
      useProduction: boolean;
    };
  };

  // PEF Configuration
  pef: {
    hypervisorPath: string;
    firmwarePath: string;
    vmConfig: {
      memory: number;      // in MB
      vcpus: number;
      encrypted: boolean;
      uvEnabled: boolean;
      measurementRequired: boolean;
    };
    attestation: {
      apiUrl: string;
      apiKey?: string;
      certificatePath?: string;
      useProduction: boolean;
    };
  };

  // Resource Limits
  resources: {
    maxMemoryPerContext: number;  // in MB
    maxCpuPerContext: number;     // percentage (0-100)
    maxActiveContexts: number;
    maxQueuedRequests: number;
    contextTimeout: number;       // in seconds
  };

  // Security Settings
  security: {
    minSecurityLevel: TEESecurityLevel;
    requireRemoteAttestation: boolean;
    attestationValidityPeriod: number;  // in seconds
    allowedOperations: string[];
    trustedSigners: string[];           // public key hashes
    platformPreference: ('sgx' | 'sev' | 'trustzone' | 'keystone' | 'pef')[];
  };

  // Monitoring
  monitoring: {
    metricsInterval: number;     // in milliseconds
    retentionPeriod: number;     // in seconds
    alertThresholds: {
      cpuUsage: number;          // percentage
      memoryUsage: number;       // percentage
      queueSize: number;
      errorRate: number;         // percentage
    };
  };
}

export const defaultConfig: TEEConfiguration = {
  sgx: {
    enclavePath: process.env.SGX_ENCLAVE_PATH || './enclave.signed.so',
    iasUrl: process.env.IAS_URL || 'https://api.trustedservices.intel.com/sgx/dev',
    iasApiKey: process.env.IAS_API_KEY,
    useProductionIas: process.env.NODE_ENV === 'production'
  },

  trustzone: {
    trustletPath: process.env.TRUSTZONE_TRUSTLET_PATH || './trustlet.ta',
    secureStorage: process.env.TRUSTZONE_STORAGE_PATH || './secure_storage'
  },

  sev: {
    firmwarePath: process.env.SEV_FIRMWARE_PATH || '/usr/sev/firmware.bin',
    policyPath: process.env.SEV_POLICY_PATH || '/etc/sev/policy.json',
    vmConfig: {
      memory: 512,
      vcpus: 2,
      encrypted: true,
      measurementRequired: true,
      snpRequired: process.env.NODE_ENV === 'production'
    },
    attestation: {
      apiUrl: process.env.SEV_API_URL || 'https://kdsintf.amd.com',
      apiKey: process.env.SEV_API_KEY,
      certificatePath: process.env.SEV_CERT_PATH,
      useProduction: process.env.NODE_ENV === 'production'
    }
  },

  keystone: {
    securityMonitorPath: process.env.KEYSTONE_SM_PATH || '/usr/keystone/security_monitor.bin',
    runtimePath: process.env.KEYSTONE_RUNTIME_PATH || '/usr/keystone/eyrie-rt',
    enclaveConfig: {
      memorySize: 512,
      stackSize: 4,
      measurementRequired: true
    },
    attestation: {
      apiUrl: process.env.KEYSTONE_API_URL || 'https://api.keystone-enclave.org',
      apiKey: process.env.KEYSTONE_API_KEY,
      certificatePath: process.env.KEYSTONE_CERT_PATH,
      useProduction: process.env.NODE_ENV === 'production'
    }
  },

  pef: {
    hypervisorPath: process.env.PEF_HYPERVISOR_PATH || '/usr/pef/hypervisor.bin',
    firmwarePath: process.env.PEF_FIRMWARE_PATH || '/usr/pef/firmware.bin',
    vmConfig: {
      memory: 512,
      vcpus: 2,
      encrypted: true,
      uvEnabled: true,
      measurementRequired: true
    },
    attestation: {
      apiUrl: process.env.PEF_API_URL || 'https://api.ibm.com/pef/attestation',
      apiKey: process.env.PEF_API_KEY,
      certificatePath: process.env.PEF_CERT_PATH,
      useProduction: process.env.NODE_ENV === 'production'
    }
  },

  resources: {
    maxMemoryPerContext: 512,    // 512 MB
    maxCpuPerContext: 50,        // 50%
    maxActiveContexts: 10,
    maxQueuedRequests: 100,
    contextTimeout: 300          // 5 minutes
  },

  security: {
    minSecurityLevel: TEESecurityLevel.MEDIUM,
    requireRemoteAttestation: true,
    attestationValidityPeriod: 300,  // 5 minutes
    allowedOperations: ['encrypt', 'decrypt', 'sign', 'verify'],
    trustedSigners: [],
    platformPreference: ['sgx', 'sev', 'pef', 'keystone', 'trustzone']  // Updated platform preference
  },

  monitoring: {
    metricsInterval: 1000,       // 1 second
    retentionPeriod: 86400,      // 24 hours
    alertThresholds: {
      cpuUsage: 80,              // 80%
      memoryUsage: 80,           // 80%
      queueSize: 50,             // 50 requests
      errorRate: 5               // 5%
    }
  }
}; 