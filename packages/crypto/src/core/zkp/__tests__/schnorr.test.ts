import { Schnorr, SchnorrParams, SchnorrKeyPair } from '../schnorr';
import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';

describe('Schnorr Signature System', () => {
  let params: SchnorrParams;
  let keyPair: SchnorrKeyPair;
  const message = 'Hello, Schnorr Signature!';

  beforeAll(async () => {
    // Generate parameters with smaller bit size for testing
    params = await Schnorr.generateParams(512);
    
    // Generate key pair
    keyPair = await Schnorr.generateKeyPair(params);
  });

  it('should generate valid parameters', () => {
    expect(params.p).toBeDefined();
    expect(params.q).toBeDefined();
    expect(params.g).toBeDefined();
    expect(params.p.bitLength()).toBeGreaterThanOrEqual(512);
    expect(params.g.compareTo(BigInteger.ONE)).toBeGreaterThan(0);
    expect(params.g.compareTo(params.p)).toBeLessThan(0);
  });

  it('should generate valid key pair', () => {
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey.compareTo(params.q)).toBeLessThan(0);
    expect(keyPair.publicKey.compareTo(params.p)).toBeLessThan(0);
    
    // Verify g^x = y (mod p)
    const computedPublicKey = params.g.modPow(keyPair.privateKey, params.p);
    expect(computedPublicKey.equals(keyPair.publicKey)).toBe(true);
  });

  it('should sign and verify message', async () => {
    const signature = await Schnorr.sign(message, keyPair.privateKey, params);
    const isValid = await Schnorr.verify(message, signature, keyPair.publicKey, params);
    
    expect(isValid).toBe(true);
  });

  it('should reject invalid signature', async () => {
    const signature = await Schnorr.sign(message, keyPair.privateKey, params);
    
    // Modify the signature
    const invalidSignature = {
      ...signature,
      s: signature.s.add(new BigInteger('1'))
    };
    
    const isValid = await Schnorr.verify(message, invalidSignature, keyPair.publicKey, params);
    expect(isValid).toBe(false);
  });

  it('should reject signature with wrong public key', async () => {
    const signature = await Schnorr.sign(message, keyPair.privateKey, params);
    const wrongKeyPair = await Schnorr.generateKeyPair(params);
    
    const isValid = await Schnorr.verify(message, signature, wrongKeyPair.publicKey, params);
    expect(isValid).toBe(false);
  });

  it('should generate different signatures for same message', async () => {
    const signature1 = await Schnorr.sign(message, keyPair.privateKey, params);
    const signature2 = await Schnorr.sign(message, keyPair.privateKey, params);
    
    // Due to randomization, signatures should be different
    expect(signature1.R.equals(signature2.R)).toBe(false);
    expect(signature1.s.equals(signature2.s)).toBe(false);
    
    // But both should verify
    const isValid1 = await Schnorr.verify(message, signature1, keyPair.publicKey, params);
    const isValid2 = await Schnorr.verify(message, signature2, keyPair.publicKey, params);
    expect(isValid1).toBe(true);
    expect(isValid2).toBe(true);
  });

  it('should handle different message types', async () => {
    const testMessages = [
      'Simple text message',
      JSON.stringify({ data: 'Complex object' }),
      Buffer.from('Binary data').toString('hex'),
      '0'.repeat(1000) // Long message
    ];

    for (const msg of testMessages) {
      const signature = await Schnorr.sign(msg, keyPair.privateKey, params);
      const isValid = await Schnorr.verify(msg, signature, keyPair.publicKey, params);
      expect(isValid).toBe(true);
    }
  });

  it('should handle edge cases for private key', async () => {
    // Test with small private key
    const smallKeyPair = {
      privateKey: new BigInteger('1'),
      publicKey: params.g.modPow(new BigInteger('1'), params.p)
    };
    
    const signatureSmall = await Schnorr.sign(message, smallKeyPair.privateKey, params);
    const isValidSmall = await Schnorr.verify(message, signatureSmall, smallKeyPair.publicKey, params);
    expect(isValidSmall).toBe(true);

    // Test with large private key (q-1)
    const largePrivateKey = params.q.subtract(BigInteger.ONE);
    const largeKeyPair = {
      privateKey: largePrivateKey,
      publicKey: params.g.modPow(largePrivateKey, params.p)
    };
    
    const signatureLarge = await Schnorr.sign(message, largeKeyPair.privateKey, params);
    const isValidLarge = await Schnorr.verify(message, signatureLarge, largeKeyPair.publicKey, params);
    expect(isValidLarge).toBe(true);
  });

  it('should reject invalid parameter sizes', async () => {
    const invalidParams = await Schnorr.generateParams(256); // Too small
    await expect(Schnorr.generateKeyPair(invalidParams))
      .rejects
      .toThrow('Invalid parameter size');
  });

  it('should be non-malleable', async () => {
    const signature = await Schnorr.sign(message, keyPair.privateKey, params);
    
    // Try to create a different valid signature by modifying s
    const malleableSignature = {
      ...signature,
      s: params.q.subtract(signature.s) // s' = q - s
    };
    
    const isValid = await Schnorr.verify(message, malleableSignature, keyPair.publicKey, params);
    expect(isValid).toBe(false);
  });
}); 