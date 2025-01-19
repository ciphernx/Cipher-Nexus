import { FiatShamir, FiatShamirParams, FiatShamirProof } from '../fiat-shamir';
import { BigInteger } from 'jsbn';

describe('Fiat-Shamir Zero-Knowledge Proof', () => {
  let params: FiatShamirParams;
  let secret: BigInteger;
  let publicValue: BigInteger;

  beforeAll(async () => {
    // Generate parameters with smaller bit size for testing
    params = await FiatShamir.generateParams(512);
    
    // Generate a random secret
    secret = new BigInteger(64, 1, global.crypto.getRandomValues(new Uint8Array(8)));
    
    // Compute public value v = s^2 mod n
    publicValue = secret.modPow(new BigInteger('2'), params.n);
  });

  it('should generate valid parameters', () => {
    expect(params.n).toBeDefined();
    
    // n should be large enough
    expect(params.n.bitLength()).toBeGreaterThanOrEqual(512);
  });

  it('should generate and verify valid proof', async () => {
    const proof = await FiatShamir.prove(secret, params);
    const isValid = await FiatShamir.verify(proof, publicValue, params);
    
    expect(isValid).toBe(true);
  });

  it('should reject invalid proof', async () => {
    const proof = await FiatShamir.prove(secret, params);
    
    // Modify the proof to make it invalid
    const invalidProof: FiatShamirProof = {
      ...proof,
      response: proof.response.add(new BigInteger('1'))
    };
    
    const isValid = await FiatShamir.verify(invalidProof, publicValue, params);
    expect(isValid).toBe(false);
  });

  it('should reject proof with wrong public value', async () => {
    const proof = await FiatShamir.prove(secret, params);
    
    // Use wrong public value
    const wrongPublicValue = publicValue.multiply(new BigInteger('2')).mod(params.n);
    const isValid = await FiatShamir.verify(proof, wrongPublicValue, params);
    
    expect(isValid).toBe(false);
  });

  it('should generate different proofs for same secret', async () => {
    const proof1 = await FiatShamir.prove(secret, params);
    const proof2 = await FiatShamir.prove(secret, params);
    
    // Due to randomization, proofs should be different
    expect(proof1.commitment.equals(proof2.commitment)).toBe(false);
    expect(proof1.challenge.equals(proof2.challenge)).toBe(false);
    expect(proof1.response.equals(proof2.response)).toBe(false);
    
    // But both should verify
    const isValid1 = await FiatShamir.verify(proof1, publicValue, params);
    const isValid2 = await FiatShamir.verify(proof2, publicValue, params);
    expect(isValid1).toBe(true);
    expect(isValid2).toBe(true);
  });

  it('should handle edge cases for secret value', async () => {
    // Test with s = 1
    const s1 = new BigInteger('1');
    const v1 = s1.modPow(new BigInteger('2'), params.n);
    const proof1 = await FiatShamir.prove(s1, params);
    const isValid1 = await FiatShamir.verify(proof1, v1, params);
    expect(isValid1).toBe(true);

    // Test with s = n-1
    const sMax = params.n.subtract(new BigInteger('1'));
    const vMax = sMax.modPow(new BigInteger('2'), params.n);
    const proofMax = await FiatShamir.prove(sMax, params);
    const isValidMax = await FiatShamir.verify(proofMax, vMax, params);
    expect(isValidMax).toBe(true);
  });

  it('should throw error for invalid parameter sizes', async () => {
    await expect(FiatShamir.generateParams(256)).rejects.toThrow();
  });

  it('should maintain zero-knowledge property', async () => {
    const proof1 = await FiatShamir.prove(secret, params);
    const proof2 = await FiatShamir.prove(secret, params);
    
    // Proofs should be different (random)
    expect(proof1).not.toEqual(proof2);
    
    // Commitment should not reveal secret
    expect(proof1.commitment.equals(publicValue)).toBe(false);
    expect(proof2.commitment.equals(publicValue)).toBe(false);
    
    // Response should not be equal to secret
    expect(proof1.response.equals(secret)).toBe(false);
    expect(proof2.response.equals(secret)).toBe(false);
  });

  it('should be non-transferable', async () => {
    // Generate proof
    const proof = await FiatShamir.prove(secret, params);
    
    // Verify original proof
    const isValidOriginal = await FiatShamir.verify(proof, publicValue, params);
    expect(isValidOriginal).toBe(true);
    
    // Attempt to create a "fake" proof by reusing components
    const fakeProof: FiatShamirProof = {
      commitment: proof.commitment,
      challenge: proof.challenge,
      response: proof.response
    };
    
    // Verify with different public value
    const differentPublicValue = publicValue.add(new BigInteger('1'));
    const isValidFake = await FiatShamir.verify(fakeProof, differentPublicValue, params);
    expect(isValidFake).toBe(false);
  });
}); 