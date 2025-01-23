import { EventEmitter } from 'events';
import { createHash } from 'crypto';

interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: bigint;
  owner: string;
}

interface TokenBalance {
  address: string;
  amount: bigint;
  locked: bigint;
  lastUpdated: Date;
}

interface TokenAllowance {
  owner: string;
  spender: string;
  amount: bigint;
  expiry?: Date;
}

interface TokenMetrics {
  holders: number;
  transactions: number;
  volume: bigint;
  marketCap: bigint;
}

export class TokenContract extends EventEmitter {
  private info: TokenInfo;
  private balances: Map<string, TokenBalance> = new Map();
  private allowances: Map<string, TokenAllowance[]> = new Map();
  private metrics: TokenMetrics;

  constructor(
    symbol: string,
    name: string,
    decimals: number,
    initialSupply: bigint,
    owner: string
  ) {
    super();
    this.info = {
      symbol,
      name,
      decimals,
      totalSupply: initialSupply,
      owner
    };

    this.metrics = {
      holders: 0,
      transactions: 0,
      volume: 0n,
      marketCap: 0n
    };

    // Initialize creator balance
    this.balances.set(owner, {
      address: owner,
      amount: initialSupply,
      locked: 0n,
      lastUpdated: new Date()
    });
    this.metrics.holders = 1;
  }

  // 基础信息查询
  getInfo(): TokenInfo {
    return { ...this.info };
  }

  getMetrics(): TokenMetrics {
    return { ...this.metrics };
  }

  getBalance(address: string): bigint {
    const balance = this.balances.get(address);
    return balance ? balance.amount : 0n;
  }

  getAllowance(owner: string, spender: string): bigint {
    const ownerAllowances = this.allowances.get(owner) || [];
    const allowance = ownerAllowances.find(a => a.spender === spender);
    if (!allowance || (allowance.expiry && allowance.expiry < new Date())) {
      return 0n;
    }
    return allowance.amount;
  }

  // 转账相关
  async transfer(
    from: string,
    to: string,
    amount: bigint
  ): Promise<boolean> {
    try {
      // Check balance
      const fromBalance = this.balances.get(from);
      if (!fromBalance || fromBalance.amount < amount) {
        throw new Error('Insufficient balance');
      }

      // Check locked amount
      if (fromBalance.amount - fromBalance.locked < amount) {
        throw new Error('Funds locked');
      }

      // Update sender balance
      fromBalance.amount -= amount;
      fromBalance.lastUpdated = new Date();

      // Update recipient balance
      let toBalance = this.balances.get(to);
      if (!toBalance) {
        toBalance = {
          address: to,
          amount: 0n,
          locked: 0n,
          lastUpdated: new Date()
        };
        this.metrics.holders++;
      }
      toBalance.amount += amount;
      toBalance.lastUpdated = new Date();

      // Save updates
      this.balances.set(from, fromBalance);
      this.balances.set(to, toBalance);

      // Update metrics
      this.metrics.transactions++;
      this.metrics.volume += amount;

      this.emit('transfer', {
        from,
        to,
        amount,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async approve(
    owner: string,
    spender: string,
    amount: bigint,
    expiry?: Date
  ): Promise<boolean> {
    try {
      let ownerAllowances = this.allowances.get(owner);
      if (!ownerAllowances) {
        ownerAllowances = [];
      }

      const allowanceIndex = ownerAllowances.findIndex(a => a.spender === spender);
      const allowance: TokenAllowance = {
        owner,
        spender,
        amount,
        expiry
      };

      if (allowanceIndex >= 0) {
        ownerAllowances[allowanceIndex] = allowance;
      } else {
        ownerAllowances.push(allowance);
      }

      this.allowances.set(owner, ownerAllowances);

      this.emit('approval', {
        owner,
        spender,
        amount,
        expiry,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async transferFrom(
    spender: string,
    from: string,
    to: string,
    amount: bigint
  ): Promise<boolean> {
    try {
      // Check allowance
      const allowance = this.getAllowance(from, spender);
      if (allowance < amount) {
        throw new Error('Insufficient allowance');
      }

      // Execute transfer
      await this.transfer(from, to, amount);

      // Update allowance
      const ownerAllowances = this.allowances.get(from) || [];
      const allowanceIndex = ownerAllowances.findIndex(a => a.spender === spender);
      if (allowanceIndex >= 0) {
        ownerAllowances[allowanceIndex].amount -= amount;
      }
      this.allowances.set(from, ownerAllowances);

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // 锁定/解锁代币
  async lock(
    address: string,
    amount: bigint,
    reason: string
  ): Promise<boolean> {
    try {
      const balance = this.balances.get(address);
      if (!balance || balance.amount - balance.locked < amount) {
        throw new Error('Insufficient unlocked balance');
      }

      balance.locked += amount;
      this.balances.set(address, balance);

      this.emit('locked', {
        address,
        amount,
        reason,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async unlock(
    address: string,
    amount: bigint,
    reason: string
  ): Promise<boolean> {
    try {
      const balance = this.balances.get(address);
      if (!balance || balance.locked < amount) {
        throw new Error('Insufficient locked balance');
      }

      balance.locked -= amount;
      this.balances.set(address, balance);

      this.emit('unlocked', {
        address,
        amount,
        reason,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // 铸造/销毁代币
  async mint(
    to: string,
    amount: bigint
  ): Promise<boolean> {
    try {
      if (to !== this.info.owner) {
        throw new Error('Only owner can mint tokens');
      }

      let balance = this.balances.get(to);
      if (!balance) {
        balance = {
          address: to,
          amount: 0n,
          locked: 0n,
          lastUpdated: new Date()
        };
        this.metrics.holders++;
      }

      balance.amount += amount;
      balance.lastUpdated = new Date();
      this.balances.set(to, balance);

      this.info.totalSupply += amount;

      this.emit('mint', {
        to,
        amount,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async burn(
    from: string,
    amount: bigint
  ): Promise<boolean> {
    try {
      const balance = this.balances.get(from);
      if (!balance || balance.amount < amount) {
        throw new Error('Insufficient balance');
      }

      if (balance.amount - balance.locked < amount) {
        throw new Error('Funds locked');
      }

      balance.amount -= amount;
      balance.lastUpdated = new Date();
      this.balances.set(from, balance);

      this.info.totalSupply -= amount;

      this.emit('burn', {
        from,
        amount,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // 更新市值
  async updateMarketCap(price: bigint): Promise<void> {
    this.metrics.marketCap = this.info.totalSupply * price;
    this.emit('marketCapUpdated', {
      marketCap: this.metrics.marketCap,
      timestamp: new Date()
    });
  }
} 