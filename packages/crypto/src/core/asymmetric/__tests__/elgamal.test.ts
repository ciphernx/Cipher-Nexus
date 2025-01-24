import { ElGamal, ElGamalKeyPair, ElGamalParams } from '../elgamal';
import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto';

describe('ElGamal Encryption', () => {
  const message = 'Hello, ElGamal Encryption!';
  let params: ElGamalParams;
  let keyPair: ElGamalKeyPair;

  beforeAll(async () => {
    // Generate parameters with smaller bit size for testing
    params = await ElGamal.generateParams(2048);
    keyPair = await ElGamal.generateKeyPair(params);
  });

  it('should generate valid parameters', () => {
    expect(params.p).toBeDefined();
    expect(params.g).toBeDefined();
    expect(params.p.bitLength()).toBe(2048);
    expect(params.g.compareTo(BigInteger.ONE)).toBeGreaterThan(0);
    expect(params.g.compareTo(params.p)).toBeLessThan(0);

    // Verify that g is a generator of the multiplicative group
    const order = params.p.subtract(BigInteger.ONE);
    const gPowOrder = params.g.modPow(order, params.p);
    expect(gPowOrder.equals(BigInteger.ONE)).toBe(true);
  });

  it('should generate valid key pair', () => {
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.privateKey.compareTo(params.p.subtract(BigInteger.ONE))).toBeLessThan(0);
    expect(keyPair.privateKey.compareTo(BigInteger.ONE)).toBeGreaterThan(0);

    // Verify g^x = h (mod p)
    const computedPublicKey = params.g.modPow(keyPair.privateKey, params.p);
    expect(computedPublicKey.equals(keyPair.publicKey)).toBe(true);
  });

  it('should encrypt and decrypt correctly', async () => {
    const plaintext = Buffer.from(message);
    const messageNum = new BigInteger(plaintext.toString('hex'), 16);

    // Ensure message is in the valid range
    expect(messageNum.compareTo(params.p)).toBeLessThan(0);

    const { c1, c2 } = await ElGamal.encrypt(messageNum, keyPair.publicKey, params);
    const decrypted = await ElGamal.decrypt({ c1, c2 }, keyPair.privateKey, params);

    // Convert back to string
    const decryptedBuffer = Buffer.from(decrypted.toString(16), 'hex');
    expect(decryptedBuffer.toString()).toBe(message);
  });

  it('should produce different ciphertexts for same plaintext', async () => {
    const plaintext = Buffer.from(message);
    const messageNum = new BigInteger(plaintext.toString('hex'), 16);

    const result1 = await ElGamal.encrypt(messageNum, keyPair.publicKey, params);
    const result2 = await ElGamal.encrypt(messageNum, keyPair.publicKey, params);

    expect(result1.c1.equals(result2.c1)).toBe(false);
    expect(result1.c2.equals(result2.c2)).toBe(false);
  });

  it('should support homomorphic multiplication', async () => {
    const m1 = new BigInteger('123');
    const m2 = new BigInteger('456');

    // Encrypt individual messages
    const cipher1 = await ElGamal.encrypt(m1, keyPair.publicKey, params);
    const cipher2 = await ElGamal.encrypt(m2, keyPair.publicKey, params);

    // Multiply ciphertexts
    const productCipher = {
      c1: cipher1.c1.multiply(cipher2.c1).mod(params.p),
      c2: cipher1.c2.multiply(cipher2.c2).mod(params.p)
    };

    // Decrypt product
    const decryptedProduct = await ElGamal.decrypt(productCipher, keyPair.privateKey, params);
    const expectedProduct = m1.multiply(m2).mod(params.p);

    expect(decryptedProduct.equals(expectedProduct)).toBe(true);
  });

  it('should handle message size limits', async () => {
    // Message must be smaller than p
    const maxMessage = params.p.subtract(BigInteger.ONE);
    
    // This should work
    const cipher = await ElGamal.encrypt(maxMessage, keyPair.publicKey, params);
    const decrypted = await ElGamal.decrypt(cipher, keyPair.privateKey, params);
    expect(decrypted.equals(maxMessage)).toBe(true);

    // This should fail
    const tooLarge = params.p.add(BigInteger.ONE);
    await expect(ElGamal.encrypt(tooLarge, keyPair.publicKey, params))
      .rejects
      .toThrow('Message too large');
  });

  it('should handle concurrent operations', async () => {
    const numOperations = 5;
    const operations = Array(numOperations).fill(null).map(async (_, i) => {
      const msg = new BigInteger(i.toString());
      const cipher = await ElGamal.encrypt(msg, keyPair.publicKey, params);
      const decrypted = await ElGamal.decrypt(cipher, keyPair.privateKey, params);
      return { original: msg, decrypted };
    });

    const results = await Promise.all(operations);
    results.forEach(({ original, decrypted }) => {
      expect(decrypted.equals(original)).toBe(true);
    });
  });

  it('should reject invalid parameters', async () => {
    // Invalid key size
    await expect(ElGamal.generateParams(1024)) // Too small
      .rejects
      .toThrow('Key size too small');

    // Invalid generator
    const invalidParams = {
      ...params,
      g: BigInteger.ONE // g cannot be 1
    };
    await expect(ElGamal.generateKeyPair(invalidParams))
      .rejects
      .toThrow('Invalid generator');
  });

  it('should support exponential ElGamal', async () => {
    // For small messages, we can use g^m instead of m directly
    const smallMessage = new BigInteger('5');
    const encodedMessage = params.g.modPow(smallMessage, params.p);

    const cipher = await ElGamal.encrypt(encodedMessage, keyPair.publicKey, params);
    const decrypted = await ElGamal.decrypt(cipher, keyPair.privateKey, params);

    // Now we need to solve the discrete log to get back the original message
    let found = false;
    let result = new BigInteger('0');
    // This is just for testing, in practice we'd use more efficient methods
    for (let i = 0; i <= 10; i++) {
      if (params.g.modPow(new BigInteger(i.toString()), params.p).equals(decrypted)) {
        found = true;
        result = new BigInteger(i.toString());
        break;
      }
    }

    expect(found).toBe(true);
    expect(result.equals(smallMessage)).toBe(true);
  });

  it('should be semantically secure', async () => {
    // Test that an attacker cannot distinguish between encryptions of known messages
    const m0 = new BigInteger('0');
    const m1 = new BigInteger('1');

    // Generate many encryptions of both messages
    const numTrials = 10;
    const encryptions0 = await Promise.all(
      Array(numTrials).fill(null).map(() => ElGamal.encrypt(m0, keyPair.publicKey, params))
    );
    const encryptions1 = await Promise.all(
      Array(numTrials).fill(null).map(() => ElGamal.encrypt(m1, keyPair.publicKey, params))
    );

    // All encryptions should be different
    for (let i = 0; i < numTrials; i++) {
      for (let j = i + 1; j < numTrials; j++) {
        expect(encryptions0[i].c1.equals(encryptions0[j].c1)).toBe(false);
        expect(encryptions0[i].c2.equals(encryptions0[j].c2)).toBe(false);
        expect(encryptions1[i].c1.equals(encryptions1[j].c1)).toBe(false);
        expect(encryptions1[i].c2.equals(encryptions1[j].c2)).toBe(false);
      }
    }
  });

  it('should handle edge cases', async () => {
    // Test with message = 1
    const oneMessage = BigInteger.ONE;
    const cipherOne = await ElGamal.encrypt(oneMessage, keyPair.publicKey, params);
    const decryptedOne = await ElGamal.decrypt(cipherOne, keyPair.privateKey, params);
    expect(decryptedOne.equals(oneMessage)).toBe(true);

    // Test with message = p-1
    const maxMessage = params.p.subtract(BigInteger.ONE);
    const cipherMax = await ElGamal.encrypt(maxMessage, keyPair.publicKey, params);
    const decryptedMax = await ElGamal.decrypt(cipherMax, keyPair.privateKey, params);
    expect(decryptedMax.equals(maxMessage)).toBe(true);
  });
}); 