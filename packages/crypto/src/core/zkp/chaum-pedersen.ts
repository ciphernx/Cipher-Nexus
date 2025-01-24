import { randomBytes } from 'crypto';
import { BigInteger } from 'jsbn';
import { Hash } from '../hash';

// Interface for Chaum-Pedersen parameters
export interface ChaumPedersenParams {
  p: BigInteger; // Prime modulus
  q: BigInteger; // Prime order of subgroup
  g: BigInteger; // First generator
  h: BigInteger; // Second generator
}

// Interface for Chaum-Pedersen proof
export interface ChaumPedersenProof {
  t1: BigInteger; // First commitment
  t2: BigInteger; // Second commitment
  c: BigInteger;  // Challenge
  s: BigInteger;  // Response
}

export class ChaumPedersen {
  private static readonly ONE = new BigInteger('1');
  private static readonly TWO = new BigInteger('2');
  private static readonly ZERO = new BigInteger('0');

  /**
   * Generate parameters for the Chaum-Pedersen protocol
   * @param bits Number of bits for the prime modulus
   * @returns Parameters for the protocol
   */
  public static async generateParams(bits: number): Promise<ChaumPedersenParams> {
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
   * Generate a proof that two discrete logarithms are equal
   * Proves that y1 = g^x and y2 = h^x for some secret x
   * @param x The secret value
   * @param y1 First public value g^x
   * @param y2 Second public value h^x
   * @param params Protocol parameters
   * @returns A proof of equality
   */
  public static async prove(
    x: BigInteger,
    y1: BigInteger,
    y2: BigInteger,
    params: ChaumPedersenParams
  ): Promise<ChaumPedersenProof> {
    // Generate random value r
    const bytes = Math.ceil(params.q.bitLength() / 8);
    const buffer = randomBytes(bytes);
    const hex = buffer.toString('hex');
    const r = new BigInteger(hex, 16).mod(params.q);

    // Calculate commitments t1 = g^r, t2 = h^r
    const t1 = params.g.modPow(r, params.p);
    const t2 = params.h.modPow(r, params.p);

    // Calculate challenge c = H(g, h, y1, y2, t1, t2)
    const message = Buffer.from(
      params.g.toString() +
      params.h.toString() +
      y1.toString() +
      y2.toString() +
      t1.toString() +
      t2.toString(),
      'utf8'
    );
    const challenge = await Hash.sha256(message);
    const c = new BigInteger(challenge.toString('hex'), 16).mod(params.q);

    // Calculate response s = r + cx mod q
    const s = r.add(c.multiply(x)).mod(params.q);

    return { t1, t2, c, s };
  }

  /**
   * Verify a Chaum-Pedersen proof
   * @param y1 First public value g^x
   * @param y2 Second public value h^x
   * @param proof The proof to verify
   * @param params Protocol parameters
   * @returns true if the proof is valid, false otherwise
   */
  public static async verify(
    y1: BigInteger,
    y2: BigInteger,
    proof: ChaumPedersenProof,
    params: ChaumPedersenParams
  ): Promise<boolean> {
    // Recalculate challenge
    const message = Buffer.from(
      params.g.toString() +
      params.h.toString() +
      y1.toString() +
      y2.toString() +
      proof.t1.toString() +
      proof.t2.toString(),
      'utf8'
    );
    const challenge = await Hash.sha256(message);
    const c = new BigInteger(challenge.toString('hex'), 16).mod(params.q);

    // Verify that c matches the one in the proof
    if (!c.equals(proof.c)) {
      return false;
    }

    // Verify first equation: g^s = t1 * y1^c
    const lhs1 = params.g.modPow(proof.s, params.p);
    const rhs1 = proof.t1.multiply(y1.modPow(proof.c, params.p)).mod(params.p);

    // Verify second equation: h^s = t2 * y2^c
    const lhs2 = params.h.modPow(proof.s, params.p);
    const rhs2 = proof.t2.multiply(y2.modPow(proof.c, params.p)).mod(params.p);

    return lhs1.equals(rhs1) && lhs2.equals(rhs2);
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