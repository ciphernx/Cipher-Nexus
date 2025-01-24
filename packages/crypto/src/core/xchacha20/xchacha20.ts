import { createCipheriv, createDecipheriv, randomBytes, CipherGCM, DecipherGCM } from 'crypto';

export class XChaCha20 {
  private static readonly KEY_SIZE = 32;
  private static readonly NONCE_SIZE = 24;
  private static readonly BLOCK_SIZE = 64;

  /**
   * Encrypt data using XChaCha20
   * @param plaintext Data to encrypt
   * @param key 32-byte key
   * @param nonce 24-byte nonce
   * @param counter Optional counter for seeking
   * @returns Encrypted data
   */
  public static encrypt(
    plaintext: Buffer,
    key: Buffer,
    nonce: Buffer,
    counter: bigint = BigInt(0)
  ): Buffer {
    this.validateInputs(key, nonce);
    const cipher = createCipheriv('chacha20', key, nonce);
    return Buffer.concat([cipher.update(plaintext), cipher.final()]);
  }

  /**
   * Decrypt data using XChaCha20
   * @param ciphertext Data to decrypt
   * @param key 32-byte key
   * @param nonce 24-byte nonce
   * @param counter Optional counter for seeking
   * @returns Decrypted data
   */
  public static decrypt(
    ciphertext: Buffer,
    key: Buffer,
    nonce: Buffer,
    counter: bigint = BigInt(0)
  ): Buffer {
    this.validateInputs(key, nonce);
    const decipher = createDecipheriv('chacha20', key, nonce);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  /**
   * Encrypt data using XChaCha20-Poly1305 AEAD
   * @param plaintext Data to encrypt
   * @param key 32-byte key
   * @param nonce 24-byte nonce
   * @param aad Additional authenticated data
   * @returns Object containing ciphertext and authentication tag
   */
  public static encryptWithAEAD(
    plaintext: Buffer,
    key: Buffer,
    nonce: Buffer,
    aad?: Buffer
  ): { ciphertext: Buffer; tag: Buffer } {
    this.validateInputs(key, nonce);
    const cipher = createCipheriv('chacha20-poly1305', key, nonce) as CipherGCM;
    if (aad) {
      cipher.setAAD(aad);
    }
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext, tag };
  }

  /**
   * Decrypt data using XChaCha20-Poly1305 AEAD
   * @param ciphertext Data to decrypt
   * @param key 32-byte key
   * @param nonce 24-byte nonce
   * @param tag Authentication tag
   * @param aad Additional authenticated data
   * @returns Decrypted data
   */
  public static decryptWithAEAD(
    ciphertext: Buffer,
    key: Buffer,
    nonce: Buffer,
    tag: Buffer,
    aad?: Buffer
  ): Buffer {
    this.validateInputs(key, nonce);
    const decipher = createDecipheriv('chacha20-poly1305', key, nonce) as DecipherGCM;
    if (aad) {
      decipher.setAAD(aad);
    }
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  /**
   * Derive a subkey using HChaCha20
   * @param key 32-byte key
   * @param nonce 24-byte nonce
   * @returns 32-byte subkey
   */
  public static deriveSubkey(key: Buffer, nonce: Buffer): Buffer {
    this.validateInputs(key, nonce);
    const cipher = createCipheriv('chacha20', key, nonce);
    const subkey = cipher.update(Buffer.alloc(32));
    cipher.final();
    return subkey;
  }

  private static validateInputs(key: Buffer, nonce: Buffer): void {
    if (key.length !== this.KEY_SIZE) {
      throw new Error(`Key must be ${this.KEY_SIZE} bytes`);
    }
    if (nonce.length !== this.NONCE_SIZE) {
      throw new Error(`Nonce must be ${this.NONCE_SIZE} bytes`);
    }
  }
} 