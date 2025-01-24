import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface RecordLayerOptions {
  maxRecordSize?: number;
  keySize?: number;
  ivSize?: number;
}

export class RecordLayer {
  private static readonly DEFAULT_MAX_RECORD_SIZE = 16384;
  private static readonly DEFAULT_KEY_SIZE = 32;
  private static readonly DEFAULT_IV_SIZE = 12;
  private static readonly HEADER_SIZE = 5;
  private static readonly SEQUENCE_SIZE = 8;

  private readonly maxRecordSize: number;
  private readonly keySize: number;
  private readonly ivSize: number;
  private sequenceNumber: bigint;

  constructor(options: RecordLayerOptions = {}) {
    this.maxRecordSize = options.maxRecordSize || RecordLayer.DEFAULT_MAX_RECORD_SIZE;
    this.keySize = options.keySize || RecordLayer.DEFAULT_KEY_SIZE;
    this.ivSize = options.ivSize || RecordLayer.DEFAULT_IV_SIZE;
    this.sequenceNumber = BigInt(0);
  }

  /**
   * Encrypt a record
   * @param data Data to encrypt
   * @param key Encryption key
   * @param iv Initial vector
   * @param additionalData Additional authenticated data
   * @returns Encrypted record
   */
  public encrypt(
    data: Buffer,
    key: Buffer,
    iv: Buffer,
    additionalData?: Buffer
  ): Buffer {
    this.validateInputs(key, iv);

    if (data.length > this.maxRecordSize) {
      throw new Error(`Record size exceeds maximum (${this.maxRecordSize} bytes)`);
    }

    // Construct nonce by XORing IV with sequence number
    const nonce = Buffer.alloc(this.ivSize);
    iv.copy(nonce);
    const sequenceBuffer = Buffer.alloc(8);
    sequenceBuffer.writeBigUInt64BE(this.sequenceNumber);
    for (let i = 0; i < 8; i++) {
      nonce[i + 4] ^= sequenceBuffer[i];
    }

    // Encrypt data
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    if (additionalData) {
      cipher.setAAD(additionalData);
    }
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Increment sequence number
    this.sequenceNumber = (this.sequenceNumber + BigInt(1)) % (BigInt(1) << BigInt(64));

    // Construct record
    const record = Buffer.alloc(RecordLayer.HEADER_SIZE + ciphertext.length + 16);
    record.writeUInt16BE(ciphertext.length + 16, 3); // Record length
    ciphertext.copy(record, RecordLayer.HEADER_SIZE);
    tag.copy(record, RecordLayer.HEADER_SIZE + ciphertext.length);

    return record;
  }

  /**
   * Decrypt a record
   * @param record Record to decrypt
   * @param key Decryption key
   * @param iv Initial vector
   * @param additionalData Additional authenticated data
   * @returns Decrypted data
   */
  public decrypt(
    record: Buffer,
    key: Buffer,
    iv: Buffer,
    additionalData?: Buffer
  ): Buffer {
    this.validateInputs(key, iv);

    // Parse record
    const recordLength = record.readUInt16BE(3);
    if (recordLength > this.maxRecordSize + 16) {
      throw new Error(`Record size exceeds maximum (${this.maxRecordSize} bytes)`);
    }

    const ciphertext = record.slice(RecordLayer.HEADER_SIZE, RecordLayer.HEADER_SIZE + recordLength - 16);
    const tag = record.slice(RecordLayer.HEADER_SIZE + recordLength - 16, RecordLayer.HEADER_SIZE + recordLength);

    // Construct nonce by XORing IV with sequence number
    const nonce = Buffer.alloc(this.ivSize);
    iv.copy(nonce);
    const sequenceBuffer = Buffer.alloc(8);
    sequenceBuffer.writeBigUInt64BE(this.sequenceNumber);
    for (let i = 0; i < 8; i++) {
      nonce[i + 4] ^= sequenceBuffer[i];
    }

    // Decrypt data
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    if (additionalData) {
      decipher.setAAD(additionalData);
    }
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // Increment sequence number
    this.sequenceNumber = (this.sequenceNumber + BigInt(1)) % (BigInt(1) << BigInt(64));

    return plaintext;
  }

  /**
   * Get current sequence number
   * @returns Current sequence number
   */
  public getSequenceNumber(): bigint {
    return this.sequenceNumber;
  }

  /**
   * Reset sequence number to 0
   */
  public resetSequenceNumber(): void {
    this.sequenceNumber = BigInt(0);
  }

  private validateInputs(key: Buffer, iv: Buffer): void {
    if (key.length !== this.keySize) {
      throw new Error(`Key must be ${this.keySize} bytes`);
    }
    if (iv.length !== this.ivSize) {
      throw new Error(`IV must be ${this.ivSize} bytes`);
    }
  }
} 