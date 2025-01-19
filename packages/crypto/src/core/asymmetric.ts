import { generateKeyPairSync, publicEncrypt, privateDecrypt, constants } from 'crypto';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export class RSA {
  static readonly KEY_SIZE = 2048;

  /**
   * Generate a new RSA key pair
   * @returns {Promise<KeyPair>} Generated public and private keys in PEM format
   */
  static async generateKeyPair(): Promise<KeyPair> {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: RSA.KEY_SIZE,
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

  /**
   * Encrypt data using RSA-OAEP
   * @param {Buffer} data - Data to encrypt
   * @param {string} publicKey - Public key in PEM format
   * @returns {Promise<Buffer>} Encrypted data
   */
  static async encrypt(data: Buffer, publicKey: string): Promise<Buffer> {
    return publicEncrypt(
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      data
    );
  }

  /**
   * Decrypt data using RSA-OAEP
   * @param {Buffer} encryptedData - Data to decrypt
   * @param {string} privateKey - Private key in PEM format
   * @returns {Promise<Buffer>} Decrypted data
   */
  static async decrypt(encryptedData: Buffer, privateKey: string): Promise<Buffer> {
    return privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedData
    );
  }
} 