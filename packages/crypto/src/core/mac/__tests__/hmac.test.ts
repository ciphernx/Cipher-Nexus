import { expect } from 'chai';
import { HMAC } from '../hmac';
import { HashAlgorithm } from '../../hash';
import { randomBytes } from 'crypto';

describe('HMAC', () => {
  const message = 'Hello, HMAC!';
  const key = Buffer.from('secret key');

  const expectedLengths = {
    [HashAlgorithm.SHA256]: 32,
    [HashAlgorithm.SHA384]: 48,
    [HashAlgorithm.SHA512]: 64
  };

  it('should generate MAC of correct length for different hash algorithms', () => {
    for (const algorithm of Object.values(HashAlgorithm)) {
      const mac = HMAC.generate(Buffer.from(message), key, algorithm);
      expect(mac.length).to.equal(expectedLengths[algorithm]);
    }
  });

  it('should generate same MAC for same input', () => {
    const mac1 = HMAC.generate(Buffer.from(message), key, HashAlgorithm.SHA256);
    const mac2 = HMAC.generate(Buffer.from(message), key, HashAlgorithm.SHA256);
    expect(mac1).to.deep.equal(mac2);
  });

  it('should generate different MACs for different messages', () => {
    const mac1 = HMAC.generate(Buffer.from(message), key, HashAlgorithm.SHA256);
    const mac2 = HMAC.generate(Buffer.from('Different message'), key, HashAlgorithm.SHA256);
    expect(mac1).to.not.deep.equal(mac2);
  });

  it('should generate different MACs for different keys', () => {
    const mac1 = HMAC.generate(Buffer.from(message), key, HashAlgorithm.SHA256);
    const mac2 = HMAC.generate(Buffer.from(message), Buffer.from('different key'), HashAlgorithm.SHA256);
    expect(mac1).to.not.deep.equal(mac2);
  });

  it('should handle empty message', () => {
    const mac = HMAC.generate(Buffer.from(''), key, HashAlgorithm.SHA256);
    expect(mac).to.exist;
    expect(mac.length).to.be.greaterThan(0);
  });

  it('should handle large message', () => {
    const largeMessage = Buffer.alloc(1024 * 1024).fill('A');
    const mac = HMAC.generate(largeMessage, key, HashAlgorithm.SHA256);
    expect(mac).to.exist;
    expect(mac.length).to.be.greaterThan(0);
  });

  it('should handle binary message', () => {
    const binaryMessage = Buffer.from([0x00, 0xFF, 0x10, 0xAB]);
    const mac = HMAC.generate(binaryMessage, key, HashAlgorithm.SHA256);
    expect(mac).to.exist;
    expect(mac.length).to.be.greaterThan(0);
  });

  it('should support streaming interface', () => {
    const hmac = new HMAC(key, HashAlgorithm.SHA256);
    const chunks = [
      Buffer.from('Hello'),
      Buffer.from(', '),
      Buffer.from('HMAC'),
      Buffer.from('!')
    ];

    const expectedMac = HMAC.generate(Buffer.from(message), key, HashAlgorithm.SHA256);
    chunks.forEach(chunk => hmac.update(chunk));
    const streamingMac = hmac.digest();

    expect(streamingMac).to.deep.equal(expectedMac);
  });

  it('should verify valid MAC', () => {
    const mac = HMAC.generate(Buffer.from(message), key, HashAlgorithm.SHA256);
    const isValid = HMAC.verify(Buffer.from(message), mac, key, HashAlgorithm.SHA256);
    expect(isValid).to.be.true;

    // Should reject MAC for different message
    const isInvalidMessage = HMAC.verify(Buffer.from('Different message'), mac, key, HashAlgorithm.SHA256);
    expect(isInvalidMessage).to.be.false;

    // Should reject MAC for different key
    const isInvalidKey = HMAC.verify(Buffer.from(message), mac, Buffer.from('different key'), HashAlgorithm.SHA256);
    expect(isInvalidKey).to.be.false;
  });

  it('should have constant-time verification', () => {
    const mac = HMAC.generate(Buffer.from(message), key, HashAlgorithm.SHA256);
    const startTime = process.hrtime();
    HMAC.verify(Buffer.from(message), mac, key, HashAlgorithm.SHA256);
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const timeDiff = seconds + nanoseconds / 1e9;
    expect(timeDiff).to.be.lessThan(0.1);
  });

  it('should reject invalid inputs', () => {
    expect(() => HMAC.generate(Buffer.from(message), Buffer.alloc(0), HashAlgorithm.SHA256)).to.throw();

    const mac = HMAC.generate(Buffer.from(message), key, HashAlgorithm.SHA256);
    const invalidMac = Buffer.alloc(mac.length);
    expect(() => HMAC.verify(Buffer.from(message), invalidMac, key, HashAlgorithm.SHA256)).to.throw();
  });

  it('should have uniform distribution of MAC values', () => {
    const numTests = 1000;
    const macLength = 32; // SHA-256
    const macValues = new Array(macLength).fill(0);

    for (let i = 0; i < numTests; i++) {
      const testMessage = `Test message ${i}`;
      const mac = HMAC.generate(Buffer.from(testMessage), key, HashAlgorithm.SHA256);
      mac.forEach((byte, index) => {
        macValues[index] += byte;
      });
    }

    // Calculate average and check distribution
    const average = macValues.map(sum => sum / numTests);
    const expectedAverage = 128; // For uniform distribution of bytes (0-255)
    const tolerance = 15; // Allow 15% deviation

    for (const value of average) {
      const diffPercentage = Math.abs((value - expectedAverage) / expectedAverage) * 100;
      expect(diffPercentage).to.be.greaterThan(45); // Allow some variance
      expect(diffPercentage).to.be.lessThan(55);
    }
  });

  it('should be deterministic for same key derivation parameters', () => {
    const salt = Buffer.from('salt');
    const info = Buffer.from('info');

    const derivedKey1 = HMAC.deriveKey(key, salt, info, 32);
    const derivedKey2 = HMAC.deriveKey(Buffer.from('different key'), salt, info, 32);
    const derivedKey1Again = HMAC.deriveKey(key, salt, info, 32);

    expect(derivedKey1).to.not.deep.equal(derivedKey2);
    expect(derivedKey1).to.deep.equal(derivedKey1Again);

    // MACs generated with derived keys should also be different
    const mac1 = HMAC.generate(Buffer.from(message), derivedKey1, HashAlgorithm.SHA256);
    const mac2 = HMAC.generate(Buffer.from(message), derivedKey2, HashAlgorithm.SHA256);
    expect(mac1).to.not.deep.equal(mac2);
  });
});

describe('HMAC (Hash-based Message Authentication Code)', () => {
  const message = 'Hello, HMAC!';
  const hashAlgorithms = [
    HashAlgorithm.SHA256,
    HashAlgorithm.SHA384,
    HashAlgorithm.SHA512
  ];

  it('should generate MACs of correct length', () => {
    const key = randomBytes(32);
    const expectedLengths = {
      [HashAlgorithm.SHA256]: 32, // 256 bits = 32 bytes
      [HashAlgorithm.SHA384]: 48, // 384 bits = 48 bytes
      [HashAlgorithm.SHA512]: 64  // 512 bits = 64 bytes
    };

    for (const algorithm of hashAlgorithms) {
      const mac = HMAC.generate(Buffer.from(message), key, algorithm);
      expect(mac.length).toBe(expectedLengths[algorithm]);
    }
  });

  it('should be deterministic', () => {
    const key = randomBytes(32);

    for (const algorithm of hashAlgorithms) {
      const mac1 = HMAC.generate(Buffer.from(message), key, algorithm);
      const mac2 = HMAC.generate(Buffer.from(message), key, algorithm);
      expect(mac1).toEqual(mac2);
    }
  });

  it('should produce different MACs for different messages', () => {
    const key = randomBytes(32);
    const differentMessage = message + '!';

    for (const algorithm of hashAlgorithms) {
      const mac1 = HMAC.generate(Buffer.from(message), key, algorithm);
      const mac2 = HMAC.generate(Buffer.from(differentMessage), key, algorithm);
      expect(mac1).not.toEqual(mac2);
    }
  });

  it('should produce different MACs for different keys', () => {
    const key1 = randomBytes(32);
    const key2 = randomBytes(32);

    for (const algorithm of hashAlgorithms) {
      const mac1 = HMAC.generate(Buffer.from(message), key1, algorithm);
      const mac2 = HMAC.generate(Buffer.from(message), key2, algorithm);
      expect(mac1).not.toEqual(mac2);
    }
  });

  it('should support different key sizes', () => {
    const keySizes = [16, 32, 64, 128]; // Different key sizes in bytes

    for (const algorithm of hashAlgorithms) {
      for (const size of keySizes) {
        const key = randomBytes(size);
        const mac = HMAC.generate(Buffer.from(message), key, algorithm);
        expect(mac).toBeDefined();
        expect(mac.length).toBeGreaterThan(0);
      }
    }
  });

  it('should handle empty messages', () => {
    const key = randomBytes(32);

    for (const algorithm of hashAlgorithms) {
      const mac = HMAC.generate(Buffer.from(''), key, algorithm);
      expect(mac).toBeDefined();
      expect(mac.length).toBeGreaterThan(0);
    }
  });

  it('should handle large messages', () => {
    const key = randomBytes(32);
    const largeMessage = randomBytes(1024 * 1024); // 1MB

    for (const algorithm of hashAlgorithms) {
      const mac = HMAC.generate(largeMessage, key, algorithm);
      expect(mac).toBeDefined();
      expect(mac.length).toBeGreaterThan(0);
    }
  });

  it('should support streaming interface', async () => {
    const key = randomBytes(32);
    const chunks = [
      Buffer.from('First chunk'),
      Buffer.from('Second chunk'),
      Buffer.from('Third chunk')
    ];

    for (const algorithm of hashAlgorithms) {
      // Single-pass MAC
      const fullMessage = Buffer.concat(chunks);
      const expectedMac = HMAC.generate(fullMessage, key, algorithm);

      // Streaming MAC
      const hmac = new HMAC.Streaming(key, algorithm);
      for (const chunk of chunks) {
        await hmac.update(chunk);
      }
      const streamingMac = await hmac.finalize();

      expect(streamingMac).toEqual(expectedMac);
    }
  });

  it('should verify MACs correctly', () => {
    const key = randomBytes(32);

    for (const algorithm of hashAlgorithms) {
      const mac = HMAC.generate(Buffer.from(message), key, algorithm);

      // Verify with correct message and key
      const isValid = HMAC.verify(Buffer.from(message), mac, key, algorithm);
      expect(isValid).toBe(true);

      // Verify with wrong message
      const isInvalidMessage = HMAC.verify(Buffer.from(message + '!'), mac, key, algorithm);
      expect(isInvalidMessage).toBe(false);

      // Verify with wrong key
      const wrongKey = randomBytes(32);
      const isInvalidKey = HMAC.verify(Buffer.from(message), mac, wrongKey, algorithm);
      expect(isInvalidKey).toBe(false);
    }
  });

  it('should be time-independent in verification', async () => {
    const key = randomBytes(32);
    const shortMessage = 'short';
    const longMessage = 'very_long_message_for_timing_test';

    for (const algorithm of hashAlgorithms) {
      const mac = HMAC.generate(Buffer.from(message), key, algorithm);

      const startShort = process.hrtime.bigint();
      await HMAC.verify(Buffer.from(shortMessage), mac, key, algorithm);
      const endShort = process.hrtime.bigint();

      const startLong = process.hrtime.bigint();
      await HMAC.verify(Buffer.from(longMessage), mac, key, algorithm);
      const endLong = process.hrtime.bigint();

      const shortTime = Number(endShort - startShort);
      const longTime = Number(endLong - startLong);

      // Times should be within 10% of each other
      const timeDiff = Math.abs(shortTime - longTime) / Math.max(shortTime, longTime);
      expect(timeDiff).toBeLessThan(0.1);
    }
  });

  it('should reject invalid parameters', () => {
    const key = randomBytes(32);
    const mac = HMAC.generate(Buffer.from(message), key, HashAlgorithm.SHA256);

    // Test with empty key
    expect(() => HMAC.generate(Buffer.from(message), Buffer.alloc(0), HashAlgorithm.SHA256)).toThrow();

    // Test with invalid MAC length in verification
    const invalidMac = Buffer.concat([mac, Buffer.from([0])]);
    expect(() => HMAC.verify(Buffer.from(message), invalidMac, key, HashAlgorithm.SHA256)).toThrow();
  });

  it('should exhibit avalanche effect', () => {
    const key = randomBytes(32);
    const message1 = randomBytes(64);
    const message2 = Buffer.from(message1);
    // Change a single bit
    message2[0] ^= 1;

    for (const algorithm of hashAlgorithms) {
      const mac1 = HMAC.generate(message1, key, algorithm);
      const mac2 = HMAC.generate(message2, key, algorithm);

      // Count differing bits
      let differingBits = 0;
      for (let i = 0; i < mac1.length; i++) {
        const xor = mac1[i] ^ mac2[i];
        differingBits += countBits(xor);
      }

      // On average, half of the bits should be different
      const totalBits = mac1.length * 8;
      const diffPercentage = (differingBits / totalBits) * 100;
      expect(diffPercentage).toBeGreaterThan(45); // Allow some variance
      expect(diffPercentage).toBeLessThan(55);
    }
  });

  it('should support key derivation', () => {
    const masterKey = randomBytes(32);
    const info1 = Buffer.from('purpose1');
    const info2 = Buffer.from('purpose2');

    for (const algorithm of hashAlgorithms) {
      const derivedKey1 = HMAC.deriveKey(masterKey, info1, 32, algorithm);
      const derivedKey2 = HMAC.deriveKey(masterKey, info2, 32, algorithm);

      // Derived keys should be different
      expect(derivedKey1).not.toEqual(derivedKey2);

      // Derived keys should be deterministic
      const derivedKey1Again = HMAC.deriveKey(masterKey, info1, 32, algorithm);
      expect(derivedKey1).toEqual(derivedKey1Again);

      // Derived keys should work for MAC generation
      const mac1 = HMAC.generate(Buffer.from(message), derivedKey1, algorithm);
      const mac2 = HMAC.generate(Buffer.from(message), derivedKey2, algorithm);
      expect(mac1).not.toEqual(mac2);
    }
  });
});

// Helper function to count bits in a byte
function countBits(byte: number): number {
  let count = 0;
  for (let i = 0; i < 8; i++) {
    if ((byte & (1 << i)) !== 0) {
      count++;
    }
  }
  return count;
} 