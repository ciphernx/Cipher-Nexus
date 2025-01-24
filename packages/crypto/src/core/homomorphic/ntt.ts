import { randomBytes } from 'crypto';

export class NTT {
  private n: number;
  private q: bigint;
  private w: bigint;
  private w_inv: bigint;
  private n_inv: bigint;

  constructor(n: number, q: bigint) {
    this.n = n;
    this.q = q;
    // Find primitive nth root of unity modulo q
    this.w = this.findPrimitiveRoot();
    this.w_inv = this.modInverse(this.w);
    this.n_inv = this.modInverse(BigInt(n));
  }

  // Forward NTT
  public transform(poly: bigint[]): bigint[] {
    const result = new Array(this.n).fill(0n);
    let w_pow = 1n;
    
    for (let k = 0; k < this.n; k++) {
      let sum = 0n;
      for (let i = 0; i < this.n; i++) {
        sum = (sum + poly[i] * this.modPow(this.w, BigInt(i * k))) % this.q;
      }
      result[k] = sum;
    }
    
    return result;
  }

  // Inverse NTT
  public inverseTransform(poly: bigint[]): bigint[] {
    const result = new Array(this.n).fill(0n);
    
    for (let k = 0; k < this.n; k++) {
      let sum = 0n;
      for (let i = 0; i < this.n; i++) {
        sum = (sum + poly[i] * this.modPow(this.w_inv, BigInt(i * k))) % this.q;
      }
      result[k] = (sum * this.n_inv) % this.q;
    }
    
    return result;
  }

  // Polynomial multiplication using NTT
  public multiply(a: bigint[], b: bigint[]): bigint[] {
    const a_ntt = this.transform(a);
    const b_ntt = this.transform(b);
    
    // Point-wise multiplication in NTT domain
    const prod_ntt = a_ntt.map((x, i) => (x * b_ntt[i]) % this.q);
    
    // Transform back
    return this.inverseTransform(prod_ntt);
  }

  // Helper methods
  private modPow(base: bigint, exp: bigint): bigint {
    let result = 1n;
    base = base % this.q;
    while (exp > 0n) {
      if (exp & 1n) {
        result = (result * base) % this.q;
      }
      base = (base * base) % this.q;
      exp >>= 1n;
    }
    return result;
  }

  private modInverse(a: bigint): bigint {
    return this.modPow(a, this.q - 2n); // Using Fermat's little theorem
  }

  private findPrimitiveRoot(): bigint {
    // Find a primitive nth root of unity
    // For simplicity, we assume q is a prime where q ≡ 1 (mod 2n)
    let w = 2n;
    while (this.modPow(w, BigInt(this.n)) !== 1n || 
           this.modPow(w, BigInt(this.n / 2)) === 1n) {
      w += 1n;
    }
    return w;
  }
} 