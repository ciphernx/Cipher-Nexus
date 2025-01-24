import { Argon2, Argon2Variant, Argon2Params } from '../argon2';
import { randomBytes } from 'crypto';

describe('Argon2 Password Hashing', () => {
  const password = 'MySecurePassword123!';
  const variants = [
    Argon2Variant.Argon2i,   // Optimized for side-channel resistance
    Argon2Variant.Argon2d,   // Optimized for maximum GPU cracking resistance
    Argon2Variant.Argon2id   // Hybrid mode
  ];

  it('should generate correct hash lengths', () => {
    const hashLengths = [16, 32, 64]; // Different hash lengths in bytes
    
    for (const variant of variants) {
      for (const length of hashLengths) {
        const params: Argon2Params = {
          variant,
          hashLength: length,
          timeCost: 2,
          memoryCost: 1024,
          parallelism: 1
        };
        
        const hash = Argon2.hash(Buffer.from(password), params);
        expect(hash.length).toBe(length);
      }
    }
  });

  it('should be deterministic with same salt', () => {
    const salt = randomBytes(16);
    
    for (const variant of variants) {
      const params: Argon2Params = {
        variant,
        hashLength: 32,
        timeCost: 2,
        memoryCost: 1024,
        parallelism: 1,
        salt
      };
      
      const hash1 = Argon2.hash(Buffer.from(password), params);
      const hash2 = Argon2.hash(Buffer.from(password), params);
      expect(hash1).toEqual(hash2);
    }
  });

  it('should produce different hashes with different salts', () => {
    for (const variant of variants) {
      const params1: Argon2Params = {
        variant,
        hashLength: 32,
        timeCost: 2,
        memoryCost: 1024,
        parallelism: 1,
        salt: randomBytes(16)
      };
      
      const params2 = { ...params1, salt: randomBytes(16) };
      
      const hash1 = Argon2.hash(Buffer.from(password), params1);
      const hash2 = Argon2.hash(Buffer.from(password), params2);
      expect(hash1).not.toEqual(hash2);
    }
  });

  it('should verify correct passwords', () => {
    for (const variant of variants) {
      const params: Argon2Params = {
        variant,
        hashLength: 32,
        timeCost: 2,
        memoryCost: 1024,
        parallelism: 1,
        salt: randomBytes(16)
      };
      
      const hash = Argon2.hash(Buffer.from(password), params);
      const isValid = Argon2.verify(Buffer.from(password), hash, params);
      expect(isValid).toBe(true);
    }
  });

  it('should reject incorrect passwords', () => {
    const wrongPassword = 'WrongPassword123!';
    
    for (const variant of variants) {
      const params: Argon2Params = {
        variant,
        hashLength: 32,
        timeCost: 2,
        memoryCost: 1024,
        parallelism: 1,
        salt: randomBytes(16)
      };
      
      const hash = Argon2.hash(Buffer.from(password), params);
      const isValid = Argon2.verify(Buffer.from(wrongPassword), hash, params);
      expect(isValid).toBe(false);
    }
  });

  it('should handle empty passwords', () => {
    for (const variant of variants) {
      const params: Argon2Params = {
        variant,
        hashLength: 32,
        timeCost: 2,
        memoryCost: 1024,
        parallelism: 1,
        salt: randomBytes(16)
      };
      
      const hash = Argon2.hash(Buffer.from(''), params);
      expect(hash).toBeDefined();
      expect(hash.length).toBe(32);
      
      const isValid = Argon2.verify(Buffer.from(''), hash, params);
      expect(isValid).toBe(true);
    }
  });

  it('should support different time costs', () => {
    const timeCosts = [1, 2, 4]; // Different time cost factors
    
    for (const variant of variants) {
      for (const timeCost of timeCosts) {
        const params: Argon2Params = {
          variant,
          hashLength: 32,
          timeCost,
          memoryCost: 1024,
          parallelism: 1,
          salt: randomBytes(16)
        };
        
        const hash = Argon2.hash(Buffer.from(password), params);
        expect(hash).toBeDefined();
        expect(hash.length).toBe(32);
      }
    }
  });

  it('should support different memory costs', () => {
    const memoryCosts = [1024, 2048, 4096]; // Different memory costs in KiB
    
    for (const variant of variants) {
      for (const memoryCost of memoryCosts) {
        const params: Argon2Params = {
          variant,
          hashLength: 32,
          timeCost: 2,
          memoryCost,
          parallelism: 1,
          salt: randomBytes(16)
        };
        
        const hash = Argon2.hash(Buffer.from(password), params);
        expect(hash).toBeDefined();
        expect(hash.length).toBe(32);
      }
    }
  });

  it('should support different parallelism degrees', () => {
    const parallelismDegrees = [1, 2, 4]; // Different parallelism degrees
    
    for (const variant of variants) {
      for (const parallelism of parallelismDegrees) {
        const params: Argon2Params = {
          variant,
          hashLength: 32,
          timeCost: 2,
          memoryCost: 1024,
          parallelism,
          salt: randomBytes(16)
        };
        
        const hash = Argon2.hash(Buffer.from(password), params);
        expect(hash).toBeDefined();
        expect(hash.length).toBe(32);
      }
    }
  });

  it('should support additional data (AD)', () => {
    const ad = Buffer.from('Additional Data');
    
    for (const variant of variants) {
      const params: Argon2Params = {
        variant,
        hashLength: 32,
        timeCost: 2,
        memoryCost: 1024,
        parallelism: 1,
        salt: randomBytes(16),
        additionalData: ad
      };
      
      const hash1 = Argon2.hash(Buffer.from(password), params);
      const hash2 = Argon2.hash(Buffer.from(password), { ...params, additionalData: Buffer.from('Different AD') });
      
      // Different AD should produce different hashes
      expect(hash1).not.toEqual(hash2);
      
      // Verification should work with correct AD
      const isValid = Argon2.verify(Buffer.from(password), hash1, params);
      expect(isValid).toBe(true);
      
      // Verification should fail with wrong AD
      const isInvalid = Argon2.verify(Buffer.from(password), hash1, { ...params, additionalData: Buffer.from('Different AD') });
      expect(isInvalid).toBe(false);
    }
  });

  it('should support secret value', () => {
    const secret = randomBytes(32);
    
    for (const variant of variants) {
      const params: Argon2Params = {
        variant,
        hashLength: 32,
        timeCost: 2,
        memoryCost: 1024,
        parallelism: 1,
        salt: randomBytes(16),
        secret
      };
      
      const hash1 = Argon2.hash(Buffer.from(password), params);
      const hash2 = Argon2.hash(Buffer.from(password), { ...params, secret: randomBytes(32) });
      
      // Different secrets should produce different hashes
      expect(hash1).not.toEqual(hash2);
      
      // Verification should work with correct secret
      const isValid = Argon2.verify(Buffer.from(password), hash1, params);
      expect(isValid).toBe(true);
      
      // Verification should fail with wrong secret
      const isInvalid = Argon2.verify(Buffer.from(password), hash1, { ...params, secret: randomBytes(32) });
      expect(isInvalid).toBe(false);
    }
  });

  it('should reject invalid parameters', () => {
    const invalidParams = [
      { timeCost: 0 },    // Time cost too low
      { memoryCost: 7 },  // Memory cost not power of 2
      { parallelism: 0 }, // Parallelism too low
      { salt: Buffer.alloc(15) } // Salt too short
    ];
    
    for (const variant of variants) {
      for (const invalid of invalidParams) {
        const params: Argon2Params = {
          variant,
          hashLength: 32,
          timeCost: 2,
          memoryCost: 1024,
          parallelism: 1,
          salt: randomBytes(16),
          ...invalid
        };
        
        expect(() => Argon2.hash(Buffer.from(password), params)).toThrow();
      }
    }
  });

  it('should be time-independent in verification', async () => {
    // Test that verification time doesn't leak password length
    const shortPassword = 'short';
    const longPassword = 'very_long_password_for_timing_test';
    
    for (const variant of variants) {
      const params: Argon2Params = {
        variant,
        hashLength: 32,
        timeCost: 2,
        memoryCost: 1024,
        parallelism: 1,
        salt: randomBytes(16)
      };
      
      const hash = Argon2.hash(Buffer.from(password), params);
      
      const startShort = process.hrtime.bigint();
      await Argon2.verify(Buffer.from(shortPassword), hash, params);
      const endShort = process.hrtime.bigint();
      
      const startLong = process.hrtime.bigint();
      await Argon2.verify(Buffer.from(longPassword), hash, params);
      const endLong = process.hrtime.bigint();
      
      const shortTime = Number(endShort - startShort);
      const longTime = Number(endLong - startLong);
      
      // Times should be within 10% of each other
      const timeDiff = Math.abs(shortTime - longTime) / Math.max(shortTime, longTime);
      expect(timeDiff).toBeLessThan(0.1);
    }
  });
}); 