import { expect } from 'chai';
import { FHE, FHEParams } from '../fhe';

describe('FHE Tests', () => {
  let fhe: FHE;
  let params: FHEParams;

  beforeEach(() => {
    params = {
      polyDegree: 1024,
      plainTextModulus: 2n ** 16n,
      cipherTextModulus: 2n ** 60n,
      bootstrapModulus: 2n ** 30n,
      noiseThresholdAdd: 40,
      noiseThresholdMult: 20,
      plainTextBits: 16
    };
    fhe = new FHE(params);
  });

  describe('Basic Operations', () => {
    test('key generation with different security levels', async () => {
      const keyPair128 = await fhe.generateKeyPair(128);
      const keyPair256 = await fhe.generateKeyPair(256);
      
      expect(keyPair128.publicKey).toBeDefined();
      expect(keyPair128.secretKey).toBeDefined();
      expect(keyPair256.publicKey.length).toBeGreaterThan(keyPair128.publicKey.length);
    });

    test('encryption/decryption with large messages', async () => {
      const keyPair = await fhe.generateKeyPair(128);
      const message = 123456789n;
      
      const ciphertext = await fhe.encrypt(message, keyPair.publicKey);
      const decrypted = await fhe.decrypt(ciphertext, keyPair.secretKey);
      
      expect(decrypted).toBe(message);
    });

    test('homomorphic operations with overflow handling', async () => {
      const keyPair = await fhe.generateKeyPair(128);
      const a = 2n ** 15n - 1n;  // Max value before overflow
      const b = 2n;
      
      const encA = await fhe.encrypt(a, keyPair.publicKey);
      const encB = await fhe.encrypt(b, keyPair.publicKey);
      
      const sum = await fhe.add(encA, encB);
      const product = await fhe.multiply(encA, encB);
      
      const decSum = await fhe.decrypt(sum, keyPair.secretKey);
      const decProduct = await fhe.decrypt(product, keyPair.secretKey);
      
      expect(decSum).toBe((a + b) % params.plainTextModulus);
      expect(decProduct).toBe((a * b) % params.plainTextModulus);
    });
  });

  describe('Advanced Features', () => {
    test('bootstrapping operation', async () => {
      const keyPair = await fhe.generateKeyPair(128);
      const message = 42n;
      
      let ciphertext = await fhe.encrypt(message, keyPair.publicKey);
      
      // Perform multiple operations to increase noise
      for (let i = 0; i < 10; i++) {
        ciphertext = await fhe.multiply(ciphertext, ciphertext);
      }
      
      // Bootstrap to reduce noise
      const refreshed = await fhe.bootstrap(ciphertext);
      const decrypted = await fhe.decrypt(refreshed, keyPair.secretKey);
      
      expect(decrypted).toBe(message);
    });

    test('noise growth analysis', async () => {
      const keyPair = await fhe.generateKeyPair(128);
      const message = 7n;
      
      const ciphertext = await fhe.encrypt(message, keyPair.publicKey);
      const initialNoise = await (fhe as any).estimateNoise(ciphertext);
      
      // Perform multiplication to increase noise
      const multiplied = await fhe.multiply(ciphertext, ciphertext);
      const noisyNoise = await (fhe as any).estimateNoise(multiplied);
      
      expect(noisyNoise).toBeGreaterThan(initialNoise);
    });

    test('SIMD parallel processing', async () => {
      const keyPair = await fhe.generateKeyPair(128);
      const messages = [1n, 2n, 3n, 4n];
      
      // Encrypt multiple messages in parallel
      const ciphertexts = await Promise.all(
        messages.map(m => fhe.encrypt(m, keyPair.publicKey))
      );
      
      // Perform parallel addition
      const sums = await Promise.all(
        ciphertexts.map(async (c, i) => {
          if (i === 0) return c;
          return fhe.add(c, ciphertexts[i - 1]);
        })
      );
      
      // Decrypt results
      const results = await Promise.all(
        sums.map(s => fhe.decrypt(s, keyPair.secretKey))
      );
      
      expect(results[1]).toBe(3n);  // 1 + 2
      expect(results[2]).toBe(5n);  // 2 + 3
      expect(results[3]).toBe(7n);  // 3 + 4
    });
  });

  describe('Performance Tests', () => {
    test('performance benchmarks', async () => {
      const keyPair = await fhe.generateKeyPair(128);
      const message = 123n;
      
      const start = performance.now();
      
      // Measure encryption time
      const encStart = performance.now();
      const ciphertext = await fhe.encrypt(message, keyPair.publicKey);
      const encTime = performance.now() - encStart;
      
      // Measure operation time
      const opStart = performance.now();
      const squared = await fhe.multiply(ciphertext, ciphertext);
      const opTime = performance.now() - opStart;
      
      // Measure decryption time
      const decStart = performance.now();
      const decrypted = await fhe.decrypt(squared, keyPair.secretKey);
      const decTime = performance.now() - decStart;
      
      const totalTime = performance.now() - start;
      
      expect(encTime).toBeLessThan(1000);  // Encryption under 1s
      expect(opTime).toBeLessThan(2000);   // Operation under 2s
      expect(decTime).toBeLessThan(1000);  // Decryption under 1s
      expect(totalTime).toBeLessThan(4000); // Total under 4s
    });

    test('memory usage optimization', async () => {
      const keyPair = await fhe.generateKeyPair(128);
      const messages = Array(100).fill(42n);
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Encrypt and process many messages
      const ciphertexts = await Promise.all(
        messages.map(m => fhe.encrypt(m, keyPair.publicKey))
      );
      
      const sums = await Promise.all(
        ciphertexts.map(async (c, i) => {
          if (i === 0) return c;
          return fhe.add(c, ciphertexts[i - 1]);
        })
      );
      
      const results = await Promise.all(
        sums.map(s => fhe.decrypt(s, keyPair.secretKey))
      );
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be reasonable
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });

  describe('Security Tests', () => {
    test('noise growth analysis', async () => {
      const keyPair = await fhe.generateKeyPair();
      const message = 42n;
      
      // Initial encryption
      const ct = await fhe.encrypt(message, keyPair.publicKey);
      const initialNoise = await (fhe as any).estimateNoise(ct);
      
      // Perform multiple operations
      let current = ct;
      const noiseGrowth = [];
      
      for (let i = 0; i < 10; i++) {
        current = await fhe.multiply(current, current, keyPair.evaluationKey!);
        const noise = await (fhe as any).estimateNoise(current);
        noiseGrowth.push(noise);
      }
      
      // Verify noise growth pattern
      for (let i = 1; i < noiseGrowth.length; i++) {
        expect(noiseGrowth[i]).toBeGreaterThan(noiseGrowth[i-1]);
      }
    });

    test('bootstrapping correctness', async () => {
      const keyPair = await fhe.generateKeyPair();
      const message = 123n;
      
      // Encrypt and perform operations until noise threshold
      let ct = await fhe.encrypt(message, keyPair.publicKey);
      for (let i = 0; i < 15; i++) {
        ct = await fhe.multiply(ct, ct, keyPair.evaluationKey!);
      }
      
      // Perform bootstrapping
      const refreshed = await fhe.bootstrap(ct);
      const noise = await (fhe as any).estimateNoise(refreshed);
      
      // Verify noise reduction and correctness
      expect(noise).toBeLessThan(await (fhe as any).estimateNoise(ct));
      const decrypted = await fhe.decrypt(refreshed, keyPair.secretKey);
      expect(decrypted).toBe(message);
    });

    test('key switching security', async () => {
      const keyPair1 = await fhe.generateKeyPair();
      const keyPair2 = await fhe.generateKeyPair();
      const message = 42n;
      
      // Encrypt with first key
      const ct1 = await fhe.encrypt(message, keyPair1.publicKey);
      
      // Switch to second key
      const switchKey = await (fhe as any).generateKeySwitchingKey(
        keyPair1.secretKey,
        keyPair2.secretKey
      );
      const ct2 = await (fhe as any).keySwitch(ct1, switchKey);
      
      // Verify decryption with second key
      const decrypted = await fhe.decrypt(ct2, keyPair2.secretKey);
      expect(decrypted).toBe(message);
    });

    test('circular security', async () => {
      const keyPair = await fhe.generateKeyPair();
      const message = 42n;
      
      // Encrypt secret key
      const encryptedKey = await fhe.encrypt(
        BigInt('0x' + keyPair.secretKey.toString('hex')),
        keyPair.publicKey
      );
      
      // Attempt homomorphic operations on encrypted key
      const squared = await fhe.multiply(encryptedKey, encryptedKey, keyPair.evaluationKey!);
      
      // Verify noise growth is normal
      const noise = await (fhe as any).estimateNoise(squared);
      expect(noise).toBeLessThan(1000); // Arbitrary threshold
    });

    test('chosen ciphertext security', async () => {
      const keyPair = await fhe.generateKeyPair();
      const message = 42n;
      
      // Generate valid ciphertext
      const validCt = await fhe.encrypt(message, keyPair.publicKey);
      
      // Modify ciphertext
      const modifiedCt = {
        c0: Buffer.from(validCt.c0),
        c1: Buffer.from(validCt.c1)
      };
      modifiedCt.c0[0] ^= 1; // Flip one bit
      
      // Attempt decryption
      const validDecrypted = await fhe.decrypt(validCt, keyPair.secretKey);
      const modifiedDecrypted = await fhe.decrypt(modifiedCt, keyPair.secretKey);
      
      // Verify modified ciphertext produces different result
      expect(modifiedDecrypted).not.toBe(validDecrypted);
    });

    test('semantic security', async () => {
      const keyPair = await fhe.generateKeyPair();
      const message1 = 42n;
      const message2 = 42n;
      
      // Generate multiple ciphertexts of same message
      const ct1 = await fhe.encrypt(message1, keyPair.publicKey);
      const ct2 = await fhe.encrypt(message2, keyPair.publicKey);
      
      // Verify ciphertexts are different
      expect(ct1.c0.equals(ct2.c0)).toBe(false);
      expect(ct1.c1.equals(ct2.c1)).toBe(false);
      
      // But decrypt to same value
      const dec1 = await fhe.decrypt(ct1, keyPair.secretKey);
      const dec2 = await fhe.decrypt(ct2, keyPair.secretKey);
      expect(dec1).toBe(dec2);
    });

    test('malleability resistance', async () => {
      const keyPair = await fhe.generateKeyPair();
      const message = 42n;
      
      // Generate valid ciphertext
      const ct = await fhe.encrypt(message, keyPair.publicKey);
      
      // Attempt to create related ciphertext
      const relatedCt = {
        c0: Buffer.from(ct.c0),
        c1: Buffer.from(ct.c1)
      };
      
      // Multiply c0 and c1 by 2 (attempting multiplicative malleability)
      for (let i = 0; i < relatedCt.c0.length; i++) {
        relatedCt.c0[i] = (relatedCt.c0[i] * 2) % 256;
        relatedCt.c1[i] = (relatedCt.c1[i] * 2) % 256;
      }
      
      // Decrypt both ciphertexts
      const originalDecrypted = await fhe.decrypt(ct, keyPair.secretKey);
      const relatedDecrypted = await fhe.decrypt(relatedCt, keyPair.secretKey);
      
      // Verify related ciphertext does not decrypt to 2*message
      expect(relatedDecrypted).not.toBe(message * 2n);
    });

    test('noise estimation accuracy', async () => {
      const keyPair = await fhe.generateKeyPair();
      const message = 42n;
      
      // Generate ciphertext and estimate noise
      const ct = await fhe.encrypt(message, keyPair.publicKey);
      const initialNoise = await (fhe as any).estimateNoise(ct);
      
      // Perform operation and estimate new noise
      const squared = await fhe.multiply(ct, ct, keyPair.evaluationKey!);
      const newNoise = await (fhe as any).estimateNoise(squared);
      
      // Verify noise estimation is consistent
      expect(newNoise).toBeGreaterThan(initialNoise);
      expect(newNoise).toBeLessThan(initialNoise * initialNoise); // Noise growth should be less than quadratic
    });

    test('key generation entropy', async () => {
      // Generate multiple key pairs
      const keyPairs = await Promise.all(
        Array(10).fill(0).map(() => fhe.generateKeyPair())
      );
      
      // Verify all keys are different
      for (let i = 0; i < keyPairs.length; i++) {
        for (let j = i + 1; j < keyPairs.length; j++) {
          expect(keyPairs[i].publicKey.equals(keyPairs[j].publicKey)).toBe(false);
          expect(keyPairs[i].secretKey.equals(keyPairs[j].secretKey)).toBe(false);
        }
      }
    });

    test('ciphertext indistinguishability', async () => {
      const keyPair = await fhe.generateKeyPair();
      const messages = [0n, 1n, 42n, 255n];
      
      // Generate ciphertexts
      const ciphertexts = await Promise.all(
        messages.map(m => fhe.encrypt(m, keyPair.publicKey))
      );
      
      // Verify all ciphertexts have same length
      const lengths = ciphertexts.map(ct => ct.c0.length + ct.c1.length);
      expect(new Set(lengths).size).toBe(1);
      
      // Verify ciphertexts are different
      for (let i = 0; i < ciphertexts.length; i++) {
        for (let j = i + 1; j < ciphertexts.length; j++) {
          expect(ciphertexts[i].c0.equals(ciphertexts[j].c0)).toBe(false);
          expect(ciphertexts[i].c1.equals(ciphertexts[j].c1)).toBe(false);
        }
      }
    });
  });
}); 