import { ElGamalEncryption } from '../ElGamalEncryption';
import { KeyManager } from '../../KeyManager';
import { FileKeyStorage } from '../../storage/FileKeyStorage';
import { 
  HomomorphicConfig, 
  HomomorphicScheme,
  SecurityLevel 
} from '../../types';
import { join } from 'path';
import { mkdir, rm } from 'fs/promises';

describe('ElGamalEncryption', () => {
  let encryption: ElGamalEncryption;
  let keyManager: KeyManager;
  let keyId: string;
  const tempDir = join(__dirname, 'test-keys');

  beforeAll(async () => {
    await mkdir(tempDir, { recursive: true });
    const storage = new FileKeyStorage(tempDir);
    keyManager = new KeyManager(storage);
    
    const config: HomomorphicConfig = {
      scheme: HomomorphicScheme.ELGAMAL,
      securityLevel: SecurityLevel.MEDIUM,
      polyModulusDegree: 4096
    };
    
    encryption = new ElGamalEncryption(config, keyManager);
    keyId = await keyManager.generateKey(config);
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Basic Operations', () => {
    it('should encrypt and decrypt single value', async () => {
      const data = [123n];
      const encrypted = await encryption.encrypt(data, keyId);
      const decrypted = await encryption.decrypt(encrypted, keyId);
      expect(decrypted[0]).toBe(data[0]);
    });

    it('should encrypt and decrypt array of values', async () => {
      const data = [123n, 456n, 789n];
      const encrypted = await encryption.encrypt(data, keyId);
      const decrypted = await encryption.decrypt(encrypted, keyId);
      expect(decrypted).toEqual(data);
    });

    it('should handle zero values', async () => {
      const data = [0n];
      const encrypted = await encryption.encrypt(data, keyId);
      const decrypted = await encryption.decrypt(encrypted, keyId);
      expect(decrypted[0]).toBe(0n);
    });

    it('should throw error for negative values', async () => {
      const data = [-1n];
      await expect(encryption.encrypt(data, keyId))
        .rejects.toThrow();
    });
  });

  describe('Homomorphic Operations', () => {
    it('should multiply two encrypted values', async () => {
      const a = [2n];
      const b = [3n];
      
      const encA = await encryption.encrypt(a, keyId);
      const encB = await encryption.encrypt(b, keyId);
      
      const product = await encryption.multiply(encA, encB);
      const decrypted = await encryption.decrypt(product, keyId);
      
      expect(decrypted[0]).toBe(6n);
    });

    it('should multiply arrays of encrypted values', async () => {
      const a = [2n, 3n, 4n];
      const b = [3n, 4n, 5n];
      
      const encA = await encryption.encrypt(a, keyId);
      const encB = await encryption.encrypt(b, keyId);
      
      const products = await encryption.multiply(encA, encB);
      const decrypted = await encryption.decrypt(products, keyId);
      
      expect(decrypted).toEqual([6n, 12n, 20n]);
    });

    it('should throw error for addition', async () => {
      const a = await encryption.encrypt([1n], keyId);
      const b = await encryption.encrypt([2n], keyId);
      
      await expect(encryption.add(a, b))
        .rejects.toThrow('Addition not supported');
    });

    it('should throw error for unsupported operations', async () => {
      const enc = await encryption.encrypt([1n], keyId);
      
      await expect(encryption.relinearize(enc))
        .rejects.toThrow('Relinearization not supported');
      
      await expect(encryption.rotate(enc, 1))
        .rejects.toThrow('Rotation not supported');
      
      await expect(encryption.rescale(enc))
        .rejects.toThrow('Rescaling not supported');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid scheme', () => {
      const config: HomomorphicConfig = {
        scheme: HomomorphicScheme.BGV,
        securityLevel: SecurityLevel.MEDIUM,
        polyModulusDegree: 4096
      };
      
      expect(() => new ElGamalEncryption(config, keyManager))
        .toThrow('Invalid scheme');
    });

    it('should throw error for mismatched key IDs', async () => {
      const a = await encryption.encrypt([1n], keyId);
      const b = await encryption.encrypt([2n], 'invalid-key');
      
      await expect(encryption.multiply(a, b))
        .rejects.toThrow('different keys');
    });

    it('should throw error for mismatched array lengths', async () => {
      const a = await encryption.encrypt([1n], keyId);
      const b = await encryption.encrypt([1n, 2n], keyId);
      
      await expect(encryption.multiply(a, b))
        .rejects.toThrow('different lengths');
    });
  });

  describe('Performance Metrics', () => {
    it('should track successful operations', async () => {
      const data = [123n];
      await encryption.encrypt(data, keyId);
      
      const metrics = encryption.getMetrics();
      expect(metrics.successCount).toBeGreaterThan(0);
      expect(metrics.failureCount).toBe(0);
    });

    it('should track failed operations', async () => {
      try {
        await encryption.encrypt([-1n], keyId);
      } catch (error) {
        // Expected error
      }
      
      const metrics = encryption.getMetrics();
      expect(metrics.failureCount).toBeGreaterThan(0);
    });

    it('should clear metrics', async () => {
      await encryption.encrypt([123n], keyId);
      encryption.clearMetrics();
      
      const metrics = encryption.getMetrics();
      expect(metrics.successCount).toBe(0);
      expect(metrics.failureCount).toBe(0);
    });
  });
}); 