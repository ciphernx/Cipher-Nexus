import { RSA, RSAKeyPair, RSAParams, RSAPadding } from '../rsa';
import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto';

describe('RSA Encryption', () => {
  const message = 'Hello, RSA Encryption!';
  let params: RSAParams;
  let keyPair: RSAKeyPair;

  beforeAll(async () => {
    // Generate parameters with smaller bit size for testing
    params = await RSA.generateParams(2048);
    keyPair = await RSA.generateKeyPair(params);
  });

  it('should generate valid parameters', () => {
    expect(params.bits).toBe(2048);
    expect(params.e).toBeDefined();
    expect(params.e.compareTo(BigInteger.ONE)).toBeGreaterThan(0);
  });

  it('should generate valid key pair', () => {
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.publicKey.n.bitLength()).toBe(2048);
    expect(keyPair.publicKey.e.equals(params.e)).toBe(true);

    // Verify n = p * q
    expect(keyPair.privateKey.p.multiply(keyPair.privateKey.q).equals(keyPair.publicKey.n)).toBe(true);

    // Verify d * e ≡ 1 (mod φ(n))
    const phi = keyPair.privateKey.p.subtract(BigInteger.ONE)
      .multiply(keyPair.privateKey.q.subtract(BigInteger.ONE));
    const result = keyPair.privateKey.d.multiply(params.e).mod(phi);
    expect(result.equals(BigInteger.ONE)).toBe(true);
  });

  it('should encrypt and decrypt correctly with PKCS1 padding', async () => {
    const plaintext = Buffer.from(message);
    const ciphertext = await RSA.encrypt(plaintext, keyPair.publicKey, {
      padding: RSAPadding.PKCS1
    });
    const decrypted = await RSA.decrypt(ciphertext, keyPair.privateKey, {
      padding: RSAPadding.PKCS1
    });

    expect(decrypted.toString()).toBe(message);
  });

  it('should encrypt and decrypt correctly with OAEP padding', async () => {
    const plaintext = Buffer.from(message);
    const ciphertext = await RSA.encrypt(plaintext, keyPair.publicKey, {
      padding: RSAPadding.OAEP,
      hash: 'sha256',
      label: Buffer.from('test-label')
    });
    const decrypted = await RSA.decrypt(ciphertext, keyPair.privateKey, {
      padding: RSAPadding.OAEP,
      hash: 'sha256',
      label: Buffer.from('test-label')
    });

    expect(decrypted.toString()).toBe(message);
  });

  it('should produce different ciphertexts for same plaintext', async () => {
    const plaintext = Buffer.from(message);
    const ciphertext1 = await RSA.encrypt(plaintext, keyPair.publicKey, {
      padding: RSAPadding.OAEP
    });
    const ciphertext2 = await RSA.encrypt(plaintext, keyPair.publicKey, {
      padding: RSAPadding.OAEP
    });

    expect(ciphertext1).not.toEqual(ciphertext2);
  });

  it('should sign and verify correctly with PSS padding', async () => {
    const data = Buffer.from(message);
    const signature = await RSA.sign(data, keyPair.privateKey, {
      padding: RSAPadding.PSS,
      hash: 'sha256',
      saltLength: 32
    });
    const isValid = await RSA.verify(data, signature, keyPair.publicKey, {
      padding: RSAPadding.PSS,
      hash: 'sha256',
      saltLength: 32
    });

    expect(isValid).toBe(true);
  });

  it('should reject invalid signatures', async () => {
    const data = Buffer.from(message);
    const signature = await RSA.sign(data, keyPair.privateKey, {
      padding: RSAPadding.PSS,
      hash: 'sha256'
    });

    // Modify signature
    signature[0] ^= 1;

    const isValid = await RSA.verify(data, signature, keyPair.publicKey, {
      padding: RSAPadding.PSS,
      hash: 'sha256'
    });

    expect(isValid).toBe(false);
  });

  it('should handle message size limits', async () => {
    // Maximum message size for PKCS1 is (keysize - 11) bytes
    const maxSize = Math.floor((2048 / 8) - 11);
    const largeMessage = randomBytes(maxSize);

    // This should work
    const ciphertext = await RSA.encrypt(largeMessage, keyPair.publicKey, {
      padding: RSAPadding.PKCS1
    });
    const decrypted = await RSA.decrypt(ciphertext, keyPair.privateKey, {
      padding: RSAPadding.PKCS1
    });
    expect(decrypted).toEqual(largeMessage);

    // This should fail
    const tooLarge = Buffer.concat([largeMessage, Buffer.from([0])]);
    await expect(RSA.encrypt(tooLarge, keyPair.publicKey, {
      padding: RSAPadding.PKCS1
    })).rejects.toThrow('Message too long');
  });

  it('should handle concurrent operations', async () => {
    const numOperations = 5;
    const operations = Array(numOperations).fill(null).map(async (_, i) => {
      const msg = `Message ${i}`;
      const plaintext = Buffer.from(msg);
      const ciphertext = await RSA.encrypt(plaintext, keyPair.publicKey, {
        padding: RSAPadding.OAEP
      });
      const decrypted = await RSA.decrypt(ciphertext, keyPair.privateKey, {
        padding: RSAPadding.OAEP
      });
      return { original: msg, decrypted: decrypted.toString() };
    });

    const results = await Promise.all(operations);
    results.forEach(({ original, decrypted }) => {
      expect(decrypted).toBe(original);
    });
  });

  it('should reject invalid parameters', async () => {
    // Invalid key size
    await expect(RSA.generateParams(1024)) // Too small
      .rejects
      .toThrow('Key size too small');

    // Invalid public exponent
    await expect(RSA.generateParams(2048, new BigInteger('2'))) // Must be odd
      .rejects
      .toThrow('Invalid public exponent');
  });

  it('should support CRT optimization', async () => {
    const plaintext = Buffer.from(message);
    
    // Encrypt with normal decryption
    const ciphertext1 = await RSA.encrypt(plaintext, keyPair.publicKey, {
      padding: RSAPadding.PKCS1
    });
    const decrypted1 = await RSA.decrypt(ciphertext1, keyPair.privateKey, {
      padding: RSAPadding.PKCS1,
      useCRT: false
    });

    // Encrypt with CRT optimization
    const ciphertext2 = await RSA.encrypt(plaintext, keyPair.publicKey, {
      padding: RSAPadding.PKCS1
    });
    const decrypted2 = await RSA.decrypt(ciphertext2, keyPair.privateKey, {
      padding: RSAPadding.PKCS1,
      useCRT: true
    });

    expect(decrypted1.toString()).toBe(message);
    expect(decrypted2.toString()).toBe(message);
  });

  it('should be resistant to timing attacks', async () => {
    const data = Buffer.from(message);
    const signature = await RSA.sign(data, keyPair.privateKey, {
      padding: RSAPadding.PSS,
      hash: 'sha256',
      constantTime: true
    });

    // Measure verification time for valid signature
    const start1 = process.hrtime.bigint();
    await RSA.verify(data, signature, keyPair.publicKey, {
      padding: RSAPadding.PSS,
      hash: 'sha256',
      constantTime: true
    });
    const end1 = process.hrtime.bigint();

    // Modify signature
    signature[0] ^= 1;

    // Measure verification time for invalid signature
    const start2 = process.hrtime.bigint();
    await RSA.verify(data, signature, keyPair.publicKey, {
      padding: RSAPadding.PSS,
      hash: 'sha256',
      constantTime: true
    });
    const end2 = process.hrtime.bigint();

    // Times should be similar
    const diff = Number(end1 - start1 - (end2 - start2)) / 1_000_000; // Convert to ms
    expect(Math.abs(diff)).toBeLessThan(5); // Less than 5ms difference
  });
}); 