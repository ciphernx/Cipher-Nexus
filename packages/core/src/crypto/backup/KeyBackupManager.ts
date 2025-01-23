import { writeFile, readFile, readdir, mkdir, rm } from 'fs/promises';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { join } from 'path';
import { AuditLogger, AuditEventType, AuditSeverity } from '../audit/AuditLogger';

export interface BackupConfig {
  backupPath: string;
  encryptionKey: Buffer;
  maxBackups: number;
  compressionEnabled?: boolean;
}

export interface BackupMetadata {
  id: string;
  timestamp: string;
  keyIds: string[];
  size: number;
  checksum: string;
  version: string;
}

export class KeyBackupManager {
  private config: Required<BackupConfig>;
  private auditLogger: AuditLogger;

  constructor(config: BackupConfig, auditLogger: AuditLogger) {
    this.config = {
      ...config,
      compressionEnabled: config.compressionEnabled ?? true
    };
    this.auditLogger = auditLogger;
  }

  /**
   * Create a backup of specified keys
   */
  async createBackup(
    keys: Array<{ id: string; data: Buffer }>,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      const backupId = this.generateBackupId();
      const timestamp = new Date().toISOString();

      // Prepare backup data
      const backupData = {
        keys,
        metadata: {
          ...metadata,
          timestamp,
          version: '1.0.0'
        }
      };

      // Encrypt backup data
      const iv = randomBytes(16);
      const encrypted = this.encryptBackup(
        Buffer.from(JSON.stringify(backupData)),
        this.config.encryptionKey,
        iv
      );

      // Create backup metadata
      const backupMetadata: BackupMetadata = {
        id: backupId,
        timestamp,
        keyIds: keys.map(k => k.id),
        size: encrypted.length,
        checksum: this.calculateChecksum(encrypted),
        version: '1.0.0'
      };

      // Save backup and metadata
      const backupPath = join(this.config.backupPath, backupId);
      await mkdir(backupPath, { recursive: true });

      await Promise.all([
        writeFile(join(backupPath, 'backup.enc'), Buffer.concat([iv, encrypted])),
        writeFile(join(backupPath, 'metadata.json'), JSON.stringify(backupMetadata))
      ]);

      // Cleanup old backups
      await this.cleanupOldBackups();

      // Audit logging
      await this.auditLogger.log({
        type: AuditEventType.KEY_GENERATION,
        severity: AuditSeverity.INFO,
        operation: 'CREATE_BACKUP',
        details: {
          backupId,
          keyCount: keys.length,
          size: encrypted.length
        },
        status: 'SUCCESS'
      });

      return backupId;

    } catch (error) {
      await this.auditLogger.log({
        type: AuditEventType.KEY_GENERATION,
        severity: AuditSeverity.ERROR,
        operation: 'CREATE_BACKUP',
        details: { error: error instanceof Error ? error.message : String(error) },
        status: 'FAILURE'
      });
      throw error;
    }
  }

  /**
   * Restore keys from a backup
   */
  async restoreBackup(
    backupId: string,
    keyIds?: string[]
  ): Promise<Array<{ id: string; data: Buffer }>> {
    try {
      const backupPath = join(this.config.backupPath, backupId);
      
      // Read backup and metadata
      const [encryptedData, metadataStr] = await Promise.all([
        readFile(join(backupPath, 'backup.enc')),
        readFile(join(backupPath, 'metadata.json'), 'utf8')
      ]);

      const metadata = JSON.parse(metadataStr) as BackupMetadata;

      // Verify checksum
      const actualChecksum = this.calculateChecksum(encryptedData.slice(16));
      if (actualChecksum !== metadata.checksum) {
        throw new Error('Backup integrity check failed');
      }

      // Decrypt backup
      const iv = encryptedData.slice(0, 16);
      const encrypted = encryptedData.slice(16);
      const decrypted = this.decryptBackup(
        encrypted,
        this.config.encryptionKey,
        iv
      );

      const backupData = JSON.parse(decrypted.toString());

      // Filter keys if specific IDs requested
      let restoredKeys = backupData.keys;
      if (keyIds && keyIds.length > 0) {
        restoredKeys = restoredKeys.filter((k: any) => keyIds.includes(k.id));
      }

      // Audit logging
      await this.auditLogger.log({
        type: AuditEventType.KEY_GENERATION,
        severity: AuditSeverity.INFO,
        operation: 'RESTORE_BACKUP',
        details: {
          backupId,
          keyCount: restoredKeys.length
        },
        status: 'SUCCESS'
      });

      return restoredKeys;

    } catch (error) {
      await this.auditLogger.log({
        type: AuditEventType.KEY_GENERATION,
        severity: AuditSeverity.ERROR,
        operation: 'RESTORE_BACKUP',
        details: {
          backupId,
          error: error instanceof Error ? error.message : String(error)
        },
        status: 'FAILURE'
      });
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    const backups: BackupMetadata[] = [];
    const files = await readdir(this.config.backupPath);

    for (const file of files) {
      try {
        const metadataPath = join(this.config.backupPath, file, 'metadata.json');
        const metadata = JSON.parse(
          await readFile(metadataPath, 'utf8')
        ) as BackupMetadata;
        backups.push(metadata);
      } catch (error) {
        // Skip invalid backups
        console.error(`Error reading backup ${file}:`, error);
      }
    }

    return backups.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const backupPath = join(this.config.backupPath, backupId);
      
      // Read backup and metadata
      const [encryptedData, metadataStr] = await Promise.all([
        readFile(join(backupPath, 'backup.enc')),
        readFile(join(backupPath, 'metadata.json'), 'utf8')
      ]);

      const metadata = JSON.parse(metadataStr) as BackupMetadata;

      // Verify checksum
      const actualChecksum = this.calculateChecksum(encryptedData.slice(16));
      const isValid = actualChecksum === metadata.checksum;

      // Audit logging
      await this.auditLogger.log({
        type: AuditEventType.KEY_GENERATION,
        severity: isValid ? AuditSeverity.INFO : AuditSeverity.WARNING,
        operation: 'VERIFY_BACKUP',
        details: {
          backupId,
          isValid
        },
        status: isValid ? 'SUCCESS' : 'FAILURE'
      });

      return isValid;

    } catch (error) {
      await this.auditLogger.log({
        type: AuditEventType.KEY_GENERATION,
        severity: AuditSeverity.ERROR,
        operation: 'VERIFY_BACKUP',
        details: {
          backupId,
          error: error instanceof Error ? error.message : String(error)
        },
        status: 'FAILURE'
      });
      return false;
    }
  }

  private generateBackupId(): string {
    return `backup-${Date.now()}-${randomBytes(4).toString('hex')}`;
  }

  private calculateChecksum(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private encryptBackup(data: Buffer, key: Buffer, iv: Buffer): Buffer {
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    return Buffer.concat([cipher.update(data), cipher.final()]);
  }

  private decryptBackup(data: Buffer, key: Buffer, iv: Buffer): Buffer {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  private async cleanupOldBackups(): Promise<void> {
    const backups = await this.listBackups();
    
    if (backups.length > this.config.maxBackups) {
      const toDelete = backups.slice(this.config.maxBackups);
      
      for (const backup of toDelete) {
        try {
          const backupPath = join(this.config.backupPath, backup.id);
          await rm(backupPath, { recursive: true });
        } catch (error) {
          console.error(`Error deleting backup ${backup.id}:`, error);
        }
      }
    }
  }
} 