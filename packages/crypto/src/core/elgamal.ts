import { randomBytes } from 'crypto';
import { BigInteger } from 'jsbn';

// Interface for ElGamal public key
export interface ElGamalPublicKey {
  p: BigInteger; // Prime modulus
  g: BigInteger; // Generator
  h: BigInteger; // Public value h = g^x mod p
}

// Interface for ElGamal private key
export interface ElGamalPrivateKey {
  x: BigInteger; // Private exponent
}

// Interface for ElGamal ciphertext
export interface ElGamalCiphertext {
  c1: BigInteger; // First component c1 = g^r
  c2: BigInteger; // Second component c2 = h^r * m
}

export class ElGamal {
  private static readonly ONE = new BigInteger('1');
  private static readonly TWO = new BigInteger('2');
  private static readonly ZERO = new BigInteger('0');

  /**
   * Generate an ElGamal key pair
   * @param bits Number of bits for the prime modulus
   * @returns Public and private keys
   */
  public static async generateKeyPair(bits: number): Promise<{
    publicKey: ElGamalPublicKey;
    privateKey: ElGamalPrivateKey;
  }> {
    // Generate a safe prime p = 2q + 1 where q is also prime
    let q: BigInteger;
    let p: BigInteger;
    let isPrime = false;

    do {
      // Generate q
      const bytes = Math.ceil(bits / 8);
      const buffer = randomBytes(bytes);
      const hex = buffer.toString('hex');
      q = new BigInteger(hex, 16);
      
      // Calculate p = 2q + 1
      p = q.multiply(this.TWO).add(this.ONE);
      
      // Check if both p and q are prime
      isPrime = await this.isProbablePrime(p) && await this.isProbablePrime(q);
    } while (!isPrime);

    // Find a generator g of the q-order subgroup
    const g = await this.findGenerator(p, q);

    // Generate private key x
    const bytes = Math.ceil(q.bitLength() / 8);
    const buffer = randomBytes(bytes);
    const hex = buffer.toString('hex');
    const x = new BigInteger(hex, 16).mod(q);

    // Calculate public key h = g^x mod p
    const h = g.modPow(x, p);

    return {
      publicKey: { p, g, h },
      privateKey: { x }
    };
  }

  /**
   * Encrypt a message using ElGamal encryption
   * @param message The message to encrypt (as a BigInteger)
   * @param publicKey The public key to encrypt with
   * @returns The ciphertext
   */
  public static async encrypt(
    message: BigInteger,
    publicKey: ElGamalPublicKey
  ): Promise<ElGamalCiphertext> {
    // Ensure message is in the correct range
    if (message.compareTo(this.ZERO) < 0 || message.compareTo(publicKey.p) >= 0) {
      throw new Error('Message must be in range [0, p-1]');
    }

    // Generate random value r
    const bytes = Math.ceil(publicKey.p.bitLength() / 8);
    const buffer = randomBytes(bytes);
    const hex = buffer.toString('hex');
    const r = new BigInteger(hex, 16).mod(publicKey.p.subtract(this.ONE));

    // Calculate c1 = g^r mod p
    const c1 = publicKey.g.modPow(r, publicKey.p);

    // Calculate c2 = h^r * m mod p
    const hr = publicKey.h.modPow(r, publicKey.p);
    const c2 = hr.multiply(message).mod(publicKey.p);

    return { c1, c2 };
  }

  /**
   * Decrypt a ciphertext using ElGamal decryption
   * @param ciphertext The ciphertext to decrypt
   * @param privateKey The private key to decrypt with
   * @param publicKey The public key (needed for modulus)
   * @returns The decrypted message
   */
  public static async decrypt(
    ciphertext: ElGamalCiphertext,
    privateKey: ElGamalPrivateKey,
    publicKey: ElGamalPublicKey
  ): Promise<BigInteger> {
    // Calculate s = c1^x mod p
    const s = ciphertext.c1.modPow(privateKey.x, publicKey.p);

    // Calculate m = c2 * s^(-1) mod p
    const sInverse = s.modInverse(publicKey.p);
    const message = ciphertext.c2.multiply(sInverse).mod(publicKey.p);

    return message;
  }

  /**
   * Multiply two ciphertexts (homomorphic multiplication)
   * @param ct1 First ciphertext
   * @param ct2 Second ciphertext
   * @param publicKey Public key for modulus
   * @returns Product ciphertext that decrypts to the product of the plaintexts
   */
  public static multiply(
    ct1: ElGamalCiphertext,
    ct2: ElGamalCiphertext,
    publicKey: ElGamalPublicKey
  ): ElGamalCiphertext {
    // Multiply component-wise
    const c1 = ct1.c1.multiply(ct2.c1).mod(publicKey.p);
    const c2 = ct1.c2.multiply(ct2.c2).mod(publicKey.p);

    return { c1, c2 };
  }

  /**
   * Raise a ciphertext to a power (homomorphic exponentiation)
   * @param ct The ciphertext
   * @param exponent The exponent
   * @param publicKey Public key for modulus
   * @returns Power ciphertext that decrypts to the plaintext raised to the exponent
   */
  public static power(
    ct: ElGamalCiphertext,
    exponent: BigInteger,
    publicKey: ElGamalPublicKey
  ): ElGamalCiphertext {
    // Raise each component to the exponent
    const c1 = ct.c1.modPow(exponent, publicKey.p);
    const c2 = ct.c2.modPow(exponent, publicKey.p);

    return { c1, c2 };
  }

  /**
   * Check if a number is probably prime using Miller-Rabin test
   * @param n Number to test
   * @returns true if probably prime, false if composite
   */
  private static async isProbablePrime(n: BigInteger): Promise<boolean> {
    const k = 20; // Number of iterations
    if (n.compareTo(this.ONE) <= 0) return false;
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
    for (let i = 0; i < k; i++) {
      // Generate random base a
      const bytes = Math.ceil(n.bitLength() / 8);
      const buffer = randomBytes(bytes);
      const hex = buffer.toString('hex');
      const a = new BigInteger(hex, 16).mod(n.subtract(this.TWO)).add(this.TWO);

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

  /**
   * Find a generator of the q-order subgroup of Z_p*
   * @param p Prime modulus
   * @param q Prime order of subgroup
   * @returns A generator
   */
  private static async findGenerator(p: BigInteger, q: BigInteger): Promise<BigInteger> {
    const h = p.subtract(this.ONE).divide(q);
    while (true) {
      // Generate random element
      const bytes = Math.ceil(p.bitLength() / 8);
      const buffer = randomBytes(bytes);
      const hex = buffer.toString('hex');
      const a = new BigInteger(hex, 16).mod(p.subtract(this.TWO)).add(this.TWO);
      
      // Calculate g = a^h mod p
      const g = a.modPow(h, p);
      
      // Check if g generates subgroup of order q
      if (!g.equals(this.ONE)) {
        return g;
      }
    }
  }
} 