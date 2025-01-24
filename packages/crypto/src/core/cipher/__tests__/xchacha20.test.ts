import { XChaCha20 } from '../xchacha20';
import { randomBytes } from 'crypto';

describe('XChaCha20 Stream Cipher', () => {
  const message = 'Hello, XChaCha20!';

  it('should encrypt and decrypt correctly', () => {
    const key = randomBytes(32);
    const nonce = randomBytes(24); // XChaCha20 uses 24-byte nonce
    
    const ciphertext = XChaCha20.encrypt(Buffer.from(message), key, nonce);
    const plaintext = XChaCha20.decrypt(ciphertext, key, nonce);
    
    expect(plaintext.toString()).toBe(message);
  });

  it('should produce different ciphertexts for same plaintext with different nonces', () => {
    const key = randomBytes(32);
    const nonce1 = randomBytes(24);
    const nonce2 = randomBytes(24);

    const ciphertext1 = XChaCha20.encrypt(Buffer.from(message), key, nonce1);
    const ciphertext2 = XChaCha20.encrypt(Buffer.from(message), key, nonce2);

    expect(ciphertext1).not.toEqual(ciphertext2);
  });

  it('should handle empty messages', () => {
    const key = randomBytes(32);
    const nonce = randomBytes(24);

    const ciphertext = XChaCha20.encrypt(Buffer.from(''), key, nonce);
    const plaintext = XChaCha20.decrypt(ciphertext, key, nonce);

    expect(plaintext.length).toBe(0);
  });

  it('should handle large messages', () => {
    const key = randomBytes(32);
    const nonce = randomBytes(24);
    const largeMessage = randomBytes(1024 * 1024); // 1MB

    const ciphertext = XChaCha20.encrypt(largeMessage, key, nonce);
    const plaintext = XChaCha20.decrypt(ciphertext, key, nonce);

    expect(plaintext).toEqual(largeMessage);
  });

  it('should support streaming interface', async () => {
    const key = randomBytes(32);
    const nonce = randomBytes(24);
    const chunks = [
      Buffer.from('First chunk'),
      Buffer.from('Second chunk'),
      Buffer.from('Third chunk')
    ];

    // Single-pass encryption
    const fullMessage = Buffer.concat(chunks);
    const expectedCiphertext = XChaCha20.encrypt(fullMessage, key, nonce);

    // Streaming encryption
    const encryptor = new XChaCha20.Streaming.Encrypt(key, nonce);
    const encryptedChunks = [];
    for (const chunk of chunks) {
      const encryptedChunk = await encryptor.update(chunk);
      encryptedChunks.push(encryptedChunk);
    }
    const finalEncryptedChunk = await encryptor.finalize();
    if (finalEncryptedChunk) encryptedChunks.push(finalEncryptedChunk);
    const streamingCiphertext = Buffer.concat(encryptedChunks);

    expect(streamingCiphertext).toEqual(expectedCiphertext);

    // Streaming decryption
    const decryptor = new XChaCha20.Streaming.Decrypt(key, nonce);
    const decryptedChunks = [];
    for (const chunk of encryptedChunks) {
      const decryptedChunk = await decryptor.update(chunk);
      decryptedChunks.push(decryptedChunk);
    }
    const finalDecryptedChunk = await decryptor.finalize();
    if (finalDecryptedChunk) decryptedChunks.push(finalDecryptedChunk);

    const streamingPlaintext = Buffer.concat(decryptedChunks);
    expect(streamingPlaintext.toString()).toBe(fullMessage.toString());
  });

  it('should support seeking', () => {
    const key = randomBytes(32);
    const nonce = randomBytes(24);
    const largeMessage = randomBytes(1024); // 1KB

    // Encrypt full message
    const fullCiphertext = XChaCha20.encrypt(largeMessage, key, nonce);

    // Encrypt part of message starting from offset
    const offset = 512; // Start from middle
    const partialMessage = largeMessage.slice(offset);
    const partialCiphertext = XChaCha20.encrypt(partialMessage, key, nonce, { counter: offset / 64 });

    // Compare the corresponding parts
    expect(partialCiphertext).toEqual(fullCiphertext.slice(offset));
  });

  it('should support authenticated encryption with Poly1305', () => {
    const key = randomBytes(32);
    const nonce = randomBytes(24);
    const aad = Buffer.from('Additional authenticated data');

    // Encrypt with authentication
    const { ciphertext, tag } = XChaCha20.encryptWithPoly1305(Buffer.from(message), key, nonce, aad);

    // Decrypt with authentication
    const plaintext = XChaCha20.decryptWithPoly1305(ciphertext, tag, key, nonce, aad);
    expect(plaintext.toString()).toBe(message);

    // Tamper with ciphertext
    const tamperedCiphertext = Buffer.from(ciphertext);
    tamperedCiphertext[0] ^= 1;
    expect(() => {
      XChaCha20.decryptWithPoly1305(tamperedCiphertext, tag, key, nonce, aad);
    }).toThrow();

    // Tamper with AAD
    const tamperedAad = Buffer.from('Tampered authenticated data');
    expect(() => {
      XChaCha20.decryptWithPoly1305(ciphertext, tag, key, nonce, tamperedAad);
    }).toThrow();
  });

  it('should reject invalid parameters', () => {
    const message = Buffer.from('test message');
    const key = randomBytes(32);
    const nonce = randomBytes(24);

    // Test with invalid key size
    const invalidKey = randomBytes(31); // XChaCha20 requires 32-byte key
    expect(() => XChaCha20.encrypt(message, invalidKey, nonce)).toThrow();

    // Test with invalid nonce size
    const invalidNonce = randomBytes(23); // XChaCha20 requires 24-byte nonce
    expect(() => XChaCha20.encrypt(message, key, invalidNonce)).toThrow();

    // Test with invalid counter
    expect(() => XChaCha20.encrypt(message, key, nonce, { counter: -1 })).toThrow();
  });

  it('should handle subkey derivation correctly', () => {
    const key = randomBytes(32);
    const nonce = randomBytes(24);

    // Derive subkey using HChaCha20
    const subkey = XChaCha20.deriveSubkey(key, nonce.slice(0, 16));
    expect(subkey.length).toBe(32);

    // Encrypt with derived subkey
    const shortNonce = nonce.slice(16); // Use remaining 8 bytes as ChaCha20 nonce
    const ciphertext1 = XChaCha20.encrypt(Buffer.from(message), key, nonce);
    const ciphertext2 = XChaCha20.encryptWithSubkey(Buffer.from(message), subkey, shortNonce);

    expect(ciphertext1).toEqual(ciphertext2);
  });

  it('should be time-independent in decryption', async () => {
    const key = randomBytes(32);
    const nonce = randomBytes(24);
    const aad = Buffer.from('Additional authenticated data');
    const shortMessage = Buffer.from('short');
    const longMessage = Buffer.from('very_long_message_for_timing_test');

    // Create valid authenticated ciphertexts
    const short = XChaCha20.encryptWithPoly1305(shortMessage, key, nonce, aad);
    const long = XChaCha20.encryptWithPoly1305(longMessage, key, nonce, aad);

    const startShort = process.hrtime.bigint();
    await XChaCha20.decryptWithPoly1305(short.ciphertext, short.tag, key, nonce, aad);
    const endShort = process.hrtime.bigint();

    const startLong = process.hrtime.bigint();
    await XChaCha20.decryptWithPoly1305(long.ciphertext, long.tag, key, nonce, aad);
    const endLong = process.hrtime.bigint();

    const shortTime = Number(endShort - startShort);
    const longTime = Number(endLong - startLong);

    // Times should be roughly proportional to message length
    const ratio = longTime / shortTime;
    const expectedRatio = longMessage.length / shortMessage.length;
    expect(ratio).toBeGreaterThan(expectedRatio * 0.5);
    expect(ratio).toBeLessThan(expectedRatio * 1.5);
  });

  it('should handle counter overflow correctly', () => {
    const key = randomBytes(32);
    const nonce = randomBytes(24);
    const message = Buffer.from('test');

    // Test with counter near maximum value
    const maxCounter = Math.pow(2, 32) - 2;
    const ciphertext1 = XChaCha20.encrypt(message, key, nonce, { counter: maxCounter });
    const ciphertext2 = XChaCha20.encrypt(message, key, nonce, { counter: maxCounter + 1 });

    expect(ciphertext1).not.toEqual(ciphertext2);

    // Counter overflow should throw error
    expect(() => {
      XChaCha20.encrypt(message, key, nonce, { counter: Math.pow(2, 32) });
    }).toThrow();
  });

  it('should support parallel processing', async () => {
    const key = randomBytes(32);
    const nonce = randomBytes(24);
    const largeMessage = randomBytes(1024 * 1024); // 1MB

    // Split message into chunks for parallel processing
    const chunkSize = 256 * 1024; // 256KB chunks
    const chunks: Buffer[] = [];
    
    for (let i = 0; i < largeMessage.length; i += chunkSize) {
      chunks.push(largeMessage.slice(i, i + chunkSize));
    }

    // Encrypt chunks in parallel
    const encryptedChunks = await Promise.all(chunks.map(async (chunk, index) => {
      const counter = Math.floor((index * chunkSize) / 64); // 64 bytes per block
      return XChaCha20.encrypt(chunk, key, nonce, { counter });
    }));

    // Combine encrypted chunks
    const parallelCiphertext = Buffer.concat(encryptedChunks);

    // Compare with sequential encryption
    const sequentialCiphertext = XChaCha20.encrypt(largeMessage, key, nonce);

    expect(parallelCiphertext).toEqual(sequentialCiphertext);
  });
}); 