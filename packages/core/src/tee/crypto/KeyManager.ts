import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import { CryptoService } from './CryptoService';
import { randomBytes, createHash, generateKeyPairSync } from 'crypto';

export interface KeyConfig {
  keyType: 'symmetric' | 'asymmetric';
  algorithm: string;
  keySize: number;
  rotationPeriod: number;  // milliseconds
  backupEnabled: boolean;
}

export interface KeyMetadata {
  id: string;
  type: string;
  algorithm: string;
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'expired' | 'revoked';
  version: number;
}

export interface KeyMaterial {
  key: Buffer;
  iv?: Buffer;
  publicKey?: Buffer;
  privateKey?: Buffer;
}

export interface KeyEntry {
  metadata: KeyMetadata;
  material: KeyMaterial;
}

export class KeyManager extends EventEmitter {
  private readonly config: KeyConfig;
  private readonly cryptoService: CryptoService;
  private activeKeys: Map<string, KeyEntry>;
  private keyHistory: Map<string, KeyEntry[]>;
  private rotationInterval: NodeJS.Timeout | null = null;

  constructor(config: KeyConfig, cryptoService: CryptoService) {
    super();
    this.config = config;
    this.cryptoService = cryptoService;
    this.activeKeys = new Map();
    this.keyHistory = new Map();

    // Start key rotation if enabled
    if (this.config.rotationPeriod > 0) {
      this.startKeyRotation();
    }
  }

  async createKey(
    keyType: string,
    metadata?: Partial<KeyMetadata>
  ): Promise<KeyEntry> {
    try {
      const keyId = this.generateKeyId();
      const now = Date.now();

      const keyMetadata: KeyMetadata = {
        id: keyId,
        type: keyType,
        algorithm: this.config.algorithm,
        createdAt: now,
        expiresAt: now + this.config.rotationPeriod,
        status: 'active',
        version: 1,
        ...metadata
      };

      const keyMaterial = await this.generateKeyMaterial(keyType);
      const keyEntry: KeyEntry = {
        metadata: keyMetadata,
        material: keyMaterial
      };

      // Store key
      this.activeKeys.set(keyId, keyEntry);
      this.keyHistory.set(keyId, [keyEntry]);

      this.emit('key-created', { keyId, type: keyType });
      logger.info('Key created', { keyId, type: keyType });

      return keyEntry;

    } catch (error) {
      logger.error('Failed to create key', { keyType }, error as Error);
      throw error;
    }
  }

  async getKey(keyId: string): Promise<KeyEntry | undefined> {
    const key = this.activeKeys.get(keyId);
    if (!key) {
      logger.warn('Key not found', { keyId });
      return undefined;
    }

    if (key.metadata.status === 'revoked') {
      logger.warn('Attempted to access revoked key', { keyId });
      return undefined;
    }

    if (key.metadata.expiresAt < Date.now()) {
      key.metadata.status = 'expired';
      logger.warn('Attempted to access expired key', { keyId });
      return undefined;
    }

    return key;
  }

  async rotateKey(keyId: string): Promise<KeyEntry> {
    try {
      const currentKey = await this.getKey(keyId);
      if (!currentKey) {
        throw new Error(`Key not found: ${keyId}`);
      }

      // Create new version
      const now = Date.now();
      const newKeyMaterial = await this.generateKeyMaterial(currentKey.metadata.type);
      const newKeyEntry: KeyEntry = {
        metadata: {
          ...currentKey.metadata,
          createdAt: now,
          expiresAt: now + this.config.rotationPeriod,
          version: currentKey.metadata.version + 1
        },
        material: newKeyMaterial
      };

      // Update storage
      this.activeKeys.set(keyId, newKeyEntry);
      const history = this.keyHistory.get(keyId) || [];
      history.push(newKeyEntry);
      this.keyHistory.set(keyId, history);

      this.emit('key-rotated', { keyId, version: newKeyEntry.metadata.version });
      logger.info('Key rotated', { keyId, version: newKeyEntry.metadata.version });

      return newKeyEntry;

    } catch (error) {
      logger.error('Failed to rotate key', { keyId }, error as Error);
      throw error;
    }
  }

  async revokeKey(keyId: string): Promise<void> {
    try {
      const key = this.activeKeys.get(keyId);
      if (!key) {
        throw new Error(`Key not found: ${keyId}`);
      }

      // Update status
      key.metadata.status = 'revoked';
      
      // Remove from active keys
      this.activeKeys.delete(keyId);

      this.emit('key-revoked', { keyId });
      logger.info('Key revoked', { keyId });

    } catch (error) {
      logger.error('Failed to revoke key', { keyId }, error as Error);
      throw error;
    }
  }

  async backupKeys(): Promise<{ [keyId: string]: KeyEntry[] }> {
    if (!this.config.backupEnabled) {
      throw new Error('Key backup is not enabled');
    }

    try {
      const backup: { [keyId: string]: KeyEntry[] } = {};
      
      for (const [keyId, history] of this.keyHistory.entries()) {
        backup[keyId] = history;
      }

      this.emit('keys-backed-up', { 
        timestamp: Date.now(),
        keyCount: this.activeKeys.size
      });

      logger.info('Keys backed up', { 
        keyCount: this.activeKeys.size,
        historyCount: this.keyHistory.size
      });

      return backup;

    } catch (error) {
      logger.error('Failed to backup keys', {}, error as Error);
      throw error;
    }
  }

  async restoreKeys(backup: { [keyId: string]: KeyEntry[] }): Promise<void> {
    try {
      this.activeKeys.clear();
      this.keyHistory.clear();

      for (const [keyId, history] of Object.entries(backup)) {
        this.keyHistory.set(keyId, history);
        
        // Restore latest version as active if not expired/revoked
        const latestVersion = history[history.length - 1];
        if (
          latestVersion.metadata.status === 'active' &&
          latestVersion.metadata.expiresAt > Date.now()
        ) {
          this.activeKeys.set(keyId, latestVersion);
        }
      }

      this.emit('keys-restored', {
        timestamp: Date.now(),
        keyCount: this.activeKeys.size
      });

      logger.info('Keys restored', {
        activeCount: this.activeKeys.size,
        historyCount: this.keyHistory.size
      });

    } catch (error) {
      logger.error('Failed to restore keys', {}, error as Error);
      throw error;
    }
  }

  async listKeys(): Promise<KeyEntry[]> {
    return Array.from(this.activeKeys.values());
  }

  private async generateKeyMaterial(keyType: string): Promise<KeyMaterial> {
    if (this.config.keyType === 'symmetric') {
      const key = this.cryptoService.generateKey();
      const iv = randomBytes(12);  // For AES-GCM
      return { key, iv };
    } else {
      // Generate RSA key pair for asymmetric encryption
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,  // Key size in bits
        publicKeyEncoding: {
          type: 'spki',
          format: 'der'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'der'
        }
      });

      return {
        key: privateKey,  // Use private key as main key
        publicKey: publicKey,
        privateKey: privateKey
      };
    }
  }

  private generateKeyId(): string {
    const random = randomBytes(16);
    const timestamp = Buffer.from(Date.now().toString());
    return createHash('sha256')
      .update(Buffer.concat([random, timestamp]))
      .digest('hex')
      .slice(0, 32);
  }

  private startKeyRotation(): void {
    if (this.rotationInterval) {
      return;
    }

    this.rotationInterval = setInterval(async () => {
      try {
        for (const [keyId, key] of this.activeKeys.entries()) {
          if (key.metadata.expiresAt <= Date.now()) {
            await this.rotateKey(keyId);
          }
        }
      } catch (error) {
        logger.error('Error during key rotation', {}, error as Error);
      }
    }, Math.min(this.config.rotationPeriod / 10, 3600000)); // Check at least hourly
  }

  shutdown(): void {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
  }
} 