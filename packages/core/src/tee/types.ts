/**
 * Trusted Execution Environment types and interfaces
 */

/**
 * TEE security levels
 */
export enum TEESecurityLevel {
  BASIC = 'basic',     // Software-based TEE
  MEDIUM = 'medium',   // Hardware-assisted TEE
  HIGH = 'high'        // Full hardware TEE (e.g. SGX)
}

/**
 * TEE configuration options
 */
export interface TEEConfig {
  securityLevel: TEESecurityLevel;
  memoryLimit: number;        // Memory limit in MB
  timeLimit: number;          // Time limit in seconds
  enableRemoteAttestation: boolean;
  trustedServices: string[];  // List of trusted service identifiers
}

/**
 * Attestation report structure
 */
export interface AttestationReport {
  timestamp: number;
  enclave: {
    id: string;
    hash: string;
    version: string;
  };
  platform: {
    securityLevel: TEESecurityLevel;
    features: string[];
    measurements: {
      pcr: { [key: number]: string };  // Platform Configuration Registers
      quote: string;                    // SGX Quote or equivalent
    };
  };
  signature: string;
}

/**
 * Resource metrics for TEE monitoring
 */
export interface TEEMetrics {
  cpuUsage: number;           // CPU usage percentage
  memoryUsage: number;        // Memory usage in bytes
  activeOperations: number;   // Number of active operations
  queuedOperations: number;   // Number of queued operations
  lastMeasurement: number;    // Timestamp of last measurement
}

/**
 * Security measurement data
 */
export interface SecurityMeasurements {
  integrityHash: string;      // Hash of the code and data
  securityScore: number;      // Security score (0-100)
  vulnerabilities: {
    severity: 'low' | 'medium' | 'high';
    description: string;
    location: string;
  }[];
}

/**
 * TEE operation result
 */
export interface TEEResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metrics: TEEMetrics;
  attestation?: AttestationReport;
}

/**
 * TEE operation context
 */
export interface TEEContext {
  id: string;
  securityLevel: TEESecurityLevel;
  startTime: number;
  resources: {
    allocatedMemory: number;
    maxThreads: number;
  };
  attestation: AttestationReport;
}

/**
 * TEE operation request
 */
export interface TEERequest<T> {
  operation: string;
  input: T;
  context?: TEEContext;
  config?: Partial<TEEConfig>;
} 