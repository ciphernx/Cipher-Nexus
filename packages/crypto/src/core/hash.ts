import { createHash, createHmac, createSign, createVerify } from 'crypto';

export class Hash {
  /**
   * Compute SHA-256 hash of data
   * @param {Buffer} data - Data to hash
   * @returns {Promise<Buffer>} Hash value
   */
  static async sha256(data: Buffer): Promise<Buffer> {
    return createHash('sha256').update(data).digest();
  }

  /**
   * Compute HMAC using SHA-256
   * @param {Buffer} data - Data to authenticate
   * @param {Buffer} key - HMAC key
   * @returns {Promise<Buffer>} HMAC value
   */
  static async hmac(data: Buffer, key: Buffer): Promise<Buffer> {
    return createHmac('sha256', key).update(data).digest();
  }
}

export class Signature {
  /**
   * Sign data using RSA-SHA256
   * @param {Buffer} data - Data to sign
   * @param {string} privateKey - Private key in PEM format
   * @returns {Promise<Buffer>} Signature
   */
  static async sign(data: Buffer, privateKey: string): Promise<Buffer> {
    const signer = createSign('SHA256');
    signer.update(data);
    return signer.sign(privateKey);
  }

  /**
   * Verify RSA-SHA256 signature
   * @param {Buffer} data - Original data
   * @param {Buffer} signature - Signature to verify
   * @param {string} publicKey - Public key in PEM format
   * @returns {Promise<boolean>} Whether signature is valid
   */
  static async verify(data: Buffer, signature: Buffer, publicKey: string): Promise<boolean> {
    const verifier = createVerify('SHA256');
    verifier.update(data);
    return verifier.verify(publicKey, signature);
  }
} 