import { AES, AESMode, AESKeyLength } from '../aes';
import { randomBytes } from 'crypto';

describe('AES-CFB (Cipher Feedback Mode)', () => {
  const message = 'Hello, AES-CFB!';

  it('should encrypt and decrypt correctly', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16); // CFB requires full block size IV
    
    const ciphertext = AES.encrypt(Buffer.from(message), key, {
      mode: AESMode.CFB,
      iv
    });

    const plaintext = AES.decrypt(ciphertext, key, {
      mode: AESMode.CFB,
      iv
    });
    
    expect(plaintext.toString()).toBe(message);
  });

  it('should produce different ciphertexts for same plaintext with different IVs', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv1 = randomBytes(16);
    const iv2 = randomBytes(16);

    const ciphertext1 = AES.encrypt(Buffer.from(message), key, {
      mode: AESMode.CFB,
      iv: iv1
    });

    const ciphertext2 = AES.encrypt(Buffer.from(message), key, {
      mode: AESMode.CFB,
      iv: iv2
    });

    expect(ciphertext1).not.toEqual(ciphertext2);
  });

  it('should handle empty messages', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);

    const ciphertext = AES.encrypt(Buffer.from(''), key, {
      mode: AESMode.CFB,
      iv
    });

    const plaintext = AES.decrypt(ciphertext, key, {
      mode: AESMode.CFB,
      iv
    });

    expect(plaintext.length).toBe(0);
  });

  it('should handle large messages', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    const largeMessage = randomBytes(1024 * 1024); // 1MB

    const ciphertext = AES.encrypt(largeMessage, key, {
      mode: AESMode.CFB,
      iv
    });

    const plaintext = AES.decrypt(ciphertext, key, {
      mode: AESMode.CFB,
      iv
    });

    expect(plaintext).toEqual(largeMessage);
  });

  it('should support streaming interface', async () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    const chunks = [
      Buffer.from('First chunk'),
      Buffer.from('Second chunk'),
      Buffer.from('Third chunk')
    ];

    // Single-pass encryption
    const fullMessage = Buffer.concat(chunks);
    const expectedCiphertext = AES.encrypt(fullMessage, key, {
      mode: AESMode.CFB,
      iv
    });

    // Streaming encryption
    const encryptor = new AES.Streaming.Encrypt(key, {
      mode: AESMode.CFB,
      iv
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
      mode: AESMode.CFB,
      iv
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

  it('should support error propagation and recovery', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    const message = Buffer.from('A fairly long message to test error propagation in CFB mode');

    // Encrypt the message
    const ciphertext = AES.encrypt(message, key, {
      mode: AESMode.CFB,
      iv
    });

    // Corrupt a single byte in the middle of the ciphertext
    const corruptedCiphertext = Buffer.from(ciphertext);
    const corruptionIndex = Math.floor(ciphertext.length / 2);
    corruptedCiphertext[corruptionIndex] ^= 0xFF;

    // Decrypt the corrupted ciphertext
    const corruptedPlaintext = AES.decrypt(corruptedCiphertext, key, {
      mode: AESMode.CFB,
      iv
    });

    // Verify that only a limited number of bytes after the corruption are affected
    const blockSize = 16;
    expect(corruptedPlaintext.slice(0, corruptionIndex)).toEqual(
      message.slice(0, corruptionIndex)
    );
    expect(corruptedPlaintext.slice(corruptionIndex + blockSize)).toEqual(
      message.slice(corruptionIndex + blockSize)
    );
  });

  it('should support different segment sizes', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    const segmentSizes = [1, 8, 16, 32, 64, 128]; // in bits

    for (const s of segmentSizes) {
      const ciphertext = AES.encrypt(Buffer.from(message), key, {
        mode: AESMode.CFB,
        iv,
        segmentSize: s
      });

      const plaintext = AES.decrypt(ciphertext, key, {
        mode: AESMode.CFB,
        iv,
        segmentSize: s
      });

      expect(plaintext.toString()).toBe(message);
    }
  });

  it('should reject invalid parameters', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    const message = Buffer.from('test message');

    // Test with invalid key size
    const invalidKey = randomBytes(31); // Not a valid AES key length
    expect(() => AES.encrypt(message, invalidKey, {
      mode: AESMode.CFB,
      iv
    })).toThrow();

    // Test with invalid IV size
    const invalidIV = randomBytes(15); // CFB requires 16-byte IV
    expect(() => AES.encrypt(message, key, {
      mode: AESMode.CFB,
      iv: invalidIV
    })).toThrow();

    // Test with invalid segment size
    expect(() => AES.encrypt(message, key, {
      mode: AESMode.CFB,
      iv,
      segmentSize: 9 // Must be multiple of 8
    })).toThrow();

    expect(() => AES.encrypt(message, key, {
      mode: AESMode.CFB,
      iv,
      segmentSize: 0 // Must be positive
    })).toThrow();

    expect(() => AES.encrypt(message, key, {
      mode: AESMode.CFB,
      iv,
      segmentSize: 129 // Must not exceed block size
    })).toThrow();
  });

  it('should be resistant to known plaintext attacks', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    const knownPlaintext = Buffer.from('Known plaintext');
    const secretMessage = Buffer.from('Secret message');

    // Encrypt known plaintext
    const knownCiphertext = AES.encrypt(knownPlaintext, key, {
      mode: AESMode.CFB,
      iv
    });

    // Encrypt secret message with different IV
    const differentIV = randomBytes(16);
    const secretCiphertext = AES.encrypt(secretMessage, key, {
      mode: AESMode.CFB,
      iv: differentIV
    });

    // Knowledge of plaintext-ciphertext pair should not help decrypt other messages
    const knownPair = {
      plaintext: knownPlaintext,
      ciphertext: knownCiphertext,
      iv
    };

    // Attempt to decrypt secret message using known pair (should fail)
    const derivedKey = AES.CFB.deriveKeyFromKnownPair(knownPair);
    expect(derivedKey).not.toEqual(key);
  });

  it('should support partial decryption with error recovery', async () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    const message = randomBytes(1024); // 1KB

    // Encrypt the message
    const ciphertext = AES.encrypt(message, key, {
      mode: AESMode.CFB,
      iv
    });

    // Corrupt some bytes in the middle
    const corruptedCiphertext = Buffer.from(ciphertext);
    const corruptionStart = 400;
    const corruptionLength = 32;
    for (let i = 0; i < corruptionLength; i++) {
      corruptedCiphertext[corruptionStart + i] ^= 0xFF;
    }

    // Decrypt in chunks to demonstrate error recovery
    const decryptor = new AES.Streaming.Decrypt(key, {
      mode: AESMode.CFB,
      iv
    });

    const chunkSize = 256;
    const decryptedChunks = [];
    
    for (let i = 0; i < corruptedCiphertext.length; i += chunkSize) {
      const chunk = corruptedCiphertext.slice(i, i + chunkSize);
      const decryptedChunk = await decryptor.update(chunk);
      decryptedChunks.push(decryptedChunk);
    }

    const finalChunk = await decryptor.finalize();
    if (finalChunk) decryptedChunks.push(finalChunk);

    const decryptedMessage = Buffer.concat(decryptedChunks);

    // Verify that corruption only affects a limited portion of the message
    expect(decryptedMessage.slice(0, corruptionStart)).toEqual(
      message.slice(0, corruptionStart)
    );
    expect(decryptedMessage.slice(corruptionStart + corruptionLength + 16)).toEqual(
      message.slice(corruptionStart + corruptionLength + 16)
    );
  });
}); 