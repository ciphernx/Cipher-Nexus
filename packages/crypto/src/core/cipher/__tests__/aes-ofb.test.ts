import { AES, AESMode, AESKeyLength } from '../aes';
import { randomBytes } from 'crypto';

describe('AES-OFB (Output Feedback Mode)', () => {
  const message = 'Hello, AES-OFB!';

  it('should encrypt and decrypt correctly', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16); // OFB requires full block size IV
    
    const ciphertext = AES.encrypt(Buffer.from(message), key, {
      mode: AESMode.OFB,
      iv
    });

    const plaintext = AES.decrypt(ciphertext, key, {
      mode: AESMode.OFB,
      iv
    });
    
    expect(plaintext.toString()).toBe(message);
  });

  it('should produce different ciphertexts for same plaintext with different IVs', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv1 = randomBytes(16);
    const iv2 = randomBytes(16);

    const ciphertext1 = AES.encrypt(Buffer.from(message), key, {
      mode: AESMode.OFB,
      iv: iv1
    });

    const ciphertext2 = AES.encrypt(Buffer.from(message), key, {
      mode: AESMode.OFB,
      iv: iv2
    });

    expect(ciphertext1).not.toEqual(ciphertext2);
  });

  it('should handle empty messages', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);

    const ciphertext = AES.encrypt(Buffer.from(''), key, {
      mode: AESMode.OFB,
      iv
    });

    const plaintext = AES.decrypt(ciphertext, key, {
      mode: AESMode.OFB,
      iv
    });

    expect(plaintext.length).toBe(0);
  });

  it('should handle large messages', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    const largeMessage = randomBytes(1024 * 1024); // 1MB

    const ciphertext = AES.encrypt(largeMessage, key, {
      mode: AESMode.OFB,
      iv
    });

    const plaintext = AES.decrypt(ciphertext, key, {
      mode: AESMode.OFB,
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
      mode: AESMode.OFB,
      iv
    });

    // Streaming encryption
    const encryptor = new AES.Streaming.Encrypt(key, {
      mode: AESMode.OFB,
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
      mode: AESMode.OFB,
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

  it('should verify that encryption and decryption are identical operations', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    const message = Buffer.from('Test message');

    // Encrypt using encryption function
    const ciphertext1 = AES.encrypt(message, key, {
      mode: AESMode.OFB,
      iv
    });

    // Encrypt using decryption function (should produce same result)
    const ciphertext2 = AES.decrypt(message, key, {
      mode: AESMode.OFB,
      iv
    });

    expect(ciphertext1).toEqual(ciphertext2);
  });

  it('should handle bit flipping attacks', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    const message = Buffer.from('A fairly long message to test bit flipping in OFB mode');

    // Encrypt the message
    const ciphertext = AES.encrypt(message, key, {
      mode: AESMode.OFB,
      iv
    });

    // Flip bits in the ciphertext
    const corruptedCiphertext = Buffer.from(ciphertext);
    const corruptionIndex = Math.floor(ciphertext.length / 2);
    corruptedCiphertext[corruptionIndex] ^= 0xFF;

    // Decrypt the corrupted ciphertext
    const corruptedPlaintext = AES.decrypt(corruptedCiphertext, key, {
      mode: AESMode.OFB,
      iv
    });

    // Verify that only the corrupted byte is affected
    expect(corruptedPlaintext[corruptionIndex]).not.toBe(message[corruptionIndex]);
    expect(corruptedPlaintext.slice(0, corruptionIndex)).toEqual(
      message.slice(0, corruptionIndex)
    );
    expect(corruptedPlaintext.slice(corruptionIndex + 1)).toEqual(
      message.slice(corruptionIndex + 1)
    );
  });

  it('should reject invalid parameters', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    const message = Buffer.from('test message');

    // Test with invalid key size
    const invalidKey = randomBytes(31); // Not a valid AES key length
    expect(() => AES.encrypt(message, invalidKey, {
      mode: AESMode.OFB,
      iv
    })).toThrow();

    // Test with invalid IV size
    const invalidIV = randomBytes(15); // OFB requires 16-byte IV
    expect(() => AES.encrypt(message, key, {
      mode: AESMode.OFB,
      iv: invalidIV
    })).toThrow();
  });

  it('should support parallel processing of keystream', async () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    const largeMessage = randomBytes(1024 * 1024); // 1MB

    // Generate keystream in parallel
    const blockSize = 16;
    const numBlocks = Math.ceil(largeMessage.length / blockSize);
    const keystreamBlocks = await Promise.all(
      Array(numBlocks).fill(0).map((_, i) => 
        AES.OFB.generateKeystreamBlock(key, iv, i)
      )
    );

    // Combine keystream blocks
    const keystream = Buffer.concat(keystreamBlocks);

    // XOR message with keystream
    const ciphertext = Buffer.allocUnsafe(largeMessage.length);
    for (let i = 0; i < largeMessage.length; i++) {
      ciphertext[i] = largeMessage[i] ^ keystream[i];
    }

    // Verify with standard encryption
    const expectedCiphertext = AES.encrypt(largeMessage, key, {
      mode: AESMode.OFB,
      iv
    });

    expect(ciphertext).toEqual(expectedCiphertext);
  });

  it('should be resistant to known plaintext attacks', () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    const knownPlaintext = Buffer.from('Known plaintext');
    const secretMessage = Buffer.from('Secret message');

    // Encrypt known plaintext
    const knownCiphertext = AES.encrypt(knownPlaintext, key, {
      mode: AESMode.OFB,
      iv
    });

    // Encrypt secret message with different IV
    const differentIV = randomBytes(16);
    const secretCiphertext = AES.encrypt(secretMessage, key, {
      mode: AESMode.OFB,
      iv: differentIV
    });

    // Knowledge of plaintext-ciphertext pair should not help decrypt other messages
    const knownPair = {
      plaintext: knownPlaintext,
      ciphertext: knownCiphertext,
      iv
    };

    // Attempt to decrypt secret message using known pair (should fail)
    const derivedKey = AES.OFB.deriveKeyFromKnownPair(knownPair);
    expect(derivedKey).not.toEqual(key);
  });

  it('should support incremental processing', async () => {
    const key = randomBytes(AESKeyLength.AES256);
    const iv = randomBytes(16);
    const message = randomBytes(1024); // 1KB

    // Process in small increments
    const incrementSize = 16; // Process one block at a time
    const processor = new AES.OFB.IncrementalProcessor(key, iv);
    
    const processedChunks = [];
    for (let i = 0; i < message.length; i += incrementSize) {
      const chunk = message.slice(i, i + incrementSize);
      const processedChunk = await processor.process(chunk);
      processedChunks.push(processedChunk);
    }

    const incrementalResult = Buffer.concat(processedChunks);

    // Compare with standard encryption
    const standardResult = AES.encrypt(message, key, {
      mode: AESMode.OFB,
      iv
    });

    expect(incrementalResult).toEqual(standardResult);
  });
}); 