import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Compression options
 */
export interface CompressionOptions {
  level?: number; // Compression level (1-9, default: 6)
  threshold?: number; // Minimum size in bytes to compress (default: 1024)
}

/**
 * Compression utility class
 */
export class Compression {
  private readonly level: number;
  private readonly threshold: number;

  constructor(options: CompressionOptions = {}) {
    this.level = options.level || 6;
    this.threshold = options.threshold || 1024;
  }

  /**
   * Compress data if it meets the threshold
   */
  async compress(data: string | Buffer): Promise<Buffer> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    // Don't compress if below threshold
    if (buffer.length < this.threshold) {
      return buffer;
    }

    try {
      return await gzipAsync(buffer, { level: this.level });
    } catch (error) {
      throw new Error(`Compression failed: ${error.message}`);
    }
  }

  /**
   * Decompress data
   */
  async decompress(data: Buffer): Promise<Buffer> {
    try {
      // Check if data is actually compressed
      const isCompressed = data[0] === 0x1f && data[1] === 0x8b;
      if (!isCompressed) {
        return data;
      }

      return await gunzipAsync(data);
    } catch (error) {
      throw new Error(`Decompression failed: ${error.message}`);
    }
  }

  /**
   * Calculate compression ratio
   */
  calculateRatio(original: Buffer, compressed: Buffer): number {
    return compressed.length / original.length;
  }

  /**
   * Estimate potential compression savings
   */
  async estimateSavings(data: string | Buffer): Promise<{
    originalSize: number;
    compressedSize: number;
    ratio: number;
    savings: number;
  }> {
    const original = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const compressed = await this.compress(original);

    const ratio = this.calculateRatio(original, compressed);
    const savings = original.length - compressed.length;

    return {
      originalSize: original.length,
      compressedSize: compressed.length,
      ratio,
      savings
    };
  }
} 