import { randomBytes } from 'crypto';
import { BigInteger } from 'jsbn';
import { Hash } from '../hash';

/**
 * Schnorr protocol parameters
 */
export interface SchnorrParams {
  p: BigInteger;  // Large prime
  q: BigInteger;  // Prime divisor of p-1
  g: BigInteger;  // Generator of order q
}

/**
 * Schnorr proof
 */
export interface SchnorrProof {
  commitment: BigInteger;  // g^r mod p
  challenge: BigInteger;   // Hash(g, h, commitment)
  response: BigInteger;    // r + x * challenge mod q
}

/**
 * Implementation of the Schnorr zero-knowledge proof protocol
 * Proves knowledge of x in y = g^x mod p without revealing x
 */
export class SchnorrProtocol {
  private readonly ONE = new BigInteger('1');
  private readonly TWO = new BigInteger('2');

  /**
   * Generate protocol parameters
   * @param bitLength Bit length of prime p
   */
  public static async generateParams(bitLength: number): Promise<SchnorrParams> {
    // Generate prime p such that p-1 = 2q where q is also prime (safe prime)
    let p: BigInteger;
    let q: BigInteger;
    
    do {
      q = await this.generatePrime(bitLength - 1);
      p = q.shiftLeft(1).add(this.ONE);
    } while (!p.isProbablePrime(50));

    // Find generator g of order q
    const g = await this.findGenerator(p, q);

    return { p, q, g };
  }

  /**
   * Generate a proof of knowledge of discrete logarithm
   * @param secret Secret value x where y = g^x mod p
   * @param params Protocol parameters
   */
  public async prove(secret: BigInteger, params: SchnorrParams): Promise<SchnorrProof> {
    // Verify parameters
    this.verifyParams(params);

    // Verify secret is in range [1, q-1]
    if (secret.compareTo(this.ONE) < 0 || secret.compareTo(params.q) >= 0) {
      throw new Error('Secret must be in range [1, q-1]');
    }

    // Generate random value r in [1, q-1]
    const r = this.generateRandom(params.q);

    // Compute commitment t = g^r mod p
    const commitment = params.g.modPow(r, params.p);

    // Compute public value y = g^x mod p
    const publicValue = params.g.modPow(secret, params.p);

    // Compute challenge c = H(g || y || t)
    const challenge = await this.computeChallenge(params.g, publicValue, commitment, params.q);

    // Compute response s = r + x * c mod q
    const response = r.add(secret.multiply(challenge)).mod(params.q);

    return {
      commitment,
      challenge,
      response
    };
  }

  /**
   * Verify a Schnorr proof
   * @param proof The proof to verify
   * @param publicValue Public value y = g^x mod p
   * @param params Protocol parameters
   */
  public async verify(
    proof: SchnorrProof,
    publicValue: BigInteger,
    params: SchnorrParams
  ): Promise<boolean> {
    // Verify parameters
    this.verifyParams(params);

    // Verify proof components are in range [1, p-1]
    if (proof.commitment.compareTo(this.ONE) < 0 || proof.commitment.compareTo(params.p) >= 0) {
      return false;
    }
    if (proof.response.compareTo(this.ONE) < 0 || proof.response.compareTo(params.q) >= 0) {
      return false;
    }

    // Verify commitment t = g^s * y^(-c) mod p
    const lhs = params.g.modPow(proof.response, params.p);
    const rhs = proof.commitment.multiply(
      publicValue.modPow(proof.challenge, params.p).modInverse(params.p)
    ).mod(params.p);

    if (!lhs.equals(rhs)) {
      return false;
    }

    // Verify challenge c = H(g || y || t)
    const expectedChallenge = await this.computeChallenge(
      params.g,
      publicValue,
      proof.commitment,
      params.q
    );

    return proof.challenge.equals(expectedChallenge);
  }

  /**
   * Generate a random value in range [1, max-1]
   */
  private generateRandom(max: BigInteger): BigInteger {
    const bytes = max.toByteArray().length;
    let r: BigInteger;
    
    do {
      const buf = randomBytes(bytes);
      r = new BigInteger(buf.toString('hex'), 16).mod(max);
    } while (r.equals(this.ONE) || r.signum() === 0);

    return r;
  }

  /**
   * Generate a probable prime number of given bit length
   */
  private static async generatePrime(bitLength: number): Promise<BigInteger> {
    let prime: BigInteger;
    
    do {
      const buf = randomBytes(Math.ceil(bitLength / 8));
      prime = new BigInteger(buf.toString('hex'), 16);
      // Ensure the number has exactly bitLength bits
      prime.setBit(bitLength - 1);
      // Ensure the number is odd
      prime.setBit(0);
    } while (!prime.isProbablePrime(50));

    return prime;
  }

  /**
   * Find a generator of order q in Z_p*
   */
  private static async findGenerator(p: BigInteger, q: BigInteger): Promise<BigInteger> {
    const ONE = new BigInteger('1');
    const TWO = new BigInteger('2');
    
    // Find h such that g = h^2 mod p is a generator
    let h: BigInteger;
    let g: BigInteger;
    
    do {
      const bytes = p.toByteArray().length;
      const buf = randomBytes(bytes);
      h = new BigInteger(buf.toString('hex'), 16).mod(p);
      // Compute g = h^2 mod p
      g = h.modPow(TWO, p);
    } while (
      g.equals(ONE) ||
      g.modPow(q, p).equals(ONE)
    );

    return g;
  }

  /**
   * Compute Fiat-Shamir challenge
   */
  private async computeChallenge(
    g: BigInteger,
    y: BigInteger,
    t: BigInteger,
    q: BigInteger
  ): Promise<BigInteger> {
    const hash = await Hash.sha256(
      Buffer.concat([
        Buffer.from(g.toString(16), 'hex'),
        Buffer.from(y.toString(16), 'hex'),
        Buffer.from(t.toString(16), 'hex')
      ])
    );

    return new BigInteger(hash.toString('hex'), 16).mod(q);
  }

  /**
   * Verify protocol parameters
   */
  private verifyParams(params: SchnorrParams): void {
    // Verify prime p
    if (!params.p.isProbablePrime(50)) {
      throw new Error('Parameter p must be prime');
    }

    // Verify prime q
    if (!params.q.isProbablePrime(50)) {
      throw new Error('Parameter q must be prime');
    }

    // Verify p = 2q + 1
    if (!params.p.subtract(this.ONE).equals(params.q.shiftLeft(1))) {
      throw new Error('Parameter p must equal 2q + 1');
    }

    // Verify generator g
    if (params.g.compareTo(this.TWO) < 0 || params.g.compareTo(params.p) >= 0) {
      throw new Error('Generator g must be in range [2, p-1]');
    }
    if (params.g.modPow(params.q, params.p).equals(this.ONE)) {
      throw new Error('Parameter g must be a generator of order q');
    }
  }
} 