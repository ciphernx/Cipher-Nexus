import { randomBytes } from 'crypto';
import { BigInteger } from 'jsbn';

export interface PaillierKeyPair {
  publicKey: {
    n: BigInteger;  // n = p * q
    g: BigInteger;  // g = n + 1
    bits: number;   // key size in bits
  };
  privateKey: {
    lambda: BigInteger;  // lcm(p-1, q-1)
    mu: BigInteger;      // (L(g^lambda mod n^2))^(-1) mod n
    p: BigInteger;       // first prime
    q: BigInteger;       // second prime
  };
}

export class Paillier {
  static readonly DEFAULT_KEY_SIZE = 2048;
  private static readonly ONE = new BigInteger('1');
  private static readonly TWO = new BigInteger('2');

  /**
   * Generate a new Paillier key pair
   * @param {number} bits - Key size in bits (default: 2048)
   * @returns {Promise<PaillierKeyPair>} Generated key pair
   */
  static async generateKeyPair(bits: number = Paillier.DEFAULT_KEY_SIZE): Promise<PaillierKeyPair> {
    // Generate two large prime numbers p and q
    const p = await this.generatePrime(bits / 2);
    const q = await this.generatePrime(bits / 2);

    // Compute n = p * q
    const n = p.multiply(q);

    // Compute lambda = lcm(p-1, q-1)
    const p1 = p.subtract(this.ONE);
    const q1 = q.subtract(this.ONE);
    const lambda = this.lcm(p1, q1);

    // g = n + 1
    const g = n.add(this.ONE);

    // Compute mu = (L(g^lambda mod n^2))^(-1) mod n
    const nSquare = n.multiply(n);
    const gLambda = g.modPow(lambda, nSquare);
    const L = this.L(gLambda, n);
    const mu = L.modInverse(n);

    return {
      publicKey: { n, g, bits },
      privateKey: { lambda, mu, p, q }
    };
  }

  /**
   * Encrypt a number using Paillier encryption
   * @param {number} m - Number to encrypt
   * @param {PaillierKeyPair['publicKey']} publicKey - Public key
   * @returns {Promise<BigInteger>} Encrypted number
   */
  static async encrypt(m: number, publicKey: PaillierKeyPair['publicKey']): Promise<BigInteger> {
    const { n, g } = publicKey;
    const nSquare = n.multiply(n);
    
    // Convert message to BigInteger and ensure it's positive and smaller than n
    const message = new BigInteger(Math.abs(m).toString());
    if (message.compareTo(n) >= 0) {
      throw new Error('Message is too large');
    }
    
    // Generate random r
    const r = await this.generateRandom(n);
    
    // Compute c = g^m * r^n mod n^2
    const gm = g.modPow(message, nSquare);
    const rn = r.modPow(n, nSquare);
    
    return gm.multiply(rn).mod(nSquare);
  }

  /**
   * Decrypt a number using Paillier encryption
   * @param {BigInteger} c - Encrypted number
   * @param {PaillierKeyPair} keyPair - Key pair
   * @returns {Promise<number>} Decrypted number
   */
  static async decrypt(c: BigInteger, keyPair: PaillierKeyPair): Promise<number> {
    const { n } = keyPair.publicKey;
    const { lambda, mu } = keyPair.privateKey;
    const nSquare = n.multiply(n);
    
    // Compute m = L(c^lambda mod n^2) * mu mod n
    const cLambda = c.modPow(lambda, nSquare);
    const L = this.L(cLambda, n);
    const m = L.multiply(mu).mod(n);
    
    // Convert BigInteger to number
    const result = parseInt(m.toString(), 10);
    if (isNaN(result)) {
      throw new Error('Decryption failed');
    }
    return result;
  }

  /**
   * Add two encrypted numbers
   * @param {BigInteger} c1 - First encrypted number
   * @param {BigInteger} c2 - Second encrypted number
   * @param {PaillierKeyPair['publicKey']} publicKey - Public key
   * @returns {Promise<BigInteger>} Encrypted sum
   */
  static async add(c1: BigInteger, c2: BigInteger, publicKey: PaillierKeyPair['publicKey']): Promise<BigInteger> {
    const nSquare = publicKey.n.multiply(publicKey.n);
    return c1.multiply(c2).mod(nSquare);
  }

  /**
   * Multiply an encrypted number by a constant
   * @param {BigInteger} c - Encrypted number
   * @param {number} k - Constant
   * @param {PaillierKeyPair['publicKey']} publicKey - Public key
   * @returns {Promise<BigInteger>} Encrypted product
   */
  static async multiplyByConstant(c: BigInteger, k: number, publicKey: PaillierKeyPair['publicKey']): Promise<BigInteger> {
    if (k < 0) {
      throw new Error('Constant must be non-negative');
    }
    const nSquare = publicKey.n.multiply(publicKey.n);
    return c.modPow(new BigInteger(k.toString()), nSquare);
  }

  // Helper functions
  private static async generatePrime(bits: number): Promise<BigInteger> {
    const minIterations = 20; // Number of Miller-Rabin iterations
    
    while (true) {
      // Generate random odd number
      const bytes = Math.ceil(bits / 8);
      const buffer = randomBytes(bytes);
      const hex = buffer.toString('hex');
      const n = new BigInteger(hex, 16);
      n.setBit(bits - 1); // Ensure correct bit length
      n.setBit(0);        // Ensure odd
      
      if (await this.isProbablePrime(n, minIterations)) {
        return n;
      }
    }
  }

  private static async isProbablePrime(n: BigInteger, iterations: number): Promise<boolean> {
    if (n.compareTo(this.TWO) < 0) return false;
    if (n.equals(this.TWO)) return true;
    if (n.mod(this.TWO).equals(this.ZERO)) return false;

    // Write n-1 as 2^s * d
    let s = 0;
    let d = n.subtract(this.ONE);
    while (d.mod(this.TWO).equals(this.ZERO)) {
      s++;
      d = d.divide(this.TWO);
    }

    // Witness loop
    for (let i = 0; i < iterations; i++) {
      const a = await this.generateRandom(n.subtract(this.TWO));
      let x = a.modPow(d, n);

      if (x.equals(this.ONE) || x.equals(n.subtract(this.ONE))) continue;

      let isPrime = false;
      for (let r = 1; r < s; r++) {
        x = x.multiply(x).mod(n);
        if (x.equals(n.subtract(this.ONE))) {
          isPrime = true;
          break;
        }
        if (x.equals(this.ONE)) return false;
      }

      if (!isPrime) return false;
    }

    return true;
  }

  private static async generateRandom(max: BigInteger): Promise<BigInteger> {
    const bytes = Math.ceil(max.bitLength() / 8);
    let r: BigInteger;
    do {
      const buffer = randomBytes(bytes);
      const hex = buffer.toString('hex');
      r = new BigInteger(hex, 16);
    } while (r.compareTo(max) >= 0);
    return r;
  }

  private static L(x: BigInteger, n: BigInteger): BigInteger {
    return x.subtract(this.ONE).divide(n);
  }

  private static lcm(a: BigInteger, b: BigInteger): BigInteger {
    return a.multiply(b).divide(a.gcd(b));
  }

  private static readonly ZERO = new BigInteger('0');
}
