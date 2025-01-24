import { createHmac } from 'crypto';

export enum HashAlgorithm {
  SHA256 = 'sha256',
  SHA384 = 'sha384',
  SHA512 = 'sha512'
}

export class HMAC {
  private key: Buffer;
  private algorithm: HashAlgorithm;
  private hmac: any;

  constructor(key: Buffer, algorithm: HashAlgorithm = HashAlgorithm.SHA256) {
    this.key = key;
    this.algorithm = algorithm;
    this.hmac = createHmac(algorithm, key);
  }

  public static generate(data: Buffer, key: Buffer, algorithm: HashAlgorithm = HashAlgorithm.SHA256): Buffer {
    const hmac = createHmac(algorithm, key);
    hmac.update(data);
    return hmac.digest();
  }

  public static verify(data: Buffer, mac: Buffer, key: Buffer, algorithm: HashAlgorithm = HashAlgorithm.SHA256): boolean {
    const expectedMac = HMAC.generate(data, key, algorithm);
    return mac.length === expectedMac.length && 
           Buffer.compare(mac, expectedMac) === 0;
  }

  public update(data: Buffer): void {
    this.hmac.update(data);
  }

  public digest(): Buffer {
    return this.hmac.digest();
  }

  public static deriveKey(key: Buffer, salt: Buffer, info: Buffer, length: number): Buffer {
    const hmac = createHmac('sha256', key);
    hmac.update(salt);
    hmac.update(info);
    return hmac.digest().slice(0, length);
  }
} 