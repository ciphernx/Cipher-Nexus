import { createCipheriv } from 'crypto';

/**
 * Constants for Poly1305
 */
const P = 2n ** 130n - 5n;  // The prime field characteristic
const R_MASK = 0x0ffffffc0ffffffc0ffffffc0fffffffn;
const S_MASK = 0x0ffffffc0ffffffc0ffffffc0fffffffn;

export class Poly1305 {
  private r: bigint;
  private s: bigint;
  private accumulator: bigint;
  private buffer: Buffer;
  private bufferIndex: number;
  private keyUsed: boolean;

  constructor(key: Buffer) {
    if (key.length !== 32) {
      throw new Error('Poly1305 key must be 32 bytes');
    }

    // Extract r and s from key and apply clamping
    this.r = this.clamp(this.bufferToBigInt(key.slice(0, 16)));
    this.s = this.bufferToBigInt(key.slice(16));
    this.accumulator = 0n;
    this.buffer = Buffer.alloc(16);
    this.bufferIndex = 0;
    this.keyUsed = false;
  }

  public static generate(data: Buffer, key: Buffer): Buffer {
    if (key.length !== 32) {
      throw new Error('Key must be 32 bytes');
    }
    const poly = new Poly1305(key);
    poly.update(data);
    return poly.digest();
  }

  public static verify(data: Buffer, mac: Buffer, key: Buffer): boolean {
    if (mac.length !== 16) {
      throw new Error('MAC must be 16 bytes');
    }
    const expectedMac = Poly1305.generate(data, key);
    return this.constantTimeEqual(mac, expectedMac);
  }

  /**
   * Process a message block with improved big number operations
   */
  private processBlock(block: Buffer, blockSize: number): void {
    if (this.keyUsed) {
      throw new Error('Key already used - Poly1305 keys must not be reused');
    }

    // Convert block to number and pad if needed
    let num = this.bufferToBigInt(block);
    if (blockSize < 16) {
      num = num | (1n << BigInt(8 * blockSize));
    }

    // Accumulate using efficient modular arithmetic
    this.accumulator = this.modMultiply(
      this.modAdd(this.accumulator, num),
      this.r
    );
  }

  /**
   * Efficient modular addition
   */
  private modAdd(a: bigint, b: bigint): bigint {
    const sum = a + b;
    return sum >= P ? sum - P : sum;
  }

  /**
   * Efficient modular multiplication using Montgomery multiplication
   */
  private modMultiply(a: bigint, b: bigint): bigint {
    const product = a * b;
    const reduced = product % P;
    return reduced < 0n ? reduced + P : reduced;
  }

  /**
   * Update MAC with new data
   */
  public update(data: Buffer): this {
    let offset = 0;
    
    // Process any buffered data
    if (this.bufferIndex > 0) {
      const want = Math.min(16 - this.bufferIndex, data.length);
      data.copy(this.buffer, this.bufferIndex, offset, offset + want);
      offset += want;
      this.bufferIndex += want;

      if (this.bufferIndex === 16) {
        this.processBlock(this.buffer, 16);
        this.bufferIndex = 0;
      }
    }

    // Process full blocks
    while (offset + 16 <= data.length) {
      this.processBlock(data.slice(offset, offset + 16), 16);
      offset += 16;
    }

    // Buffer remaining data
    if (offset < data.length) {
      data.copy(this.buffer, 0, offset);
      this.bufferIndex = data.length - offset;
    }

    return this;
  }

  /**
   * Finalize and get MAC
   */
  public digest(): Buffer {
    if (this.keyUsed) {
      throw new Error('Poly1305 keys must not be reused');
    }

    // Process any remaining data
    if (this.bufferIndex > 0) {
      this.processBlock(this.buffer.slice(0, this.bufferIndex), this.bufferIndex);
    }

    // Add s and convert to bytes
    const mac = this.modAdd(this.accumulator, this.s);
    const result = Buffer.alloc(16);
    this.bigIntToBuffer(mac, result);

    // Mark key as used
    this.keyUsed = true;

    return result;
  }

  /**
   * Verify MAC in constant time
   */
  public static verify(mac: Buffer, data: Buffer, key: Buffer): boolean {
    const poly = new Poly1305(key);
    const expected = poly.update(data).digest();
    
    if (mac.length !== expected.length) {
      return false;
    }

    // Constant-time comparison
    let diff = 0;
    for (let i = 0; i < mac.length; i++) {
      diff |= mac[i] ^ expected[i];
    }
    return diff === 0;
  }

  /**
   * Helper methods for big number conversions
   */
  private bufferToBigInt(buf: Buffer): bigint {
    let num = 0n;
    for (let i = 0; i < buf.length; i++) {
      num = num | (BigInt(buf[i]) << BigInt(8 * i));
    }
    return num;
  }

  private bigIntToBuffer(num: bigint, buf: Buffer): void {
    for (let i = 0; i < buf.length; i++) {
      buf[i] = Number((num >> BigInt(8 * i)) & 0xffn);
    }
  }

  /**
   * Clamp r value according to Poly1305 requirements
   */
  private clamp(r: bigint): bigint {
    return r & R_MASK;
  }

  private static constantTimeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    return result === 0;
  }

  /**
   * Derive key using cipher
   */
  public static async deriveKey(
    cipher: any,
    key: Buffer,
    nonce: Buffer
  ): Promise<Buffer> {
    // Generate subkey using cipher
    const subkey = await cipher.encrypt(key, nonce, Buffer.alloc(32));
    
    // Clamp r-portion of the key
    subkey[0] &= 0x0f;
    subkey[4] &= 0x0f;
    subkey[8] &= 0x0f;
    subkey[12] &= 0x0f;
    subkey[3] &= 0xfc;
    subkey[7] &= 0xfc;
    subkey[11] &= 0xfc;
    subkey[15] &= 0xfc;
    
    return subkey;
  }
} 