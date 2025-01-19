import { Poly1305 } from '../poly1305';
import { randomBytes } from 'crypto';

describe('Poly1305 Message Authentication Code', () => {
  const message = 'Hello, Poly1305!';

  it('should generate MACs of correct length', () => {
    const key = randomBytes(32); // Poly1305 requires a 32-byte key
    const mac = Poly1305.generate(Buffer.from(message), key);
    expect(mac.length).toBe(16); // Poly1305 always produces 16-byte (128-bit) tags
  });

  it('should be deterministic', () => {
    const key = randomBytes(32);
    const mac1 = Poly1305.generate(Buffer.from(message), key);
    const mac2 = Poly1305.generate(Buffer.from(message), key);
    expect(mac1).toEqual(mac2);
  });

  it('should produce different MACs for different messages', () => {
    const key = randomBytes(32);
    const differentMessage = message + '!';

    const mac1 = Poly1305.generate(Buffer.from(message), key);
    const mac2 = Poly1305.generate(Buffer.from(differentMessage), key);
    expect(mac1).not.toEqual(mac2);
  });

  it('should produce different MACs for different keys', () => {
    const key1 = randomBytes(32);
    const key2 = randomBytes(32);

    const mac1 = Poly1305.generate(Buffer.from(message), key1);
    const mac2 = Poly1305.generate(Buffer.from(message), key2);
    expect(mac1).not.toEqual(mac2);
  });

  it('should handle empty messages', () => {
    const key = randomBytes(32);
    const mac = Poly1305.generate(Buffer.from(''), key);
    expect(mac).toBeDefined();
    expect(mac.length).toBe(16);
  });

  it('should handle large messages', () => {
    const key = randomBytes(32);
    const largeMessage = randomBytes(1024 * 1024); // 1MB

    const mac = Poly1305.generate(largeMessage, key);
    expect(mac).toBeDefined();
    expect(mac.length).toBe(16);
  });

  it('should support streaming interface', async () => {
    const key = randomBytes(32);
    const chunks = [
      Buffer.from('First chunk'),
      Buffer.from('Second chunk'),
      Buffer.from('Third chunk')
    ];

    // Single-pass MAC
    const fullMessage = Buffer.concat(chunks);
    const expectedMac = Poly1305.generate(fullMessage, key);

    // Streaming MAC
    const poly = new Poly1305.Streaming(key);
    for (const chunk of chunks) {
      await poly.update(chunk);
    }
    const streamingMac = await poly.finalize();

    expect(streamingMac).toEqual(expectedMac);
  });

  it('should verify MACs correctly', () => {
    const key = randomBytes(32);
    const mac = Poly1305.generate(Buffer.from(message), key);

    // Verify with correct message and key
    const isValid = Poly1305.verify(Buffer.from(message), mac, key);
    expect(isValid).toBe(true);

    // Verify with wrong message
    const isInvalidMessage = Poly1305.verify(Buffer.from(message + '!'), mac, key);
    expect(isInvalidMessage).toBe(false);

    // Verify with wrong key
    const wrongKey = randomBytes(32);
    const isInvalidKey = Poly1305.verify(Buffer.from(message), mac, wrongKey);
    expect(isInvalidKey).toBe(false);
  });

  it('should be time-independent in verification', async () => {
    const key = randomBytes(32);
    const shortMessage = 'short';
    const longMessage = 'very_long_message_for_timing_test';
    const mac = Poly1305.generate(Buffer.from(message), key);

    const startShort = process.hrtime.bigint();
    await Poly1305.verify(Buffer.from(shortMessage), mac, key);
    const endShort = process.hrtime.bigint();

    const startLong = process.hrtime.bigint();
    await Poly1305.verify(Buffer.from(longMessage), mac, key);
    const endLong = process.hrtime.bigint();

    const shortTime = Number(endShort - startShort);
    const longTime = Number(endLong - startLong);

    // Times should be within 10% of each other
    const timeDiff = Math.abs(shortTime - longTime) / Math.max(shortTime, longTime);
    expect(timeDiff).toBeLessThan(0.1);
  });

  it('should reject invalid parameters', () => {
    const message = Buffer.from('test message');
    const key = randomBytes(32);
    const mac = Poly1305.generate(message, key);

    // Test with wrong key size
    const invalidKey = randomBytes(31); // Poly1305 requires exactly 32 bytes
    expect(() => Poly1305.generate(message, invalidKey)).toThrow();

    // Test with invalid MAC length in verification
    const invalidMac = Buffer.concat([mac, Buffer.from([0])]);
    expect(() => Poly1305.verify(message, invalidMac, key)).toThrow();
  });

  it('should work with ChaCha20 generated keys', () => {
    // Simulate ChaCha20 key and nonce
    const chaChaKey = randomBytes(32);
    const nonce = randomBytes(12);
    
    // Generate Poly1305 key from ChaCha20
    const poly1305Key = Poly1305.deriveKey(chaChaKey, nonce);
    expect(poly1305Key.length).toBe(32);

    // Use the derived key for MAC generation
    const mac = Poly1305.generate(Buffer.from(message), poly1305Key);
    expect(mac.length).toBe(16);

    // Verify the MAC
    const isValid = Poly1305.verify(Buffer.from(message), mac, poly1305Key);
    expect(isValid).toBe(true);
  });

  it('should support additional authenticated data (AAD)', () => {
    const key = randomBytes(32);
    const aad = Buffer.from('Additional authenticated data');

    // Generate MAC with AAD
    const mac1 = Poly1305.generate(Buffer.from(message), key, { aad });
    const mac2 = Poly1305.generate(Buffer.from(message), key); // Without AAD

    // MACs should be different with and without AAD
    expect(mac1).not.toEqual(mac2);

    // Verification should succeed with correct AAD
    const isValid = Poly1305.verify(Buffer.from(message), mac1, key, { aad });
    expect(isValid).toBe(true);

    // Verification should fail with wrong AAD
    const wrongAad = Buffer.from('Wrong additional data');
    const isInvalid = Poly1305.verify(Buffer.from(message), mac1, key, { aad: wrongAad });
    expect(isInvalid).toBe(false);
  });

  it('should support one-time key usage warning', () => {
    const key = randomBytes(32);
    const message1 = Buffer.from('First message');
    const message2 = Buffer.from('Second message');

    // Using the same key twice should emit a warning
    const spy = jest.spyOn(console, 'warn').mockImplementation();
    
    Poly1305.generate(message1, key);
    Poly1305.generate(message2, key);

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Poly1305 key should only be used once')
    );

    spy.mockRestore();
  });

  it('should handle block boundary messages', () => {
    const key = randomBytes(32);
    const blockSize = 16; // Poly1305 block size

    // Test messages of different lengths around block boundaries
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
      const mac = Poly1305.generate(testMessage, key);
      expect(mac.length).toBe(16);
      
      const isValid = Poly1305.verify(testMessage, mac, key);
      expect(isValid).toBe(true);
    }
  });
}); 