import { FHEParams, FHECiphertext } from './fhe';
import { CRT } from './crt';
import { SIMD } from './simd';

export class KeySwitcher {
  private params: FHEParams;
  private crt: CRT;
  private simd: SIMD;
  private decompositionBase: bigint;
  private decompositionSize: number;

  constructor(
    params: FHEParams,
    primes: bigint[],
    decompositionBase = 1n << 8n,
    decompositionSize = 4
  ) {
    this.params = params;
    this.crt = new CRT(primes);
    this.simd = new SIMD();
    this.decompositionBase = decompositionBase;
    this.decompositionSize = decompositionSize;
  }

  /**
   * Generate key switching key
   */
  public async generateKeySwitchingKey(
    oldKey: Buffer,
    newKey: Buffer
  ): Promise<Buffer> {
    const oldKeyPoly = this.bufferToPolynomial(oldKey);
    const newKeyPoly = this.bufferToPolynomial(newKey);
    const components: Buffer[] = [];

    // Convert to CRT representation for faster operations
    const oldKeyCRT = this.crt.polyToCRT(oldKeyPoly);
    const newKeyCRT = this.crt.polyToCRT(newKeyPoly);

    // Generate key switching components
    for (let i = 0; i < this.decompositionSize; i++) {
      const factor = this.decompositionBase ** BigInt(i);
      
      // Generate random polynomial and error
      const a = this.generateRandomPolynomial();
      const e = this.generateErrorPolynomial();
      
      // Convert to CRT
      const aCRT = this.crt.polyToCRT(a);
      const eCRT = this.crt.polyToCRT(e);
      
      // Compute b = -(a*s' + e) + p^i * s mod q
      const as = await this.simd.parallelMultiply(
        this.flattenCRT(aCRT),
        this.flattenCRT(newKeyCRT),
        this.params.q
      );
      
      const scaled = this.scalePolynomialCRT(oldKeyCRT, factor);
      const b = this.subtractPolynomialsCRT(
        scaled,
        this.addPolynomialsCRT(this.reshapeCRT(as), eCRT)
      );
      
      components.push(
        this.polynomialToBuffer(this.crt.polyFromCRT(b)),
        this.polynomialToBuffer(a)
      );
    }

    return Buffer.concat(components);
  }

  /**
   * Perform key switching on a ciphertext
   */
  public async keySwitch(
    ciphertext: FHECiphertext,
    switchingKey: Buffer
  ): Promise<FHECiphertext> {
    // Convert ciphertext to CRT representation
    const c0CRT = this.crt.polyToCRT(this.bufferToPolynomial(ciphertext.c0));
    const c1CRT = this.crt.polyToCRT(this.bufferToPolynomial(ciphertext.c1));
    
    // Initialize result
    let resultC0 = c0CRT;
    let resultC1 = Array(this.params.n).fill(0).map(() => 
      Array(this.crt.primes.length).fill(0n)
    );
    
    // Process each decomposition level
    for (let i = 0; i < this.decompositionSize; i++) {
      const componentSize = this.params.n * 8;
      const factor = this.decompositionBase ** BigInt(i);
      
      // Extract switching key components
      const b = this.bufferToPolynomial(
        switchingKey.subarray(i * 2 * componentSize, (i * 2 + 1) * componentSize)
      );
      const a = this.bufferToPolynomial(
        switchingKey.subarray((i * 2 + 1) * componentSize, (i * 2 + 2) * componentSize)
      );
      
      // Convert to CRT
      const bCRT = this.crt.polyToCRT(b);
      const aCRT = this.crt.polyToCRT(a);
      
      // Decompose c1
      const c1Scaled = this.scalePolynomialCRT(c1CRT, factor);
      
      // Compute contribution
      const termB = await this.simd.parallelMultiply(
        this.flattenCRT(bCRT),
        this.flattenCRT(c1Scaled),
        this.params.q
      );
      
      const termA = await this.simd.parallelMultiply(
        this.flattenCRT(aCRT),
        this.flattenCRT(c1Scaled),
        this.params.q
      );
      
      // Add to result
      resultC0 = this.addPolynomialsCRT(resultC0, this.reshapeCRT(termB));
      resultC1 = this.addPolynomialsCRT(resultC1, this.reshapeCRT(termA));
    }
    
    return {
      c0: this.polynomialToBuffer(this.crt.polyFromCRT(resultC0)),
      c1: this.polynomialToBuffer(this.crt.polyFromCRT(resultC1))
    };
  }

  // Helper methods for CRT operations
  private flattenCRT(poly: bigint[][]): bigint[] {
    return poly.flat();
  }

  private reshapeCRT(flat: bigint[]): bigint[][] {
    const result: bigint[][] = [];
    const width = this.crt.primes.length;
    for (let i = 0; i < flat.length; i += width) {
      result.push(flat.slice(i, i + width));
    }
    return result;
  }

  private addPolynomialsCRT(a: bigint[][], b: bigint[][]): bigint[][] {
    return a.map((row, i) => this.crt.addCRT(row, b[i]));
  }

  private subtractPolynomialsCRT(a: bigint[][], b: bigint[][]): bigint[][] {
    return a.map((row, i) => 
      row.map((x, j) => (x - b[i][j] + this.params.q) % this.params.q)
    );
  }

  private scalePolynomialCRT(poly: bigint[][], factor: bigint): bigint[][] {
    return poly.map(row => row.map(x => (x * factor) % this.params.q));
  }

  // Basic conversion methods
  private bufferToPolynomial(buf: Buffer): bigint[] {
    const poly = new Array(this.params.n);
    for (let i = 0; i < this.params.n; i++) {
      poly[i] = this.bufferToBigInt(buf.subarray(i * 8, (i + 1) * 8));
    }
    return poly;
  }

  private polynomialToBuffer(poly: bigint[]): Buffer {
    const buf = Buffer.alloc(poly.length * 8);
    for (let i = 0; i < poly.length; i++) {
      this.bigIntToBuffer(poly[i], buf.subarray(i * 8, (i + 1) * 8));
    }
    return buf;
  }

  private bigIntToBuffer(num: bigint, buf: Buffer): void {
    for (let i = 0; i < 8; i++) {
      buf[i] = Number((num >> BigInt(i * 8)) & 0xffn);
    }
  }

  private bufferToBigInt(buf: Buffer): bigint {
    let result = 0n;
    for (let i = 0; i < buf.length; i++) {
      result |= BigInt(buf[i]) << BigInt(i * 8);
    }
    return result;
  }

  private generateRandomPolynomial(): bigint[] {
    const poly = new Array(this.params.n);
    for (let i = 0; i < this.params.n; i++) {
      poly[i] = BigInt(Math.floor(Math.random() * Number(this.params.q)));
    }
    return poly;
  }

  private generateErrorPolynomial(): bigint[] {
    const poly = new Array(this.params.n);
    for (let i = 0; i < this.params.n; i++) {
      const gaussian = Math.sqrt(-2 * Math.log(Math.random())) * 
                      Math.cos(2 * Math.PI * Math.random()) * 
                      this.params.variance;
      poly[i] = BigInt(Math.round(gaussian)) % this.params.q;
    }
    return poly;
  }

  public cleanup() {
    this.simd.terminate();
  }
} 