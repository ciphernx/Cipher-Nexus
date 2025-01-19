import { EventEmitter } from 'events';
import { TokenContract } from './TokenContract';

interface StakingPosition {
  address: string;
  amount: bigint;
  startTime: Date;
  lockPeriod: number; // 锁定期(天)
  rewards: bigint;
  lastClaim: Date;
}

interface RewardConfig {
  baseRate: number;      // 基础年化率
  boostMultiplier: number; // 加速倍数
  minStake: bigint;      // 最小质押量
  maxBoost: number;      // 最大加速倍数
}

interface GovernanceProposal {
  id: string;
  proposer: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  status: 'active' | 'passed' | 'rejected' | 'executed';
  votes: {
    for: bigint;
    against: bigint;
  };
  quorum: bigint;       // 最小投票数
  threshold: number;    // 通过阈值(0-1)
}

interface Vote {
  voter: string;
  proposalId: string;
  amount: bigint;
  support: boolean;
  timestamp: Date;
}

export class TokenEconomyManager extends EventEmitter {
  private token: TokenContract;
  private stakingPositions: Map<string, StakingPosition> = new Map();
  private proposals: Map<string, GovernanceProposal> = new Map();
  private votes: Map<string, Vote[]> = new Map();
  private rewardConfig: RewardConfig;

  constructor(
    token: TokenContract,
    rewardConfig: RewardConfig
  ) {
    super();
    this.token = token;
    this.rewardConfig = rewardConfig;
  }

  // 质押相关
  async stake(
    address: string,
    amount: bigint,
    lockPeriod: number
  ): Promise<boolean> {
    try {
      // 检查最小质押量
      if (amount < this.rewardConfig.minStake) {
        throw new Error('Stake amount below minimum');
      }

      // 锁定代币
      await this.token.lock(address, amount, 'staking');

      // 创建或更新质押位置
      let position = this.stakingPositions.get(address);
      if (position) {
        position.amount += amount;
        position.lockPeriod = Math.max(position.lockPeriod, lockPeriod);
      } else {
        position = {
          address,
          amount,
          startTime: new Date(),
          lockPeriod,
          rewards: 0n,
          lastClaim: new Date()
        };
      }
      this.stakingPositions.set(address, position);

      this.emit('staked', {
        address,
        amount,
        lockPeriod,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async unstake(
    address: string,
    amount: bigint
  ): Promise<boolean> {
    try {
      const position = this.stakingPositions.get(address);
      if (!position) {
        throw new Error('No staking position found');
      }

      // 检查锁定期
      const now = new Date();
      const lockEndTime = new Date(position.startTime);
      lockEndTime.setDate(lockEndTime.getDate() + position.lockPeriod);
      if (now < lockEndTime) {
        throw new Error('Tokens still locked');
      }

      // 检查金额
      if (amount > position.amount) {
        throw new Error('Unstake amount exceeds staked amount');
      }

      // 解锁代币
      await this.token.unlock(address, amount, 'unstaking');

      // 更新质押位置
      position.amount -= amount;
      if (position.amount === 0n) {
        this.stakingPositions.delete(address);
      } else {
        this.stakingPositions.set(address, position);
      }

      this.emit('unstaked', {
        address,
        amount,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async claimRewards(address: string): Promise<bigint> {
    try {
      const position = this.stakingPositions.get(address);
      if (!position) {
        throw new Error('No staking position found');
      }

      // 计算奖励
      const rewards = this.calculateRewards(position);
      if (rewards === 0n) {
        return 0n;
      }

      // 铸造奖励代币
      await this.token.mint(address, rewards);

      // 更新质押位置
      position.rewards += rewards;
      position.lastClaim = new Date();
      this.stakingPositions.set(address, position);

      this.emit('rewardsClaimed', {
        address,
        amount: rewards,
        timestamp: new Date()
      });

      return rewards;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // 治理相关
  async createProposal(
    proposer: string,
    title: string,
    description: string,
    votingPeriod: number,
    quorum: bigint,
    threshold: number
  ): Promise<string> {
    try {
      // 检查提案者质押
      const position = this.stakingPositions.get(proposer);
      if (!position || position.amount < this.rewardConfig.minStake) {
        throw new Error('Insufficient stake to create proposal');
      }

      // 生成提案ID
      const proposalId = this.generateProposalId(title, proposer);

      // 创建提案
      const proposal: GovernanceProposal = {
        id: proposalId,
        proposer,
        title,
        description,
        startTime: new Date(),
        endTime: new Date(Date.now() + votingPeriod * 24 * 60 * 60 * 1000),
        status: 'active',
        votes: {
          for: 0n,
          against: 0n
        },
        quorum,
        threshold
      };

      this.proposals.set(proposalId, proposal);
      this.votes.set(proposalId, []);

      this.emit('proposalCreated', {
        proposalId,
        proposer,
        timestamp: new Date()
      });

      return proposalId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async vote(
    voter: string,
    proposalId: string,
    support: boolean
  ): Promise<boolean> {
    try {
      const proposal = this.proposals.get(proposalId);
      if (!proposal) {
        throw new Error('Proposal not found');
      }

      if (proposal.status !== 'active') {
        throw new Error('Proposal not active');
      }

      if (new Date() > proposal.endTime) {
        throw new Error('Voting period ended');
      }

      // 获取投票权重(质押量)
      const position = this.stakingPositions.get(voter);
      if (!position || position.amount === 0n) {
        throw new Error('No voting power');
      }

      // 检查是否已投票
      const proposalVotes = this.votes.get(proposalId) || [];
      if (proposalVotes.some(v => v.voter === voter)) {
        throw new Error('Already voted');
      }

      // 记录投票
      const vote: Vote = {
        voter,
        proposalId,
        amount: position.amount,
        support,
        timestamp: new Date()
      };
      proposalVotes.push(vote);
      this.votes.set(proposalId, proposalVotes);

      // 更新提案票数
      if (support) {
        proposal.votes.for += position.amount;
      } else {
        proposal.votes.against += position.amount;
      }

      // 检查是否达到法定人数和通过阈值
      const totalVotes = proposal.votes.for + proposal.votes.against;
      if (totalVotes >= proposal.quorum) {
        const forPercentage = Number(proposal.votes.for) / Number(totalVotes);
        if (forPercentage >= proposal.threshold) {
          proposal.status = 'passed';
        } else if (forPercentage < 1 - proposal.threshold) {
          proposal.status = 'rejected';
        }
      }

      this.proposals.set(proposalId, proposal);

      this.emit('voted', {
        voter,
        proposalId,
        support,
        amount: position.amount,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async executeProposal(proposalId: string): Promise<boolean> {
    try {
      const proposal = this.proposals.get(proposalId);
      if (!proposal) {
        throw new Error('Proposal not found');
      }

      if (proposal.status !== 'passed') {
        throw new Error('Proposal not passed');
      }

      // 在这里实现提案执行逻辑
      proposal.status = 'executed';
      this.proposals.set(proposalId, proposal);

      this.emit('proposalExecuted', {
        proposalId,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // 查询方法
  getStakingPosition(address: string): StakingPosition | undefined {
    return this.stakingPositions.get(address);
  }

  getProposal(proposalId: string): GovernanceProposal | undefined {
    return this.proposals.get(proposalId);
  }

  getVotes(proposalId: string): Vote[] {
    return this.votes.get(proposalId) || [];
  }

  // 私有方法
  private calculateRewards(position: StakingPosition): bigint {
    const now = new Date();
    const timeDiff = (now.getTime() - position.lastClaim.getTime()) / (1000 * 60 * 60 * 24 * 365); // 年化
    
    // 计算基础奖励
    let rate = this.rewardConfig.baseRate;

    // 应用加速倍数
    const boost = Math.min(
      this.rewardConfig.maxBoost,
      1 + (position.lockPeriod / 365) * this.rewardConfig.boostMultiplier
    );
    rate *= boost;

    // 计算奖励
    const rewards = BigInt(Math.floor(Number(position.amount) * rate * timeDiff));
    return rewards;
  }

  private generateProposalId(title: string, proposer: string): string {
    const { createHash } = require('crypto');
    const hash = createHash('sha256');
    hash.update(title + proposer + Date.now().toString());
    return hash.digest('hex').substring(0, 16);
  }
} 