import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { join } from 'path';
import { ensureDir, writeFile, readFile, remove, readdir } from 'fs-extra';
import { KeyMetadata } from '../types';

/**
 * File-based key storage implementation with encryption
 */
export class FileKeyStorage {
  private basePath: string;
  private encryptionKey: Buffer;
  private metadataPath: string;

  constructor(basePath: string, masterKey?: string) {
    this.basePath = basePath;
    this.metadataPath = join(basePath, 'metadata.json');
    
    // Use provided master key or generate one
    this.encryptionKey = masterKey ? 
      Buffer.from(masterKey, 'hex') : 
      randomBytes(32);
  }

  /**
   * Initialize storage
   */
  async initialize(): Promise<void> {
    await ensureDir(this.basePath);
    
    // Create metadata file if it doesn't exist
    try {
      await readFile(this.metadataPath);
    } catch {
      await writeFile(this.metadataPath, JSON.stringify({}));
    }
  }

  /**
   * Save encrypted key and metadata
   */
  async save(key: Buffer, metadata: KeyMetadata): Promise<void> {
    // Generate random IV
    const iv = randomBytes(16);
    
    // Encrypt key
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encryptedKey = Buffer.concat([
      cipher.update(key),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    // Combine IV, auth tag and encrypted key
    const keyData = Buffer.concat([
      iv,
      authTag,
      encryptedKey
    ]);

    // Save encrypted key
    const keyPath = join(this.basePath, `${metadata.id}.key`);
    await writeFile(keyPath, keyData);

    // Update metadata
    const allMetadata = await this.readMetadata();
    allMetadata[metadata.id] = metadata;
    await writeFile(this.metadataPath, JSON.stringify(allMetadata));
  }

  /**
   * Load and decrypt key
   */
  async load(id: string): Promise<{key: Buffer, metadata: KeyMetadata}> {
    // Read metadata
    const allMetadata = await this.readMetadata();
    const metadata = allMetadata[id];
    if (!metadata) {
      throw new Error(`Key not found: ${id}`);
    }

    // Read encrypted key data
    const keyPath = join(this.basePath, `${id}.key`);
    const keyData = await readFile(keyPath);

    // Extract IV, auth tag and encrypted key
    const iv = keyData.slice(0, 16);
    const authTag = keyData.slice(16, 32);
    const encryptedKey = keyData.slice(32);

    // Decrypt key
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    const key = Buffer.concat([
      decipher.update(encryptedKey),
      decipher.final()
    ]);

    return { key, metadata };
  }

  /**
   * Delete key and metadata
   */
  async delete(id: string): Promise<void> {
    // Securely delete key file
    const keyPath = join(this.basePath, `${id}.key`);
    try {
      // Overwrite with random data before deletion
      await writeFile(keyPath, randomBytes(1024));
      await remove(keyPath);
    } catch {
      // Ignore errors if file doesn't exist
    }

    // Remove from metadata
    const allMetadata = await this.readMetadata();
    delete allMetadata[id];
    await writeFile(this.metadataPath, JSON.stringify(allMetadata));
  }

  /**
   * List all key metadata
   */
  async list(): Promise<KeyMetadata[]> {
    const allMetadata = await this.readMetadata();
    return Object.values(allMetadata);
  }

  /**
   * Backup keys to specified path
   */
  async backup(backupPath: string): Promise<void> {
    await ensureDir(backupPath);

    // Copy all key files and metadata
    const allMetadata = await this.readMetadata();
    
    for (const [id, metadata] of Object.entries(allMetadata)) {
      const sourcePath = join(this.basePath, `${id}.key`);
      const targetPath = join(backupPath, `${id}.key`);
      await readFile(sourcePath).then(data => writeFile(targetPath, data));
    }

    // Save metadata
    const backupMetadataPath = join(backupPath, 'metadata.json');
    await writeFile(backupMetadataPath, JSON.stringify(allMetadata));
  }

  /**
   * Restore keys from backup
   */
  async restore(backupPath: string): Promise<void> {
    // Read backup metadata
    const backupMetadataPath = join(backupPath, 'metadata.json');
    const backupMetadata = JSON.parse(
      await readFile(backupMetadataPath, 'utf8')
    );

    // Restore each key
    for (const [id, metadata] of Object.entries(backupMetadata)) {
      const sourcePath = join(backupPath, `${id}.key`);
      const targetPath = join(this.basePath, `${id}.key`);
      await readFile(sourcePath).then(data => writeFile(targetPath, data));
    }

    // Update metadata
    await writeFile(this.metadataPath, JSON.stringify(backupMetadata));
  }

  /**
   * Read metadata file
   */
  private async readMetadata(): Promise<Record<string, KeyMetadata>> {
    try {
      const data = await readFile(this.metadataPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  /**
   * Clean up old backups
   */
  async cleanupBackups(backupPath: string, maxAge: number): Promise<void> {
    const files = await readdir(backupPath);
    const now = Date.now();

    for (const file of files) {
      const filePath = join(backupPath, file);
      const stats = await readFile(filePath).then(f => f.stats);
      
      if (now - stats.mtimeMs > maxAge) {
        // Securely delete old backups
        await writeFile(filePath, randomBytes(1024));
        await remove(filePath);
      }
    }
  }
} 