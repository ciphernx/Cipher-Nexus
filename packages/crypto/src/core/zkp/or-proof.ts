import { randomBytes } from 'crypto';
import { BigInteger } from 'jsbn';
import { Hash } from '../hash';

// Interface for OR-proof parameters
export interface OrProofParams {
  n1: BigInteger;  // RSA modulus for first statement
  n2: BigInteger;  // RSA modulus for second statement
}

// Interface for OR-proof
export interface OrProof {
  commitments: [BigInteger, BigInteger];  // y1, y2
  challenges: [Buffer, Buffer];           // e1, e2
  responses: [BigInteger, BigInteger];    // z1, z2
}

export class OrProof {
  private static readonly ONE = new BigInteger('1');
  private static readonly TWO = new BigInteger('2');
  private static readonly ZERO = new BigInteger('0');

  /**
   * Generate parameters for the OR-proof protocol
   * @param bits Number of bits for each RSA modulus
   * @returns Parameters for the protocol
   */
  public static async generateParams(bits: number): Promise<OrProofParams> {
    // Generate two RSA moduli
    let p1: BigInteger;
    let q1: BigInteger;
    let p2: BigInteger;
    let q2: BigInteger;
    
    do {
      const bytes = Math.ceil(bits / 2 / 8);
      const buffer = randomBytes(bytes);
      const hex = buffer.toString('hex');
      p1 = new BigInteger(hex, 16);
    } while (!(await this.isProbablePrime(p1)));

    do {
      const bytes = Math.ceil(bits / 2 / 8);
      const buffer = randomBytes(bytes);
      const hex = buffer.toString('hex');
      q1 = new BigInteger(hex, 16);
    } while (!(await this.isProbablePrime(q1)));

    do {
      const bytes = Math.ceil(bits / 2 / 8);
      const buffer = randomBytes(bytes);
      const hex = buffer.toString('hex');
      p2 = new BigInteger(hex, 16);
    } while (!(await this.isProbablePrime(p2)));

    do {
      const bytes = Math.ceil(bits / 2 / 8);
      const buffer = randomBytes(bytes);
      const hex = buffer.toString('hex');
      q2 = new BigInteger(hex, 16);
    } while (!(await this.isProbablePrime(q2)));

    // Calculate RSA moduli
    const n1 = p1.multiply(q1);
    const n2 = p2.multiply(q2);

    return { n1, n2 };
  }

  /**
   * Generate a proof that at least one of two statements is true
   * @param secret1 First secret (or null if first statement is false)
   * @param secret2 Second secret (or null if second statement is false)
   * @param publicValue1 First public value
   * @param publicValue2 Second public value
   * @param params Protocol parameters
   * @returns The proof
   */
  public static async prove(
    secret1: BigInteger | null,
    secret2: BigInteger | null,
    publicValue1: BigInteger,
    publicValue2: BigInteger,
    params: OrProofParams
  ): Promise<OrProof> {
    if (!secret1 && !secret2) {
      throw new Error('At least one secret must be provided');
    }

    // Generate random values
    const r1 = this.generateRandom(params.n1);
    const r2 = this.generateRandom(params.n2);

    let e1: Buffer;
    let e2: Buffer;
    let z1: BigInteger;
    let z2: BigInteger;
    let y1: BigInteger;
    let y2: BigInteger;

    if (secret1) {
      // Simulate proof for statement2
      e2 = await Hash.sha256(Buffer.from(Date.now().toString()));
      const e2BigInt = new BigInteger(e2.toString('hex'), 16);
      z2 = this.generateRandom(params.n2);
      y2 = z2.modPow(this.TWO, params.n2).multiply(
        publicValue2.modPow(e2BigInt, params.n2).modInverse(params.n2)
      ).mod(params.n2);

      // Generate real proof for statement1
      y1 = r1.modPow(this.TWO, params.n1);
      const combinedHash = await Hash.sha256(
        Buffer.concat([
          Buffer.from(y1.toString()),
          Buffer.from(y2.toString()),
          e2
        ])
      );
      e1 = combinedHash;
      const e1BigInt = new BigInteger(e1.toString('hex'), 16);
      z1 = r1.multiply(secret1.modPow(e1BigInt, params.n1)).mod(params.n1);
    } else if (secret2) {
      // Simulate proof for statement1
      e1 = await Hash.sha256(Buffer.from(Date.now().toString()));
      const e1BigInt = new BigInteger(e1.toString('hex'), 16);
      z1 = this.generateRandom(params.n1);
      y1 = z1.modPow(this.TWO, params.n1).multiply(
        publicValue1.modPow(e1BigInt, params.n1).modInverse(params.n1)
      ).mod(params.n1);

      // Generate real proof for statement2
      y2 = r2.modPow(this.TWO, params.n2);
      const combinedHash = await Hash.sha256(
        Buffer.concat([
          Buffer.from(y1.toString()),
          Buffer.from(y2.toString()),
          e1
        ])
      );
      e2 = combinedHash;
      const e2BigInt = new BigInteger(e2.toString('hex'), 16);
      z2 = r2.multiply(secret2.modPow(e2BigInt, params.n2)).mod(params.n2);
    } else {
      throw new Error('Unreachable code - at least one secret must be provided');
    }

    return {
      commitments: [y1, y2] as [BigInteger, BigInteger],
      challenges: [e1, e2] as [Buffer, Buffer],
      responses: [z1, z2] as [BigInteger, BigInteger]
    };
  }

  /**
   * Verify an OR-proof
   * @param proof The proof to verify
   * @param publicValue1 First public value
   * @param publicValue2 Second public value
   * @param params Protocol parameters
   * @returns true if the proof is valid, false otherwise
   */
  public static async verify(
    proof: OrProof,
    publicValue1: BigInteger,
    publicValue2: BigInteger,
    params: OrProofParams
  ): Promise<boolean> {
    const [y1, y2] = proof.commitments;
    const [e1, e2] = proof.challenges;
    const [z1, z2] = proof.responses;

    // Convert Buffer challenges to BigIntegers
    const e1BigInt = new BigInteger(e1.toString('hex'), 16);
    const e2BigInt = new BigInteger(e2.toString('hex'), 16);

    // Verify that challenges are correctly derived
    const combinedHash = await Hash.sha256(
      Buffer.concat([
        Buffer.from(y1.toString()),
        Buffer.from(y2.toString()),
        e1
      ])
    );
    if (!combinedHash.equals(e2)) {
      return false;
    }

    // Verify both proofs
    const valid1 = z1.modPow(this.TWO, params.n1).equals(
      y1.multiply(publicValue1.modPow(e1BigInt, params.n1)).mod(params.n1)
    );

    const valid2 = z2.modPow(this.TWO, params.n2).equals(
      y2.multiply(publicValue2.modPow(e2BigInt, params.n2)).mod(params.n2)
    );

    return valid1 && valid2;
  }

  /**
   * Generate a random value modulo n
   * @param n Modulus
   * @returns Random value
   */
  private static generateRandom(n: BigInteger): BigInteger {
    const bytes = Math.ceil(n.bitLength() / 8);
    const buffer = randomBytes(bytes);
    const hex = buffer.toString('hex');
    return new BigInteger(hex, 16).mod(n);
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
} 