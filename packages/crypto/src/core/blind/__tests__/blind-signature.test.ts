import { BlindSignature, BlindParams, BlindKeyPair } from '../blind-signature';
import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';

describe('Blind Signature Scheme', () => {
  let params: BlindParams;
  let signerKeyPair: BlindKeyPair;
  const message = 'Hello, Blind Signature!';

  beforeAll(async () => {
    // Generate parameters with smaller bit size for testing
    params = await BlindSignature.generateParams(512);
    signerKeyPair = await BlindSignature.generateKeyPair(params);
  });

  it('should generate valid parameters', () => {
    expect(params.n).toBeDefined();
    expect(params.e).toBeDefined();
    expect(params.n.bitLength()).toBeGreaterThanOrEqual(512);
    expect(params.e.compareTo(BigInteger.ONE)).toBeGreaterThan(0);
    
    // Verify e is coprime with φ(n)
    const phi = params.p.subtract(BigInteger.ONE).multiply(params.q.subtract(BigInteger.ONE));
    expect(params.e.gcd(phi).equals(BigInteger.ONE)).toBe(true);
  });

  it('should generate valid key pair', () => {
    expect(signerKeyPair.publicKey).toBeDefined();
    expect(signerKeyPair.privateKey).toBeDefined();
    
    // Verify public key matches parameters
    expect(signerKeyPair.publicKey.n.equals(params.n)).toBe(true);
    expect(signerKeyPair.publicKey.e.equals(params.e)).toBe(true);
    
    // Verify private key is valid (d * e ≡ 1 (mod φ(n)))
    const phi = params.p.subtract(BigInteger.ONE).multiply(params.q.subtract(BigInteger.ONE));
    const result = signerKeyPair.privateKey.multiply(params.e).mod(phi);
    expect(result.equals(BigInteger.ONE)).toBe(true);
  });

  it('should blind, sign, and unblind correctly', async () => {
    // Hash the message
    const messageHash = createHash('sha256').update(message).digest();
    const messageNum = new BigInteger(messageHash.toString('hex'), 16);

    // User: Generate random blinding factor and blind the message
    const user = new BlindSignature(params);
    const { blindedMessage, unblindingFactor } = await user.blind(messageNum);

    // Signer: Sign the blinded message
    const signer = new BlindSignature(params);
    const blindSignature = await signer.sign(blindedMessage, signerKeyPair.privateKey);

    // User: Unblind the signature
    const signature = await user.unblind(blindSignature, unblindingFactor);

    // Verify the signature
    const isValid = await BlindSignature.verify(message, signature, signerKeyPair.publicKey);
    expect(isValid).toBe(true);
  });

  it('should maintain blindness property', async () => {
    const user = new BlindSignature(params);
    const messageHash1 = createHash('sha256').update('Message 1').digest();
    const messageHash2 = createHash('sha256').update('Message 2').digest();
    const message1 = new BigInteger(messageHash1.toString('hex'), 16);
    const message2 = new BigInteger(messageHash2.toString('hex'), 16);

    // Blind both messages
    const blind1 = await user.blind(message1);
    const blind2 = await user.blind(message2);

    // Blinded messages should be different from original messages
    expect(blind1.blindedMessage.equals(message1)).toBe(false);
    expect(blind2.blindedMessage.equals(message2)).toBe(false);
    
    // Blinded messages should be different from each other
    expect(blind1.blindedMessage.equals(blind2.blindedMessage)).toBe(false);
  });

  it('should prevent signature forgery', async () => {
    const user = new BlindSignature(params);
    const messageHash = createHash('sha256').update(message).digest();
    const messageNum = new BigInteger(messageHash.toString('hex'), 16);

    // Try to forge signature by modifying blinded message
    const { blindedMessage, unblindingFactor } = await user.blind(messageNum);
    const forgedBlindedMessage = blindedMessage.add(BigInteger.ONE);
    
    const signer = new BlindSignature(params);
    const blindSignature = await signer.sign(forgedBlindedMessage, signerKeyPair.privateKey);
    const signature = await user.unblind(blindSignature, unblindingFactor);

    const isValid = await BlindSignature.verify(message, signature, signerKeyPair.publicKey);
    expect(isValid).toBe(false);
  });

  it('should generate different blind factors each time', async () => {
    const user = new BlindSignature(params);
    const messageHash = createHash('sha256').update(message).digest();
    const messageNum = new BigInteger(messageHash.toString('hex'), 16);

    const blind1 = await user.blind(messageNum);
    const blind2 = await user.blind(messageNum);

    // Blinding factors should be different
    expect(blind1.unblindingFactor.equals(blind2.unblindingFactor)).toBe(false);
    // Blinded messages should be different
    expect(blind1.blindedMessage.equals(blind2.blindedMessage)).toBe(false);
  });

  it('should handle concurrent blind signatures', async () => {
    const numSignatures = 5;
    const signatures = Array(numSignatures).fill(null).map(async (_, i) => {
      const user = new BlindSignature(params);
      const uniqueMessage = `Message ${i}`;
      const messageHash = createHash('sha256').update(uniqueMessage).digest();
      const messageNum = new BigInteger(messageHash.toString('hex'), 16);

      // Blind and sign
      const { blindedMessage, unblindingFactor } = await user.blind(messageNum);
      const signer = new BlindSignature(params);
      const blindSignature = await signer.sign(blindedMessage, signerKeyPair.privateKey);
      const signature = await user.unblind(blindSignature, unblindingFactor);

      return { message: uniqueMessage, signature };
    });

    const results = await Promise.all(signatures);

    // Verify all signatures
    for (const { message, signature } of results) {
      const isValid = await BlindSignature.verify(message, signature, signerKeyPair.publicKey);
      expect(isValid).toBe(true);
    }
  });

  it('should reject invalid parameter sizes', async () => {
    await expect(BlindSignature.generateParams(256)) // Too small
      .rejects
      .toThrow('Invalid parameter size');
  });

  it('should reject invalid blind factors', async () => {
    const user = new BlindSignature(params);
    const messageHash = createHash('sha256').update(message).digest();
    const messageNum = new BigInteger(messageHash.toString('hex'), 16);

    // Try to use invalid blinding factor
    const invalidFactor = BigInteger.ONE;
    await expect(user.blind(messageNum, invalidFactor))
      .rejects
      .toThrow('Invalid blinding factor');
  });

  it('should be non-malleable', async () => {
    const user = new BlindSignature(params);
    const messageHash = createHash('sha256').update(message).digest();
    const messageNum = new BigInteger(messageHash.toString('hex'), 16);

    const { blindedMessage, unblindingFactor } = await user.blind(messageNum);
    const signer = new BlindSignature(params);
    const blindSignature = await signer.sign(blindedMessage, signerKeyPair.privateKey);
    const signature = await user.unblind(blindSignature, unblindingFactor);

    // Try to create malicious signature
    const maliciousSignature = signature.multiply(BigInteger.ONE.add(BigInteger.ONE)).mod(params.n);

    const isValid = await BlindSignature.verify(message, maliciousSignature, signerKeyPair.publicKey);
    expect(isValid).toBe(false);
  });
}); 