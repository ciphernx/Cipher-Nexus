import { PBKDF2, HashAlgorithm } from '../pbkdf2';
import { randomBytes } from 'crypto';

describe('PBKDF2 (Password-Based Key Derivation Function 2)', () => {
  const password = 'MySecurePassword123!';
  const hashAlgorithms = [
    HashAlgorithm.SHA256,
    HashAlgorithm.SHA384,
    HashAlgorithm.SHA512
  ];

  it('should derive keys of correct length', () => {
    const salt = randomBytes(16);
    const iterations = 1000;
    const lengths = [16, 32, 64]; // Different output lengths in bytes

    for (const algorithm of hashAlgorithms) {
      for (const length of lengths) {
        const derivedKey = PBKDF2.derive(Buffer.from(password), length, {
          salt,
          iterations,
          hashAlgorithm: algorithm
        });
        expect(derivedKey.length).toBe(length);
      }
    }
  });

  it('should be deterministic', () => {
    const salt = randomBytes(16);
    const iterations = 1000;
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      const key1 = PBKDF2.derive(Buffer.from(password), length, {
        salt,
        iterations,
        hashAlgorithm: algorithm
      });
      const key2 = PBKDF2.derive(Buffer.from(password), length, {
        salt,
        iterations,
        hashAlgorithm: algorithm
      });
      expect(key1).toEqual(key2);
    }
  });

  it('should produce different keys with different passwords', () => {
    const differentPassword = 'DifferentPassword123!';
    const salt = randomBytes(16);
    const iterations = 1000;
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      const key1 = PBKDF2.derive(Buffer.from(password), length, {
        salt,
        iterations,
        hashAlgorithm: algorithm
      });
      const key2 = PBKDF2.derive(Buffer.from(differentPassword), length, {
        salt,
        iterations,
        hashAlgorithm: algorithm
      });
      expect(key1).not.toEqual(key2);
    }
  });

  it('should produce different keys with different salts', () => {
    const salt1 = randomBytes(16);
    const salt2 = randomBytes(16);
    const iterations = 1000;
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      const key1 = PBKDF2.derive(Buffer.from(password), length, {
        salt: salt1,
        iterations,
        hashAlgorithm: algorithm
      });
      const key2 = PBKDF2.derive(Buffer.from(password), length, {
        salt: salt2,
        iterations,
        hashAlgorithm: algorithm
      });
      expect(key1).not.toEqual(key2);
    }
  });

  it('should produce different keys with different iterations', () => {
    const salt = randomBytes(16);
    const iterations1 = 1000;
    const iterations2 = 2000;
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      const key1 = PBKDF2.derive(Buffer.from(password), length, {
        salt,
        iterations: iterations1,
        hashAlgorithm: algorithm
      });
      const key2 = PBKDF2.derive(Buffer.from(password), length, {
        salt,
        iterations: iterations2,
        hashAlgorithm: algorithm
      });
      expect(key1).not.toEqual(key2);
    }
  });

  it('should handle empty passwords', () => {
    const salt = randomBytes(16);
    const iterations = 1000;
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      const key = PBKDF2.derive(Buffer.from(''), length, {
        salt,
        iterations,
        hashAlgorithm: algorithm
      });
      expect(key).toBeDefined();
      expect(key.length).toBe(length);
    }
  });

  it('should support high iteration counts', () => {
    const salt = randomBytes(16);
    const iterations = 100000; // High iteration count
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      const key = PBKDF2.derive(Buffer.from(password), length, {
        salt,
        iterations,
        hashAlgorithm: algorithm
      });
      expect(key).toBeDefined();
      expect(key.length).toBe(length);
    }
  });

  it('should reject invalid parameters', () => {
    const salt = randomBytes(16);
    const iterations = 1000;
    const length = 32;

    const invalidParams = [
      { iterations: 0 },    // Iterations too low
      { iterations: -1 },   // Negative iterations
      { salt: Buffer.alloc(0) }, // Empty salt
      { length: 0 }         // Zero length output
    ];

    for (const algorithm of hashAlgorithms) {
      for (const invalid of invalidParams) {
        expect(() => PBKDF2.derive(Buffer.from(password), length, {
          salt,
          iterations,
          hashAlgorithm: algorithm,
          ...invalid
        })).toThrow();
      }
    }
  });

  it('should produce high entropy output', () => {
    const salt = randomBytes(16);
    const iterations = 1000;
    const length = 1024; // Large output to analyze entropy

    for (const algorithm of hashAlgorithms) {
      const key = PBKDF2.derive(Buffer.from(password), length, {
        salt,
        iterations,
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

  it('should be time-dependent on iteration count', () => {
    const salt = randomBytes(16);
    const length = 32;
    const iterations1 = 1000;
    const iterations2 = 10000;

    for (const algorithm of hashAlgorithms) {
      const start1 = process.hrtime.bigint();
      PBKDF2.derive(Buffer.from(password), length, {
        salt,
        iterations: iterations1,
        hashAlgorithm: algorithm
      });
      const end1 = process.hrtime.bigint();

      const start2 = process.hrtime.bigint();
      PBKDF2.derive(Buffer.from(password), length, {
        salt,
        iterations: iterations2,
        hashAlgorithm: algorithm
      });
      const end2 = process.hrtime.bigint();

      const time1 = Number(end1 - start1);
      const time2 = Number(end2 - start2);

      // Time should scale roughly linearly with iterations
      // Allow for some variance due to system load
      const ratio = time2 / time1;
      const expectedRatio = iterations2 / iterations1;
      expect(ratio).toBeGreaterThan(expectedRatio * 0.5);
      expect(ratio).toBeLessThan(expectedRatio * 1.5);
    }
  });

  it('should support streaming interface', async () => {
    const salt = randomBytes(16);
    const iterations = 1000;
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      // Single-pass derivation
      const expectedKey = PBKDF2.derive(Buffer.from(password), length, {
        salt,
        iterations,
        hashAlgorithm: algorithm
      });

      // Streaming derivation
      const deriver = new PBKDF2.Streaming({
        salt,
        iterations,
        hashAlgorithm: algorithm
      });

      // Feed password in chunks
      const chunks = [
        password.slice(0, 5),
        password.slice(5, 10),
        password.slice(10)
      ];

      for (const chunk of chunks) {
        await deriver.update(Buffer.from(chunk));
      }

      const streamingKey = await deriver.finalize(length);
      expect(streamingKey).toEqual(expectedKey);
    }
  });

  it('should verify derived keys', () => {
    const salt = randomBytes(16);
    const iterations = 1000;
    const length = 32;

    for (const algorithm of hashAlgorithms) {
      const key = PBKDF2.derive(Buffer.from(password), length, {
        salt,
        iterations,
        hashAlgorithm: algorithm
      });

      // Verify with correct password
      const isValid = PBKDF2.verify(Buffer.from(password), key, {
        salt,
        iterations,
        hashAlgorithm: algorithm
      });
      expect(isValid).toBe(true);

      // Verify with wrong password
      const isInvalid = PBKDF2.verify(Buffer.from('WrongPassword'), key, {
        salt,
        iterations,
        hashAlgorithm: algorithm
      });
      expect(isInvalid).toBe(false);
    }
  });
}); 