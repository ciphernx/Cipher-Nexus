import { randomBytes } from 'crypto';
import { BigInteger } from 'jsbn';
import { Hash } from '../hash';

// Interface for Pedersen parameters
export interface PedersenParams {
  p: BigInteger;  // Prime modulus
  q: BigInteger;  // Prime order of subgroup
  g: BigInteger;  // First generator
  h: BigInteger;  // Second generator
}

export class Pedersen {
  private static readonly ONE = new BigInteger('1');
  private static readonly TWO = new BigInteger('2');
  private static readonly ZERO = new BigInteger('0');

  /**
   * Generate parameters for the Pedersen commitment scheme
   * @param bits Number of bits for the prime modulus
   * @returns Parameters for the scheme
   */
  public static async generateParams(bits: number): Promise<PedersenParams> {
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

    // Find generators g and h
    const g = await this.findGenerator(p, q);
    const h = await this.findGenerator(p, q);

    return { p, q, g, h };
  }

  /**
   * Generate a commitment to a message
   * @param message The message to commit to
   * @param randomness The randomness used for the commitment
   * @param params Protocol parameters
   * @returns The commitment
   */
  public static async commit(
    message: BigInteger,
    randomness: BigInteger,
    params: PedersenParams
  ): Promise<BigInteger> {
    // Verify message and randomness are in range
    if (message.compareTo(params.q) >= 0) {
      throw new Error('Message is too large');
    }
    if (randomness.compareTo(params.q) >= 0) {
      throw new Error('Randomness is too large');
    }

    // Calculate commitment = g^m * h^r mod p
    const commitment = params.g.modPow(message, params.p)
      .multiply(params.h.modPow(randomness, params.p))
      .mod(params.p);

    return commitment;
  }

  /**
   * Verify a commitment
   * @param commitment The commitment to verify
   * @param message The message that was committed to
   * @param randomness The randomness used for the commitment
   * @param params Protocol parameters
   * @returns true if the commitment is valid, false otherwise
   */
  public static async verify(
    commitment: BigInteger,
    message: BigInteger,
    randomness: BigInteger,
    params: PedersenParams
  ): Promise<boolean> {
    // Verify message and randomness are in range
    if (message.compareTo(params.q) >= 0) {
      throw new Error('Message is too large');
    }
    if (randomness.compareTo(params.q) >= 0) {
      throw new Error('Randomness is too large');
    }

    // Calculate expected commitment = g^m * h^r mod p
    const expected = params.g.modPow(message, params.p)
      .multiply(params.h.modPow(randomness, params.p))
      .mod(params.p);

    return commitment.equals(expected);
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