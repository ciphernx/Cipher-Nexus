import { Curve25519 } from '../curve25519';
import { randomBytes } from 'crypto';

describe('Curve25519 Key Exchange', () => {
  it('should generate valid key pairs', () => {
    const keyPair = Curve25519.generateKeyPair();
    
    expect(keyPair.publicKey.length).toBe(32);
    expect(keyPair.secretKey.length).toBe(32);
    
    // Public key should be on the curve
    expect(Curve25519.isValidPoint(keyPair.publicKey)).toBe(true);
  });

  it('should perform key exchange correctly', () => {
    const aliceKeyPair = Curve25519.generateKeyPair();
    const bobKeyPair = Curve25519.generateKeyPair();

    // Compute shared secrets
    const aliceShared = Curve25519.computeSharedSecret(
      aliceKeyPair.secretKey,
      bobKeyPair.publicKey
    );

    const bobShared = Curve25519.computeSharedSecret(
      bobKeyPair.secretKey,
      aliceKeyPair.publicKey
    );

    // Both parties should compute the same shared secret
    expect(aliceShared).toEqual(bobShared);
  });

  it('should generate different key pairs', () => {
    const keyPair1 = Curve25519.generateKeyPair();
    const keyPair2 = Curve25519.generateKeyPair();

    expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
    expect(keyPair1.secretKey).not.toEqual(keyPair2.secretKey);
  });

  it('should generate deterministic key pairs from seed', () => {
    const seed = randomBytes(32);
    
    // Generate two key pairs from same seed
    const keyPair1 = Curve25519.generateKeyPairFromSeed(seed);
    const keyPair2 = Curve25519.generateKeyPairFromSeed(seed);

    // Should generate identical key pairs
    expect(keyPair1.publicKey).toEqual(keyPair2.publicKey);
    expect(keyPair1.secretKey).toEqual(keyPair2.secretKey);
  });

  it('should reject invalid public keys', () => {
    const keyPair = Curve25519.generateKeyPair();
    const invalidPublicKey = Buffer.alloc(32, 0); // All zeros is invalid

    expect(() => {
      Curve25519.computeSharedSecret(keyPair.secretKey, invalidPublicKey);
    }).toThrow('invalid public key');
  });

  it('should support multiple participants', () => {
    const alice = Curve25519.generateKeyPair();
    const bob = Curve25519.generateKeyPair();
    const carol = Curve25519.generateKeyPair();

    // Alice -> Bob -> Carol -> Alice
    const secret1 = Curve25519.computeSharedSecret(
      alice.secretKey,
      Curve25519.computeSharedSecret(
        bob.secretKey,
        Curve25519.computeSharedSecret(
          carol.secretKey,
          alice.publicKey
        )
      )
    );

    // Bob -> Carol -> Alice -> Bob
    const secret2 = Curve25519.computeSharedSecret(
      bob.secretKey,
      Curve25519.computeSharedSecret(
        carol.secretKey,
        Curve25519.computeSharedSecret(
          alice.secretKey,
          bob.publicKey
        )
      )
    );

    // Should arrive at same shared secret
    expect(secret1).toEqual(secret2);
  });

  it('should derive keys from shared secrets', () => {
    const aliceKeyPair = Curve25519.generateKeyPair();
    const bobKeyPair = Curve25519.generateKeyPair();

    const sharedSecret = Curve25519.computeSharedSecret(
      aliceKeyPair.secretKey,
      bobKeyPair.publicKey
    );

    // Derive encryption keys
    const key1 = Curve25519.deriveKey(sharedSecret, 'encryption');
    const key2 = Curve25519.deriveKey(sharedSecret, 'encryption');
    expect(key1).toEqual(key2);

    // Different purposes should produce different keys
    const macKey = Curve25519.deriveKey(sharedSecret, 'mac');
    expect(key1).not.toEqual(macKey);
  });

  it('should support concurrent key exchanges', async () => {
    const numExchanges = 100;
    const exchanges = Array(numExchanges).fill(null).map(() => {
      const alice = Curve25519.generateKeyPair();
      const bob = Curve25519.generateKeyPair();

      return Promise.all([
        Curve25519.computeSharedSecret(alice.secretKey, bob.publicKey),
        Curve25519.computeSharedSecret(bob.secretKey, alice.publicKey)
      ]).then(([secret1, secret2]) => {
        expect(secret1).toEqual(secret2);
      });
    });

    await Promise.all(exchanges);
  });

  it('should support test vectors', () => {
    // Test vectors from RFC 7748
    const testVector = {
      alicePrivate: Buffer.from('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a', 'hex'),
      alicePublic: Buffer.from('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a', 'hex'),
      bobPrivate: Buffer.from('5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb', 'hex'),
      bobPublic: Buffer.from('de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f', 'hex'),
      shared: Buffer.from('4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742', 'hex')
    };

    const shared = Curve25519.computeSharedSecret(
      testVector.alicePrivate,
      testVector.bobPublic
    );
    expect(shared).toEqual(testVector.shared);
  });

  it('should handle key exchange with ephemeral keys', () => {
    const staticKeyPair = Curve25519.generateKeyPair();
    const ephemeralKeyPair = Curve25519.generateKeyPair();

    const sharedSecret = Curve25519.computeSharedSecret(
      staticKeyPair.secretKey,
      ephemeralKeyPair.publicKey
    );

    expect(sharedSecret.length).toBe(32);
  });

  it('should support X25519 test vectors', () => {
    // Iterative test from RFC 7748
    let k = Buffer.from('0900000000000000000000000000000000000000000000000000000000000000', 'hex');
    let u = Buffer.from('0900000000000000000000000000000000000000000000000000000000000000', 'hex');

    // Perform 1 iteration
    const result1 = Curve25519.scalarMult(k, u);
    expect(result1.toString('hex')).toBe(
      '422c8e7a6227d7bca1350b3e2bb7279f7897b87bb6854b783c60e80311ae3079'
    );

    // Perform 1000 iterations
    for (let i = 0; i < 999; i++) {
      k = Curve25519.scalarMult(k, u);
    }
    expect(k.toString('hex')).toBe(
      '684cf59ba83309552800ef566f2f4d3c1c3887c49360e3875f2eb94d99532c51'
    );
  });

  it('should clamp private keys correctly', () => {
    const rawPrivate = Buffer.alloc(32, 0xFF);
    const clampedPrivate = Curve25519.clampPrivateKey(rawPrivate);

    // Check clamping bits
    expect(clampedPrivate[0] & 0x40).toBe(0x40); // Bit 6 should be 1
    expect(clampedPrivate[0] & 0x80).toBe(0x00); // Bit 7 should be 0
    expect(clampedPrivate[31] & 0x7F).toBe(0x00); // Bits 0-6 should be 0
    expect(clampedPrivate[31] & 0x40).toBe(0x00); // Bit 6 should be 0
  });
}); 