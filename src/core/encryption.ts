import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto';

interface KeyPair {
  publicKey: {
    n: BigInteger;
    e: BigInteger;
  };
  privateKey: {
    n: BigInteger;
    d: BigInteger;
  };
}

export class Encryption {
  private keyPair: KeyPair | null = null;

  // 生成RSA密钥对
  async generateKeys(bits: number = 2048): Promise<KeyPair> {
    // 生成两个大素数
    const p = await this.generatePrime(bits / 2);
    const q = await this.generatePrime(bits / 2);

    // 计算n = p * q
    const n = p.multiply(q);

    // 计算欧拉函数φ(n) = (p-1)(q-1)
    const p1 = p.subtract(BigInteger.ONE);
    const q1 = q.subtract(BigInteger.ONE);
    const phi = p1.multiply(q1);

    // 选择公钥e，通常使用65537
    const e = new BigInteger('65537');

    // 计算私钥d，使得ed ≡ 1 (mod φ(n))
    const d = e.modInverse(phi);

    this.keyPair = {
      publicKey: { n, e },
      privateKey: { n, d }
    };

    return this.keyPair;
  }

  // 加密数据
  encrypt(data: string, publicKey: { n: BigInteger; e: BigInteger }): string {
    const m = new BigInteger(Buffer.from(data).toString('hex'), 16);
    if (m.compareTo(publicKey.n) >= 0) {
      throw new Error('Message too large');
    }
    
    // 使用公钥加密: c = m^e mod n
    const c = m.modPow(publicKey.e, publicKey.n);
    return c.toString(16);
  }

  // 解密数据
  decrypt(encryptedData: string, privateKey: { n: BigInteger; d: BigInteger }): string {
    const c = new BigInteger(encryptedData, 16);
    
    // 使用私钥解密: m = c^d mod n
    const m = c.modPow(privateKey.d, privateKey.n);
    const decryptedBuffer = Buffer.from(m.toString(16), 'hex');
    return decryptedBuffer.toString();
  }

  // 生成大素数
  private async generatePrime(bits: number): Promise<BigInteger> {
    while (true) {
      const candidate = this.generateRandomBigInt(bits);
      if (await this.isProbablePrime(candidate, 20)) {
        return candidate;
      }
    }
  }

  // 生成指定位数的随机大整数
  private generateRandomBigInt(bits: number): BigInteger {
    const bytes = Math.ceil(bits / 8);
    const randomBuffer = randomBytes(bytes);
    
    // 确保最高位为1
    randomBuffer[0] |= 0x80;
    
    return new BigInteger(randomBuffer.toString('hex'), 16);
  }

  // Miller-Rabin素性测试
  private async isProbablePrime(n: BigInteger, k: number): Promise<boolean> {
    if (n.equals(BigInteger.ONE)) return false;
    if (n.equals(new BigInteger('2'))) return true;
    if (n.mod(new BigInteger('2')).equals(BigInteger.ZERO)) return false;

    let s = 0;
    let d = n.subtract(BigInteger.ONE);
    while (d.mod(new BigInteger('2')).equals(BigInteger.ZERO)) {
      s++;
      d = d.divide(new BigInteger('2'));
    }

    witnessLoop: for (let i = 0; i < k; i++) {
      const a = this.generateRandomBigInt(n.bitLength() - 1);
      let x = a.modPow(d, n);

      if (x.equals(BigInteger.ONE) || x.equals(n.subtract(BigInteger.ONE))) {
        continue;
      }

      for (let r = 1; r < s; r++) {
        x = x.modPow(new BigInteger('2'), n);
        if (x.equals(BigInteger.ONE)) return false;
        if (x.equals(n.subtract(BigInteger.ONE))) continue witnessLoop;
      }

      return false;
    }

    return true;
  }

  // 同态加密支持
  encryptForHomomorphic(data: number, publicKey: { n: BigInteger; e: BigInteger }): string {
    const m = new BigInteger(data.toString());
    return this.encrypt(m.toString(), publicKey);
  }

  // 同态解密支持
  decryptForHomomorphic(encryptedData: string, privateKey: { n: BigInteger; d: BigInteger }): number {
    const decrypted = this.decrypt(encryptedData, privateKey);
    return parseInt(decrypted);
  }

  // 同态加法
  homomorphicAdd(
    enc1: string,
    enc2: string,
    publicKey: { n: BigInteger; e: BigInteger }
  ): string {
    const c1 = new BigInteger(enc1, 16);
    const c2 = new BigInteger(enc2, 16);
    const result = c1.multiply(c2).mod(publicKey.n);
    return result.toString(16);
  }

  // 同态乘法(标量)
  homomorphicMultiply(
    enc: string,
    scalar: number,
    publicKey: { n: BigInteger; e: BigInteger }
  ): string {
    const c = new BigInteger(enc, 16);
    const result = c.modPow(new BigInteger(scalar.toString()), publicKey.n);
    return result.toString(16);
  }
} 