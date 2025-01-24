import { EncryptionConfig, EncryptionKey, EncryptedData } from '../types';
import { randomBytes, createCipheriv, createDecipheriv, generateKeyPairSync } from 'crypto';

export class Encryption {
  constructor(private config: EncryptionConfig) {}

  async generateKeys(): Promise<EncryptionKey> {
    switch (this.config.algorithm) {
      case 'RSA':
        return this.generateRSAKeys();
      case 'AES':
        return this.generateAESKeys();
      case 'FHE':
        return this.generateFHEKeys();
      default:
        throw new Error(`Unsupported algorithm: ${this.config.algorithm}`);
    }
  }

  async encrypt(data: any, key: string): Promise<EncryptedData> {
    switch (this.config.algorithm) {
      case 'RSA':
        return this.encryptRSA(data, key);
      case 'AES':
        return this.encryptAES(data, key);
      case 'FHE':
        return this.encryptFHE(data, key);
      default:
        throw new Error(`Unsupported algorithm: ${this.config.algorithm}`);
    }
  }

  async decrypt(encryptedData: EncryptedData, key: string): Promise<any> {
    switch (this.config.algorithm) {
      case 'RSA':
        return this.decryptRSA(encryptedData, key);
      case 'AES':
        return this.decryptAES(encryptedData, key);
      case 'FHE':
        return this.decryptFHE(encryptedData, key);
      default:
        throw new Error(`Unsupported algorithm: ${this.config.algorithm}`);
    }
  }

  private generateRSAKeys(): EncryptionKey {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: this.config.keySize,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    return {
      publicKey,
      privateKey
    };
  }

  private generateAESKeys(): EncryptionKey {
    const key = randomBytes(this.config.keySize / 8).toString('hex');
    return {
      publicKey: key,
      privateKey: key
    };
  }

  private generateFHEKeys(): EncryptionKey {
    // TODO: Implement FHE key generation
    throw new Error('FHE key generation not implemented yet');
  }

  private async encryptRSA(data: any, publicKey: string): Promise<EncryptedData> {
    const { publicEncrypt } = await import('crypto');
    const buffer = Buffer.from(JSON.stringify(data));
    const encrypted = publicEncrypt(publicKey, buffer);
    
    return {
      data: encrypted.toString('base64')
    };
  }

  private async encryptAES(data: any, key: string): Promise<EncryptedData> {
    const iv = randomBytes(16);
    const cipher = createCipheriv(
      `aes-${this.config.keySize}-${this.config.mode || 'gcm'}`,
      Buffer.from(key, 'hex'),
      iv
    );

    const buffer = Buffer.from(JSON.stringify(data));
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      data: encrypted.toString('base64'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  private async encryptFHE(data: any, key: string): Promise<EncryptedData> {
    // TODO: Implement FHE encryption
    throw new Error('FHE encryption not implemented yet');
  }

  private async decryptRSA(encryptedData: EncryptedData, privateKey: string): Promise<any> {
    const { privateDecrypt } = await import('crypto');
    const buffer = Buffer.from(encryptedData.data, 'base64');
    const decrypted = privateDecrypt(privateKey, buffer);
    
    return JSON.parse(decrypted.toString());
  }

  private async decryptAES(encryptedData: EncryptedData, key: string): Promise<any> {
    if (!encryptedData.iv || !encryptedData.tag) {
      throw new Error('Missing IV or authentication tag for AES decryption');
    }

    const decipher = createDecipheriv(
      `aes-${this.config.keySize}-${this.config.mode || 'gcm'}`,
      Buffer.from(key, 'hex'),
      Buffer.from(encryptedData.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    const buffer = Buffer.from(encryptedData.data, 'base64');
    const decrypted = Buffer.concat([decipher.update(buffer), decipher.final()]);
    
    return JSON.parse(decrypted.toString());
  }

  private async decryptFHE(encryptedData: EncryptedData, key: string): Promise<any> {
    // TODO: Implement FHE decryption
    throw new Error('FHE decryption not implemented yet');
  }
}
