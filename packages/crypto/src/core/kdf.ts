import { pbkdf2, randomBytes } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

export class KDF {
  private static readonly DEFAULT_ITERATIONS = 100000;
  private static readonly DEFAULT_KEY_LENGTH = 32; // 256 bits
  private static readonly SALT_LENGTH = 16;        // 128 bits

  /**
   * Generate a cryptographic key from a password using PBKDF2
   * @param {string} password - The password to derive key from
   * @param {number} keyLength - Length of the derived key in bytes (default: 32)
   * @param {number} iterations - Number of iterations (default: 100000)
   * @returns {Promise<{key: Buffer, salt: Buffer}>} Derived key and salt
   */
  static async deriveKey(
    password: string,
    keyLength: number = this.DEFAULT_KEY_LENGTH,
    iterations: number = this.DEFAULT_ITERATIONS
  ): Promise<{ key: Buffer; salt: Buffer }> {
    // Generate random salt
    const salt = randomBytes(this.SALT_LENGTH);

    // Derive key using PBKDF2-SHA256
    const key = await pbkdf2Async(
      password,
      salt,
      iterations,
      keyLength,
      'sha256'
    );

    return { key, salt };
  }

  /**
   * Verify a password against a known key and salt
   * @param {string} password - The password to verify
   * @param {Buffer} key - The known key to verify against
   * @param {Buffer} salt - The salt used to derive the known key
   * @param {number} keyLength - Length of the derived key in bytes (default: 32)
   * @param {number} iterations - Number of iterations (default: 100000)
   * @returns {Promise<boolean>} Whether the password is correct
   */
  static async verifyKey(
    password: string,
    key: Buffer,
    salt: Buffer,
    keyLength: number = this.DEFAULT_KEY_LENGTH,
    iterations: number = this.DEFAULT_ITERATIONS
  ): Promise<boolean> {
    // Derive key using the same parameters
    const derivedKey = await pbkdf2Async(
      password,
      salt,
      iterations,
      keyLength,
      'sha256'
    );

    // Compare keys in constant time
    if (key.length !== derivedKey.length) {
      return false;
    }

    let diff = 0;
    for (let i = 0; i < key.length; i++) {
      diff |= key[i] ^ derivedKey[i];
    }
    return diff === 0;
  }
} 