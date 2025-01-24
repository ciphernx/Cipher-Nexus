import { Encryption } from './encryption';
import { BigInteger } from 'jsbn';

interface PrivacyConfig {
  encryptionBits: number;
  noiseScale: number;
  clipNorm: number;
}

export class PrivacyProtocol {
  private encryption: Encryption;
  private config: PrivacyConfig;
  private keyPair: {
    publicKey: { n: BigInteger; e: BigInteger };
    privateKey: { n: BigInteger; d: BigInteger };
  } | null = null;

  constructor(config: PrivacyConfig) {
    this.encryption = new Encryption();
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.keyPair = await this.encryption.generateKeys(this.config.encryptionBits);
  }

  // 加密数据并添加差分隐私噪声
  async encrypt(data: number[]): Promise<string[]> {
    if (!this.keyPair) {
      throw new Error('Privacy protocol not initialized');
    }

    // 应用梯度裁剪
    const clippedData = this.clipGradients(data);
    
    // 添加差分隐私噪声
    const noisyData = this.addNoise(clippedData);
    
    // 加密处理后的数据
    return Promise.all(
      noisyData.map(value => 
        this.encryption.encryptForHomomorphic(value, this.keyPair!.publicKey)
      )
    );
  }

  // 解密数据
  async decrypt(encryptedData: string[]): Promise<number[]> {
    if (!this.keyPair) {
      throw new Error('Privacy protocol not initialized');
    }

    return Promise.all(
      encryptedData.map(value =>
        this.encryption.decryptForHomomorphic(value, this.keyPair!.privateKey)
      )
    );
  }

  // 聚合加密数据
  async aggregateEncrypted(encryptedDataArray: string[][]): Promise<string[]> {
    if (!this.keyPair) {
      throw new Error('Privacy protocol not initialized');
    }

    const result: string[] = [];
    const numParams = encryptedDataArray[0].length;

    for (let i = 0; i < numParams; i++) {
      let aggregated = encryptedDataArray[0][i];
      for (let j = 1; j < encryptedDataArray.length; j++) {
        aggregated = this.encryption.homomorphicAdd(
          aggregated,
          encryptedDataArray[j][i],
          this.keyPair.publicKey
        );
      }
      result.push(aggregated);
    }

    return result;
  }

  // 验证数据完整性
  async verifyIntegrity(
    originalData: number[],
    encryptedData: string[],
    decryptedData: number[]
  ): Promise<boolean> {
    if (!this.keyPair) {
      throw new Error('Privacy protocol not initialized');
    }

    // 重新加密原始数据
    const reEncrypted = await this.encrypt(originalData);
    
    // 验证加密结果是否一致
    const encryptionMatch = reEncrypted.every(
      (value, index) => value === encryptedData[index]
    );

    // 验证解密结果是否在可接受的误差范围内
    const decryptionMatch = originalData.every(
      (value, index) => Math.abs(value - decryptedData[index]) < 1e-6
    );

    return encryptionMatch && decryptionMatch;
  }

  // 生成零知识证明
  async generateProof(data: number[]): Promise<{
    commitment: string;
    challenge: string;
    response: string;
  }> {
    if (!this.keyPair) {
      throw new Error('Privacy protocol not initialized');
    }

    // 生成随机数r
    const r = new BigInteger(this.generateRandomHex(32), 16);
    
    // 计算承诺值 commitment = g^r mod n
    const commitment = r.modPow(
      this.keyPair.publicKey.e,
      this.keyPair.publicKey.n
    ).toString(16);

    // 生成挑战值
    const challenge = this.generateChallenge(data, commitment);

    // 计算响应值 response = r + challenge * data
    const response = r.add(
      new BigInteger(challenge, 16).multiply(
        new BigInteger(data.join(''), 10)
      )
    ).toString(16);

    return {
      commitment,
      challenge,
      response
    };
  }

  // 验证零知识证明
  async verifyProof(
    data: number[],
    proof: {
      commitment: string;
      challenge: string;
      response: string;
    }
  ): Promise<boolean> {
    if (!this.keyPair) {
      throw new Error('Privacy protocol not initialized');
    }

    // 重新计算挑战值
    const computedChallenge = this.generateChallenge(data, proof.commitment);
    
    // 验证挑战值是否匹配
    if (computedChallenge !== proof.challenge) {
      return false;
    }

    // 验证响应值
    const left = new BigInteger(proof.response, 16).modPow(
      this.keyPair.publicKey.e,
      this.keyPair.publicKey.n
    );

    const right = new BigInteger(proof.commitment, 16).multiply(
      new BigInteger(data.join(''), 10).modPow(
        new BigInteger(proof.challenge, 16),
        this.keyPair.publicKey.n
      )
    ).mod(this.keyPair.publicKey.n);

    return left.equals(right);
  }

  // 私有辅助方法

  private clipGradients(gradients: number[]): number[] {
    const norm = Math.sqrt(
      gradients.reduce((sum, grad) => sum + grad * grad, 0)
    );

    if (norm <= this.config.clipNorm) {
      return gradients;
    }

    const scale = this.config.clipNorm / norm;
    return gradients.map(grad => grad * scale);
  }

  private addNoise(data: number[]): number[] {
    return data.map(value => {
      const noise = this.generateGaussianNoise(0, this.config.noiseScale);
      return value + noise;
    });
  }

  private generateGaussianNoise(mean: number, stdDev: number): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    
    const noise = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + stdDev * noise;
  }

  private generateRandomHex(bytes: number): string {
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private generateChallenge(data: number[], commitment: string): string {
    const input = data.join('') + commitment;
    let hash = 0;
    
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16);
  }

  // Getter方法
  getPublicKey() {
    return this.keyPair?.publicKey;
  }

  getConfig() {
    return { ...this.config };
  }
} 