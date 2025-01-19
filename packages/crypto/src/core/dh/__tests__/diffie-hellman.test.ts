import { DiffieHellman, DHParams } from '../diffie-hellman';
import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto';

describe('Diffie-Hellman Key Exchange', () => {
  let params: DHParams;
  let alice: DiffieHellman;
  let bob: DiffieHellman;

  beforeAll(async () => {
    // Generate parameters with smaller bit size for testing
    params = await DiffieHellman.generateParams(512);
  });

  beforeEach(() => {
    // Create new instances for Alice and Bob before each test
    alice = new DiffieHellman(params);
    bob = new DiffieHellman(params);
  });

  it('should generate valid parameters', () => {
    expect(params.p).toBeDefined();
    expect(params.g).toBeDefined();
    expect(params.p.bitLength()).toBeGreaterThanOrEqual(512);
    expect(params.g.compareTo(BigInteger.ONE)).toBeGreaterThan(0);
    expect(params.g.compareTo(params.p)).toBeLessThan(0);
    
    // Verify that g is a generator of the multiplicative group
    const order = params.p.subtract(BigInteger.ONE);
    const gPowOrder = params.g.modPow(order, params.p);
    expect(gPowOrder.equals(BigInteger.ONE)).toBe(true);
  });

  it('should generate valid key pairs', () => {
    const aliceKeyPair = alice.generateKeyPair();
    const bobKeyPair = bob.generateKeyPair();

    // Verify private keys are in valid range
    expect(aliceKeyPair.privateKey.compareTo(BigInteger.ONE)).toBeGreaterThan(0);
    expect(aliceKeyPair.privateKey.compareTo(params.p.subtract(BigInteger.ONE))).toBeLessThan(0);
    expect(bobKeyPair.privateKey.compareTo(BigInteger.ONE)).toBeGreaterThan(0);
    expect(bobKeyPair.privateKey.compareTo(params.p.subtract(BigInteger.ONE))).toBeLessThan(0);

    // Verify public keys are computed correctly
    const computedAlicePublic = params.g.modPow(aliceKeyPair.privateKey, params.p);
    const computedBobPublic = params.g.modPow(bobKeyPair.privateKey, params.p);
    expect(computedAlicePublic.equals(aliceKeyPair.publicKey)).toBe(true);
    expect(computedBobPublic.equals(bobKeyPair.publicKey)).toBe(true);
  });

  it('should compute same shared secret', () => {
    const aliceKeyPair = alice.generateKeyPair();
    const bobKeyPair = bob.generateKeyPair();

    // Compute shared secrets
    const aliceSharedSecret = alice.computeSharedSecret(aliceKeyPair.privateKey, bobKeyPair.publicKey);
    const bobSharedSecret = bob.computeSharedSecret(bobKeyPair.privateKey, aliceKeyPair.publicKey);

    // Verify shared secrets match
    expect(aliceSharedSecret.equals(bobSharedSecret)).toBe(true);
  });

  it('should generate different key pairs each time', () => {
    const keyPair1 = alice.generateKeyPair();
    const keyPair2 = alice.generateKeyPair();

    // Key pairs should be different
    expect(keyPair1.privateKey.equals(keyPair2.privateKey)).toBe(false);
    expect(keyPair1.publicKey.equals(keyPair2.publicKey)).toBe(false);
  });

  it('should handle small subgroup attacks', () => {
    const aliceKeyPair = alice.generateKeyPair();
    
    // Try to use invalid public key (1)
    const invalidPublicKey = BigInteger.ONE;
    
    expect(() => {
      alice.computeSharedSecret(aliceKeyPair.privateKey, invalidPublicKey);
    }).toThrow('Invalid public key');
  });

  it('should reject public keys not in the group', () => {
    const aliceKeyPair = alice.generateKeyPair();
    
    // Try to use public key = p
    const invalidPublicKey = params.p;
    
    expect(() => {
      alice.computeSharedSecret(aliceKeyPair.privateKey, invalidPublicKey);
    }).toThrow('Invalid public key');
  });

  it('should handle key exchange with multiple parties', () => {
    const charlie = new DiffieHellman(params);

    const aliceKeyPair = alice.generateKeyPair();
    const bobKeyPair = bob.generateKeyPair();
    const charlieKeyPair = charlie.generateKeyPair();

    // Compute pairwise shared secrets
    const aliceBobSecret = alice.computeSharedSecret(aliceKeyPair.privateKey, bobKeyPair.publicKey);
    const bobAliceSecret = bob.computeSharedSecret(bobKeyPair.privateKey, aliceKeyPair.publicKey);
    
    const bobCharlieSecret = bob.computeSharedSecret(bobKeyPair.privateKey, charlieKeyPair.publicKey);
    const charlieBobSecret = charlie.computeSharedSecret(charlieKeyPair.privateKey, bobKeyPair.publicKey);
    
    const charlieAliceSecret = charlie.computeSharedSecret(charlieKeyPair.privateKey, aliceKeyPair.publicKey);
    const aliceCharlieSecret = alice.computeSharedSecret(aliceKeyPair.privateKey, charlieKeyPair.publicKey);

    // Verify all pairs have matching secrets
    expect(aliceBobSecret.equals(bobAliceSecret)).toBe(true);
    expect(bobCharlieSecret.equals(charlieBobSecret)).toBe(true);
    expect(charlieAliceSecret.equals(aliceCharlieSecret)).toBe(true);
  });

  it('should reject invalid parameter sizes', async () => {
    await expect(DiffieHellman.generateParams(256)) // Too small
      .rejects
      .toThrow('Invalid parameter size');
  });

  it('should be non-malleable', () => {
    const aliceKeyPair = alice.generateKeyPair();
    const bobKeyPair = bob.generateKeyPair();

    // Compute original shared secret
    const originalSecret = alice.computeSharedSecret(aliceKeyPair.privateKey, bobKeyPair.publicKey);

    // Try to create malicious public key by multiplying with generator
    const maliciousPublicKey = bobKeyPair.publicKey.multiply(params.g).mod(params.p);
    const maliciousSecret = alice.computeSharedSecret(aliceKeyPair.privateKey, maliciousPublicKey);

    // The secrets should be different
    expect(originalSecret.equals(maliciousSecret)).toBe(false);
  });

  it('should handle concurrent key exchanges', async () => {
    const numExchanges = 5;
    const exchanges = Array(numExchanges).fill(null).map(async () => {
      const alice = new DiffieHellman(params);
      const bob = new DiffieHellman(params);

      const aliceKeyPair = alice.generateKeyPair();
      const bobKeyPair = bob.generateKeyPair();

      const aliceSecret = alice.computeSharedSecret(aliceKeyPair.privateKey, bobKeyPair.publicKey);
      const bobSecret = bob.computeSharedSecret(bobKeyPair.privateKey, aliceKeyPair.publicKey);

      return { aliceSecret, bobSecret };
    });

    const results = await Promise.all(exchanges);
    
    // Verify all exchanges produced matching secrets
    results.forEach(({ aliceSecret, bobSecret }) => {
      expect(aliceSecret.equals(bobSecret)).toBe(true);
    });

    // Verify all exchanges produced different secrets
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        expect(results[i].aliceSecret.equals(results[j].aliceSecret)).toBe(false);
      }
    }
  });
}); 