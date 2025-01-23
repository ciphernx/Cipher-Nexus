import {
  HomomorphicConfig,
  HomomorphicScheme,
  EncryptedData,
  HomomorphicOp,
  PerformanceMetrics,
  CacheConfig
} from './types';
import { KeyManager } from './KeyManager';

/**
 * Abstract base class for homomorphic encryption schemes
 */
export abstract class HomomorphicEncryption {
  protected config: HomomorphicConfig;
  protected keyManager: KeyManager;
  protected cache: Map<string, EncryptedData>;
  protected metrics: PerformanceMetrics[];

  constructor(config: HomomorphicConfig, keyManager: KeyManager) {
    this.validateConfig(config);
    this.config = config;
    this.keyManager = keyManager;
    this.cache = new Map();
    this.metrics = [];
  }

  /**
   * Encrypt data
   */
  abstract encrypt(data: number[] | bigint[], keyId: string): Promise<EncryptedData>;

  /**
   * Decrypt data
   */
  abstract decrypt(encrypted: EncryptedData, keyId: string): Promise<number[] | bigint[]>;

  /**
   * Add two encrypted values
   */
  abstract add(a: EncryptedData, b: EncryptedData): Promise<EncryptedData>;

  /**
   * Multiply two encrypted values
   */
  abstract multiply(a: EncryptedData, b: EncryptedData): Promise<EncryptedData>;

  /**
   * Rotate encrypted vector
   */
  abstract rotate(encrypted: EncryptedData, steps: number): Promise<EncryptedData>;

  /**
   * Relinearize ciphertext
   */
  abstract relinearize(encrypted: EncryptedData): Promise<EncryptedData>;

  /**
   * Rescale ciphertext
   */
  abstract rescale(encrypted: EncryptedData): Promise<EncryptedData>;

  /**
   * Configure caching
   */
  configureCaching(config: CacheConfig): void {
    if (!config.enabled) {
      this.cache.clear();
      return;
    }

    // Implement cache size management
    if (this.getCacheSize() > config.maxSize) {
      this.evictCache(config.maxSize);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Validate encryption configuration
   */
  protected validateConfig(config: HomomorphicConfig): void {
    if (!config.scheme) {
      throw new Error('Encryption scheme is required');
    }
    if (!config.securityLevel) {
      throw new Error('Security level is required');
    }

    switch (config.scheme) {
      case HomomorphicScheme.BGV:
      case HomomorphicScheme.BFV:
      case HomomorphicScheme.CKKS:
        if (!config.polyModulusDegree) {
          throw new Error('Polynomial modulus degree is required for this scheme');
        }
        if (!config.coeffModulus || config.coeffModulus.length === 0) {
          throw new Error('Coefficient modulus is required for this scheme');
        }
        break;

      case HomomorphicScheme.BFV:
        if (!config.plainModulus) {
          throw new Error('Plain modulus is required for BFV scheme');
        }
        break;

      case HomomorphicScheme.CKKS:
        if (!config.scale) {
          throw new Error('Scale is required for CKKS scheme');
        }
        break;
    }
  }

  /**
   * Record operation metrics
   */
  protected recordMetrics(
    operation: HomomorphicOp,
    startTime: Date,
    inputSize: number,
    success: boolean,
    error?: string
  ): void {
    const metrics: PerformanceMetrics = {
      operationId: Math.random().toString(36).substr(2, 9),
      operation,
      startTime,
      endTime: new Date(),
      inputSize,
      memoryUsed: process.memoryUsage().heapUsed,
      success,
      error
    };

    this.metrics.push(metrics);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Get current cache size in MB
   */
  private getCacheSize(): number {
    let size = 0;
    for (const [_, data] of this.cache) {
      size += data.data.byteLength;
    }
    return size / (1024 * 1024); // Convert to MB
  }

  /**
   * Evict items from cache to meet size limit
   */
  private evictCache(maxSizeMB: number): void {
    // Sort by last access time
    const entries = [...this.cache.entries()].sort((a, b) => {
      const timeA = a[1].metadata?.lastAccessed as number || 0;
      const timeB = b[1].metadata?.lastAccessed as number || 0;
      return timeA - timeB;
    });

    while (this.getCacheSize() > maxSizeMB && entries.length > 0) {
      const [key] = entries.shift()!;
      this.cache.delete(key);
    }
  }
} 