import { OrProof, OrProofParams } from '../or-proof';
import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto';

describe('OR-Proof Zero-Knowledge Proof', () => {
  let params: OrProofParams;
  let secret1: BigInteger | null;
  let secret2: BigInteger | null;
  let publicValue1: BigInteger;
  let publicValue2: BigInteger;

  beforeAll(async () => {
    // Generate parameters with smaller bit size for testing
    params = await OrProof.generateParams(512);
    
    // Generate random secrets and compute public values
    const generateSecret = () => new BigInteger(randomBytes(8).toString('hex'), 16).mod(params.n1);
    secret1 = generateSecret();
    secret2 = null; // We'll prove knowledge of secret1 only
    
    // Compute public values: v = s^2 mod n
    publicValue1 = secret1.modPow(new BigInteger('2'), params.n1);
    publicValue2 = new BigInteger('123'); // Some arbitrary value we don't know preimage of
  });

  it('should generate valid parameters', () => {
    expect(params.n1).toBeDefined();
    expect(params.n2).toBeDefined();
    expect(params.n1.bitLength()).toBeGreaterThanOrEqual(512);
    expect(params.n2.bitLength()).toBeGreaterThanOrEqual(512);
  });

  it('should prove and verify knowledge of first secret', async () => {
    const proof = await OrProof.prove(secret1, null, publicValue1, publicValue2, params);
    const isValid = await OrProof.verify(proof, publicValue1, publicValue2, params);
    
    expect(isValid).toBe(true);
  });

  it('should prove and verify knowledge of second secret', async () => {
    // Switch the secrets around
    const proof = await OrProof.prove(null, secret1, publicValue2, publicValue1, params);
    const isValid = await OrProof.verify(proof, publicValue2, publicValue1, params);
    
    expect(isValid).toBe(true);
  });

  it('should reject proof with no secrets', async () => {
    await expect(OrProof.prove(null, null, publicValue1, publicValue2, params))
      .rejects
      .toThrow('At least one secret must be provided');
  });

  it('should reject invalid proof', async () => {
    const proof = await OrProof.prove(secret1, null, publicValue1, publicValue2, params);
    
    // Modify the proof to make it invalid
    const invalidProof = {
      ...proof,
      commitments: [
        proof.commitments[0].add(new BigInteger('1')),
        proof.commitments[1]
      ] as [BigInteger, BigInteger]
    };
    
    const isValid = await OrProof.verify(invalidProof, publicValue1, publicValue2, params);
    expect(isValid).toBe(false);
  });

  it('should reject proof with wrong public values', async () => {
    const proof = await OrProof.prove(secret1, null, publicValue1, publicValue2, params);
    
    // Try to verify with wrong public values
    const wrongPublicValue = publicValue1.add(new BigInteger('1'));
    const isValid = await OrProof.verify(proof, wrongPublicValue, publicValue2, params);
    
    expect(isValid).toBe(false);
  });

  it('should generate different proofs for same secrets', async () => {
    const proof1 = await OrProof.prove(secret1, null, publicValue1, publicValue2, params);
    const proof2 = await OrProof.prove(secret1, null, publicValue1, publicValue2, params);
    
    // Due to randomization, proofs should be different
    expect(proof1.commitments[0].equals(proof2.commitments[0])).toBe(false);
    expect(proof1.commitments[1].equals(proof2.commitments[1])).toBe(false);
    
    // But both should verify
    const isValid1 = await OrProof.verify(proof1, publicValue1, publicValue2, params);
    const isValid2 = await OrProof.verify(proof2, publicValue1, publicValue2, params);
    expect(isValid1).toBe(true);
    expect(isValid2).toBe(true);
  });

  it('should maintain zero-knowledge property', async () => {
    const proof = await OrProof.prove(secret1, null, publicValue1, publicValue2, params);
    
    // The proof should not reveal which statement is true
    expect(proof.commitments[0].equals(publicValue1)).toBe(false);
    expect(proof.commitments[1].equals(publicValue2)).toBe(false);
    
    // The challenges should be different
    expect(proof.challenges[0].equals(proof.challenges[1])).toBe(false);
  });

  it('should handle edge cases for secret values', async () => {
    // Test with small secret
    const smallSecret = new BigInteger('1');
    const smallPublicValue = smallSecret.modPow(new BigInteger('2'), params.n1);
    const proofSmall = await OrProof.prove(smallSecret, null, smallPublicValue, publicValue2, params);
    const isValidSmall = await OrProof.verify(proofSmall, smallPublicValue, publicValue2, params);
    expect(isValidSmall).toBe(true);

    // Test with large secret
    const largeSecret = params.n1.subtract(new BigInteger('1'));
    const largePublicValue = largeSecret.modPow(new BigInteger('2'), params.n1);
    const proofLarge = await OrProof.prove(largeSecret, null, largePublicValue, publicValue2, params);
    const isValidLarge = await OrProof.verify(proofLarge, largePublicValue, publicValue2, params);
    expect(isValidLarge).toBe(true);
  });

  it('should reject proof with invalid parameter sizes', async () => {
    const invalidParams = await OrProof.generateParams(256); // Too small
    await expect(OrProof.prove(secret1, null, publicValue1, publicValue2, invalidParams))
      .rejects
      .toThrow('Invalid parameter size');
  });

  it('should be non-transferable', async () => {
    const proof = await OrProof.prove(secret1, null, publicValue1, publicValue2, params);
    
    // Verify original proof
    const isValidOriginal = await OrProof.verify(proof, publicValue1, publicValue2, params);
    expect(isValidOriginal).toBe(true);
    
    // Try to use the proof for different public values
    const differentValue = publicValue1.add(new BigInteger('1'));
    const isValidTransferred = await OrProof.verify(proof, differentValue, publicValue2, params);
    expect(isValidTransferred).toBe(false);
  });
}); 