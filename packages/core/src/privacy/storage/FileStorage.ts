import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { AuditEvent } from '../AuditLogger';
import { HomomorphicKeyPair } from '../HomomorphicEncryption';
import { KeyMetadata } from '../KeyManager';
import { Compression, CompressionOptions } from './compression';

/**
 * File storage configuration
 */
export interface FileStorageConfig {
  basePath: string;
  encryption?: {
    key: Buffer;
    algorithm: string;
  };
  compression?: CompressionOptions;
  maxCacheSize?: number; // Maximum number of items to cache
}

/**
 * File storage implementation with caching and encryption
 */
export class FileStorage {
  private cache: Map<string, {
    data: any;
    timestamp: number;
  }> = new Map();
  private compression: Compression;

  constructor(private readonly config: FileStorageConfig) {
    this.compression = new Compression(config.compression);
  }

  /**
   * Initialize storage
   */
  async initialize(): Promise<void> {
    try {
      // Create base directory if it doesn't exist
      await fs.mkdir(this.config.basePath, { recursive: true });

      // Create subdirectories for different types of data
      await Promise.all([
        fs.mkdir(join(this.config.basePath, 'keys'), { recursive: true }),
        fs.mkdir(join(this.config.basePath, 'audit'), { recursive: true }),
        fs.mkdir(join(this.config.basePath, 'metadata'), { recursive: true })
      ]);
    } catch (error) {
      throw new Error(`Failed to initialize storage: ${error.message}`);
    }
  }

  /**
   * Store data with optional encryption and compression
   */
  async store(type: 'keys' | 'audit' | 'metadata', id: string, data: any): Promise<void> {
    try {
      const path = this.getPath(type, id);
      await fs.mkdir(dirname(path), { recursive: true });

      let processedData = JSON.stringify(data);

      if (this.config.compression) {
        processedData = (await this.compress(processedData)).toString('base64');
      }

      if (this.config.encryption) {
        processedData = await this.encrypt(processedData);
      }

      await fs.writeFile(path, processedData);
      
      // Update cache
      this.updateCache(this.getCacheKey(type, id), data);
    } catch (error) {
      throw new Error(`Failed to store data: ${error.message}`);
    }
  }

  /**
   * Retrieve data with automatic decryption and decompression
   */
  async retrieve<T>(type: 'keys' | 'audit' | 'metadata', id: string): Promise<T | null> {
    try {
      const cacheKey = this.getCacheKey(type, id);
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) return cached;

      const path = this.getPath(type, id);
      
      try {
        await fs.access(path);
      } catch {
        return null;
      }

      let data = await fs.readFile(path, 'utf8');

      if (this.config.encryption) {
        data = await this.decrypt(data);
      }

      if (this.config.compression) {
        data = await this.decompress(Buffer.from(data, 'base64'));
      }

      const parsed = JSON.parse(data);
      this.updateCache(cacheKey, parsed);
      return parsed;
    } catch (error) {
      throw new Error(`Failed to retrieve data: ${error.message}`);
    }
  }

  /**
   * List all items of a specific type
   */
  async list(type: 'keys' | 'audit' | 'metadata'): Promise<string[]> {
    try {
      const dirPath = join(this.config.basePath, type);
      const files = await fs.readdir(dirPath);
      return files.map(f => f.replace('.json', ''));
    } catch (error) {
      throw new Error(`Failed to list items: ${error.message}`);
    }
  }

  /**
   * Delete an item
   */
  async delete(type: 'keys' | 'audit' | 'metadata', id: string): Promise<void> {
    try {
      const path = this.getPath(type, id);
      await fs.unlink(path);
      this.removeFromCache(this.getCacheKey(type, id));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to delete item: ${error.message}`);
      }
    }
  }

  /**
   * Clear all data of a specific type
   */
  async clear(type: 'keys' | 'audit' | 'metadata'): Promise<void> {
    try {
      const dirPath = join(this.config.basePath, type);
      const files = await fs.readdir(dirPath);
      await Promise.all(
        files.map(file => fs.unlink(join(dirPath, file)))
      );
      this.clearTypeFromCache(type);
    } catch (error) {
      throw new Error(`Failed to clear data: ${error.message}`);
    }
  }

  /**
   * Get full path for an item
   */
  private getPath(type: string, id: string): string {
    return join(this.config.basePath, type, `${id}.json`);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(type: string, id: string): string {
    return `${type}:${id}`;
  }

  /**
   * Update cache with new data
   */
  private updateCache(key: string, data: any): void {
    if (!this.config.maxCacheSize) return;

    if (this.cache.size >= this.config.maxCacheSize) {
      // Remove oldest entry
      const oldestKey = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get data from cache
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Update timestamp to mark as recently used
    cached.timestamp = Date.now();
    return cached.data as T;
  }

  /**
   * Remove item from cache
   */
  private removeFromCache(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached items of a specific type
   */
  private clearTypeFromCache(type: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${type}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Encrypt data
   */
  private async encrypt(data: string): Promise<string> {
    if (!this.config.encryption) return data;

    const { key, algorithm } = this.config.encryption;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(data)),
      cipher.final()
    ]);

    return JSON.stringify({
      iv: iv.toString('base64'),
      data: encrypted.toString('base64')
    });
  }

  /**
   * Decrypt data
   */
  private async decrypt(data: string): Promise<string> {
    if (!this.config.encryption) return data;

    const { key, algorithm } = this.config.encryption;
    const { iv, data: encryptedData } = JSON.parse(data);
    
    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(iv, 'base64')
    );

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedData, 'base64')),
      decipher.final()
    ]);

    return decrypted.toString();
  }

  /**
   * Compress data
   */
  private async compress(data: string): Promise<Buffer> {
    if (!this.config.compression) return Buffer.from(data);
    return this.compression.compress(data);
  }

  /**
   * Decompress data
   */
  private async decompress(data: Buffer): Promise<string> {
    if (!this.config.compression) return data.toString();
    const decompressed = await this.compression.decompress(data);
    return decompressed.toString();
  }
} 