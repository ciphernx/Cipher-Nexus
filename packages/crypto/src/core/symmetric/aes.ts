import { createCipheriv, createDecipheriv, CipherGCM, DecipherGCM } from 'crypto';

export enum AESMode {
  CBC = 'aes-256-cbc',
  GCM = 'aes-256-gcm'
}

export interface AESParams {
  key: Buffer;
  iv: Buffer;
  mode: AESMode;
}

export class AES {
  private params: AESParams;
  private cipher: CipherGCM | any;

  constructor(params: AESParams) {
    this.validateParams(params);
    this.params = params;
    this.cipher = createCipheriv(params.mode, params.key, params.iv);
  }

  public static async encrypt(data: Buffer, params: AESParams): Promise<Buffer> {
    const aes = new AES(params);
    return Buffer.concat([aes.update(data), await aes.final()]);
  }

  public static async decrypt(ciphertext: Buffer, params: AESParams): Promise<Buffer> {
    const decipher = createDecipheriv(params.mode, params.key, params.iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  public static async encryptGCM(data: Buffer, params: AESParams): Promise<{ ciphertext: Buffer; tag: Buffer }> {
    if (params.mode !== AESMode.GCM) {
      throw new Error('GCM mode required');
    }
    const cipher = createCipheriv(params.mode, params.key, params.iv) as CipherGCM;
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    return { ciphertext, tag: cipher.getAuthTag() };
  }

  public static async decryptGCM(ciphertext: Buffer, tag: Buffer, params: AESParams): Promise<Buffer> {
    if (params.mode !== AESMode.GCM) {
      throw new Error('GCM mode required');
    }
    const decipher = createDecipheriv(params.mode, params.key, params.iv) as DecipherGCM;
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  public update(data: Buffer): Buffer {
    return this.cipher.update(data);
  }

  public async final(): Promise<Buffer> {
    return this.cipher.final();
  }

  private validateParams(params: AESParams): void {
    if (![16, 24, 32].includes(params.key.length)) {
      throw new Error('Invalid key length');
    }
    if (params.iv.length !== 16) {
      throw new Error('Invalid IV length');
    }
  }
} 