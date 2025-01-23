import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { KeyBackupManager, BackupConfig } from '../KeyBackupManager';
import { AuditLogger } from '../../audit/AuditLogger';

describe('KeyBackupManager', () => {
  let backupManager: KeyBackupManager;
  let config: BackupConfig;
  let auditLogger: AuditLogger;
  let testKeys: Array<{ id: string; data: Buffer }>;
  const tempDir = join(__dirname, 'test-backups');

  beforeAll(async () => {
    await mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    config = {
      backupPath: tempDir,
      encryptionKey: randomBytes(32),
      maxBackups: 3,
      compressionEnabled: true
    };

    auditLogger = {
      log: jest.fn().mockResolvedValue(undefined)
    } as unknown as AuditLogger;

    backupManager = new KeyBackupManager(config, auditLogger);

    testKeys = [
      { id: 'key1', data: Buffer.from('test key 1') },
      { id: 'key2', data: Buffer.from('test key 2') }
    ];
  });

  describe('createBackup', () => {
    it('should create a backup successfully', async () => {
      const backupId = await backupManager.createBackup(testKeys);
      expect(backupId).toMatch(/^backup-\d+-[a-f0-9]{8}$/);
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'CREATE_BACKUP',
          status: 'SUCCESS'
        })
      );
    });

    it('should include metadata in backup', async () => {
      const metadata = { test: 'value' };
      const backupId = await backupManager.createBackup(testKeys, metadata);
      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(1);
      expect(backups[0].id).toBe(backupId);
    });

    it('should enforce max backups limit', async () => {
      await Promise.all([
        backupManager.createBackup(testKeys),
        backupManager.createBackup(testKeys),
        backupManager.createBackup(testKeys),
        backupManager.createBackup(testKeys)
      ]);

      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(config.maxBackups);
    });
  });

  describe('restoreBackup', () => {
    let backupId: string;

    beforeEach(async () => {
      backupId = await backupManager.createBackup(testKeys);
    });

    it('should restore all keys from backup', async () => {
      const restored = await backupManager.restoreBackup(backupId);
      expect(restored).toHaveLength(testKeys.length);
      expect(restored[0].id).toBe(testKeys[0].id);
      expect(restored[0].data).toEqual(testKeys[0].data);
    });

    it('should restore specific keys when keyIds provided', async () => {
      const restored = await backupManager.restoreBackup(backupId, ['key1']);
      expect(restored).toHaveLength(1);
      expect(restored[0].id).toBe('key1');
    });

    it('should throw error for invalid backup id', async () => {
      await expect(backupManager.restoreBackup('invalid-id'))
        .rejects.toThrow();
    });
  });

  describe('listBackups', () => {
    beforeEach(async () => {
      await Promise.all([
        backupManager.createBackup(testKeys),
        backupManager.createBackup(testKeys)
      ]);
    });

    it('should list all backups', async () => {
      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(2);
      expect(backups[0].keyIds).toEqual(testKeys.map(k => k.id));
    });

    it('should sort backups by timestamp descending', async () => {
      const backups = await backupManager.listBackups();
      expect(new Date(backups[0].timestamp).getTime())
        .toBeGreaterThan(new Date(backups[1].timestamp).getTime());
    });
  });

  describe('verifyBackup', () => {
    let backupId: string;

    beforeEach(async () => {
      backupId = await backupManager.createBackup(testKeys);
    });

    it('should verify valid backup', async () => {
      const isValid = await backupManager.verifyBackup(backupId);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid backup id', async () => {
      const isValid = await backupManager.verifyBackup('invalid-id');
      expect(isValid).toBe(false);
    });
  });
}); 