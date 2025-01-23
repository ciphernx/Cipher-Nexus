import { EventEmitter } from 'events';

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  value: T;
  size: number;
  hits: number;
  lastAccessed: number;
  expiresAt?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize?: number;        // Maximum cache size in bytes
  maxEntries?: number;     // Maximum number of entries
  ttl?: number;           // Time to live in milliseconds
  checkPeriod?: number;   // Cleanup check period in milliseconds
  maxMemoryUsage?: number; // Maximum memory usage percentage (0-1)
}

/**
 * Advanced cache implementation with LRU, TTL and memory-aware features
 */
export class AdvancedCache<T> extends EventEmitter {
  private entries: Map<string, CacheEntry<T>>;
  private config: Required<CacheConfig>;
  private currentSize: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig = {}) {
    super();
    this.entries = new Map();
    this.currentSize = 0;
    this.config = {
      maxSize: config.maxSize || 1024 * 1024 * 100, // 100MB
      maxEntries: config.maxEntries || 1000,
      ttl: config.ttl || 1000 * 60 * 60, // 1 hour
      checkPeriod: config.checkPeriod || 1000 * 60, // 1 minute
      maxMemoryUsage: config.maxMemoryUsage || 0.8 // 80%
    };

    this.startCleanupTimer();
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T, size?: number): void {
    const entry: CacheEntry<T> = {
      value,
      size: size || this.calculateSize(value),
      hits: 0,
      lastAccessed: Date.now(),
      expiresAt: this.config.ttl > 0 ? Date.now() + this.config.ttl : undefined
    };

    // Check if we need to make space
    if (this.shouldEvict(entry.size)) {
      this.evict();
    }

    // Check memory usage
    if (this.isMemoryUsageHigh()) {
      this.emit('memory-pressure');
      this.evictByMemory();
    }

    // Add new entry
    const existing = this.entries.get(key);
    if (existing) {
      this.currentSize -= existing.size;
    }

    this.entries.set(key, entry);
    this.currentSize += entry.size;
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.delete(key);
      return undefined;
    }

    // Update stats
    entry.hits++;
    entry.lastAccessed = Date.now();
    
    return entry.value;
  }

  /**
   * Delete a value from the cache
   */
  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.entries.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.entries.clear();
    this.currentSize = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.currentSize,
      entries: this.entries.size,
      memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal
    };
  }

  /**
   * Stop the cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  private startCleanupTimer(): void {
    if (this.config.checkPeriod > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.config.checkPeriod);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.delete(key);
      }
    }
  }

  private shouldEvict(newSize: number): boolean {
    return (
      this.currentSize + newSize > this.config.maxSize ||
      this.entries.size >= this.config.maxEntries
    );
  }

  private evict(): void {
    // Get entries sorted by last accessed time and hits
    const entries = Array.from(this.entries.entries())
      .sort((a, b) => {
        const timeScore = a[1].lastAccessed - b[1].lastAccessed;
        const hitScore = a[1].hits - b[1].hits;
        return timeScore + hitScore * 0.1; // Weight hits less than time
      });

    // Remove entries until we have enough space
    while (
      entries.length > 0 &&
      (this.currentSize > this.config.maxSize ||
        this.entries.size >= this.config.maxEntries)
    ) {
      const [key, entry] = entries.shift()!;
      this.delete(key);
    }
  }

  private evictByMemory(): void {
    const memoryUsage = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal;
    
    if (memoryUsage > this.config.maxMemoryUsage) {
      // Remove 20% of entries
      const entriesToRemove = Math.ceil(this.entries.size * 0.2);
      const entries = Array.from(this.entries.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
        .slice(0, entriesToRemove);

      for (const [key] of entries) {
        this.delete(key);
      }
    }
  }

  private isMemoryUsageHigh(): boolean {
    return process.memoryUsage().heapUsed / process.memoryUsage().heapTotal > this.config.maxMemoryUsage;
  }

  private calculateSize(value: T): number {
    if (value instanceof Uint8Array || value instanceof Buffer) {
      return value.byteLength;
    }
    return Buffer.byteLength(JSON.stringify(value));
  }
} 