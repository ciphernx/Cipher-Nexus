import { BGVEncryption } from '../BGVEncryption';
import { KeyManager } from '../../KeyManager';
import { FileKeyStorage } from '../../storage/FileKeyStorage';
import { 
  HomomorphicConfig, 
  HomomorphicScheme, 
  SecurityLevel,
  KeyGenParams
} from '../../types';
import * as path from 'path';
import * as fs from 'fs-extra';

describe('BGVEncryption', () => {
  let keyManager: KeyManager;
  let encryption: BGVEncryption;
  let keyId: string;
  const testDir = path.join(__dirname, '../../../__tests__/.keys');

  beforeAll(async () => {
    await fs.ensureDir(testDir);
    const storage = new FileKeyStorage(testDir);
    keyManager = new KeyManager(storage);

    // Generate keys for testing
    const params: KeyGenParams = {
      scheme: HomomorphicScheme.BGV,
      securityLevel: SecurityLevel.BASIC,
      keyTypes: ['public', 'private', 'relin', 'galois'],
      polyModulusDegree: 4096,
      plainModulus: BigInt(1024)
    };
    keyId = await keyManager.generateKey(params);

    const config: HomomorphicConfig = {
      scheme: HomomorphicScheme.BGV,
      securityLevel: SecurityLevel.BASIC,
      polyModulusDegree: 4096,
      plainModulus: BigInt(1024)
    };
    encryption = new BGVEncryption(config, keyManager);
  });

  afterAll(async () => {
    await fs.remove(testDir);
  });

  describe('Basic Operations', () => {
    test('should encrypt and decrypt single value', async () => {
      const value = [123];
      const encrypted = await encryption.encrypt(value, keyId);
      const decrypted = await encryption.decrypt(encrypted, keyId);
      expect(decrypted).toEqual(value);
    });

    test('should encrypt and decrypt array of values', async () => {
      const values = [1, 2, 3, 4, 5];
      const encrypted = await encryption.encrypt(values, keyId);
      const decrypted = await encryption.decrypt(encrypted, keyId);
      expect(decrypted).toEqual(values);
    });

    test('should handle zero values', async () => {
      const values = [0, 0, 0];
      const encrypted = await encryption.encrypt(values, keyId);
      const decrypted = await encryption.decrypt(encrypted, keyId);
      expect(decrypted).toEqual(values);
    });
  });

  describe('Homomorphic Operations', () => {
    test('should add two encrypted values', async () => {
      const a = [10, 20, 30];
      const b = [1, 2, 3];
      const expected = [11, 22, 33];

      const encA = await encryption.encrypt(a, keyId);
      const encB = await encryption.encrypt(b, keyId);
      const encSum = await encryption.add(encA, encB);
      const result = await encryption.decrypt(encSum, keyId);

      expect(result).toEqual(expected);
    });

    test('should multiply two encrypted values', async () => {
      const a = [2, 3, 4];
      const b = [3, 4, 5];
      const expected = [6, 12, 20];

      const encA = await encryption.encrypt(a, keyId);
      const encB = await encryption.encrypt(b, keyId);
      const encProduct = await encryption.multiply(encA, encB);
      const result = await encryption.decrypt(encProduct, keyId);

      expect(result).toEqual(expected);
    });

    test('should perform relinearization after multiplication', async () => {
      const a = [2, 3];
      const b = [3, 4];
      const expected = [6, 12];

      const encA = await encryption.encrypt(a, keyId);
      const encB = await encryption.encrypt(b, keyId);
      const encProduct = await encryption.multiply(encA, encB);
      const relinearized = await encryption.relinearize(encProduct);
      const result = await encryption.decrypt(relinearized, keyId);

      expect(result).toEqual(expected);
    });

    test('should rotate encrypted vector', async () => {
      const values = [1, 2, 3, 4];
      const steps = 1;
      const expected = [4, 1, 2, 3];

      const encrypted = await encryption.encrypt(values, keyId);
      const rotated = await encryption.rotate(encrypted, steps);
      const result = await encryption.decrypt(rotated, keyId);

      expect(result).toEqual(expected);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for invalid scheme', () => {
      const config: HomomorphicConfig = {
        scheme: HomomorphicScheme.ELGAMAL,
        securityLevel: SecurityLevel.BASIC
      };
      expect(() => new BGVEncryption(config, keyManager))
        .toThrow('Invalid scheme for BGV encryption');
    });

    test('should throw error for mismatched key IDs', async () => {
      const a = await encryption.encrypt([1], keyId);
      const b = await encryption.encrypt([2], 'different-key-id');
      await expect(encryption.add(a, b))
        .rejects.toThrow('Cannot add ciphertexts with different keys');
    });
  });

  describe('Performance Metrics', () => {
    test('should track successful operations', async () => {
      const values = [1, 2, 3];
      await encryption.encrypt(values, keyId);
      const metrics = encryption.getMetrics();
      
      expect(metrics).toHaveLength(1);
      expect(metrics[0].success).toBe(true);
      expect(metrics[0].inputSize).toBe(3);
    });

    test('should track failed operations', async () => {
      try {
        await encryption.decrypt({ 
          data: new Uint8Array(),
          keyId: 'invalid-key',
          scheme: HomomorphicScheme.BGV
        }, 'invalid-key');
      } catch (error) {
        const metrics = encryption.getMetrics();
        const lastMetric = metrics[metrics.length - 1];
        
        expect(lastMetric.success).toBe(false);
        expect(lastMetric.error).toBeDefined();
      }
    });

    test('should clear metrics', () => {
      encryption.clearMetrics();
      expect(encryption.getMetrics()).toHaveLength(0);
    });
  });
}); 