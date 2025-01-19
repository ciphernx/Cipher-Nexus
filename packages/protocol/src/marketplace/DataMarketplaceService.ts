import { DataMarketplace } from './DataMarketplace';
import { DifferentialPrivacy } from '../core/privacy/DifferentialPrivacy';
import { HomomorphicEncryption } from '../core/privacy/HomomorphicEncryption';

interface MarketplaceStats {
  totalAssets: number;
  totalVolume: number;
  activeTraders: number;
  averagePrice: number;
  topCategories: Array<{
    type: string;
    count: number;
  }>;
}

interface SearchFilters {
  type?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  privacyScore?: number;
  status?: string[];
  owner?: string;
}

interface SortOptions {
  field: 'price' | 'privacyScore' | 'lastUpdated' | 'recordCount';
  order: 'asc' | 'desc';
}

export class DataMarketplaceService {
  private marketplace: DataMarketplace;
  private differentialPrivacy: DifferentialPrivacy;
  private homomorphicEncryption: HomomorphicEncryption;

  constructor(
    marketplace: DataMarketplace,
    differentialPrivacy: DifferentialPrivacy,
    homomorphicEncryption: HomomorphicEncryption
  ) {
    this.marketplace = marketplace;
    this.differentialPrivacy = differentialPrivacy;
    this.homomorphicEncryption = homomorphicEncryption;

    this.setupEventHandlers();
  }

  async listAsset(asset: any): Promise<string> {
    try {
      // Validate asset data
      this.validateAssetData(asset);

      // Calculate data quality metrics
      const quality = await this.calculateDataQuality(asset);

      // Prepare asset with quality metrics
      const assetWithQuality = {
        ...asset,
        metadata: {
          ...asset.metadata,
          quality
        }
      };

      // List asset in marketplace
      const assetId = await this.marketplace.listAsset(assetWithQuality);

      return assetId;
    } catch (error) {
      console.error('Failed to list asset:', error);
      throw error;
    }
  }

  async searchAssets(
    filters: SearchFilters,
    sort: SortOptions,
    page: number,
    limit: number
  ): Promise<{
    assets: any[];
    total: number;
  }> {
    try {
      // Get all assets
      const allAssets = Array.from(await this.getAllAssets());

      // Apply filters
      let filteredAssets = this.applyFilters(allAssets, filters);

      // Apply sorting
      filteredAssets = this.applySorting(filteredAssets, sort);

      // Apply pagination
      const start = (page - 1) * limit;
      const paginatedAssets = filteredAssets.slice(start, start + limit);

      return {
        assets: paginatedAssets,
        total: filteredAssets.length
      };
    } catch (error) {
      console.error('Failed to search assets:', error);
      throw error;
    }
  }

  async purchaseDataAccess(
    assetId: string,
    buyer: string,
    amount: number
  ): Promise<void> {
    try {
      // Verify asset exists and is available
      const asset = await this.marketplace.getAsset(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      if (asset.status !== 'listed') {
        throw new Error('Asset is not available for purchase');
      }

      // Process purchase
      await this.marketplace.purchaseAccess(assetId, buyer, amount);

      // Setup secure data access
      await this.setupSecureAccess(assetId, buyer);
    } catch (error) {
      console.error('Failed to purchase access:', error);
      throw error;
    }
  }

  async getMarketplaceStats(): Promise<MarketplaceStats> {
    try {
      const assets = Array.from(await this.getAllAssets());

      // Calculate statistics
      const stats: MarketplaceStats = {
        totalAssets: assets.length,
        totalVolume: 0,
        activeTraders: new Set(assets.flatMap(a => a.accessControl.allowedUsers)).size,
        averagePrice: 0,
        topCategories: []
      };

      // Calculate total volume and average price
      const prices = assets.map(a => a.price);
      stats.totalVolume = prices.reduce((sum, price) => sum + price, 0);
      stats.averagePrice = stats.totalVolume / assets.length;

      // Calculate top categories
      const categoryCount = new Map<string, number>();
      assets.forEach(asset => {
        const count = categoryCount.get(asset.type) || 0;
        categoryCount.set(asset.type, count + 1);
      });

      stats.topCategories = Array.from(categoryCount.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return stats;
    } catch (error) {
      console.error('Failed to get marketplace stats:', error);
      throw error;
    }
  }

  async updateAssetMetadata(
    assetId: string,
    updates: any
  ): Promise<void> {
    try {
      // Verify asset exists
      const asset = await this.marketplace.getAsset(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      // Update metadata
      await this.marketplace.updateAsset(assetId, {
        metadata: {
          ...asset.metadata,
          ...updates,
          lastUpdated: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to update asset metadata:', error);
      throw error;
    }
  }

  private async getAllAssets(): Promise<any[]> {
    // In a real implementation, this would be replaced with a database query
    const assets: any[] = [];
    for (const [_, asset] of this.marketplace.assets) {
      assets.push(asset);
    }
    return assets;
  }

  private applyFilters(assets: any[], filters: SearchFilters): any[] {
    return assets.filter(asset => {
      // Type filter
      if (filters.type && !filters.type.includes(asset.type)) {
        return false;
      }

      // Price range filter
      if (filters.priceRange) {
        if (asset.price < filters.priceRange.min || asset.price > filters.priceRange.max) {
          return false;
        }
      }

      // Privacy score filter
      if (filters.privacyScore && asset.privacyScore < filters.privacyScore) {
        return false;
      }

      // Status filter
      if (filters.status && !filters.status.includes(asset.status)) {
        return false;
      }

      // Owner filter
      if (filters.owner && asset.owner !== filters.owner) {
        return false;
      }

      return true;
    });
  }

  private applySorting(assets: any[], sort: SortOptions): any[] {
    return assets.sort((a, b) => {
      let valueA, valueB;

      switch (sort.field) {
        case 'price':
          valueA = a.price;
          valueB = b.price;
          break;
        case 'privacyScore':
          valueA = a.privacyScore;
          valueB = b.privacyScore;
          break;
        case 'lastUpdated':
          valueA = new Date(a.metadata.lastUpdated).getTime();
          valueB = new Date(b.metadata.lastUpdated).getTime();
          break;
        case 'recordCount':
          valueA = a.metadata.recordCount;
          valueB = b.metadata.recordCount;
          break;
        default:
          return 0;
      }

      return sort.order === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }

  private async calculateDataQuality(asset: any): Promise<{
    completeness: number;
    accuracy: number;
    consistency: number;
  }> {
    // This is a simplified implementation
    // In production, implement proper data quality assessment
    return {
      completeness: 0.95,
      accuracy: 0.90,
      consistency: 0.85
    };
  }

  private validateAssetData(asset: any): void {
    const requiredFields = ['name', 'description', 'owner', 'price', 'type'];
    for (const field of requiredFields) {
      if (!asset[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (asset.price <= 0) {
      throw new Error('Price must be greater than 0');
    }

    const validTypes = ['tabular', 'image', 'text'];
    if (!validTypes.includes(asset.type)) {
      throw new Error('Invalid asset type');
    }
  }

  private async setupSecureAccess(assetId: string, userId: string): Promise<void> {
    try {
      const asset = await this.marketplace.getAsset(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      // Apply differential privacy if enabled
      if (asset.metadata?.privacy?.useDifferentialPrivacy) {
        await this.differentialPrivacy.applyDifferentialPrivacy(
          asset,
          10 // batch size
        );
      }

      // Apply homomorphic encryption if enabled
      if (asset.metadata?.privacy?.useHomomorphicEncryption) {
        const encryptedData = await this.homomorphicEncryption.encryptWeights(
          asset.data
        );
        // Store encrypted data for user access
      }
    } catch (error) {
      console.error('Failed to setup secure access:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    this.marketplace.on('assetListed', (event) => {
      console.log('New asset listed:', event);
    });

    this.marketplace.on('accessPurchased', (event) => {
      console.log('Access purchased:', event);
    });

    this.marketplace.on('error', (error) => {
      console.error('Marketplace error:', error);
    });
  }
} 