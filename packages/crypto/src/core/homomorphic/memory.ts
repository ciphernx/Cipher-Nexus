/**
 * Memory and communication optimizations for homomorphic encryption
 */
export class MemoryManager {
  private static instance: MemoryManager;
  private cache: Map<string, WeakRef<any>>;
  private registry: FinalizationRegistry<string>;
  private memoryLimit: number;
  private currentUsage: number;

  private constructor() {
    this.cache = new Map();
    this.registry = new FinalizationRegistry((key) => {
      this.cache.delete(key);
      this.currentUsage = this.estimateMemoryUsage();
    });
    this.memoryLimit = 1024 * 1024 * 1024; // 1GB default
    this.currentUsage = 0;
  }

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Set memory limit
   */
  public setMemoryLimit(limitInBytes: number): void {
    this.memoryLimit = limitInBytes;
    this.cleanup();
  }

  /**
   * Cache polynomial with automatic cleanup
   */
  public cachePolynomial(key: string, poly: bigint[]): void {
    const size = this.estimatePolynomialSize(poly);
    
    if (this.currentUsage + size > this.memoryLimit) {
      this.cleanup();
    }
    
    const ref = new WeakRef(poly);
    this.cache.set(key, ref);
    this.registry.register(poly, key);
    this.currentUsage += size;
  }

  /**
   * Get cached polynomial
   */
  public getCachedPolynomial(key: string): bigint[] | null {
    const ref = this.cache.get(key);
    if (!ref) return null;
    
    const poly = ref.deref();
    if (!poly) {
      this.cache.delete(key);
      return null;
    }
    
    return poly;
  }

  /**
   * Compress polynomial for efficient storage/transmission
   */
  public compressPolynomial(poly: bigint[]): Uint8Array {
    // Find bit length needed for coefficients
    const maxCoeff = poly.reduce((max, x) => 
      x > max ? x : max, 0n
    );
    const bitLength = maxCoeff.toString(2).length;
    
    // Pack coefficients into minimal bytes
    const byteLength = Math.ceil(bitLength * poly.length / 8);
    const result = new Uint8Array(byteLength + 4); // +4 for metadata
    
    // Store metadata
    new DataView(result.buffer).setUint32(0, bitLength, true);
    
    // Pack coefficients
    let currentByte = 4;
    let currentBit = 0;
    
    for (const coeff of poly) {
      const bits = coeff.toString(2).padStart(bitLength, '0');
      
      for (const bit of bits) {
        if (bit === '1') {
          result[currentByte] |= 1 << currentBit;
        }
        
        currentBit++;
        if (currentBit === 8) {
          currentBit = 0;
          currentByte++;
        }
      }
    }
    
    return result;
  }

  /**
   * Decompress polynomial
   */
  public decompressPolynomial(data: Uint8Array): bigint[] {
    // Read metadata
    const bitLength = new DataView(data.buffer).getUint32(0, true);
    
    // Calculate number of coefficients
    const totalBits = (data.length - 4) * 8;
    const numCoeffs = Math.floor(totalBits / bitLength);
    
    const result: bigint[] = new Array(numCoeffs);
    let currentByte = 4;
    let currentBit = 0;
    
    // Extract coefficients
    for (let i = 0; i < numCoeffs; i++) {
      let coeff = 0n;
      
      for (let j = 0; j < bitLength; j++) {
        if (data[currentByte] & (1 << currentBit)) {
          coeff |= 1n << BigInt(j);
        }
        
        currentBit++;
        if (currentBit === 8) {
          currentBit = 0;
          currentByte++;
        }
      }
      
      result[i] = coeff;
    }
    
    return result;
  }

  /**
   * Batch process polynomials with memory constraints
   */
  public async processBatch<T>(
    items: T[],
    processor: (item: T) => Promise<bigint[]>,
    batchSize: number
  ): Promise<bigint[][]> {
    const results: bigint[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(processor)
      );
      
      results.push(...batchResults);
      
      // Force garbage collection between batches
      if (global.gc) {
        global.gc();
      }
    }
    
    return results;
  }

  /**
   * Stream large polynomials
   */
  public async* streamPolynomial(
    poly: bigint[],
    chunkSize: number
  ): AsyncGenerator<Uint8Array> {
    for (let i = 0; i < poly.length; i += chunkSize) {
      const chunk = poly.slice(i, i + chunkSize);
      yield this.compressPolynomial(chunk);
    }
  }

  /**
   * Reconstruct polynomial from stream
   */
  public async reconstructPolynomial(
    stream: AsyncIterable<Uint8Array>
  ): Promise<bigint[]> {
    const chunks: bigint[][] = [];
    
    for await (const chunk of stream) {
      chunks.push(this.decompressPolynomial(chunk));
    }
    
    return chunks.flat();
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let total = 0;
    for (const [key, ref] of this.cache.entries()) {
      const poly = ref.deref();
      if (poly) {
        total += this.estimatePolynomialSize(poly);
      } else {
        this.cache.delete(key);
      }
    }
    return total;
  }

  /**
   * Estimate polynomial size in bytes
   */
  private estimatePolynomialSize(poly: bigint[]): number {
    return poly.reduce((sum, x) => 
      sum + Math.ceil(x.toString(2).length / 8), 0
    );
  }

  /**
   * Clean up memory when approaching limit
   */
  private cleanup(): void {
    if (this.currentUsage <= this.memoryLimit) return;
    
    // Remove oldest entries until under limit
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => {
      const polyA = a[1].deref();
      const polyB = b[1].deref();
      if (!polyA || !polyB) return 0;
      return this.estimatePolynomialSize(polyA) - 
             this.estimatePolynomialSize(polyB);
    });
    
    for (const [key] of entries) {
      if (this.currentUsage <= this.memoryLimit) break;
      this.cache.delete(key);
      this.currentUsage = this.estimateMemoryUsage();
    }
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
  }
} 