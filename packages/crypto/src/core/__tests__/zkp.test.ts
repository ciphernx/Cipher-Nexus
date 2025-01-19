import { Schnorr, SchnorrParams } from '../zkp';
import { BigInteger } from 'jsbn';

describe('Schnorr', () => {
  let params: SchnorrParams;
  const secretValue = new BigInteger('42'); // Secret discrete logarithm

  beforeAll(async () => {
    // Use smaller parameters for faster tests
    params = await Schnorr.generateParams(512);
  });

  it('should generate valid group parameters', () => {
    const { p, q, g } = params;
    
    // Check that p and q are defined
    expect(p).toBeDefined();
    expect(q).toBeDefined();
    expect(g).toBeDefined();
    
    // Check that p = 2q + 1
    expect(q.multiply(new BigInteger('2')).add(new BigInteger('1')).equals(p)).toBe(true);
    
    // Check that g^q mod p = 1
    expect(g.modPow(q, p).equals(new BigInteger('1'))).toBe(true);
  });

  it('should generate and verify valid proofs', async () => {
    const { p, g } = params;
    
    // Compute public value h = g^x mod p
    const h = g.modPow(secretValue, p);
    
    // Generate proof
    const proof = await Schnorr.prove(secretValue, params);
    
    // Verify proof
    const isValid = await Schnorr.verify(h, proof, params);
    expect(isValid).toBe(true);
  });

  it('should reject proofs with wrong secret', async () => {
    const { p, g } = params;
    const wrongSecret = new BigInteger('43');
    
    // Compute public value h = g^x mod p
    const h = g.modPow(secretValue, p);
    
    // Generate proof with wrong secret
    const proof = await Schnorr.prove(wrongSecret, params);
    
    // Verify proof
    const isValid = await Schnorr.verify(h, proof, params);
    expect(isValid).toBe(false);
  });

  it('should reject proofs with modified commitment', async () => {
    const { p, g } = params;
    
    // Compute public value h = g^x mod p
    const h = g.modPow(secretValue, p);
    
    // Generate proof
    const proof = await Schnorr.prove(secretValue, params);
    
    // Modify commitment
    const modifiedProof = {
      ...proof,
      commitment: proof.commitment.add(new BigInteger('1'))
    };
    
    // Verify modified proof
    const isValid = await Schnorr.verify(h, modifiedProof, params);
    expect(isValid).toBe(false);
  });

  it('should reject proofs with modified challenge', async () => {
    const { p, g } = params;
    
    // Compute public value h = g^x mod p
    const h = g.modPow(secretValue, p);
    
    // Generate proof
    const proof = await Schnorr.prove(secretValue, params);
    
    // Modify challenge
    const modifiedProof = {
      ...proof,
      challenge: proof.challenge.add(new BigInteger('1'))
    };
    
    // Verify modified proof
    const isValid = await Schnorr.verify(h, modifiedProof, params);
    expect(isValid).toBe(false);
  });

  it('should reject proofs with modified response', async () => {
    const { p, g } = params;
    
    // Compute public value h = g^x mod p
    const h = g.modPow(secretValue, p);
    
    // Generate proof
    const proof = await Schnorr.prove(secretValue, params);
    
    // Modify response
    const modifiedProof = {
      ...proof,
      response: proof.response.add(new BigInteger('1'))
    };
    
    // Verify modified proof
    const isValid = await Schnorr.verify(h, modifiedProof, params);
    expect(isValid).toBe(false);
  });
}); 