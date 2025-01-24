import { PrivacyProtocol } from './privacy-protocol';
import { Model } from './model';
import { BigInteger } from 'jsbn';

interface FederatedConfig {
  minClients: number;
  roundTimeout: number;
  privacyConfig: {
    encryptionBits: number;
    noiseScale: number;
    clipNorm: number;
  };
}

interface ClientUpdate {
  clientId: string;
  encryptedGradients: string[];
  proof: {
    commitment: string;
    challenge: string;
    response: string;
  };
}

export class FederatedLearning {
  private model: Model;
  private privacyProtocol: PrivacyProtocol;
  private config: FederatedConfig;
  private clients: Set<string> = new Set();
  private roundUpdates: Map<string, ClientUpdate> = new Map();
  private currentRound: number = 0;
  private roundInProgress: boolean = false;

  constructor(model: Model, config: FederatedConfig) {
    this.model = model;
    this.config = config;
    this.privacyProtocol = new PrivacyProtocol(config.privacyConfig);
  }

  async initialize(): Promise<void> {
    await this.privacyProtocol.initialize();
    await this.model.initialize();
  }

  // 注册新客户端
  async registerClient(clientId: string): Promise<{
    modelParams: number[];
    publicKey: { n: BigInteger; e: BigInteger };
  }> {
    this.clients.add(clientId);
    const modelParams = await this.model.getParameters();
    const publicKey = this.privacyProtocol.getPublicKey();

    if (!publicKey) {
      throw new Error('Privacy protocol not initialized');
    }

    return {
      modelParams,
      publicKey
    };
  }

  // 提交客户端更新
  async submitUpdate(clientId: string, update: ClientUpdate): Promise<boolean> {
    if (!this.roundInProgress) {
      throw new Error('No active training round');
    }

    if (!this.clients.has(clientId)) {
      throw new Error('Unregistered client');
    }

    if (this.roundUpdates.has(clientId)) {
      throw new Error('Client already submitted update for this round');
    }

    // 验证零知识证明
    const decryptedGradients = await this.privacyProtocol.decrypt(
      update.encryptedGradients
    );

    const proofValid = await this.privacyProtocol.verifyProof(
      decryptedGradients,
      update.proof
    );

    if (!proofValid) {
      throw new Error('Invalid zero-knowledge proof');
    }

    // 验证梯度范围
    const validGradients = this.validateGradients(decryptedGradients);
    if (!validGradients) {
      throw new Error('Invalid gradient values');
    }

    this.roundUpdates.set(clientId, update);

    // 检查是否收到足够的更新
    if (this.roundUpdates.size >= this.config.minClients) {
      await this.aggregateAndUpdate();
    }

    return true;
  }

  // 开始新一轮训练
  async startRound(): Promise<number> {
    if (this.roundInProgress) {
      throw new Error('Round already in progress');
    }

    if (this.clients.size < this.config.minClients) {
      throw new Error('Insufficient clients registered');
    }

    this.currentRound++;
    this.roundInProgress = true;
    this.roundUpdates.clear();

    // 设置超时以确保轮次最终完成
    setTimeout(async () => {
      if (this.roundInProgress && this.roundUpdates.size >= 1) {
        await this.aggregateAndUpdate();
      }
    }, this.config.roundTimeout);

    return this.currentRound;
  }

  // 获取当前训练状态
  getStatus(): {
    round: number;
    clientCount: number;
    updatesReceived: number;
    inProgress: boolean;
  } {
    return {
      round: this.currentRound,
      clientCount: this.clients.size,
      updatesReceived: this.roundUpdates.size,
      inProgress: this.roundInProgress
    };
  }

  // 私有辅助方法

  private async aggregateAndUpdate(): Promise<void> {
    if (!this.roundInProgress) {
      return;
    }

    try {
      // 提取所有加密的梯度更新
      const encryptedUpdates = Array.from(this.roundUpdates.values()).map(
        update => update.encryptedGradients
      );

      // 聚合加密的梯度
      const aggregatedEncrypted = await this.privacyProtocol.aggregateEncrypted(
        encryptedUpdates
      );

      // 解密聚合后的梯度
      const aggregatedGradients = await this.privacyProtocol.decrypt(
        aggregatedEncrypted
      );

      // 计算平均梯度
      const numUpdates = this.roundUpdates.size;
      const averagedGradients = aggregatedGradients.map(
        grad => grad / numUpdates
      );

      // 更新模型参数
      await this.model.updateParameters(averagedGradients);

    } catch (error) {
      console.error('Error during aggregation:', error);
    } finally {
      // 完成当前轮次
      this.roundInProgress = false;
      this.roundUpdates.clear();
    }
  }

  private validateGradients(gradients: number[]): boolean {
    // 验证梯度值是否在合理范围内
    return gradients.every(grad => {
      const absGrad = Math.abs(grad);
      return !isNaN(absGrad) && isFinite(absGrad) && absGrad < 1e6;
    });
  }

  // Getter方法
  getModel(): Model {
    return this.model;
  }

  getPrivacyProtocol(): PrivacyProtocol {
    return this.privacyProtocol;
  }

  getConfig(): FederatedConfig {
    return { ...this.config };
  }
} 