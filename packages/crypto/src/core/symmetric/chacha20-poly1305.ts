import { createCipheriv, createDecipheriv, CipherCCM, DecipherCCM } from 'crypto';

export interface ChaChaParams {
  key: Buffer;
  nonce: Buffer;
}

export class ChaCha20Poly1305 {
  private params: ChaChaParams;
  private cipher: CipherCCM;

  constructor(params: ChaChaParams) {
    this.validateParams(params);
    this.params = params;
    this.cipher = createCipheriv('chacha20-poly1305', params.key, params.nonce) as CipherCCM;
  }

  public static async encrypt(data: Buffer, params: ChaChaParams): Promise<{ ciphertext: Buffer; tag: Buffer }> {
    const cipher = createCipheriv('chacha20-poly1305', params.key, params.nonce) as CipherCCM;
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    return { ciphertext, tag: cipher.getAuthTag() };
  }

  public static async decrypt(ciphertext: Buffer, tag: Buffer, params: ChaChaParams): Promise<Buffer> {
    const decipher = createDecipheriv('chacha20-poly1305', params.key, params.nonce) as DecipherCCM;
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  public update(data: Buffer): Buffer {
    return this.cipher.update(data);
  }

  public async final(): Promise<{ finalCiphertext: Buffer; tag: Buffer }> {
    const finalCiphertext = this.cipher.final();
    const tag = this.cipher.getAuthTag();
    return { finalCiphertext, tag };
  }

  private validateParams(params: ChaChaParams): void {
    if (params.key.length !== 32) {
      throw new Error('Invalid key length');
    }
    if (params.nonce.length !== 12) {
      throw new Error('Invalid nonce length');
    }
  }
} 