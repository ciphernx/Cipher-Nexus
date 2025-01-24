import { randomBytes } from 'crypto';
import { BigInteger } from 'jsbn';
import { Hash } from '../hash';

// Interface for Fiat-Shamir parameters
export interface FiatShamirParams {
  n: BigInteger;  // RSA modulus (product of two primes)
}

// Interface for Fiat-Shamir proof
export interface FiatShamirProof {
  commitment: BigInteger;  // y = r^2 mod n
  challenge: Buffer;      // e = H(y)
  response: BigInteger;   // z = r * s^e mod n
}

export class FiatShamir {
  private static readonly ONE = new BigInteger('1');
  private static readonly TWO = new BigInteger('2');
  private static readonly ZERO = new BigInteger('0');

  /**
   * Generate parameters for the Fiat-Shamir protocol
   * @param bits Number of bits for the RSA modulus
   * @returns Parameters for the protocol
   */
  public static async generateParams(bits: number): Promise<FiatShamirParams> {
    // Generate two random primes p and q
    let p: BigInteger;
    let q: BigInteger;
    
    do {
      const bytes = Math.ceil(bits / 2 / 8);
      const buffer = randomBytes(bytes);
      const hex = buffer.toString('hex');
      p = new BigInteger(hex, 16);
    } while (!(await this.isProbablePrime(p)));

    do {
      const bytes = Math.ceil(bits / 2 / 8);
      const buffer = randomBytes(bytes);
      const hex = buffer.toString('hex');
      q = new BigInteger(hex, 16);
    } while (!(await this.isProbablePrime(q)));

    // Calculate RSA modulus n = p * q
    const n = p.multiply(q);

    return { n };
  }

  /**
   * Generate a proof of knowledge of a square root
   * @param secret The secret value s where v = s^2 mod n
   * @param params Protocol parameters
   * @returns The proof
   */
  public static async prove(
    secret: BigInteger,
    params: FiatShamirParams
  ): Promise<FiatShamirProof> {
    // Generate random value r
    const bytes = Math.ceil(params.n.bitLength() / 8);
    const buffer = randomBytes(bytes);
    const hex = buffer.toString('hex');
    const r = new BigInteger(hex, 16).mod(params.n);

    // Calculate commitment y = r^2 mod n
    const commitment = r.modPow(this.TWO, params.n);

    // Calculate challenge e = H(y)
    const challengeInput = commitment.toString();
    const challenge = await Hash.sha256(Buffer.from(challengeInput));

    // Calculate response z = r * s^e mod n
    const e = new BigInteger(challenge.toString('hex'), 16);
    const response = r.multiply(secret.modPow(e, params.n)).mod(params.n);

    return { commitment, challenge, response };
  }

  /**
   * Verify a Fiat-Shamir proof
   * @param proof The proof to verify
   * @param publicValue The public value v = s^2 mod n
   * @param params Protocol parameters
   * @returns true if the proof is valid, false otherwise
   */
  public static async verify(
    proof: FiatShamirProof,
    publicValue: BigInteger,
    params: FiatShamirParams
  ): Promise<boolean> {
    // Recalculate challenge e = H(y)
    const challengeInput = proof.commitment.toString();
    const challenge = await Hash.sha256(Buffer.from(challengeInput));

    // Verify that challenge matches
    if (!challenge.equals(proof.challenge)) {
      return false;
    }

    // Convert challenge to BigInteger
    const e = new BigInteger(challenge.toString('hex'), 16);

    // Verify that z^2 = y * v^e mod n
    const lhs = proof.response.modPow(this.TWO, params.n);
    const rhs = proof.commitment.multiply(
      publicValue.modPow(e, params.n)
    ).mod(params.n);

    return lhs.equals(rhs);
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