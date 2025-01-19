import { BigInteger } from 'jsbn';
import { ChaumPedersen, ChaumPedersenParams, ChaumPedersenProof } from '../chaum-pedersen';

describe('Chaum-Pedersen Zero-Knowledge Proof', () => {
  let params: ChaumPedersenParams;
  let x: BigInteger;  // Secret value
  let y1: BigInteger; // g^x
  let y2: BigInteger; // h^x

  beforeAll(async () => {
    // Generate parameters with smaller bit size for testing
    params = await ChaumPedersen.generateParams(512);
    
    // Generate a random secret
    x = new BigInteger(64, 1, global.crypto.getRandomValues(new Uint8Array(8)));
    
    // Compute public values
    y1 = params.g.modPow(x, params.p);
    y2 = params.h.modPow(x, params.p);
  });

  it('should generate valid parameters', () => {
    expect(params.p).toBeDefined();
    expect(params.q).toBeDefined();
    expect(params.g).toBeDefined();
    expect(params.h).toBeDefined();

    // Verify that g and h have order q
    expect(params.g.modPow(params.q, params.p).equals(new BigInteger('1'))).toBe(true);
    expect(params.h.modPow(params.q, params.p).equals(new BigInteger('1'))).toBe(true);
  });

  it('should generate and verify valid proof', async () => {
    const proof = await ChaumPedersen.prove(x, y1, y2, params);
    const isValid = await ChaumPedersen.verify(y1, y2, proof, params);
    
    expect(isValid).toBe(true);
  });

  it('should reject invalid proof', async () => {
    const proof = await ChaumPedersen.prove(x, y1, y2, params);
    
    // Modify the proof to make it invalid
    const invalidProof: ChaumPedersenProof = {
      ...proof,
      s: proof.s.add(new BigInteger('1'))
    };
    
    const isValid = await ChaumPedersen.verify(y1, y2, invalidProof, params);
    expect(isValid).toBe(false);
  });

  it('should reject proof with wrong public values', async () => {
    const proof = await ChaumPedersen.prove(x, y1, y2, params);
    
    // Use wrong public value
    const wrongY2 = y2.multiply(new BigInteger('2')).mod(params.p);
    const isValid = await ChaumPedersen.verify(y1, wrongY2, proof, params);
    
    expect(isValid).toBe(false);
  });

  it('should generate different proofs for same secret', async () => {
    const proof1 = await ChaumPedersen.prove(x, y1, y2, params);
    const proof2 = await ChaumPedersen.prove(x, y1, y2, params);
    
    // Due to randomization, proofs should be different
    expect(proof1.t1.equals(proof2.t1)).toBe(false);
    expect(proof1.t2.equals(proof2.t2)).toBe(false);
    
    // But both should verify
    const isValid1 = await ChaumPedersen.verify(y1, y2, proof1, params);
    const isValid2 = await ChaumPedersen.verify(y1, y2, proof2, params);
    expect(isValid1).toBe(true);
    expect(isValid2).toBe(true);
  });

  it('should handle edge cases for secret value', async () => {
    // Test with x = 1
    const x1 = new BigInteger('1');
    const y1_1 = params.g.modPow(x1, params.p);
    const y2_1 = params.h.modPow(x1, params.p);
    const proof1 = await ChaumPedersen.prove(x1, y1_1, y2_1, params);
    const isValid1 = await ChaumPedersen.verify(y1_1, y2_1, proof1, params);
    expect(isValid1).toBe(true);

    // Test with x = q-1 (largest valid secret)
    const xMax = params.q.subtract(new BigInteger('1'));
    const y1_max = params.g.modPow(xMax, params.p);
    const y2_max = params.h.modPow(xMax, params.p);
    const proofMax = await ChaumPedersen.prove(xMax, y1_max, y2_max, params);
    const isValidMax = await ChaumPedersen.verify(y1_max, y2_max, proofMax, params);
    expect(isValidMax).toBe(true);
  });

  it('should throw error for invalid parameter sizes', async () => {
    await expect(ChaumPedersen.generateParams(256)).rejects.toThrow();
  });

  it('should throw error for invalid secret range', async () => {
    const invalidSecret = params.q.add(new BigInteger('1'));
    await expect(ChaumPedersen.prove(invalidSecret, y1, y2, params)).rejects.toThrow();
  });

  it('should maintain zero-knowledge property', async () => {
    const proof1 = await ChaumPedersen.prove(x, y1, y2, params);
    const proof2 = await ChaumPedersen.prove(x, y1, y2, params);
    
    // Proofs should be different (random)
    expect(proof1).not.toEqual(proof2);
    
    // But should not reveal any information about x
    expect(proof1.t1.equals(y1)).toBe(false);
    expect(proof1.t2.equals(y2)).toBe(false);
    expect(proof2.t1.equals(y1)).toBe(false);
    expect(proof2.t2.equals(y2)).toBe(false);
  });
}); 