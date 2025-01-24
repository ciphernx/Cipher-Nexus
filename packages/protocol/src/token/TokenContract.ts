import { EventEmitter } from 'events';
import { createHash } from 'crypto';

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  owner: string;
}

interface TransferMetadata {
  reference?: string;
  description?: string;
  timestamp?: Date;
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
  private balances: Map<string, bigint> = new Map();
  private allowances: Map<string, Map<string, bigint>> = new Map();
  private readonly info: TokenInfo;
  private metrics: TokenMetrics;

  constructor(
    name: string,
    symbol: string,
    decimals: number,
    initialSupply: bigint,
    owner: string
  ) {
    super();
    this.info = {
      name,
      symbol,
      decimals,
      totalSupply: initialSupply,
      owner
    };
    this.balances.set(owner, initialSupply);

    this.metrics = {
      holders: 0,
      transactions: 0,
      volume: 0n,
      marketCap: 0n
    };

    // Initialize creator balance
    this.balances.set(owner, initialSupply);
    this.metrics.holders = 1;
  }

  async transfer(
    to: string,
    amount: bigint,
    metadata: TransferMetadata = {}
  ): Promise<boolean> {
    try {
      const sender = this.info.owner;
      await this.validateTransfer(sender, to, amount);

      // Update balances
      const fromBalance = this.balances.get(sender) || 0n;
      const toBalance = this.balances.get(to) || 0n;

      this.balances.set(sender, fromBalance - amount);
      this.balances.set(to, toBalance + amount);

      this.emit('Transfer', {
        from: sender,
        to,
        amount,
        metadata: {
          ...metadata,
          timestamp: metadata.timestamp || new Date()
        }
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async transferFrom(
    from: string,
    to: string,
    amount: bigint,
    metadata: TransferMetadata = {}
  ): Promise<boolean> {
    try {
      await this.validateTransfer(from, to, amount);
      await this.validateAllowance(from, this.info.owner, amount);

      // Update balances
      const fromBalance = this.balances.get(from) || 0n;
      const toBalance = this.balances.get(to) || 0n;

      this.balances.set(from, fromBalance - amount);
      this.balances.set(to, toBalance + amount);

      // Update allowance
      const allowance = this.getAllowance(from, this.info.owner);
      this.setAllowance(from, this.info.owner, allowance - amount);

      this.emit('Transfer', {
        from,
        to,
        amount,
        metadata: {
          ...metadata,
          timestamp: metadata.timestamp || new Date()
        }
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async approve(
    spender: string,
    amount: bigint,
    metadata: TransferMetadata = {}
  ): Promise<boolean> {
    try {
      this.setAllowance(this.info.owner, spender, amount);

      this.emit('Approval', {
        owner: this.info.owner,
        spender,
        amount,
        metadata: {
          ...metadata,
          timestamp: metadata.timestamp || new Date()
        }
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  getInfo(): TokenInfo {
    return { ...this.info };
  }

  getBalance(account: string): bigint {
    return this.balances.get(account) || 0n;
  }

  getAllowance(owner: string, spender: string): bigint {
    return this.allowances.get(owner)?.get(spender) || 0n;
  }

  private setAllowance(owner: string, spender: string, amount: bigint): void {
    if (!this.allowances.has(owner)) {
      this.allowances.set(owner, new Map());
    }
    this.allowances.get(owner)!.set(spender, amount);
  }

  private async validateTransfer(
    from: string,
    to: string,
    amount: bigint
  ): Promise<void> {
    if (amount <= 0n) {
      throw new Error('Amount must be positive');
    }

    if (!from || !to) {
      throw new Error('Invalid addresses');
    }

    const fromBalance = this.balances.get(from) || 0n;
    if (fromBalance < amount) {
      throw new Error('Insufficient balance');
    }
  }

  private async validateAllowance(
    owner: string,
    spender: string,
    amount: bigint
  ): Promise<void> {
    const allowance = this.getAllowance(owner, spender);
    if (allowance < amount) {
      throw new Error('Insufficient allowance');
    }
  }

  getMetrics(): TokenMetrics {
    return { ...this.metrics };
  }

  // Token locking/unlocking operations
  async lock(
    address: string,
    amount: bigint,
    reason: string
  ): Promise<boolean> {
    try {
      const balance = this.balances.get(address);
      if (!balance || balance < amount) {
        throw new Error('Insufficient unlocked balance');
      }

      this.balances.set(address, balance - amount);

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
      if (!balance || balance < amount) {
        throw new Error('Insufficient locked balance');
      }

      this.balances.set(address, balance - amount);

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

  // Token minting/burning operations
  async mint(
    to: string,
    amount: bigint
  ): Promise<boolean> {
    try {
      if (to !== this.info.owner) {
        throw new Error('Only owner can mint tokens');
      }

      let balance = this.balances.get(to) || 0n;
      balance += amount;
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
      if (!balance || balance < amount) {
        throw new Error('Insufficient balance');
      }

      this.balances.set(from, balance - amount);

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

  // Update market capitalization
  async updateMarketCap(price: bigint): Promise<void> {
    this.metrics.marketCap = this.info.totalSupply * price;
    this.emit('marketCapUpdated', {
      marketCap: this.metrics.marketCap,
      timestamp: new Date()
    });
  }
} 