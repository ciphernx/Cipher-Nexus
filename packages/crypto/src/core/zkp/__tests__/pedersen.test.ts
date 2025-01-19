import { Pedersen, PedersenParams } from '../pedersen';
import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto';

describe('Pedersen Commitment Scheme', () => {
  let params: PedersenParams;
  const message = new BigInteger('42'); // Example message to commit to

  beforeAll(async () => {
    // Generate parameters with smaller bit size for testing
    params = await Pedersen.generateParams(512);
  });

  it('should generate valid parameters', () => {
    expect(params.p).toBeDefined();
    expect(params.q).toBeDefined();
    expect(params.g).toBeDefined();
    expect(params.h).toBeDefined();
    expect(params.p.bitLength()).toBeGreaterThanOrEqual(512);
    expect(params.g.compareTo(BigInteger.ONE)).toBeGreaterThan(0);
    expect(params.g.compareTo(params.p)).toBeLessThan(0);
    expect(params.h.compareTo(BigInteger.ONE)).toBeGreaterThan(0);
    expect(params.h.compareTo(params.p)).toBeLessThan(0);
  });

  it('should commit and verify correctly', async () => {
    // Generate random randomness for the commitment
    const r = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);
    
    // Create commitment
    const commitment = await Pedersen.commit(message, r, params);
    
    // Verify commitment
    const isValid = await Pedersen.verify(commitment, message, r, params);
    expect(isValid).toBe(true);
  });

  it('should maintain hiding property', async () => {
    // Create two commitments to the same message with different randomness
    const r1 = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);
    const r2 = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);
    
    const commitment1 = await Pedersen.commit(message, r1, params);
    const commitment2 = await Pedersen.commit(message, r2, params);
    
    // Commitments should be different
    expect(commitment1.equals(commitment2)).toBe(false);
    
    // But both should verify
    const isValid1 = await Pedersen.verify(commitment1, message, r1, params);
    const isValid2 = await Pedersen.verify(commitment2, message, r2, params);
    expect(isValid1).toBe(true);
    expect(isValid2).toBe(true);
  });

  it('should maintain binding property', async () => {
    const r = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);
    const commitment = await Pedersen.commit(message, r, params);
    
    // Try to open commitment with different message
    const differentMessage = message.add(BigInteger.ONE);
    const isValid = await Pedersen.verify(commitment, differentMessage, r, params);
    expect(isValid).toBe(false);
  });

  it('should support homomorphic addition', async () => {
    const message1 = new BigInteger('30');
    const message2 = new BigInteger('12');
    const r1 = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);
    const r2 = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);
    
    // Create commitments
    const commitment1 = await Pedersen.commit(message1, r1, params);
    const commitment2 = await Pedersen.commit(message2, r2, params);
    
    // Add commitments
    const sumCommitment = commitment1.multiply(commitment2).mod(params.p);
    const sumMessage = message1.add(message2).mod(params.q);
    const sumRandomness = r1.add(r2).mod(params.q);
    
    // Verify the sum
    const isValid = await Pedersen.verify(sumCommitment, sumMessage, sumRandomness, params);
    expect(isValid).toBe(true);
  });

  it('should handle edge cases', async () => {
    // Test with message = 0
    const zeroMessage = new BigInteger('0');
    const r1 = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);
    const commitment1 = await Pedersen.commit(zeroMessage, r1, params);
    const isValid1 = await Pedersen.verify(commitment1, zeroMessage, r1, params);
    expect(isValid1).toBe(true);

    // Test with maximum message value (q-1)
    const maxMessage = params.q.subtract(BigInteger.ONE);
    const r2 = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);
    const commitment2 = await Pedersen.commit(maxMessage, r2, params);
    const isValid2 = await Pedersen.verify(commitment2, maxMessage, r2, params);
    expect(isValid2).toBe(true);
  });

  it('should reject invalid parameter sizes', async () => {
    const invalidParams = await Pedersen.generateParams(256); // Too small
    const r = new BigInteger(randomBytes(32).toString('hex'), 16).mod(invalidParams.q);
    
    await expect(Pedersen.commit(message, r, invalidParams))
      .rejects
      .toThrow('Invalid parameter size');
  });

  it('should reject invalid message range', async () => {
    const r = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);
    const invalidMessage = params.q.add(BigInteger.ONE); // Message larger than q
    
    await expect(Pedersen.commit(invalidMessage, r, params))
      .rejects
      .toThrow('Message out of range');
  });

  it('should reject invalid randomness range', async () => {
    const invalidRandomness = params.q.add(BigInteger.ONE); // Randomness larger than q
    
    await expect(Pedersen.commit(message, invalidRandomness, params))
      .rejects
      .toThrow('Randomness out of range');
  });

  it('should be non-malleable', async () => {
    const r = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);
    const commitment = await Pedersen.commit(message, r, params);
    
    // Try to create a different valid commitment by modifying it
    const malleableCommitment = commitment.multiply(params.g).mod(params.p);
    
    // Should not verify with original message and randomness
    const isValid = await Pedersen.verify(malleableCommitment, message, r, params);
    expect(isValid).toBe(false);
  });
}); 