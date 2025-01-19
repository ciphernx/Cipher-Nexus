import { ChaCha20Poly1305, ChaChaParams } from '../chacha20-poly1305';
import { randomBytes } from 'crypto';

describe('ChaCha20-Poly1305 AEAD', () => {
  const message = 'Hello, ChaCha20-Poly1305!';
  let key: Buffer;
  let nonce: Buffer;

  beforeEach(() => {
    // Generate random key and nonce for each test
    key = randomBytes(32);    // 256-bit key
    nonce = randomBytes(12);  // 96-bit nonce
  });

  it('should encrypt and decrypt correctly', async () => {
    const params: ChaChaParams = {
      key,
      nonce,
      authData: Buffer.from('Additional authenticated data')
    };

    const plaintext = Buffer.from(message);
    const { ciphertext, tag } = await ChaCha20Poly1305.encrypt(plaintext, params);
    const decrypted = await ChaCha20Poly1305.decrypt(ciphertext, tag, params);

    expect(decrypted.toString()).toBe(message);
  });

  it('should produce different ciphertexts for same plaintext with different nonces', async () => {
    const params1: ChaChaParams = {
      key,
      nonce: randomBytes(12),
      authData: Buffer.from('AAD')
    };

    const params2: ChaChaParams = {
      key,
      nonce: randomBytes(12),
      authData: Buffer.from('AAD')
    };

    const plaintext = Buffer.from(message);
    const result1 = await ChaCha20Poly1305.encrypt(plaintext, params1);
    const result2 = await ChaCha20Poly1305.encrypt(plaintext, params2);

    expect(result1.ciphertext).not.toEqual(result2.ciphertext);
    expect(result1.tag).not.toEqual(result2.tag);
  });

  it('should verify authentication', async () => {
    const params: ChaChaParams = {
      key,
      nonce,
      authData: Buffer.from('AAD')
    };

    const plaintext = Buffer.from(message);
    const { ciphertext, tag } = await ChaCha20Poly1305.encrypt(plaintext, params);

    // Modify ciphertext
    ciphertext[0] ^= 1;

    await expect(ChaCha20Poly1305.decrypt(ciphertext, tag, params))
      .rejects
      .toThrow('Authentication failed');
  });

  it('should verify additional authenticated data', async () => {
    const params: ChaChaParams = {
      key,
      nonce,
      authData: Buffer.from('Original AAD')
    };

    const plaintext = Buffer.from(message);
    const { ciphertext, tag } = await ChaCha20Poly1305.encrypt(plaintext, params);

    // Try to decrypt with different AAD
    const modifiedParams: ChaChaParams = {
      ...params,
      authData: Buffer.from('Modified AAD')
    };

    await expect(ChaCha20Poly1305.decrypt(ciphertext, tag, modifiedParams))
      .rejects
      .toThrow('Authentication failed');
  });

  it('should handle empty messages', async () => {
    const params: ChaChaParams = {
      key,
      nonce,
      authData: Buffer.from('AAD')
    };

    const plaintext = Buffer.from('');
    const { ciphertext, tag } = await ChaCha20Poly1305.encrypt(plaintext, params);
    const decrypted = await ChaCha20Poly1305.decrypt(ciphertext, tag, params);

    expect(decrypted.length).toBe(0);
  });

  it('should reject invalid parameters', async () => {
    // Invalid key size
    await expect(ChaCha20Poly1305.encrypt(Buffer.from(message), {
      key: randomBytes(31), // Not 32 bytes
      nonce,
      authData: Buffer.from('AAD')
    })).rejects.toThrow('Invalid key length');

    // Invalid nonce size
    await expect(ChaCha20Poly1305.encrypt(Buffer.from(message), {
      key,
      nonce: randomBytes(11), // Not 12 bytes
      authData: Buffer.from('AAD')
    })).rejects.toThrow('Invalid nonce length');
  });

  it('should handle concurrent encryption/decryption', async () => {
    const params: ChaChaParams = {
      key,
      nonce,
      authData: Buffer.from('AAD')
    };

    const numOperations = 5;
    const operations = Array(numOperations).fill(null).map(async (_, i) => {
      const msg = `Message ${i}`;
      const plaintext = Buffer.from(msg);
      const { ciphertext, tag } = await ChaCha20Poly1305.encrypt(plaintext, params);
      const decrypted = await ChaCha20Poly1305.decrypt(ciphertext, tag, params);
      return { original: msg, decrypted: decrypted.toString() };
    });

    const results = await Promise.all(operations);
    results.forEach(({ original, decrypted }) => {
      expect(decrypted).toBe(original);
    });
  });

  it('should be deterministic with same key and nonce', async () => {
    const params: ChaChaParams = {
      key,
      nonce,
      authData: Buffer.from('AAD')
    };

    const plaintext = Buffer.from(message);
    const result1 = await ChaCha20Poly1305.encrypt(plaintext, params);
    const result2 = await ChaCha20Poly1305.encrypt(plaintext, params);

    expect(result1.ciphertext).toEqual(result2.ciphertext);
    expect(result1.tag).toEqual(result2.tag);
  });

  it('should handle large data', async () => {
    const params: ChaChaParams = {
      key,
      nonce,
      authData: Buffer.from('AAD')
    };

    const largeData = Buffer.alloc(1024 * 1024); // 1MB
    randomBytes(1024 * 1024).copy(largeData);

    const { ciphertext, tag } = await ChaCha20Poly1305.encrypt(largeData, params);
    const decrypted = await ChaCha20Poly1305.decrypt(ciphertext, tag, params);

    expect(decrypted).toEqual(largeData);
  });

  it('should support incremental processing', async () => {
    const params: ChaChaParams = {
      key,
      nonce,
      authData: Buffer.from('AAD')
    };

    const chunks = [
      Buffer.from('First chunk'),
      Buffer.from('Second chunk'),
      Buffer.from('Third chunk')
    ];

    // Encrypt incrementally
    const encryptor = new ChaCha20Poly1305.Incremental(params);
    for (const chunk of chunks) {
      await encryptor.update(chunk);
    }
    const { ciphertext, tag } = await encryptor.final();

    // Decrypt incrementally
    const decryptor = new ChaCha20Poly1305.Incremental(params);
    for (let i = 0; i < ciphertext.length; i += 64) {
      const chunk = ciphertext.slice(i, i + 64);
      await decryptor.update(chunk);
    }
    const decrypted = await decryptor.final(tag);

    expect(decrypted.toString()).toBe(chunks.map(c => c.toString()).join(''));
  });
}); 