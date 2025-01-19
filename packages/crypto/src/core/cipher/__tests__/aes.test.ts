import { AES, AESMode, AESKeyLength } from '../aes';
import { randomBytes } from 'crypto';

describe('AES (Advanced Encryption Standard)', () => {
  const message = 'Hello, AES!';
  const keyLengths = [
    AESKeyLength.AES128,  // 128 bits = 16 bytes
    AESKeyLength.AES192,  // 192 bits = 24 bytes
    AESKeyLength.AES256   // 256 bits = 32 bytes
  ];
  const modes = [
    AESMode.CBC,  // Cipher Block Chaining
    AESMode.GCM   // Galois/Counter Mode
  ];

  it('should encrypt and decrypt correctly in all modes and key lengths', () => {
    for (const keyLength of keyLengths) {
      const key = randomBytes(keyLength);

      for (const mode of modes) {
        const iv = randomBytes(mode === AESMode.GCM ? 12 : 16); // GCM uses 12-byte nonce
        
        const ciphertext = AES.encrypt(Buffer.from(message), key, {
          mode,
          iv
        });

        const plaintext = AES.decrypt(ciphertext, key, {
          mode,
          iv
        });

        expect(plaintext.toString()).toBe(message);
      }
    }
  });

  it('should produce different ciphertexts for same plaintext with different IVs', () => {
    const key = randomBytes(AESKeyLength.AES256);

    for (const mode of modes) {
      const iv1 = randomBytes(mode === AESMode.GCM ? 12 : 16);
      const iv2 = randomBytes(mode === AESMode.GCM ? 12 : 16);

      const ciphertext1 = AES.encrypt(Buffer.from(message), key, {
        mode,
        iv: iv1
      });

      const ciphertext2 = AES.encrypt(Buffer.from(message), key, {
        mode,
        iv: iv2
      });

      expect(ciphertext1).not.toEqual(ciphertext2);
    }
  });

  it('should produce different ciphertexts for same plaintext with different keys', () => {
    for (const keyLength of keyLengths) {
      const key1 = randomBytes(keyLength);
      const key2 = randomBytes(keyLength);
      const iv = randomBytes(16);

      for (const mode of modes) {
        const ciphertext1 = AES.encrypt(Buffer.from(message), key1, {
          mode,
          iv
        });

        const ciphertext2 = AES.encrypt(Buffer.from(message), key2, {
          mode,
          iv
        });

        expect(ciphertext1).not.toEqual(ciphertext2);
      }
    }
  });

  it('should handle empty messages', () => {
    const key = randomBytes(AESKeyLength.AES256);

    for (const mode of modes) {
      const iv = randomBytes(mode === AESMode.GCM ? 12 : 16);
      
      const ciphertext = AES.encrypt(Buffer.from(''), key, {
        mode,
        iv
      });

      const plaintext = AES.decrypt(ciphertext, key, {
        mode,
        iv
      });

      expect(plaintext.length).toBe(0);
    }
  });

  it('should handle large messages', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const largeMessage = randomBytes(1024 * 1024); // 1MB

    for (const mode of modes) {
      const iv = randomBytes(mode === AESMode.GCM ? 12 : 16);
      
      const ciphertext = AES.encrypt(largeMessage, key, {
        mode,
        iv
      });

      const plaintext = AES.decrypt(ciphertext, key, {
        mode,
        iv
      });

      expect(plaintext).toEqual(largeMessage);
    }
  });

  it('should support streaming interface', async () => {
    const key = randomBytes(AESKeyLength.AES256);
    const chunks = [
      Buffer.from('First chunk'),
      Buffer.from('Second chunk'),
      Buffer.from('Third chunk')
    ];

    for (const mode of modes) {
      const iv = randomBytes(mode === AESMode.GCM ? 12 : 16);

      // Single-pass encryption
      const fullMessage = Buffer.concat(chunks);
      const expectedCiphertext = AES.encrypt(fullMessage, key, {
        mode,
        iv
      });

      // Streaming encryption
      const encryptor = new AES.Streaming.Encrypt(key, {
        mode,
        iv
      });

      for (const chunk of chunks) {
        await encryptor.update(chunk);
      }
      const streamingCiphertext = await encryptor.finalize();

      // Streaming decryption
      const decryptor = new AES.Streaming.Decrypt(key, {
        mode,
        iv
      });

      const decryptedChunks = [];
      for (const chunk of chunks) {
        const decryptedChunk = await decryptor.update(chunk);
        if (decryptedChunk) decryptedChunks.push(decryptedChunk);
      }
      const finalChunk = await decryptor.finalize();
      if (finalChunk) decryptedChunks.push(finalChunk);

      const streamingPlaintext = Buffer.concat(decryptedChunks);
      expect(streamingPlaintext.toString()).toBe(fullMessage.toString());
    }
  });

  it('should support authenticated encryption in GCM mode', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const nonce = randomBytes(12);
    const aad = Buffer.from('Additional authenticated data');

    // Encrypt with AAD
    const ciphertext = AES.encrypt(Buffer.from(message), key, {
      mode: AESMode.GCM,
      iv: nonce,
      aad
    });

    // Decrypt with correct AAD
    const plaintext = AES.decrypt(ciphertext, key, {
      mode: AESMode.GCM,
      iv: nonce,
      aad
    });
    expect(plaintext.toString()).toBe(message);

    // Decrypt with wrong AAD should fail
    const wrongAad = Buffer.from('Wrong additional data');
    expect(() => AES.decrypt(ciphertext, key, {
      mode: AESMode.GCM,
      iv: nonce,
      aad: wrongAad
    })).toThrow();
  });

  it('should reject invalid parameters', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const message = Buffer.from('test message');

    // Test with invalid key size
    const invalidKey = randomBytes(31); // Not a valid AES key length
    expect(() => AES.encrypt(message, invalidKey, {
      mode: AESMode.CBC,
      iv: randomBytes(16)
    })).toThrow();

    // Test with invalid IV size
    expect(() => AES.encrypt(message, key, {
      mode: AESMode.CBC,
      iv: randomBytes(15) // CBC requires 16-byte IV
    })).toThrow();

    // Test with invalid mode
    expect(() => AES.encrypt(message, key, {
      mode: 'invalid' as AESMode,
      iv: randomBytes(16)
    })).toThrow();
  });

  it('should detect tampering in GCM mode', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const nonce = randomBytes(12);
    
    const ciphertext = AES.encrypt(Buffer.from(message), key, {
      mode: AESMode.GCM,
      iv: nonce
    });

    // Tamper with the ciphertext
    ciphertext[0] ^= 1;

    // Decryption should fail
    expect(() => AES.decrypt(ciphertext, key, {
      mode: AESMode.GCM,
      iv: nonce
    })).toThrow();
  });

  it('should handle padding correctly in CBC mode', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    
    // Test different message lengths around block boundaries
    const blockSize = 16;
    const messageLengths = [
      blockSize - 1,    // One byte less than block size
      blockSize,        // Exact block size
      blockSize + 1,    // One byte more than block size
      blockSize * 2 - 1, // One byte less than two blocks
      blockSize * 2,     // Exact two blocks
      blockSize * 2 + 1  // One byte more than two blocks
    ];

    for (const length of messageLengths) {
      const testMessage = randomBytes(length);
      const ciphertext = AES.encrypt(testMessage, key, {
        mode: AESMode.CBC,
        iv
      });

      const plaintext = AES.decrypt(ciphertext, key, {
        mode: AESMode.CBC,
        iv
      });

      expect(plaintext).toEqual(testMessage);
    }
  });

  it('should be time-independent in decryption failure', async () => {
    const key = randomBytes(AESKeyLength.AES256);
    const nonce = randomBytes(12);
    const shortMessage = Buffer.from('short');
    const longMessage = Buffer.from('very_long_message_for_timing_test');

    // Create valid ciphertexts
    const shortCiphertext = AES.encrypt(shortMessage, key, {
      mode: AESMode.GCM,
      iv: nonce
    });
    const longCiphertext = AES.encrypt(longMessage, key, {
      mode: AESMode.GCM,
      iv: nonce
    });

    // Tamper with both ciphertexts
    shortCiphertext[0] ^= 1;
    longCiphertext[0] ^= 1;

    const startShort = process.hrtime.bigint();
    try {
      await AES.decrypt(shortCiphertext, key, {
        mode: AESMode.GCM,
        iv: nonce
      });
    } catch {}
    const endShort = process.hrtime.bigint();

    const startLong = process.hrtime.bigint();
    try {
      await AES.decrypt(longCiphertext, key, {
        mode: AESMode.GCM,
        iv: nonce
      });
    } catch {}
    const endLong = process.hrtime.bigint();

    const shortTime = Number(endShort - startShort);
    const longTime = Number(endLong - startLong);

    // Times should be within 10% of each other
    const timeDiff = Math.abs(shortTime - longTime) / Math.max(shortTime, longTime);
    expect(timeDiff).toBeLessThan(0.1);
  });
}); 