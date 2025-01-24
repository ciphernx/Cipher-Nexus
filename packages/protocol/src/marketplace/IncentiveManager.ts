import { EventEmitter } from 'events';
import { TokenContract } from '../token/TokenContract';
import { QualityAssessor } from './QualityAssessor';

interface StakingPosition {
  id: string;
  user: string;
  amount: bigint;
  lockedUntil: Date;
  rewards: bigint;
  lastUpdateTime: Date;
}

interface IncentiveConfig {
  minStakeAmount: bigint;
  lockPeriod: number; // in days
  baseAPR: number;
  qualityMultiplier: number;
  volumeMultiplier: number;
}

interface RewardCalculation {
  baseReward: bigint;
  qualityBonus: bigint;
  volumeBonus: bigint;
  totalReward: bigint;
}

export class IncentiveManager extends EventEmitter {
  private stakingPositions: Map<string, StakingPosition> = new Map();
  
  private readonly config: IncentiveConfig = {
    minStakeAmount: BigInt(1000) * BigInt(1e18), // 1000 tokens
    lockPeriod: 30, // 30 days
    baseAPR: 0.1, // 10% base APR
    qualityMultiplier: 2, // up to 2x for high quality
    volumeMultiplier: 1.5 // up to 1.5x for high volume
  };

  constructor(
    private tokenContract: TokenContract,
    private qualityAssessor: QualityAssessor
  ) {
    super();
  }

  async createStakingPosition(
    user: string,
    amount: bigint,
    lockPeriod: number = this.config.lockPeriod
  ): Promise<string> {
    try {
      if (amount < this.config.minStakeAmount) {
        throw new Error('Stake amount below minimum');
      }

      // Transfer tokens to contract
      await this.tokenContract.transferFrom(
        user,
        this.tokenContract.getInfo().owner,
        amount
      );

      const position: StakingPosition = {
        id: this.generateStakingId(),
        user,
        amount,
        lockedUntil: new Date(Date.now() + lockPeriod * 24 * 60 * 60 * 1000),
        rewards: 0n,
        lastUpdateTime: new Date()
      };

      this.stakingPositions.set(position.id, position);

      this.emit('stakingPositionCreated', {
        positionId: position.id,
        user,
        amount,
        lockedUntil: position.lockedUntil,
        timestamp: new Date()
      });

      return position.id;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async updateStakingRewards(positionId: string): Promise<RewardCalculation> {
    try {
      const position = this.stakingPositions.get(positionId);
      if (!position) {
        throw new Error('Staking position not found');
      }

      const now = new Date();
      const timeElapsed = (now.getTime() - position.lastUpdateTime.getTime()) / (365 * 24 * 60 * 60 * 1000); // in years

      // Calculate base reward
      const baseReward = BigInt(Math.floor(
        Number(position.amount) * this.config.baseAPR * timeElapsed
      ));

      // Calculate quality bonus
      const qualityScore = await this.getAverageQualityScore(position.user);
      const qualityBonus = BigInt(Math.floor(
        Number(baseReward) * Math.min(qualityScore * this.config.qualityMultiplier, 1)
      ));

      // Calculate volume bonus
      const volumeScore = await this.getVolumeScore(position.user);
      const volumeBonus = BigInt(Math.floor(
        Number(baseReward) * Math.min(volumeScore * this.config.volumeMultiplier, 1)
      ));

      const totalReward = baseReward + qualityBonus + volumeBonus;

      // Update position
      position.rewards += totalReward;
      position.lastUpdateTime = now;

      const calculation: RewardCalculation = {
        baseReward,
        qualityBonus,
        volumeBonus,
        totalReward
      };

      this.emit('rewardsUpdated', {
        positionId,
        calculation,
        timestamp: now
      });

      return calculation;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async claimRewards(positionId: string): Promise<bigint> {
    try {
      const position = this.stakingPositions.get(positionId);
      if (!position) {
        throw new Error('Staking position not found');
      }

      if (position.lockedUntil > new Date()) {
        throw new Error('Position still locked');
      }

      // Update rewards before claiming
      await this.updateStakingRewards(positionId);

      const rewardAmount = position.rewards;
      if (rewardAmount <= 0n) {
        throw new Error('No rewards to claim');
      }

      // Transfer rewards
      await this.tokenContract.transfer(
        position.user,
        rewardAmount
      );

      // Reset rewards
      position.rewards = 0n;

      this.emit('rewardsClaimed', {
        positionId,
        user: position.user,
        amount: rewardAmount,
        timestamp: new Date()
      });

      return rewardAmount;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async unstake(positionId: string): Promise<void> {
    try {
      const position = this.stakingPositions.get(positionId);
      if (!position) {
        throw new Error('Staking position not found');
      }

      if (position.lockedUntil > new Date()) {
        throw new Error('Position still locked');
      }

      // Claim any remaining rewards
      if (position.rewards > 0n) {
        await this.claimRewards(positionId);
      }

      // Return staked tokens
      await this.tokenContract.transfer(
        position.user,
        position.amount
      );

      // Remove position
      this.stakingPositions.delete(positionId);

      this.emit('positionUnstaked', {
        positionId,
        user: position.user,
        amount: position.amount,
        timestamp: new Date()
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getStakingPosition(positionId: string): Promise<StakingPosition | undefined> {
    return this.stakingPositions.get(positionId);
  }

  private async getAverageQualityScore(user: string): Promise<number> {
    // Get quality scores for user's assets and calculate average
    // For now, return a random score between 0 and 1
    return Math.random();
  }

  private async getVolumeScore(user: string): Promise<number> {
    // Calculate volume score based on user's trading activity
    // For now, return a random score between 0 and 1
    return Math.random();
  }

  private generateStakingId(): string {
    return 'stake_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 