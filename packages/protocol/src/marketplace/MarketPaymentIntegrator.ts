import { EventEmitter } from 'events';
import { TokenContract } from '../token/TokenContract';
import { RegisteredAsset } from './AssetRegistry';
import { Order } from './OrderMatcher';

interface PaymentTransaction {
  id: string;
  orderId: string;
  assetId: string;
  buyer: string;
  seller: string;
  amount: bigint;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: Date;
  completedAt?: Date;
}

interface EscrowAccount {
  id: string;
  orderId: string;
  amount: bigint;
  releaseTime: Date;
  status: 'locked' | 'released' | 'refunded';
}

interface RewardDistribution {
  dataProvider: bigint;
  marketplaceFee: bigint;
  qualityBonus: bigint;
  stakingReward: bigint;
}

export class MarketPaymentIntegrator extends EventEmitter {
  private transactions: Map<string, PaymentTransaction> = new Map();
  private escrowAccounts: Map<string, EscrowAccount> = new Map();
  
  private readonly MARKETPLACE_FEE_RATE = 0.02; // 2%
  private readonly QUALITY_BONUS_RATE = 0.01;   // 1%
  private readonly STAKING_REWARD_RATE = 0.01;  // 1%

  constructor(
    private tokenContract: TokenContract
  ) {
    super();
  }

  async processPayment(
    order: Order,
    asset: RegisteredAsset
  ): Promise<string> {
    try {
      const transactionId = this.generateTransactionId();
      
      // Calculate total amount including fees
      const totalAmount = this.calculateTotalAmount(order.price, order.quantity);
      
      // Create payment transaction record
      const transaction: PaymentTransaction = {
        id: transactionId,
        orderId: order.id,
        assetId: asset.id,
        buyer: order.maker,
        seller: asset.owner,
        amount: totalAmount,
        status: 'pending',
        createdAt: new Date()
      };

      // Create escrow account
      const escrow: EscrowAccount = {
        id: this.generateEscrowId(),
        orderId: order.id,
        amount: totalAmount,
        releaseTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours lock
        status: 'locked'
      };

      // Transfer tokens to escrow
      await this.tokenContract.transferFrom(
        order.maker,
        this.tokenContract.getInfo().owner, // Contract owner acts as escrow
        totalAmount
      );

      // Store records
      this.transactions.set(transactionId, transaction);
      this.escrowAccounts.set(escrow.id, escrow);

      this.emit('paymentProcessed', {
        transactionId,
        orderId: order.id,
        amount: totalAmount,
        timestamp: new Date()
      });

      return transactionId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async releasePayment(
    transactionId: string,
    force: boolean = false
  ): Promise<void> {
    try {
      const transaction = this.transactions.get(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== 'pending') {
        throw new Error('Transaction is not pending');
      }

      const escrow = Array.from(this.escrowAccounts.values())
        .find(e => e.orderId === transaction.orderId);
      
      if (!escrow) {
        throw new Error('Escrow account not found');
      }

      if (!force && escrow.releaseTime > new Date()) {
        throw new Error('Escrow lock time not expired');
      }

      // Calculate reward distribution
      const distribution = this.calculateRewardDistribution(
        transaction.amount,
        transaction.assetId
      );

      // Transfer rewards to participants
      await this.tokenContract.transfer(
        transaction.seller,
        distribution.dataProvider
      );

      await this.tokenContract.transfer(
        this.tokenContract.getInfo().owner,
        distribution.marketplaceFee
      );

      if (distribution.qualityBonus > 0n) {
        await this.tokenContract.transfer(
          transaction.seller,
          distribution.qualityBonus
        );
      }

      if (distribution.stakingReward > 0n) {
        await this.distributeStakingRewards(
          transaction.assetId,
          distribution.stakingReward
        );
      }

      // Update records
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      escrow.status = 'released';

      this.emit('paymentReleased', {
        transactionId,
        distribution,
        timestamp: new Date()
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async refundPayment(transactionId: string): Promise<void> {
    try {
      const transaction = this.transactions.get(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== 'pending') {
        throw new Error('Transaction is not pending');
      }

      const escrow = Array.from(this.escrowAccounts.values())
        .find(e => e.orderId === transaction.orderId);
      
      if (!escrow) {
        throw new Error('Escrow account not found');
      }

      // Return funds to buyer
      await this.tokenContract.transfer(
        transaction.buyer,
        transaction.amount
      );

      // Update records
      transaction.status = 'refunded';
      transaction.completedAt = new Date();
      escrow.status = 'refunded';

      this.emit('paymentRefunded', {
        transactionId,
        amount: transaction.amount,
        timestamp: new Date()
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getTransaction(transactionId: string): Promise<PaymentTransaction | undefined> {
    return this.transactions.get(transactionId);
  }

  async getEscrowAccount(escrowId: string): Promise<EscrowAccount | undefined> {
    return this.escrowAccounts.get(escrowId);
  }

  private calculateTotalAmount(price: number, quantity: number): bigint {
    const baseAmount = BigInt(Math.floor(price * quantity * 1e18));
    const fees = BigInt(Math.floor(
      price * quantity * 
      (this.MARKETPLACE_FEE_RATE + this.QUALITY_BONUS_RATE + this.STAKING_REWARD_RATE) * 
      1e18
    ));
    return baseAmount + fees;
  }

  private calculateRewardDistribution(
    totalAmount: bigint,
    assetId: string
  ): RewardDistribution {
    const marketplaceFee = (totalAmount * BigInt(Math.floor(this.MARKETPLACE_FEE_RATE * 100))) / 100n;
    const qualityBonus = (totalAmount * BigInt(Math.floor(this.QUALITY_BONUS_RATE * 100))) / 100n;
    const stakingReward = (totalAmount * BigInt(Math.floor(this.STAKING_REWARD_RATE * 100))) / 100n;
    const dataProvider = totalAmount - marketplaceFee - qualityBonus - stakingReward;

    return {
      dataProvider,
      marketplaceFee,
      qualityBonus,
      stakingReward
    };
  }

  private async distributeStakingRewards(
    assetId: string,
    totalReward: bigint
  ): Promise<void> {
    // Implement staking reward distribution logic
    // This should distribute rewards to token stakers based on their stake
    // For now, just send it to the contract owner
    await this.tokenContract.transfer(
      this.tokenContract.getInfo().owner,
      totalReward
    );
  }

  private generateTransactionId(): string {
    return 'tx_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateEscrowId(): string {
    return 'escrow_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 