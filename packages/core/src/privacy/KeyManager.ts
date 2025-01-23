import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { HomomorphicKeyPair, SecurityParams } from './HomomorphicEncryption';

/**
 * Key storage configuration
 */
export interface KeyStorageConfig {
  storageType: 'memory' | 'file' | 'database';
  encryptionKey?: string;  // Master key for encrypting stored keys
  storagePath?: string;    // Path for file storage
  databaseUrl?: string;    // URL for database storage
}

/**
 * Key metadata
 */
export interface KeyMetadata {
  keyId: string;
  createdAt: Date;
  expiresAt?: Date;
  algorithm: string;
  keySize: number;
  status: 'active' | 'expired' | 'revoked';
  purpose: string[];
}

export class KeyManager {
  private keys: Map<string, {
    keyPair: HomomorphicKeyPair;
    metadata: KeyMetadata;
  }> = new Map();

  private readonly encryptionKey: Buffer;

  constructor(private readonly config: KeyStorageConfig) {
    if (config.encryptionKey) {
      this.encryptionKey = Buffer.from(config.encryptionKey, 'hex');
    } else {
      this.encryptionKey = randomBytes(32);
    }
  }

  /**
   * Store a key pair with metadata
   * @param keyPair Key pair to store
   * @param metadata Key metadata
   * @returns Key ID
   */
  async storeKeyPair(
    keyPair: HomomorphicKeyPair,
    metadata: Omit<KeyMetadata, 'keyId' | 'createdAt'>
  ): Promise<string> {
    const keyId = this.generateKeyId();
    const fullMetadata: KeyMetadata = {
      ...metadata,
      keyId,
      createdAt: new Date()
    };

    // Encrypt private key if present
    const encryptedKeyPair = await this.encryptKeyPair(keyPair);

    // Store key pair and metadata
    this.keys.set(keyId, {
      keyPair: encryptedKeyPair,
      metadata: fullMetadata
    });

    // Persist to storage
    await this.persistKeys();

    return keyId;
  }

  /**
   * Retrieve a key pair by ID
   * @param keyId Key identifier
   * @returns Key pair and metadata
   */
  async getKeyPair(keyId: string): Promise<{
    keyPair: HomomorphicKeyPair;
    metadata: KeyMetadata;
  } | null> {
    const entry = this.keys.get(keyId);
    if (!entry) return null;

    // Check key status
    if (entry.metadata.status !== 'active') {
      throw new Error(`Key ${keyId} is ${entry.metadata.status}`);
    }

    // Check expiration
    if (entry.metadata.expiresAt && entry.metadata.expiresAt < new Date()) {
      entry.metadata.status = 'expired';
      await this.persistKeys();
      throw new Error(`Key ${keyId} has expired`);
    }

    // Decrypt private key if present
    const decryptedKeyPair = await this.decryptKeyPair(entry.keyPair);

    return {
      keyPair: decryptedKeyPair,
      metadata: entry.metadata
    };
  }

  /**
   * List all key metadata
   * @returns Array of key metadata
   */
  listKeys(): KeyMetadata[] {
    return Array.from(this.keys.values()).map(entry => entry.metadata);
  }

  /**
   * Revoke a key pair
   * @param keyId Key identifier
   */
  async revokeKey(keyId: string): Promise<void> {
    const entry = this.keys.get(keyId);
    if (!entry) {
      throw new Error(`Key ${keyId} not found`);
    }

    entry.metadata.status = 'revoked';
    await this.persistKeys();
  }

  /**
   * Rotate a key pair
   * @param keyId Key identifier
   * @param params Security parameters for new key
   * @returns New key ID
   */
  async rotateKey(
    keyId: string,
    params?: SecurityParams
  ): Promise<string> {
    const entry = this.keys.get(keyId);
    if (!entry) {
      throw new Error(`Key ${keyId} not found`);
    }

    // Create new key pair
    const he = new HomomorphicEncryption();
    const newKeyPair = await he.generateKeyPair(params);

    // Store new key with same metadata (except dates)
    const { metadata } = entry;
    const newKeyId = await this.storeKeyPair(newKeyPair, {
      algorithm: metadata.algorithm,
      keySize: metadata.keySize,
      status: 'active',
      purpose: metadata.purpose,
      expiresAt: metadata.expiresAt
    });

    // Revoke old key
    await this.revokeKey(keyId);

    return newKeyId;
  }

  /**
   * Generate a unique key ID
   */
  private generateKeyId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Encrypt a key pair for storage
   */
  private async encryptKeyPair(keyPair: HomomorphicKeyPair): Promise<HomomorphicKeyPair> {
    if (!keyPair.privateKey) return keyPair;

    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    const privateKeyString = JSON.stringify(keyPair.privateKey);
    const encrypted = Buffer.concat([
      cipher.update(privateKeyString, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();

    return {
      publicKey: keyPair.publicKey,
      privateKey: {
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64')
      } as any
    };
  }

  /**
   * Decrypt a stored key pair
   */
  private async decryptKeyPair(keyPair: HomomorphicKeyPair): Promise<HomomorphicKeyPair> {
    if (!keyPair.privateKey || !('encrypted' in keyPair.privateKey)) return keyPair;

    const encrypted = Buffer.from(keyPair.privateKey.encrypted, 'base64');
    const iv = Buffer.from(keyPair.privateKey.iv, 'base64');
    const authTag = Buffer.from(keyPair.privateKey.authTag, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return {
      publicKey: keyPair.publicKey,
      privateKey: JSON.parse(decrypted.toString())
    };
  }

  /**
   * Persist keys to configured storage
   */
  private async persistKeys(): Promise<void> {
    switch (this.config.storageType) {
      case 'file':
        await this.persistToFile();
        break;
      case 'database':
        await this.persistToDatabase();
        break;
      case 'memory':
      default:
        // No persistence needed for memory storage
        break;
    }
  }

  /**
   * Persist keys to file
   */
  private async persistToFile(): Promise<void> {
    // Implementation for file persistence
    // This would write the encrypted keys to the configured file path
  }

  /**
   * Persist keys to database
   */
  private async persistToDatabase(): Promise<void> {
    // Implementation for database persistence
    // This would store the encrypted keys in the configured database
  }
} 