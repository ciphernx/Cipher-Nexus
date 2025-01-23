import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import { createCipheriv, createDecipheriv, randomBytes, CipherGCM, DecipherGCM } from 'crypto';

export interface CryptoConfig {
  algorithm: string;
  keySize: number;
  ivSize: number;
  tagLength: number;
}

export interface EncryptionResult {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
  key?: Buffer;
}

export interface DecryptionResult {
  plaintext: Buffer;
}

export class CryptoService extends EventEmitter {
  private readonly config: CryptoConfig;

  constructor(config: Partial<CryptoConfig> = {}) {
    super();
    this.config = {
      algorithm: config.algorithm || 'aes-256-gcm',
      keySize: config.keySize || 32,
      ivSize: config.ivSize || 12,
      tagLength: config.tagLength || 16
    };
  }

  async encrypt(plaintext: Buffer, key?: Buffer): Promise<EncryptionResult> {
    try {
      // Generate key if not provided
      const encryptionKey = key || randomBytes(this.config.keySize);
      
      // Generate IV
      const iv = randomBytes(this.config.ivSize);

      // Create cipher
      const cipher = createCipheriv(
        this.config.algorithm,
        encryptionKey,
        iv
      ) as CipherGCM;

      // Encrypt data
      const ciphertext = Buffer.concat([
        cipher.update(plaintext),
        cipher.final()
      ]);

      // Get authentication tag
      const tag = cipher.getAuthTag();

      const result: EncryptionResult = {
        ciphertext,
        iv,
        tag,
        key: key ? undefined : encryptionKey
      };

      this.emit('encryption-complete', { 
        success: true,
        dataSize: plaintext.length
      });

      logger.debug('Data encrypted successfully', {
        algorithm: this.config.algorithm,
        plaintextSize: plaintext.length,
        ciphertextSize: ciphertext.length
      });

      return result;

    } catch (error) {
      logger.error('Encryption failed', {}, error as Error);
      this.emit('encryption-error', { error });
      throw error;
    }
  }

  async decrypt(
    ciphertext: Buffer,
    key: Buffer,
    iv: Buffer,
    tag: Buffer
  ): Promise<DecryptionResult> {
    try {
      // Create decipher
      const decipher = createDecipheriv(
        this.config.algorithm,
        key,
        iv
      ) as DecipherGCM;

      // Set auth tag
      decipher.setAuthTag(tag);

      // Decrypt data
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);

      this.emit('decryption-complete', {
        success: true,
        dataSize: ciphertext.length
      });

      logger.debug('Data decrypted successfully', {
        algorithm: this.config.algorithm,
        ciphertextSize: ciphertext.length,
        plaintextSize: plaintext.length
      });

      return { plaintext };

    } catch (error) {
      logger.error('Decryption failed', {}, error as Error);
      this.emit('decryption-error', { error });
      throw error;
    }
  }

  generateKey(): Buffer {
    return randomBytes(this.config.keySize);
  }

  validateConfig(): boolean {
    const validAlgorithms = ['aes-256-gcm', 'aes-192-gcm', 'aes-128-gcm'];
    
    if (!validAlgorithms.includes(this.config.algorithm)) {
      throw new Error(`Unsupported algorithm: ${this.config.algorithm}`);
    }

    if (this.config.keySize !== 32 && this.config.keySize !== 24 && this.config.keySize !== 16) {
      throw new Error(`Invalid key size: ${this.config.keySize}`);
    }

    if (this.config.ivSize !== 12) {
      throw new Error(`Invalid IV size: ${this.config.ivSize}`);
    }

    if (this.config.tagLength !== 16) {
      throw new Error(`Invalid tag length: ${this.config.tagLength}`);
    }

    return true;
  }
} 