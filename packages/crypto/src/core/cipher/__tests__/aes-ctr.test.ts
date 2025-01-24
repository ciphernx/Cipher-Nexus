import { AES, AESMode, AESKeyLength } from '../aes';
import { randomBytes } from 'crypto';

describe('AES-CTR (Counter Mode)', () => {
  const message = 'Hello, AES-CTR!';

  it('should encrypt and decrypt correctly', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const nonce = randomBytes(12); // 96-bit nonce for CTR mode
    const counter = 1n; // Initial counter value
    
    const ciphertext = AES.encrypt(Buffer.from(message), key, {
      mode: AESMode.CTR,
      nonce,
      counter
    });

    const plaintext = AES.decrypt(ciphertext, key, {
      mode: AESMode.CTR,
      nonce,
      counter
    });
    
    expect(plaintext.toString()).toBe(message);
  });

  it('should produce different ciphertexts for same plaintext with different nonces', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const nonce1 = randomBytes(12);
    const nonce2 = randomBytes(12);
    const counter = 1n;

    const ciphertext1 = AES.encrypt(Buffer.from(message), key, {
      mode: AESMode.CTR,
      nonce: nonce1,
      counter
    });

    const ciphertext2 = AES.encrypt(Buffer.from(message), key, {
      mode: AESMode.CTR,
      nonce: nonce2,
      counter
    });

    expect(ciphertext1).not.toEqual(ciphertext2);
  });

  it('should produce different ciphertexts for same plaintext with different counters', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const nonce = randomBytes(12);

    const ciphertext1 = AES.encrypt(Buffer.from(message), key, {
      mode: AESMode.CTR,
      nonce,
      counter: 1n
    });

    const ciphertext2 = AES.encrypt(Buffer.from(message), key, {
      mode: AESMode.CTR,
      nonce,
      counter: 2n
    });

    expect(ciphertext1).not.toEqual(ciphertext2);
  });

  it('should handle empty messages', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const nonce = randomBytes(12);
    const counter = 1n;

    const ciphertext = AES.encrypt(Buffer.from(''), key, {
      mode: AESMode.CTR,
      nonce,
      counter
    });

    const plaintext = AES.decrypt(ciphertext, key, {
      mode: AESMode.CTR,
      nonce,
      counter
    });

    expect(plaintext.length).toBe(0);
  });

  it('should handle large messages', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const nonce = randomBytes(12);
    const counter = 1n;
    const largeMessage = randomBytes(1024 * 1024); // 1MB

    const ciphertext = AES.encrypt(largeMessage, key, {
      mode: AESMode.CTR,
      nonce,
      counter
    });

    const plaintext = AES.decrypt(ciphertext, key, {
      mode: AESMode.CTR,
      nonce,
      counter
    });

    expect(plaintext).toEqual(largeMessage);
  });

  it('should support parallel processing', async () => {
    const key = randomBytes(AESKeyLength.AES256);
    const nonce = randomBytes(12);
    const counter = 1n;
    const largeMessage = randomBytes(1024 * 1024); // 1MB

    // Split message into chunks for parallel processing
    const chunkSize = 256 * 1024; // 256KB chunks
    const chunks: Buffer[] = [];
    
    for (let i = 0; i < largeMessage.length; i += chunkSize) {
      chunks.push(largeMessage.slice(i, i + chunkSize));
    }

    // Encrypt chunks in parallel
    const encryptedChunks = await Promise.all(chunks.map(async (chunk, index) => {
      const chunkCounter = counter + BigInt(index * chunkSize / 16); // 16 bytes per block
      return AES.encrypt(chunk, key, {
        mode: AESMode.CTR,
        nonce,
        counter: chunkCounter
      });
    }));

    // Combine encrypted chunks
    const parallelCiphertext = Buffer.concat(encryptedChunks);

    // Compare with sequential encryption
    const sequentialCiphertext = AES.encrypt(largeMessage, key, {
      mode: AESMode.CTR,
      nonce,
      counter
    });

    expect(parallelCiphertext).toEqual(sequentialCiphertext);

    // Verify decryption
    const plaintext = AES.decrypt(parallelCiphertext, key, {
      mode: AESMode.CTR,
      nonce,
      counter
    });

    expect(plaintext).toEqual(largeMessage);
  });

  it('should support streaming interface', async () => {
    const key = randomBytes(AESKeyLength.AES256);
    const nonce = randomBytes(12);
    const counter = 1n;
    const chunks = [
      Buffer.from('First chunk'),
      Buffer.from('Second chunk'),
      Buffer.from('Third chunk')
    ];

    // Single-pass encryption
    const fullMessage = Buffer.concat(chunks);
    const expectedCiphertext = AES.encrypt(fullMessage, key, {
      mode: AESMode.CTR,
      nonce,
      counter
    });

    // Streaming encryption
    const encryptor = new AES.Streaming.Encrypt(key, {
      mode: AESMode.CTR,
      nonce,
      counter
    });

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
    const decryptor = new AES.Streaming.Decrypt(key, {
      mode: AESMode.CTR,
      nonce,
      counter
    });

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
    const key = randomBytes(AESKeyLength.AES256);
    const nonce = randomBytes(12);
    const counter = 1n;
    const largeMessage = randomBytes(1024); // 1KB

    // Encrypt full message
    const fullCiphertext = AES.encrypt(largeMessage, key, {
      mode: AESMode.CTR,
      nonce,
      counter
    });

    // Encrypt part of message starting from offset
    const offset = 512; // Start from middle
    const partialMessage = largeMessage.slice(offset);
    const blockOffset = BigInt(Math.floor(offset / 16)); // 16 bytes per block
    const partialCiphertext = AES.encrypt(partialMessage, key, {
      mode: AESMode.CTR,
      nonce,
      counter: counter + blockOffset
    });

    // Compare the corresponding parts
    expect(partialCiphertext).toEqual(fullCiphertext.slice(offset));
  });

  it('should reject invalid parameters', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const nonce = randomBytes(12);
    const counter = 1n;
    const message = Buffer.from('test message');

    // Test with invalid key size
    const invalidKey = randomBytes(31); // Not a valid AES key length
    expect(() => AES.encrypt(message, invalidKey, {
      mode: AESMode.CTR,
      nonce,
      counter
    })).toThrow();

    // Test with invalid nonce size
    const invalidNonce = randomBytes(11); // CTR requires 12-byte nonce
    expect(() => AES.encrypt(message, key, {
      mode: AESMode.CTR,
      nonce: invalidNonce,
      counter
    })).toThrow();

    // Test with invalid counter
    expect(() => AES.encrypt(message, key, {
      mode: AESMode.CTR,
      nonce,
      counter: -1n
    })).toThrow();
  });

  it('should handle counter overflow correctly', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const nonce = randomBytes(12);
    const message = Buffer.from('test');

    // Test with counter near maximum value
    const maxCounter = BigInt(2 ** 32 - 2);
    const ciphertext1 = AES.encrypt(message, key, {
      mode: AESMode.CTR,
      nonce,
      counter: maxCounter
    });

    const ciphertext2 = AES.encrypt(message, key, {
      mode: AESMode.CTR,
      nonce,
      counter: maxCounter + 1n
    });

    expect(ciphertext1).not.toEqual(ciphertext2);

    // Counter overflow should throw error
    expect(() => AES.encrypt(message, key, {
      mode: AESMode.CTR,
      nonce,
      counter: BigInt(2 ** 32)
    })).toThrow();
  });
}); 