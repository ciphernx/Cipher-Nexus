import { Buffer } from 'buffer';

/**
 * Homomorphic encryption scheme types
 */
export enum HomomorphicScheme {
  ELGAMAL = 'elgamal',
  BGV = 'bgv',
  PAILLIER = 'paillier'
}

/**
 * Key types for homomorphic encryption
 */
export enum KeyType {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  EVALUATION = 'EVALUATION',
  ROTATION = 'ROTATION',
  GALOIS = 'GALOIS'
}

/**
 * Security level configuration
 */
export enum SecurityLevel {
  BASIC = 128,      // 128-bit security
  MEDIUM = 192,     // 192-bit security  
  HIGH = 256        // 256-bit security
}

/**
 * Homomorphic encryption configuration
 */
export interface HomomorphicConfig {
  scheme: HomomorphicScheme;
  securityLevel: SecurityLevel;
  polyModulusDegree?: number;    // For RLWE-based schemes
  plainModulus?: bigint;         // For BFV scheme
  coeffModulus?: bigint[];       // For BGV/BFV/CKKS schemes
  scale?: number;                // For CKKS scheme
  relinWindow?: number;          // Window size for relinearization
  batchSize?: number;            // For batching/SIMD
  decompositionBitSize?: number; // For key switching
  cacheConfig?: CacheConfig;
}

/**
 * Key generation parameters
 */
export interface KeyGenParams {
  scheme: HomomorphicScheme;
  securityLevel: SecurityLevel;
  keyTypes: ('public' | 'private' | 'relin' | 'galois')[];
  polyModulusDegree?: number;
  plainModulus?: bigint;
  coeffModulus?: bigint[];
}

/**
 * Key metadata
 */
export interface KeyMetadata {
  id: string;
  scheme: HomomorphicScheme;
  securityLevel: SecurityLevel;
  createdAt: number;
  type: 'public' | 'private' | 'relin' | 'galois';
  polyModulusDegree?: number;
  plainModulus?: bigint;
  coeffModulus?: bigint[];
}

/**
 * Encrypted data with metadata
 */
export interface EncryptedData {
  data: Uint8Array | ElGamalCiphertext[] | BGVCiphertext[];
  keyId: string;
  scheme: HomomorphicScheme;
  level?: number;
  scale?: number;
}

/**
 * Operation types supported by homomorphic encryption
 */
export enum HomomorphicOp {
  ENCRYPT = 'encrypt',
  DECRYPT = 'decrypt',
  ADD = 'add',
  MULTIPLY = 'multiply',
  RELINEARIZE = 'relinearize',
  ROTATE = 'rotate',
  RESCALE = 'rescale'
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxItems: number;
  ttlSeconds: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  operation: HomomorphicOp;
  startTime: number;
  duration: number;
  inputSize: number;
  success: boolean;
  error?: string;
  memoryUsage: number;
}

export interface ElGamalCiphertext {
  c1: bigint;
  c2: bigint;
}

export interface BGVCiphertext {
  data: Uint8Array;
  level: number;
  scale: number;
}

export interface PublicKey {
  p: bigint;  // Prime modulus
  g: bigint;  // Generator
  h: bigint;  // Public key h = g^x mod p
}

export interface PrivateKey {
  p: bigint;  // Prime modulus
  x: bigint;  // Private key
} 