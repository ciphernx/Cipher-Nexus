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
 */
export class SchnorrProtocol {
  private readonly ONE = new BigInteger('1');

  /**
   * Generate protocol parameters
   * @param bitLength Bit length of prime p
   */
  public static async generateParams(bitLength: number): Promise<SchnorrParams> {
    // Generate prime p such that p-1 = 2q where q is also prime
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

    // Generate random value r
    const r = this.generateRandom(params.q);

    // Compute commitment t = g^r mod p
    const commitment = params.g.modPow(r, params.p);

    // Compute challenge c = H(g, y, t)
    const publicValue = params.g.modPow(secret, params.p);
    const challenge = await this.computeChallenge(params.g, publicValue, commitment);

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

    // Verify commitment t = g^s * y^(-c) mod p
    const lhs = params.g.modPow(proof.response, params.p);
    const rhs = proof.commitment.multiply(
      publicValue.modPow(proof.challenge, params.p).modInverse(params.p)
    ).mod(params.p);

    if (!lhs.equals(rhs)) {
      return false;
    }

    // Verify challenge c = H(g, y, t)
    const expectedChallenge = await this.computeChallenge(
      params.g,
      publicValue,
      proof.commitment
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
      h = this.generateRandom(p);
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
    t: BigInteger
  ): Promise<BigInteger> {
    const hash = await Hash.sha256(
      Buffer.concat([
        Buffer.from(g.toString(16), 'hex'),
        Buffer.from(y.toString(16), 'hex'),
        Buffer.from(t.toString(16), 'hex')
      ])
    );

    return new BigInteger(hash.toString('hex'), 16);
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
    if (params.g.modPow(params.q, params.p).equals(this.ONE)) {
      throw new Error('Parameter g must be a generator of order q');
    }
  }
} 