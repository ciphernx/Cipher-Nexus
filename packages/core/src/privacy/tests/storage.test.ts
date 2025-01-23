import { FileStorage, FileStorageConfig } from '../storage/FileStorage';
import { DatabaseStorage, DatabaseStorageConfig } from '../storage/DatabaseStorage';
import { promises as fs } from 'fs';
import { join } from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import crypto from 'crypto';

describe('Storage Tests', () => {
  let fileStorage: FileStorage;
  let dbStorage: DatabaseStorage;
  let mongoServer: MongoMemoryServer;
  let tempDir: string;

  beforeAll(async () => {
    // Setup temporary directory for file storage
    tempDir = join(__dirname, 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    // Setup in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
  });

  afterAll(async () => {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
    await mongoServer.stop();
  });

  describe('FileStorage', () => {
    beforeEach(async () => {
      const config: FileStorageConfig = {
        basePath: tempDir,
        encryption: {
          key: crypto.randomBytes(32),
          algorithm: 'aes-256-gcm'
        },
        compression: true,
        maxCacheSize: 100
      };
      fileStorage = new FileStorage(config);
      await fileStorage.initialize();
    });

    test('should store and retrieve data', async () => {
      const testData = { test: 'data' };
      await fileStorage.store('metadata', 'test1', testData);
      const retrieved = await fileStorage.retrieve('metadata', 'test1');
      expect(retrieved).toEqual(testData);
    });

    test('should handle encrypted data', async () => {
      const testData = { sensitive: 'data' };
      await fileStorage.store('keys', 'test2', testData);
      const retrieved = await fileStorage.retrieve('keys', 'test2');
      expect(retrieved).toEqual(testData);
    });

    test('should handle cache correctly', async () => {
      const testData = { cached: 'data' };
      await fileStorage.store('metadata', 'test3', testData);
      
      // First retrieval should cache
      await fileStorage.retrieve('metadata', 'test3');
      
      // Second retrieval should use cache
      const start = Date.now();
      const retrieved = await fileStorage.retrieve('metadata', 'test3');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(5); // Should be very fast from cache
      expect(retrieved).toEqual(testData);
    });

    test('should handle non-existent data', async () => {
      const retrieved = await fileStorage.retrieve('metadata', 'nonexistent');
      expect(retrieved).toBeNull();
    });

    test('should list stored items', async () => {
      await fileStorage.store('metadata', 'test4', { data: 1 });
      await fileStorage.store('metadata', 'test5', { data: 2 });
      
      const items = await fileStorage.list('metadata');
      expect(items).toContain('test4');
      expect(items).toContain('test5');
    });

    test('should delete items', async () => {
      await fileStorage.store('metadata', 'test6', { data: 'delete' });
      await fileStorage.delete('metadata', 'test6');
      
      const retrieved = await fileStorage.retrieve('metadata', 'test6');
      expect(retrieved).toBeNull();
    });

    test('should clear all items of a type', async () => {
      await fileStorage.store('metadata', 'test7', { data: 1 });
      await fileStorage.store('metadata', 'test8', { data: 2 });
      
      await fileStorage.clear('metadata');
      const items = await fileStorage.list('metadata');
      expect(items).toHaveLength(0);
    });
  });

  describe('DatabaseStorage', () => {
    beforeEach(async () => {
      const config: DatabaseStorageConfig = {
        url: mongoServer.getUri(),
        dbName: 'testdb',
        collections: {
          keys: 'keys',
          audit: 'audit',
          metadata: 'metadata'
        },
        encryption: {
          key: crypto.randomBytes(32),
          algorithm: 'aes-256-gcm'
        }
      };
      dbStorage = new DatabaseStorage(config);
      await dbStorage.initialize();
    });

    afterEach(async () => {
      await dbStorage.close();
    });

    test('should store and retrieve data', async () => {
      const testData = { test: 'data' };
      await dbStorage.store('metadata', 'test1', testData);
      const retrieved = await dbStorage.retrieve('metadata', 'test1');
      expect(retrieved).toEqual(expect.objectContaining(testData));
    });

    test('should handle encrypted data', async () => {
      const testData = { sensitive: 'data' };
      await dbStorage.store('keys', 'test2', testData);
      const retrieved = await dbStorage.retrieve('keys', 'test2');
      expect(retrieved).toEqual(testData);
    });

    test('should handle non-existent data', async () => {
      const retrieved = await dbStorage.retrieve('metadata', 'nonexistent');
      expect(retrieved).toBeNull();
    });

    test('should list stored items', async () => {
      await dbStorage.store('metadata', 'test4', { data: 1 });
      await dbStorage.store('metadata', 'test5', { data: 2 });
      
      const items = await dbStorage.list('metadata');
      expect(items).toContain('test4');
      expect(items).toContain('test5');
    });

    test('should delete items', async () => {
      await dbStorage.store('metadata', 'test6', { data: 'delete' });
      await dbStorage.delete('metadata', 'test6');
      
      const retrieved = await dbStorage.retrieve('metadata', 'test6');
      expect(retrieved).toBeNull();
    });

    test('should clear all items of a type', async () => {
      await dbStorage.store('metadata', 'test7', { data: 1 });
      await dbStorage.store('metadata', 'test8', { data: 2 });
      
      await dbStorage.clear('metadata');
      const items = await dbStorage.list('metadata');
      expect(items).toHaveLength(0);
    });

    test('should perform aggregation queries', async () => {
      await dbStorage.store('metadata', 'test9', { value: 1 });
      await dbStorage.store('metadata', 'test10', { value: 2 });
      
      const pipeline = [
        { $group: { _id: null, total: { $sum: '$value' } } }
      ];
      
      const result = await dbStorage.aggregate('metadata', pipeline);
      expect(result[0].total).toBe(3);
    });

    test('should perform bulk operations', async () => {
      const operations = [
        {
          insertOne: {
            document: { _id: 'bulk1', data: 1 }
          }
        },
        {
          insertOne: {
            document: { _id: 'bulk2', data: 2 }
          }
        }
      ];

      await dbStorage.bulkWrite('metadata', operations);
      const items = await dbStorage.list('metadata');
      expect(items).toContain('bulk1');
      expect(items).toContain('bulk2');
    });

    test('should handle transactions', async () => {
      const session = await dbStorage.createSession();
      
      try {
        session.startTransaction();
        await dbStorage.store('metadata', 'trans1', { data: 1 });
        await dbStorage.store('metadata', 'trans2', { data: 2 });
        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }

      const items = await dbStorage.list('metadata');
      expect(items).toContain('trans1');
      expect(items).toContain('trans2');
    });
  });
}); 