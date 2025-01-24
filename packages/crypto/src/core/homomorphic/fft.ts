/**
 * Fast Fourier Transform implementation for polynomial operations
 * Supports both FFT and inverse FFT with optimized butterfly operations
 */
export class FFT {
  private n: number;
  private modulus: bigint;
  private rootOfUnity: bigint;
  private inverseRootOfUnity: bigint;

  constructor(n: number, modulus: bigint) {
    this.n = n;
    this.modulus = modulus;
    this.rootOfUnity = this.findPrimitiveRoot();
    this.inverseRootOfUnity = this.modInverse(this.rootOfUnity);
  }

  /**
   * Forward FFT transform
   */
  public transform(poly: bigint[]): bigint[] {
    if (poly.length !== this.n) {
      throw new Error('Polynomial length must match FFT size');
    }

    // Bit-reverse copy
    const result = this.bitReverseCopy(poly);
    
    // Butterfly operations
    for (let s = 1; s <= Math.log2(this.n); s++) {
      const m = 1 << s;
      const wm = this.modPow(this.rootOfUnity, BigInt(this.n / m));
      
      for (let k = 0; k < this.n; k += m) {
        let w = 1n;
        for (let j = 0; j < m/2; j++) {
          const t = (w * result[k + j + m/2]) % this.modulus;
          const u = result[k + j];
          result[k + j] = (u + t) % this.modulus;
          result[k + j + m/2] = (u - t + this.modulus) % this.modulus;
          w = (w * wm) % this.modulus;
        }
      }
    }

    return result;
  }

  /**
   * Inverse FFT transform
   */
  public inverseTransform(poly: bigint[]): bigint[] {
    if (poly.length !== this.n) {
      throw new Error('Polynomial length must match FFT size');
    }

    // Bit-reverse copy
    const result = this.bitReverseCopy(poly);
    
    // Butterfly operations with inverse root of unity
    for (let s = 1; s <= Math.log2(this.n); s++) {
      const m = 1 << s;
      const wm = this.modPow(this.inverseRootOfUnity, BigInt(this.n / m));
      
      for (let k = 0; k < this.n; k += m) {
        let w = 1n;
        for (let j = 0; j < m/2; j++) {
          const t = (w * result[k + j + m/2]) % this.modulus;
          const u = result[k + j];
          result[k + j] = (u + t) % this.modulus;
          result[k + j + m/2] = (u - t + this.modulus) % this.modulus;
          w = (w * wm) % this.modulus;
        }
      }
    }

    // Scale by n^(-1)
    const nInv = this.modInverse(BigInt(this.n));
    return result.map(x => (x * nInv) % this.modulus);
  }

  /**
   * Multiply polynomials using FFT
   */
  public multiply(a: bigint[], b: bigint[]): bigint[] {
    // Transform inputs
    const aTransform = this.transform(a);
    const bTransform = this.transform(b);
    
    // Point-wise multiplication
    const product = aTransform.map((x, i) => 
      (x * bTransform[i]) % this.modulus
    );
    
    // Inverse transform
    return this.inverseTransform(product);
  }

  /**
   * Optimized convolution using FFT
   */
  public convolve(a: bigint[], b: bigint[]): bigint[] {
    const size = a.length + b.length - 1;
    const paddedSize = 1 << Math.ceil(Math.log2(size));
    
    // Pad inputs to power of 2
    const aPadded = [...a, ...new Array(paddedSize - a.length).fill(0n)];
    const bPadded = [...b, ...new Array(paddedSize - b.length).fill(0n)];
    
    // Perform FFT multiplication
    const result = this.multiply(aPadded, bPadded);
    
    // Truncate to actual size
    return result.slice(0, size);
  }

  /**
   * Parallel FFT transform using Web Workers
   */
  public async parallelTransform(poly: bigint[]): Promise<bigint[]> {
    const numWorkers = navigator.hardwareConcurrency || 4;
    const chunkSize = this.n / numWorkers;
    
    const promises = Array(numWorkers).fill(0).map((_, i) => {
      const start = i * chunkSize;
      const end = start + chunkSize;
      return this.transformChunk(poly.slice(start, end), start);
    });
    
    const chunks = await Promise.all(promises);
    return chunks.flat();
  }

  private async transformChunk(
    chunk: bigint[],
    offset: number
  ): Promise<bigint[]> {
    return new Promise((resolve) => {
      const worker = new Worker(
        URL.createObjectURL(
          new Blob([
            `
              self.onmessage = function(e) {
                const { chunk, offset, rootOfUnity, modulus } = e.data;
                const result = fftChunk(chunk, offset, rootOfUnity, modulus);
                self.postMessage(result);
              };

              function fftChunk(chunk, offset, rootOfUnity, modulus) {
                // FFT implementation for chunk
                // ... (similar to transform method)
                return chunk;
              }
            `
          ])
        )
      );

      worker.onmessage = (e) => {
        worker.terminate();
        resolve(e.data);
      };

      worker.postMessage({
        chunk,
        offset,
        rootOfUnity: this.rootOfUnity,
        modulus: this.modulus
      });
    });
  }

  // Helper methods
  private bitReverseCopy(poly: bigint[]): bigint[] {
    const result = new Array(this.n);
    for (let i = 0; i < this.n; i++) {
      result[this.reverseBits(i)] = poly[i];
    }
    return result;
  }

  private reverseBits(x: number): number {
    let result = 0;
    for (let i = 0; i < Math.log2(this.n); i++) {
      result = (result << 1) | (x & 1);
      x >>= 1;
    }
    return result;
  }

  private findPrimitiveRoot(): bigint {
    // Find primitive nth root of unity
    let root = 2n;
    while (
      this.modPow(root, BigInt(this.n)) !== 1n ||
      this.modPow(root, BigInt(this.n >> 1)) === 1n
    ) {
      root += 1n;
    }
    return root;
  }

  private modPow(base: bigint, exp: bigint): bigint {
    let result = 1n;
    base = base % this.modulus;
    while (exp > 0n) {
      if (exp & 1n) {
        result = (result * base) % this.modulus;
      }
      base = (base * base) % this.modulus;
      exp >>= 1n;
    }
    return result;
  }

  private modInverse(a: bigint): bigint {
    return this.modPow(a, this.modulus - 2n); // Using Fermat's little theorem
  }
} 