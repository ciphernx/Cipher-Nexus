import { HKDF, HashAlgorithm } from '../hkdf';
import { randomBytes } from 'crypto';

describe('HKDF (HMAC-based Key Derivation Function)', () => {
  const hashAlgorithms = [
    HashAlgorithm.SHA256,
    HashAlgorithm.SHA384,
    HashAlgorithm.SHA512
  ];

  it('should derive keys of correct length', () => {
    const ikm = randomBytes(32); // Input Key Material
    const salt = randomBytes(16);
    const info = Buffer.from('test-key-derivation');
    const lengths = [16, 32, 64]; // Different output lengths in bytes

    for (const algorithm of hashAlgorithms) {
      for (const length of lengths) {
        const derivedKey = HKDF.derive(ikm, length, {
          salt,
          info,
          hashAlgorithm: algorithm
        });
        expect(derivedKey.length).toBe(length);
      }
    }
  });

  it('should be deterministic', () => {
    const ikm = randomBytes(32);
    const salt = randomBytes(16);
    const info = Buffer.from('test-key-derivation');
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      const key1 = HKDF.derive(ikm, length, {
        salt,
        info,
        hashAlgorithm: algorithm
      });
      const key2 = HKDF.derive(ikm, length, {
        salt,
        info,
        hashAlgorithm: algorithm
      });
      expect(key1).toEqual(key2);
    }
  });

  it('should produce different keys with different IKM', () => {
    const ikm1 = randomBytes(32);
    const ikm2 = randomBytes(32);
    const salt = randomBytes(16);
    const info = Buffer.from('test-key-derivation');
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      const key1 = HKDF.derive(ikm1, length, {
        salt,
        info,
        hashAlgorithm: algorithm
      });
      const key2 = HKDF.derive(ikm2, length, {
        salt,
        info,
        hashAlgorithm: algorithm
      });
      expect(key1).not.toEqual(key2);
    }
  });

  it('should produce different keys with different salt', () => {
    const ikm = randomBytes(32);
    const salt1 = randomBytes(16);
    const salt2 = randomBytes(16);
    const info = Buffer.from('test-key-derivation');
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      const key1 = HKDF.derive(ikm, length, {
        salt: salt1,
        info,
        hashAlgorithm: algorithm
      });
      const key2 = HKDF.derive(ikm, length, {
        salt: salt2,
        info,
        hashAlgorithm: algorithm
      });
      expect(key1).not.toEqual(key2);
    }
  });

  it('should produce different keys with different info', () => {
    const ikm = randomBytes(32);
    const salt = randomBytes(16);
    const info1 = Buffer.from('test-key-1');
    const info2 = Buffer.from('test-key-2');
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      const key1 = HKDF.derive(ikm, length, {
        salt,
        info: info1,
        hashAlgorithm: algorithm
      });
      const key2 = HKDF.derive(ikm, length, {
        salt,
        info: info2,
        hashAlgorithm: algorithm
      });
      expect(key1).not.toEqual(key2);
    }
  });

  it('should handle empty salt', () => {
    const ikm = randomBytes(32);
    const info = Buffer.from('test-key-derivation');
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      const key = HKDF.derive(ikm, length, {
        hashAlgorithm: algorithm,
        info
      });
      expect(key).toBeDefined();
      expect(key.length).toBe(length);
    }
  });

  it('should handle empty info', () => {
    const ikm = randomBytes(32);
    const salt = randomBytes(16);
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      const key = HKDF.derive(ikm, length, {
        salt,
        hashAlgorithm: algorithm
      });
      expect(key).toBeDefined();
      expect(key.length).toBe(length);
    }
  });

  it('should support expanding to multiple keys', () => {
    const ikm = randomBytes(32);
    const salt = randomBytes(16);
    const info1 = Buffer.from('encryption-key');
    const info2 = Buffer.from('authentication-key');
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      const key1 = HKDF.derive(ikm, length, {
        salt,
        info: info1,
        hashAlgorithm: algorithm
      });
      const key2 = HKDF.derive(ikm, length, {
        salt,
        info: info2,
        hashAlgorithm: algorithm
      });

      // Keys should be different
      expect(key1).not.toEqual(key2);
      
      // But both should be valid
      expect(key1.length).toBe(length);
      expect(key2.length).toBe(length);
    }
  });

  it('should reject invalid output lengths', () => {
    const ikm = randomBytes(32);
    const salt = randomBytes(16);
    const info = Buffer.from('test-key-derivation');
    const maxLengths = {
      [HashAlgorithm.SHA256]: 32 * 255, // Max length for SHA-256
      [HashAlgorithm.SHA384]: 48 * 255, // Max length for SHA-384
      [HashAlgorithm.SHA512]: 64 * 255  // Max length for SHA-512
    };

    for (const algorithm of hashAlgorithms) {
      // Test with length = 0
      expect(() => HKDF.derive(ikm, 0, {
        salt,
        info,
        hashAlgorithm: algorithm
      })).toThrow();

      // Test with length > max allowed
      const maxLength = maxLengths[algorithm];
      expect(() => HKDF.derive(ikm, maxLength + 1, {
        salt,
        info,
        hashAlgorithm: algorithm
      })).toThrow();
    }
  });

  it('should reject invalid IKM', () => {
    const salt = randomBytes(16);
    const info = Buffer.from('test-key-derivation');
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      // Test with empty IKM
      expect(() => HKDF.derive(Buffer.alloc(0), length, {
        salt,
        info,
        hashAlgorithm: algorithm
      })).toThrow();
    }
  });

  it('should produce high entropy output', () => {
    const ikm = randomBytes(32);
    const salt = randomBytes(16);
    const info = Buffer.from('test-key-derivation');
    const length = 1024; // Large output to analyze entropy

    for (const algorithm of hashAlgorithms) {
      const key = HKDF.derive(ikm, length, {
        salt,
        info,
        hashAlgorithm: algorithm
      });

      // Count occurrences of each byte value
      const counts = new Array(256).fill(0);
      for (const byte of key) {
        counts[byte]++;
      }

      // Calculate chi-square statistic
      const expected = length / 256;
      let chiSquare = 0;
      for (const count of counts) {
        chiSquare += Math.pow(count - expected, 2) / expected;
      }

      // For 255 degrees of freedom and p=0.001, chi-square should be less than 327.6
      expect(chiSquare).toBeLessThan(327.6);
    }
  });

  it('should support extracting and expanding separately', () => {
    const ikm = randomBytes(32);
    const salt = randomBytes(16);
    const info = Buffer.from('test-key-derivation');
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      // Extract phase
      const prk = HKDF.extract(ikm, {
        salt,
        hashAlgorithm: algorithm
      });

      // PRK length should match hash output size
      const hashLengths = {
        [HashAlgorithm.SHA256]: 32,
        [HashAlgorithm.SHA384]: 48,
        [HashAlgorithm.SHA512]: 64
      };
      expect(prk.length).toBe(hashLengths[algorithm]);

      // Expand phase
      const key = HKDF.expand(prk, length, {
        info,
        hashAlgorithm: algorithm
      });
      expect(key.length).toBe(length);

      // Should match one-shot derivation
      const expectedKey = HKDF.derive(ikm, length, {
        salt,
        info,
        hashAlgorithm: algorithm
      });
      expect(key).toEqual(expectedKey);
    }
  });
}); 