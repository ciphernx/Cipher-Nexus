import { randomBytes } from 'crypto';
import { BigInteger } from 'jsbn';
import { Hash } from '../hash';
import { Schnorr, SchnorrParams } from './schnorr';

export interface RangeProof {
  commitments: BigInteger[];     // Pedersen commitments for each bit
  challenges: BigInteger[];      // Challenges for each bit
  responses: BigInteger[];       // Responses for each bit
  finalCommitment: BigInteger;   // Commitment to the actual value
}

export class RangeProver {
  private static ONE = new BigInteger('1');
  private static TWO = new BigInteger('2');
  private static ZERO = new BigInteger('0');

  /**
   * Generate a proof that a value lies in the range [0, 2^n - 1]
   * @param {BigInteger} value - The value to prove
   * @param {number} bitLength - The number of bits in the range
   * @param {SchnorrParams} params - Group parameters
   * @returns {Promise<RangeProof>} Generated range proof
   */
  static async prove(value: BigInteger, bitLength: number, params: SchnorrParams): Promise<RangeProof> {
    // Ensure value is non-negative and within range
    if (value.compareTo(this.ZERO) < 0 || value.compareTo(this.TWO.pow(bitLength)) >= 0) {
      throw new Error('Value out of range');
    }

    const bits = value.toString(2).padStart(bitLength, '0').split('').map(Number);
    const commitments: BigInteger[] = [];
    const challenges: BigInteger[] = [];
    const responses: BigInteger[] = [];
    const randoms: BigInteger[] = [];

    // Generate second base point h
    const h = await this.generateH(params);

    // Generate commitments for each bit
    for (let i = 0; i < bitLength; i++) {
      const bit = bits[i];
      const r = this.generateRandom(params.q);
      randoms.push(r);

      // C = g^b * h^r mod p
      const commitment = params.g.modPow(new BigInteger(bit.toString()), params.p)
        .multiply(h.modPow(r, params.p))
        .mod(params.p);
      commitments.push(commitment);

      // Generate challenge
      const challenge = await Hash.sha256(
        Buffer.from(commitment.toString() + i.toString())
      );
      challenges.push(new BigInteger(challenge.toString('hex'), 16).mod(params.q));
    }

    // Generate responses
    for (let i = 0; i < bitLength; i++) {
      const bit = bits[i];
      // s = r + c * b mod q
      const response = randoms[i].add(
        challenges[i].multiply(new BigInteger(bit.toString()))
      ).mod(params.q);
      responses.push(response);
    }

    // Calculate final commitment as product of bit commitments
    let finalCommitment = this.ONE;
    for (let i = 0; i < bitLength; i++) {
      const power = this.TWO.pow(i);
      finalCommitment = finalCommitment.multiply(
        commitments[i].modPow(power, params.p)
      ).mod(params.p);
    }

    return {
      commitments,
      challenges,
      responses,
      finalCommitment
    };
  }

  /**
   * Verify a range proof
   * @param {RangeProof} proof - The proof to verify
   * @param {number} bitLength - The number of bits in the range
   * @param {SchnorrParams} params - Group parameters
   * @returns {Promise<boolean>} Whether the proof is valid
   */
  static async verify(proof: RangeProof, bitLength: number, params: SchnorrParams): Promise<boolean> {
    const h = await this.generateH(params);

    // Verify each bit commitment
    for (let i = 0; i < bitLength; i++) {
      // Calculate g^s * h^c
      const lhs = params.g.modPow(proof.responses[i], params.p)
        .multiply(h.modPow(proof.challenges[i], params.p))
        .mod(params.p);

      // Compare with C
      const rhs = proof.commitments[i];

      if (!lhs.equals(rhs)) {
        return false;
      }
    }

    // Verify final commitment
    let product = this.ONE;
    for (let i = 0; i < bitLength; i++) {
      const power = this.TWO.pow(i);
      product = product.multiply(
        proof.commitments[i].modPow(power, params.p)
      ).mod(params.p);
    }

    return proof.finalCommitment.equals(product);
  }

  private static generateRandom(max: BigInteger): BigInteger {
    const bytes = Math.ceil(max.bitLength() / 8);
    let r: BigInteger;
    do {
      const hex = randomBytes(bytes).toString('hex');
      r = new BigInteger(hex, 16).mod(max);
    } while (r.compareTo(this.ZERO) <= 0);
    return r;
  }

  private static async generateH(params: SchnorrParams): Promise<BigInteger> {
    const hash = await Hash.sha256(
      Buffer.from(params.g.toString() + params.p.toString())
    );
    return new BigInteger(hash.toString('hex'), 16).mod(params.p);
  }
} 