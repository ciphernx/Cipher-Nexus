import { HomomorphicEncryption } from '../HomomorphicEncryption';
import { 
  HomomorphicConfig,
  EncryptedData,
  HomomorphicOp,
  HomomorphicScheme
} from '../types';
import { KeyManager } from '../KeyManager';
import { randomBytes } from 'crypto';
import * as bigintCrypto from 'bigint-crypto-utils';

/**
 * ElGamal ciphertext structure
 */
interface ElGamalCiphertext {
  c1: bigint;  // First component (g^r)
  c2: bigint;  // Second component (h^r * m)
}

/**
 * ElGamal homomorphic encryption implementation
 * Supports multiplicative homomorphic operations
 */
export class ElGamalEncryption extends HomomorphicEncryption {
  private p: bigint;  // Prime modulus
  private g: bigint;  // Generator
  
  constructor(config: HomomorphicConfig, keyManager: KeyManager) {
    super(config, keyManager);
    if (config.scheme !== HomomorphicScheme.ELGAMAL) {
      throw new Error('Invalid scheme for ElGamal encryption');
    }

    // Initialize parameters
    this.p = this.generatePrime(config.securityLevel);
    this.g = this.findGenerator(this.p);
  }

  /**
   * Encrypt data using ElGamal encryption
   */
  async encrypt(data: number[] | bigint[], keyId: string): Promise<EncryptedData> {
    const startTime = Date.now();
    try {
      // Convert numbers to bigints if needed
      const messages = data.map(d => typeof d === 'number' ? BigInt(d) : d);
      
      // Get public key
      const publicKey = await this.keyManager.getPublicKey(keyId);
      if (!publicKey) throw new Error('Public key not found');

      // Encrypt each message
      const ciphertexts = await Promise.all(messages.map(async m => {
        const r = this.generateRandomValue(publicKey.p);
        const c1 = this.modPow(publicKey.g, r, publicKey.p);
        const c2 = (this.modPow(publicKey.h, r, publicKey.p) * m) % publicKey.p;
        return { c1, c2 };
      }));

      // Record metrics
      this.recordMetrics({
        operation: HomomorphicOp.ENCRYPT,
        startTime,
        inputSize: data.length,
        success: true
      });

      return {
        data: ciphertexts,
        keyId,
        scheme: HomomorphicScheme.ELGAMAL
      };

    } catch (error) {
      // Record failure metrics
      this.recordMetrics({
        operation: HomomorphicOp.ENCRYPT,
        startTime,
        inputSize: data.length,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Decrypt data using ElGamal decryption
   */
  async decrypt(encrypted: EncryptedData, keyId: string): Promise<number[] | bigint[]> {
    const startTime = Date.now();
    try {
      // Get private key
      const privateKey = await this.keyManager.getPrivateKey(keyId);
      if (!privateKey) throw new Error('Private key not found');

      // Decrypt each ciphertext
      const ciphertexts = encrypted.data as ElGamalCiphertext[];
      const messages = ciphertexts.map(ct => {
        const s = this.modPow(ct.c1, privateKey.x, privateKey.p);
        const sInv = this.modInverse(s, privateKey.p);
        return (ct.c2 * sInv) % privateKey.p;
      });

      // Record metrics
      this.recordMetrics({
        operation: HomomorphicOp.DECRYPT,
        startTime,
        inputSize: ciphertexts.length,
        success: true
      });

      return messages;

    } catch (error) {
      // Record failure metrics
      this.recordMetrics({
        operation: HomomorphicOp.DECRYPT,
        startTime,
        inputSize: (encrypted.data as ElGamalCiphertext[]).length,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Multiply two encrypted values
   */
  async multiply(a: EncryptedData, b: EncryptedData): Promise<EncryptedData> {
    const startTime = Date.now();
    try {
      if (a.keyId !== b.keyId) {
        throw new Error('Cannot multiply ciphertexts with different keys');
      }

      const ciphertextsA = a.data as ElGamalCiphertext[];
      const ciphertextsB = b.data as ElGamalCiphertext[];

      if (ciphertextsA.length !== ciphertextsB.length) {
        throw new Error('Cannot multiply ciphertexts of different lengths');
      }

      // Get public key for modulus
      const publicKey = await this.keyManager.getPublicKey(a.keyId);
      if (!publicKey) throw new Error('Public key not found');

      // Multiply corresponding ciphertexts
      const result = ciphertextsA.map((ctA, i) => {
        const ctB = ciphertextsB[i];
        return {
          c1: (ctA.c1 * ctB.c1) % publicKey.p,
          c2: (ctA.c2 * ctB.c2) % publicKey.p
        };
      });

      // Record metrics
      this.recordMetrics({
        operation: HomomorphicOp.MULTIPLY,
        startTime,
        inputSize: ciphertextsA.length,
        success: true
      });

      return {
        data: result,
        keyId: a.keyId,
        scheme: HomomorphicScheme.ELGAMAL
      };

    } catch (error) {
      // Record failure metrics
      this.recordMetrics({
        operation: HomomorphicOp.MULTIPLY,
        startTime,
        inputSize: (a.data as ElGamalCiphertext[]).length,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // ElGamal doesn't support homomorphic addition
  async add(a: EncryptedData, b: EncryptedData): Promise<EncryptedData> {
    throw new Error('Addition not supported in ElGamal encryption');
  }

  // ElGamal doesn't support these operations
  async relinearize(encrypted: EncryptedData): Promise<EncryptedData> {
    throw new Error('Relinearization not supported in ElGamal encryption');
  }

  async rotate(encrypted: EncryptedData, steps: number): Promise<EncryptedData> {
    throw new Error('Rotation not supported in ElGamal encryption');
  }

  async rescale(encrypted: EncryptedData): Promise<EncryptedData> {
    throw new Error('Rescaling not supported in ElGamal encryption');
  }

  /**
   * Generate prime number for given security level
   */
  private generatePrime(securityLevel: number): bigint {
    // Generate safe prime p = 2q + 1 where q is also prime
    const bits = securityLevel * 2; // Double size for safe prime
    while (true) {
      const q = bigintCrypto.prime(bits - 1);
      const p = q * BigInt(2) + BigInt(1);
      if (bigintCrypto.isProbablyPrime(p)) {
        return p;
      }
    }
  }

  /**
   * Find generator of multiplicative group
   */
  private findGenerator(p: bigint): bigint {
    const q = (p - BigInt(1)) / BigInt(2); // Order of subgroup
    
    // Try random values until we find a generator
    while (true) {
      const h = this.generateRandomValue(p - BigInt(1)) + BigInt(1);
      
      // Check if h is a generator
      const h1 = bigintCrypto.modPow(h, BigInt(2), p);
      const h2 = bigintCrypto.modPow(h, q, p);
      
      if (h1 !== BigInt(1) && h2 !== BigInt(1)) {
        return h;
      }
    }
  }

  /**
   * Generate random value in range [0, max)
   */
  private generateRandomValue(max: bigint): bigint {
    const bytes = max.toString(16).length / 2;
    while (true) {
      const value = this.bytesToBigint(randomBytes(bytes));
      if (value < max) {
        return value;
      }
    }
  }

  /**
   * Convert bigint to fixed-length byte array
   */
  private bigintToBytes(value: bigint, length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[length - 1 - i] = Number(value & BigInt(0xff));
      value = value >> BigInt(8);
    }
    return bytes;
  }

  /**
   * Convert byte array to bigint
   */
  private bytesToBigint(bytes: Uint8Array): bigint {
    let value = BigInt(0);
    for (const byte of bytes) {
      value = (value << BigInt(8)) | BigInt(byte);
    }
    return value;
  }

  private modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    if (modulus === BigInt(1)) return BigInt(0);
    let result = BigInt(1);
    base = base % modulus;
    while (exponent > BigInt(0)) {
      if (exponent % BigInt(2) === BigInt(1)) {
        result = (result * base) % modulus;
      }
      base = (base * base) % modulus;
      exponent = exponent / BigInt(2);
    }
    return result;
  }

  private modInverse(a: bigint, m: bigint): bigint {
    let [old_r, r] = [a, m];
    let [old_s, s] = [BigInt(1), BigInt(0)];
    let [old_t, t] = [BigInt(0), BigInt(1)];

    while (r !== BigInt(0)) {
      const quotient = old_r / r;
      [old_r, r] = [r, old_r - quotient * r];
      [old_s, s] = [s, old_s - quotient * s];
      [old_t, t] = [t, old_t - quotient * t];
    }

    if (old_r !== BigInt(1)) {
      throw new Error('Modular inverse does not exist');
    }

    return (old_s % m + m) % m;
  }
} 