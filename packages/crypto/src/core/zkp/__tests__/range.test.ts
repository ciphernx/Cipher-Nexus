import { RangeProver, RangeProof } from '../range';
import { Schnorr } from '../schnorr';
import { BigInteger } from 'jsbn';
import { SecureRandom } from 'crypto';

describe('Range Proof Zero-Knowledge Proof', () => {
  const bitLength = 8; // Use 8-bit numbers for testing
  let params: any;
  let value: BigInteger;

  beforeAll(async () => {
    // Generate Schnorr parameters for the range proof
    params = await Schnorr.generateParams(512); // Use smaller parameters for testing
    
    // Generate a random value within the valid range (0 to 2^bitLength - 1)
    const maxValue = new BigInteger('2').pow(bitLength).subtract(new BigInteger('1'));
    value = new BigInteger(bitLength, 1, new SecureRandom()).mod(maxValue);
  });

  it('should generate valid parameters', () => {
    expect(params.p).toBeDefined();
    expect(params.q).toBeDefined();
    expect(params.g).toBeDefined();
  });

  it('should prove and verify value in range', async () => {
    const proof = await RangeProver.prove(value, bitLength, params);
    const isValid = await RangeProver.verify(proof, bitLength, params);
    
    expect(isValid).toBe(true);
  });

  it('should reject proof for value out of range', async () => {
    // Create a value larger than the allowed range
    const largeValue = new BigInteger('2').pow(bitLength).add(new BigInteger('1'));
    
    await expect(RangeProver.prove(largeValue, bitLength, params))
      .rejects
      .toThrow('Value out of range');
  });

  it('should reject invalid proof', async () => {
    const proof = await RangeProver.prove(value, bitLength, params);
    
    // Modify the proof to make it invalid
    const invalidProof: RangeProof = {
      ...proof,
      commitments: proof.commitments.map(c => c.add(new BigInteger('1')))
    };
    
    const isValid = await RangeProver.verify(invalidProof, bitLength, params);
    expect(isValid).toBe(false);
  });

  it('should handle edge cases', async () => {
    // Test with value = 0
    const zeroValue = new BigInteger('0');
    const proofZero = await RangeProver.prove(zeroValue, bitLength, params);
    const isValidZero = await RangeProver.verify(proofZero, bitLength, params);
    expect(isValidZero).toBe(true);

    // Test with maximum allowed value (2^bitLength - 1)
    const maxValue = new BigInteger('2').pow(bitLength).subtract(new BigInteger('1'));
    const proofMax = await RangeProver.prove(maxValue, bitLength, params);
    const isValidMax = await RangeProver.verify(proofMax, bitLength, params);
    expect(isValidMax).toBe(true);
  });

  it('should generate different proofs for same value', async () => {
    const proof1 = await RangeProver.prove(value, bitLength, params);
    const proof2 = await RangeProver.prove(value, bitLength, params);
    
    // Due to randomization, proofs should be different
    expect(proof1.commitments).not.toEqual(proof2.commitments);
    expect(proof1.challenges).not.toEqual(proof2.challenges);
    expect(proof1.responses).not.toEqual(proof2.responses);
    
    // But both should verify
    const isValid1 = await RangeProver.verify(proof1, bitLength, params);
    const isValid2 = await RangeProver.verify(proof2, bitLength, params);
    expect(isValid1).toBe(true);
    expect(isValid2).toBe(true);
  });

  it('should maintain zero-knowledge property', async () => {
    const proof = await RangeProver.prove(value, bitLength, params);
    
    // Verify that commitments don't reveal the bits
    for (let i = 0; i < bitLength; i++) {
      const bit = value.testBit(i);
      const commitment = proof.commitments[i];
      
      // The commitment should not directly reveal the bit
      expect(commitment.equals(new BigInteger(bit ? '1' : '0'))).toBe(false);
    }
    
    // The final commitment should not reveal the value
    expect(proof.finalCommitment.equals(value)).toBe(false);
  });

  it('should handle different bit lengths', async () => {
    const testBitLengths = [4, 8, 16];
    
    for (const bits of testBitLengths) {
      const maxValue = new BigInteger('2').pow(bits).subtract(new BigInteger('1'));
      const testValue = new BigInteger(bits, 1, new SecureRandom()).mod(maxValue);
      
      const proof = await RangeProver.prove(testValue, bits, params);
      const isValid = await RangeProver.verify(proof, bits, params);
      
      expect(isValid).toBe(true);
      expect(proof.commitments.length).toBe(bits);
      expect(proof.challenges.length).toBe(bits);
      expect(proof.responses.length).toBe(bits);
    }
  });

  it('should reject proof with mismatched bit length', async () => {
    const proof = await RangeProver.prove(value, bitLength, params);
    
    // Try to verify with wrong bit length
    const isValid = await RangeProver.verify(proof, bitLength + 1, params);
    expect(isValid).toBe(false);
  });

  it('should reject proof with invalid parameter sizes', async () => {
    const invalidParams = await Schnorr.generateParams(256); // Too small
    await expect(RangeProver.prove(value, bitLength, invalidParams))
      .rejects
      .toThrow('Invalid parameter size');
  });
}); 