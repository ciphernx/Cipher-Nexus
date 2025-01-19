import { AES, AESParams, AESMode } from '../aes';
import { randomBytes } from 'crypto';

describe('AES Encryption', () => {
  const message = 'Hello, AES Encryption!';
  let key: Buffer;
  let iv: Buffer;

  beforeEach(() => {
    // Generate random key and IV for each test
    key = randomBytes(32); // 256-bit key
    iv = randomBytes(16);  // 128-bit IV
  });

  it('should encrypt and decrypt correctly in CBC mode', async () => {
    const params: AESParams = {
      mode: AESMode.CBC,
      key,
      iv
    };

    const plaintext = Buffer.from(message);
    const ciphertext = await AES.encrypt(plaintext, params);
    const decrypted = await AES.decrypt(ciphertext, params);

    expect(decrypted.toString()).toBe(message);
  });

  it('should encrypt and decrypt correctly in GCM mode', async () => {
    const params: AESParams = {
      mode: AESMode.GCM,
      key,
      iv,
      authData: Buffer.from('Additional authenticated data')
    };

    const plaintext = Buffer.from(message);
    const { ciphertext, tag } = await AES.encryptGCM(plaintext, params);
    const decrypted = await AES.decryptGCM(ciphertext, tag, params);

    expect(decrypted.toString()).toBe(message);
  });

  it('should produce different ciphertexts for same plaintext with different IVs', async () => {
    const params1: AESParams = {
      mode: AESMode.CBC,
      key,
      iv: randomBytes(16)
    };

    const params2: AESParams = {
      mode: AESMode.CBC,
      key,
      iv: randomBytes(16)
    };

    const plaintext = Buffer.from(message);
    const ciphertext1 = await AES.encrypt(plaintext, params1);
    const ciphertext2 = await AES.encrypt(plaintext, params2);

    expect(ciphertext1).not.toEqual(ciphertext2);
  });

  it('should handle different key sizes', async () => {
    const keySizes = [16, 24, 32]; // 128, 192, 256 bits

    for (const keySize of keySizes) {
      const params: AESParams = {
        mode: AESMode.CBC,
        key: randomBytes(keySize),
        iv
      };

      const plaintext = Buffer.from(message);
      const ciphertext = await AES.encrypt(plaintext, params);
      const decrypted = await AES.decrypt(ciphertext, params);

      expect(decrypted.toString()).toBe(message);
    }
  });

  it('should verify authentication in GCM mode', async () => {
    const params: AESParams = {
      mode: AESMode.GCM,
      key,
      iv,
      authData: Buffer.from('Additional authenticated data')
    };

    const plaintext = Buffer.from(message);
    const { ciphertext, tag } = await AES.encryptGCM(plaintext, params);

    // Modify ciphertext
    ciphertext[0] ^= 1;

    await expect(AES.decryptGCM(ciphertext, tag, params))
      .rejects
      .toThrow('Authentication failed');
  });

  it('should handle padding correctly', async () => {
    const params: AESParams = {
      mode: AESMode.CBC,
      key,
      iv
    };

    // Test different message lengths
    const messages = [
      '',
      'A',
      'AB',
      'ABC',
      'A'.repeat(15),
      'A'.repeat(16),
      'A'.repeat(17)
    ];

    for (const msg of messages) {
      const plaintext = Buffer.from(msg);
      const ciphertext = await AES.encrypt(plaintext, params);
      const decrypted = await AES.decrypt(ciphertext, params);

      expect(decrypted.toString()).toBe(msg);
    }
  });

  it('should reject invalid parameters', async () => {
    // Invalid key size
    await expect(AES.encrypt(Buffer.from(message), {
      mode: AESMode.CBC,
      key: randomBytes(15), // Not 16, 24, or 32 bytes
      iv
    })).rejects.toThrow('Invalid key length');

    // Invalid IV size
    await expect(AES.encrypt(Buffer.from(message), {
      mode: AESMode.CBC,
      key,
      iv: randomBytes(15) // Not 16 bytes
    })).rejects.toThrow('Invalid IV length');
  });

  it('should handle concurrent encryption/decryption', async () => {
    const params: AESParams = {
      mode: AESMode.CBC,
      key,
      iv
    };

    const numOperations = 5;
    const operations = Array(numOperations).fill(null).map(async (_, i) => {
      const msg = `Message ${i}`;
      const plaintext = Buffer.from(msg);
      const ciphertext = await AES.encrypt(plaintext, params);
      const decrypted = await AES.decrypt(ciphertext, params);
      return { original: msg, decrypted: decrypted.toString() };
    });

    const results = await Promise.all(operations);
    results.forEach(({ original, decrypted }) => {
      expect(decrypted).toBe(original);
    });
  });

  it('should be deterministic with same key and IV', async () => {
    const params: AESParams = {
      mode: AESMode.CBC,
      key,
      iv
    };

    const plaintext = Buffer.from(message);
    const ciphertext1 = await AES.encrypt(plaintext, params);
    const ciphertext2 = await AES.encrypt(plaintext, params);

    expect(ciphertext1).toEqual(ciphertext2);
  });

  it('should handle large data', async () => {
    const params: AESParams = {
      mode: AESMode.CBC,
      key,
      iv
    };

    const largeData = Buffer.alloc(1024 * 1024); // 1MB
    randomBytes(1024 * 1024).copy(largeData);

    const ciphertext = await AES.encrypt(largeData, params);
    const decrypted = await AES.decrypt(ciphertext, params);

    expect(decrypted).toEqual(largeData);
  });

  it('should support streaming encryption/decryption', async () => {
    const params: AESParams = {
      mode: AESMode.CBC,
      key,
      iv
    };

    const chunks = [
      Buffer.from('First chunk'),
      Buffer.from('Second chunk'),
      Buffer.from('Third chunk')
    ];

    const encryptStream = AES.createEncryptStream(params);
    const decryptStream = AES.createDecryptStream(params);

    let encrypted = Buffer.alloc(0);
    let decrypted = Buffer.alloc(0);

    for (const chunk of chunks) {
      encrypted = Buffer.concat([encrypted, await encryptStream.write(chunk)]);
    }
    encrypted = Buffer.concat([encrypted, await encryptStream.final()]);

    for (let i = 0; i < encrypted.length; i += 16) {
      const chunk = encrypted.slice(i, i + 16);
      decrypted = Buffer.concat([decrypted, await decryptStream.write(chunk)]);
    }
    decrypted = Buffer.concat([decrypted, await decryptStream.final()]);

    expect(decrypted.toString()).toBe(chunks.map(c => c.toString()).join(''));
  });
}); 