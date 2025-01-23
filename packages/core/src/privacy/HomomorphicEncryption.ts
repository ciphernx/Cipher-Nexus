import { randomBytes } from 'crypto';

/**
 * Key pair for homomorphic encryption
 */
export interface HomomorphicKeyPair {
  publicKey: {
    n: bigint;      // Modulus
    g: bigint;      // Generator
  };
  privateKey?: {
    lambda: bigint; // Carmichael's function
    mu: bigint;     // Modular multiplicative inverse
  };
}

/**
 * Security parameters for key generation
 */
export interface SecurityParams {
  keySize: number;  // Key size in bits
  certainty: number; // Prime certainty (Miller-Rabin rounds)
}

export class HomomorphicEncryption {
  private readonly DEFAULT_KEY_SIZE = 2048;
  private readonly DEFAULT_CERTAINTY = 64;

  /**
   * Generate a new key pair for homomorphic encryption
   * @param params Security parameters
   * @returns Generated key pair
   */
  async generateKeyPair(params?: SecurityParams): Promise<HomomorphicKeyPair> {
    const keySize = params?.keySize || this.DEFAULT_KEY_SIZE;
    const certainty = params?.certainty || this.DEFAULT_CERTAINTY;

    // Generate two large prime numbers
    const p = await this.generatePrime(keySize / 2, certainty);
    const q = await this.generatePrime(keySize / 2, certainty);

    // Calculate modulus n = p * q
    const n = p * q;

    // Calculate Carmichael's function λ(n)
    const lambda = this.lcm(p - 1n, q - 1n);

    // Choose generator g
    const g = await this.findGenerator(n);

    // Calculate modular multiplicative inverse μ
    const mu = this.modInverse(this.L(this.modPow(g, lambda, n * n), n), n);

    return {
      publicKey: { n, g },
      privateKey: { lambda, mu }
    };
  }

  /**
   * Encrypt a number using homomorphic encryption
   * @param value Number to encrypt
   * @param publicKey Public key
   * @returns Encrypted value
   */
  encrypt(value: number, publicKey: HomomorphicKeyPair['publicKey']): bigint {
    const { n, g } = publicKey;
    const r = this.generateRandomBigInt(n);
    const m = BigInt(Math.floor(value));
    
    // c = g^m * r^n mod n^2
    const nSquared = n * n;
    const gm = this.modPow(g, m, nSquared);
    const rn = this.modPow(r, n, nSquared);
    
    return (gm * rn) % nSquared;
  }

  /**
   * Decrypt a homomorphically encrypted value
   * @param ciphertext Encrypted value
   * @param keyPair Complete key pair
   * @returns Decrypted value
   */
  decrypt(ciphertext: bigint, keyPair: Required<HomomorphicKeyPair>): number {
    const { n } = keyPair.publicKey;
    const { lambda, mu } = keyPair.privateKey;
    const nSquared = n * n;

    // m = L(c^λ mod n^2) * μ mod n
    const x = this.modPow(ciphertext, lambda, nSquared);
    const L = this.L(x, n);
    const m = (L * mu) % n;

    return Number(m);
  }

  /**
   * Add two encrypted values homomorphically
   * @param a First encrypted value
   * @param b Second encrypted value
   * @param publicKey Public key
   * @returns Encrypted sum
   */
  addEncrypted(
    a: bigint,
    b: bigint,
    publicKey: HomomorphicKeyPair['publicKey']
  ): bigint {
    const nSquared = publicKey.n * publicKey.n;
    return (a * b) % nSquared;
  }

  /**
   * Multiply encrypted value by plain number
   * @param encrypted Encrypted value
   * @param multiplier Plain number
   * @param publicKey Public key
   * @returns Encrypted product
   */
  multiplyByConstant(
    encrypted: bigint,
    multiplier: number,
    publicKey: HomomorphicKeyPair['publicKey']
  ): bigint {
    const nSquared = publicKey.n * publicKey.n;
    return this.modPow(encrypted, BigInt(Math.floor(multiplier)), nSquared);
  }

  /**
   * Multiply two encrypted values homomorphically
   * @param a First encrypted value
   * @param b Second encrypted value
   * @param publicKey Public key
   * @returns Encrypted product
   */
  multiplyEncrypted(
    a: bigint,
    b: bigint,
    publicKey: HomomorphicKeyPair['publicKey']
  ): bigint {
    const nSquared = publicKey.n * publicKey.n;
    return this.modPow(a, b, nSquared);
  }

  /**
   * Divide encrypted value by constant
   * @param encrypted Encrypted value
   * @param divisor Plain number
   * @param publicKey Public key
   * @returns Encrypted quotient
   */
  divideByConstant(
    encrypted: bigint,
    divisor: number,
    publicKey: HomomorphicKeyPair['publicKey']
  ): bigint {
    if (divisor === 0) {
      throw new Error('Division by zero');
    }
    const inverse = this.modInverse(BigInt(Math.floor(divisor)), publicKey.n);
    return this.multiplyByConstant(encrypted, Number(inverse), publicKey);
  }

  /**
   * Calculate encrypted value raised to constant power
   * @param encrypted Encrypted value
   * @param exponent Plain number
   * @param publicKey Public key
   * @returns Encrypted result
   */
  powerByConstant(
    encrypted: bigint,
    exponent: number,
    publicKey: HomomorphicKeyPair['publicKey']
  ): bigint {
    if (exponent < 0) {
      throw new Error('Negative exponents not supported');
    }
    if (exponent === 0) {
      return this.encrypt(1, publicKey);
    }
    const nSquared = publicKey.n * publicKey.n;
    return this.modPow(encrypted, BigInt(Math.floor(exponent)), nSquared);
  }

  /**
   * Negate encrypted value
   * @param encrypted Encrypted value
   * @param publicKey Public key
   * @returns Encrypted negation
   */
  negate(
    encrypted: bigint,
    publicKey: HomomorphicKeyPair['publicKey']
  ): bigint {
    return this.multiplyByConstant(encrypted, -1, publicKey);
  }

  /**
   * Calculate absolute value of encrypted number
   * @param encrypted Encrypted value
   * @param publicKey Public key
   * @param keyPair Complete key pair (needed for comparison)
   * @returns Encrypted absolute value
   */
  async abs(
    encrypted: bigint,
    publicKey: HomomorphicKeyPair['publicKey'],
    keyPair: Required<HomomorphicKeyPair>
  ): Promise<bigint> {
    const value = this.decrypt(encrypted, keyPair);
    if (value >= 0) {
      return encrypted;
    }
    return this.negate(encrypted, publicKey);
  }

  /**
   * Compare two encrypted values
   * @param a First encrypted value
   * @param b Second encrypted value
   * @param keyPair Complete key pair (needed for comparison)
   * @returns -1 if a < b, 0 if a = b, 1 if a > b
   */
  compare(
    a: bigint,
    b: bigint,
    keyPair: Required<HomomorphicKeyPair>
  ): number {
    const valueA = this.decrypt(a, keyPair);
    const valueB = this.decrypt(b, keyPair);
    return Math.sign(valueA - valueB);
  }

  /**
   * Calculate minimum of two encrypted values
   * @param a First encrypted value
   * @param b Second encrypted value
   * @param publicKey Public key
   * @param keyPair Complete key pair
   * @returns Encrypted minimum value
   */
  async min(
    a: bigint,
    b: bigint,
    publicKey: HomomorphicKeyPair['publicKey'],
    keyPair: Required<HomomorphicKeyPair>
  ): Promise<bigint> {
    return this.compare(a, b, keyPair) <= 0 ? a : b;
  }

  /**
   * Calculate maximum of two encrypted values
   * @param a First encrypted value
   * @param b Second encrypted value
   * @param publicKey Public key
   * @param keyPair Complete key pair
   * @returns Encrypted maximum value
   */
  async max(
    a: bigint,
    b: bigint,
    publicKey: HomomorphicKeyPair['publicKey'],
    keyPair: Required<HomomorphicKeyPair>
  ): Promise<bigint> {
    return this.compare(a, b, keyPair) >= 0 ? a : b;
  }

  /**
   * Generate a random prime number
   * @param bits Bit length
   * @param certainty Miller-Rabin rounds
   * @returns Prime number
   */
  private async generatePrime(bits: number, certainty: number): Promise<bigint> {
    while (true) {
      const candidate = this.generateRandomBigInt(2n ** BigInt(bits));
      if (await this.isProbablePrime(candidate, certainty)) {
        return candidate;
      }
    }
  }

  /**
   * Find a generator for the multiplicative group
   * @param n Modulus
   * @returns Generator
   */
  private async findGenerator(n: bigint): Promise<bigint> {
    const nSquared = n * n;
    while (true) {
      const candidate = this.generateRandomBigInt(nSquared);
      if (this.gcd(candidate, nSquared) === 1n) {
        return candidate;
      }
    }
  }

  /**
   * L function for Paillier cryptosystem: L(x,n) = (x-1)/n
   */
  private L(x: bigint, n: bigint): bigint {
    return (x - 1n) / n;
  }

  /**
   * Calculate least common multiple
   */
  private lcm(a: bigint, b: bigint): bigint {
    return (a * b) / this.gcd(a, b);
  }

  /**
   * Calculate greatest common divisor
   */
  private gcd(a: bigint, b: bigint): bigint {
    while (b !== 0n) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  }

  /**
   * Calculate modular multiplicative inverse
   */
  private modInverse(a: bigint, m: bigint): bigint {
    let [old_r, r] = [a, m];
    let [old_s, s] = [1n, 0n];
    let [old_t, t] = [0n, 1n];

    while (r !== 0n) {
      const quotient = old_r / r;
      [old_r, r] = [r, old_r - quotient * r];
      [old_s, s] = [s, old_s - quotient * s];
      [old_t, t] = [t, old_t - quotient * t];
    }

    if (old_r !== 1n) {
      throw new Error('Modular inverse does not exist');
    }

    return (old_s % m + m) % m;
  }

  /**
   * Modular exponentiation
   */
  private modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    if (modulus === 1n) return 0n;
    
    let result = 1n;
    base = base % modulus;
    
    while (exponent > 0n) {
      if (exponent % 2n === 1n) {
        result = (result * base) % modulus;
      }
      base = (base * base) % modulus;
      exponent = exponent / 2n;
    }
    
    return result;
  }

  /**
   * Generate cryptographically secure random BigInt
   */
  private generateRandomBigInt(max: bigint): bigint {
    const bytes = Math.ceil(max.toString(2).length / 8);
    let value: bigint;
    
    do {
      const buf = randomBytes(bytes);
      value = BigInt('0x' + buf.toString('hex'));
    } while (value >= max);
    
    return value;
  }

  /**
   * Miller-Rabin primality test
   */
  private async isProbablePrime(n: bigint, k: number): Promise<boolean> {
    if (n <= 1n || n === 4n) return false;
    if (n <= 3n) return true;

    let d = n - 1n;
    while (d % 2n === 0n) {
      d /= 2n;
    }

    for (let i = 0; i < k; i++) {
      if (!await this.millerRabinTest(n, d)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Single iteration of Miller-Rabin test
   */
  private async millerRabinTest(n: bigint, d: bigint): Promise<boolean> {
    const a = this.generateRandomBigInt(n - 3n) + 2n;
    let x = this.modPow(a, d, n);

    if (x === 1n || x === n - 1n) return true;

    while (d !== n - 1n) {
      x = (x * x) % n;
      d *= 2n;

      if (x === 1n) return false;
      if (x === n - 1n) return true;
    }

    return false;
  }
} 