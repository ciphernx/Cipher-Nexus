import { PaillierEncryption } from '../schemes/PaillierEncryption';
import { KeyManager } from '../KeyManager';
import {
  HomomorphicConfig,
  HomomorphicScheme,
  SecurityLevel,
  KeyType
} from '../types';

describe('Paillier Encryption Tests', () => {
  let encryption: PaillierEncryption;
  let keyManager: KeyManager;
  let publicKeyId: string;
  let privateKeyId: string;

  beforeAll(async () => {
    // Initialize with test configuration
    const config: HomomorphicConfig = {
      scheme: HomomorphicScheme.PAILLIER,
      securityLevel: SecurityLevel.BASIC
    };

    // Create key manager with in-memory storage for testing
    const storage = {
      save: jest.fn(),
      load: jest.fn(),
      delete: jest.fn(),
      list: jest.fn()
    };
    keyManager = new KeyManager(storage);

    // Generate test keys
    const keyIds = await keyManager.generateKeys({
      scheme: HomomorphicScheme.PAILLIER,
      securityLevel: SecurityLevel.BASIC,
      keyTypes: [KeyType.PUBLIC, KeyType.PRIVATE]
    });

    publicKeyId = keyIds.get(KeyType.PUBLIC)!;
    privateKeyId = keyIds.get(KeyType.PRIVATE)!;

    encryption = new PaillierEncryption(config, keyManager);
  });

  describe('Basic Operations', () => {
    test('should encrypt and decrypt single value', async () => {
      const value = 42;
      const encrypted = await encryption.encrypt([value], publicKeyId);
      const decrypted = await encryption.decrypt(encrypted, privateKeyId);
      expect(decrypted[0]).toBe(BigInt(value));
    });

    test('should encrypt and decrypt array of values', async () => {
      const values = [1, 2, 3, 4, 5];
      const encrypted = await encryption.encrypt(values, publicKeyId);
      const decrypted = await encryption.decrypt(encrypted, privateKeyId);
      expect(decrypted).toEqual(values.map(BigInt));
    });

    test('should handle zero values', async () => {
      const value = 0;
      const encrypted = await encryption.encrypt([value], publicKeyId);
      const decrypted = await encryption.decrypt(encrypted, privateKeyId);
      expect(decrypted[0]).toBe(BigInt(0));
    });

    test('should handle negative values', async () => {
      const value = -42;
      const encrypted = await encryption.encrypt([value], publicKeyId);
      const decrypted = await encryption.decrypt(encrypted, privateKeyId);
      expect(decrypted[0]).toBe(BigInt(value));
    });
  });

  describe('Homomorphic Operations', () => {
    test('should add two encrypted values', async () => {
      const a = 15;
      const b = 27;
      
      const encryptedA = await encryption.encrypt([a], publicKeyId);
      const encryptedB = await encryption.encrypt([b], publicKeyId);
      
      const encryptedSum = await encryption.add(encryptedA, encryptedB);
      const decryptedSum = await encryption.decrypt(encryptedSum, privateKeyId);
      
      expect(decryptedSum[0]).toBe(BigInt(a + b));
    });

    test('should add array of encrypted values', async () => {
      const valuesA = [1, 2, 3];
      const valuesB = [4, 5, 6];
      
      const encryptedA = await encryption.encrypt(valuesA, publicKeyId);
      const encryptedB = await encryption.encrypt(valuesB, publicKeyId);
      
      const encryptedSum = await encryption.add(encryptedA, encryptedB);
      const decryptedSum = await encryption.decrypt(encryptedSum, privateKeyId);
      
      expect(decryptedSum).toEqual(
        valuesA.map((a, i) => BigInt(a + valuesB[i]))
      );
    });

    test('should multiply encrypted value by scalar', async () => {
      const value = 7;
      const scalar = 3;
      
      const encrypted = await encryption.encrypt([value], publicKeyId);
      const encryptedProduct = await encryption.multiply(encrypted, scalar);
      const decryptedProduct = await encryption.decrypt(encryptedProduct, privateKeyId);
      
      expect(decryptedProduct[0]).toBe(BigInt(value * scalar));
    });
  });

  describe('Error Handling', () => {
    test('should throw error for invalid scheme', () => {
      const invalidConfig: HomomorphicConfig = {
        scheme: HomomorphicScheme.BFV,
        securityLevel: SecurityLevel.BASIC
      };
      
      expect(() => new PaillierEncryption(invalidConfig, keyManager))
        .toThrow('Invalid scheme for Paillier encryption');
    });

    test('should throw error for mismatched key IDs', async () => {
      const encryptedA = await encryption.encrypt([1], publicKeyId);
      const encryptedB = await encryption.encrypt([2], 'different-key-id');
      
      await expect(encryption.add(encryptedA, encryptedB))
        .rejects
        .toThrow('Encrypted values must use the same key');
    });

    test('should throw error for mismatched array lengths', async () => {
      const encryptedA = await encryption.encrypt([1, 2], publicKeyId);
      const encryptedB = await encryption.encrypt([1], publicKeyId);
      
      await expect(encryption.add(encryptedA, encryptedB))
        .rejects
        .toThrow('Encrypted values must have same length');
    });

    test('should throw error for unsupported operations', async () => {
      const encrypted = await encryption.encrypt([1], publicKeyId);
      
      await expect(encryption.rotate(encrypted, 1))
        .rejects
        .toThrow('Rotation not supported in Paillier encryption');
        
      await expect(encryption.relinearize(encrypted))
        .rejects
        .toThrow('Relinearization not supported in Paillier encryption');
        
      await expect(encryption.rescale(encrypted))
        .rejects
        .toThrow('Rescaling not supported in Paillier encryption');
    });
  });

  describe('Performance Metrics', () => {
    test('should record metrics for successful operations', async () => {
      const value = 42;
      await encryption.encrypt([value], publicKeyId);
      
      const metrics = encryption.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].success).toBe(true);
      expect(metrics[0].error).toBeUndefined();
    });

    test('should record metrics for failed operations', async () => {
      const encrypted = await encryption.encrypt([1], publicKeyId);
      
      try {
        await encryption.rotate(encrypted, 1);
      } catch (error) {
        const metrics = encryption.getMetrics();
        const lastMetric = metrics[metrics.length - 1];
        expect(lastMetric.success).toBe(false);
        expect(lastMetric.error).toBeDefined();
      }
    });

    test('should clear metrics', async () => {
      await encryption.encrypt([1], publicKeyId);
      expect(encryption.getMetrics().length).toBeGreaterThan(0);
      
      encryption.clearMetrics();
      expect(encryption.getMetrics().length).toBe(0);
    });
  });
}); 