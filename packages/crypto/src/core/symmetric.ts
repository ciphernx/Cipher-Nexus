import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export interface SymmetricKey {
  key: Buffer;
  iv: Buffer;
}

export class AES {
  static readonly KEY_SIZE = 32; // 256 bits
  static readonly IV_SIZE = 16;  // 128 bits

  /**
   * Generate a new AES key
   * @returns {Promise<SymmetricKey>} Generated key and IV
   */
  static async generateKey(): Promise<SymmetricKey> {
    return {
      key: randomBytes(AES.KEY_SIZE),
      iv: randomBytes(AES.IV_SIZE)
    };
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {Buffer} data - Data to encrypt
   * @param {SymmetricKey} key - Encryption key
   * @returns {Promise<Buffer>} Encrypted data
   */
  static async encrypt(data: Buffer, { key, iv }: SymmetricKey): Promise<Buffer> {
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Combine IV, encrypted data, and auth tag
    return Buffer.concat([iv, encrypted, authTag]);
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param {Buffer} encryptedData - Data to decrypt
   * @param {Buffer} key - Decryption key
   * @returns {Promise<Buffer>} Decrypted data
   */
  static async decrypt(encryptedData: Buffer, key: Buffer): Promise<Buffer> {
    const iv = encryptedData.subarray(0, AES.IV_SIZE);
    const authTag = encryptedData.subarray(encryptedData.length - 16);
    const data = encryptedData.subarray(AES.IV_SIZE, encryptedData.length - 16);
    
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }
} 