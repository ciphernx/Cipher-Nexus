export class CRT {
  private primes: bigint[];
  private N: bigint;
  private Ni: bigint[];
  private yi: bigint[];

  constructor(primes: bigint[]) {
    this.primes = primes;
    this.N = primes.reduce((a, b) => a * b, 1n);
    this.Ni = primes.map(p => this.N / p);
    this.yi = this.Ni.map((Ni, i) => this.modInverse(Ni, this.primes[i]));
  }

  /**
   * Convert a number to its CRT representation
   */
  public toCRT(x: bigint): bigint[] {
    return this.primes.map(p => x % p);
  }

  /**
   * Convert from CRT representation back to normal form
   */
  public fromCRT(remainders: bigint[]): bigint {
    if (remainders.length !== this.primes.length) {
      throw new Error('Invalid number of remainders');
    }

    let result = 0n;
    for (let i = 0; i < this.primes.length; i++) {
      const term = (remainders[i] * this.Ni[i] * this.yi[i]) % this.N;
      result = (result + term) % this.N;
    }
    return result;
  }

  /**
   * Add two numbers in CRT representation
   */
  public addCRT(a: bigint[], b: bigint[]): bigint[] {
    return a.map((ai, i) => (ai + b[i]) % this.primes[i]);
  }

  /**
   * Multiply two numbers in CRT representation
   */
  public multiplyCRT(a: bigint[], b: bigint[]): bigint[] {
    return a.map((ai, i) => (ai * b[i]) % this.primes[i]);
  }

  /**
   * Convert a polynomial to CRT representation
   */
  public polyToCRT(poly: bigint[]): bigint[][] {
    return poly.map(coeff => this.toCRT(coeff));
  }

  /**
   * Convert a polynomial from CRT representation
   */
  public polyFromCRT(crtPoly: bigint[][]): bigint[] {
    return crtPoly.map(coeffCRT => this.fromCRT(coeffCRT));
  }

  /**
   * Multiply polynomials in CRT representation
   */
  public polyMultiplyCRT(a: bigint[][], b: bigint[][]): bigint[][] {
    const degree = a.length + b.length - 1;
    const result: bigint[][] = Array(degree).fill(0).map(() => 
      Array(this.primes.length).fill(0n)
    );

    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        const product = this.multiplyCRT(a[i], b[j]);
        for (let k = 0; k < this.primes.length; k++) {
          result[i + j][k] = (result[i + j][k] + product[k]) % this.primes[k];
        }
      }
    }

    return result;
  }

  private modInverse(a: bigint, m: bigint): bigint {
    let [old_r, r] = [a, m];
    let [old_s, s] = [1n, 0n];
    
    while (r !== 0n) {
      const quotient = old_r / r;
      [old_r, r] = [r, old_r - quotient * r];
      [old_s, s] = [s, old_s - quotient * s];
    }
    
    return (old_s % m + m) % m;
  }
} 