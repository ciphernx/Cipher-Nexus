import { EventEmitter } from 'events';
import { TokenContract } from '../token/TokenContract';
import { AssetRegistry, RegisteredAsset } from './AssetRegistry';
import { OrderMatcher, Order } from './OrderMatcher';
import { AccessManager } from './AccessManager';
import { PriceOracle } from './PriceOracle';
import { QualityAssessor } from './QualityAssessor';
import { MarketPaymentIntegrator } from './MarketPaymentIntegrator';
import { IncentiveManager } from './IncentiveManager';

interface MarketplaceStats {
  totalAssets: number;
  totalOrders: number;
  totalVolume: bigint;
  activeUsers: number;
  averagePrice: number;
}

interface SearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minQuality?: number;
  owner?: string;
}

interface SortOptions {
  field: 'price' | 'quality' | 'timestamp';
  direction: 'asc' | 'desc';
}

export class DataMarketplaceService extends EventEmitter {
  constructor(
    private assetRegistry: AssetRegistry,
    private orderMatcher: OrderMatcher,
    private accessManager: AccessManager,
    private priceOracle: PriceOracle,
    private qualityAssessor: QualityAssessor,
    private tokenContract: TokenContract,
    private paymentIntegrator: MarketPaymentIntegrator,
    private incentiveManager: IncentiveManager
  ) {
    super();
  }

  async listAsset(
    owner: string,
    metadata: any,
    price: number
  ): Promise<string> {
    try {
      // Register asset
      const assetId = await this.assetRegistry.registerAsset(owner, metadata);

      // Assess quality
      const quality = await this.qualityAssessor.assessQuality(assetId);

      // Create sell order
      const order = await this.orderMatcher.createSellOrder(
        owner,
        assetId,
        price,
        1 // quantity
      );

      this.emit('assetListed', {
        assetId,
        owner,
        price,
        quality,
        timestamp: new Date()
      });

      return assetId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async purchaseAsset(
    buyer: string,
    assetId: string
  ): Promise<string> {
    try {
      const asset = await this.assetRegistry.getAsset(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      // Get sell order
      const sellOrder = await this.orderMatcher.getBestSellOrder(assetId);
      if (!sellOrder) {
        throw new Error('No sell order available');
      }

      // Create and match buy order
      const buyOrder = await this.orderMatcher.createBuyOrder(
        buyer,
        assetId,
        sellOrder.price,
        1 // quantity
      );

      // Process payment
      const transactionId = await this.paymentIntegrator.processPayment(
        buyOrder,
        asset
      );

      // Grant access
      await this.accessManager.grantAccess(buyer, assetId);

      // Release payment after access is granted
      await this.paymentIntegrator.releasePayment(transactionId);

      this.emit('assetPurchased', {
        assetId,
        buyer,
        seller: asset.owner,
        price: sellOrder.price,
        transactionId,
        timestamp: new Date()
      });

      return transactionId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async searchAssets(
    filters: SearchFilters,
    sort?: SortOptions
  ): Promise<RegisteredAsset[]> {
    try {
      let assets = await this.assetRegistry.listAssets();

      // Apply filters
      if (filters.category) {
        assets = assets.filter(asset => asset.metadata.category === filters.category);
      }
      if (filters.minPrice !== undefined) {
        assets = assets.filter(asset => {
          const order = this.orderMatcher.getBestSellOrder(asset.id);
          return order && order.price >= filters.minPrice!;
        });
      }
      if (filters.maxPrice !== undefined) {
        assets = assets.filter(asset => {
          const order = this.orderMatcher.getBestSellOrder(asset.id);
          return order && order.price <= filters.maxPrice!;
        });
      }
      if (filters.minQuality !== undefined) {
        assets = assets.filter(asset => {
          const quality = this.qualityAssessor.getQualityScore(asset.id);
          return quality >= filters.minQuality!;
        });
      }
      if (filters.owner) {
        assets = assets.filter(asset => asset.owner === filters.owner);
      }

      // Apply sorting
      if (sort) {
        assets.sort((a, b) => {
          let valueA: number, valueB: number;

          switch (sort.field) {
            case 'price':
              const orderA = this.orderMatcher.getBestSellOrder(a.id);
              const orderB = this.orderMatcher.getBestSellOrder(b.id);
              valueA = orderA ? orderA.price : 0;
              valueB = orderB ? orderB.price : 0;
              break;
            case 'quality':
              valueA = this.qualityAssessor.getQualityScore(a.id);
              valueB = this.qualityAssessor.getQualityScore(b.id);
              break;
            case 'timestamp':
              valueA = a.createdAt.getTime();
              valueB = b.createdAt.getTime();
              break;
            default:
              return 0;
          }

          return sort.direction === 'asc' ? valueA - valueB : valueB - valueA;
        });
      }

      return assets;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getMarketplaceStats(): Promise<MarketplaceStats> {
    try {
      const assets = await this.assetRegistry.listAssets();
      const orders = await this.orderMatcher.listOrders();
      
      let totalVolume = 0n;
      const uniqueUsers = new Set<string>();
      let totalPrice = 0;
      let priceCount = 0;

      // Calculate stats
      orders.forEach(order => {
        if (order.status === 'filled') {
          totalVolume += BigInt(Math.floor(order.price * order.quantity * 1e18));
          uniqueUsers.add(order.maker);
          totalPrice += order.price;
          priceCount++;
        }
      });

      return {
        totalAssets: assets.length,
        totalOrders: orders.length,
        totalVolume,
        activeUsers: uniqueUsers.size,
        averagePrice: priceCount > 0 ? totalPrice / priceCount : 0
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Staking and rewards methods
  async stakeTokens(
    user: string,
    amount: bigint,
    lockPeriod?: number
  ): Promise<string> {
    return this.incentiveManager.createStakingPosition(user, amount, lockPeriod);
  }

  async claimRewards(positionId: string): Promise<bigint> {
    return this.incentiveManager.claimRewards(positionId);
  }

  async unstakeTokens(positionId: string): Promise<void> {
    return this.incentiveManager.unstake(positionId);
  }

  // Payment related methods
  async getTransaction(transactionId: string) {
    return this.paymentIntegrator.getTransaction(transactionId);
  }

  async refundTransaction(transactionId: string): Promise<void> {
    return this.paymentIntegrator.refundPayment(transactionId);
  }
} 