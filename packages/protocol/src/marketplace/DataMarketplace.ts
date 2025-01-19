import { EventEmitter } from 'events';
import { createHash } from 'crypto';

interface DataAsset {
  id: string;
  name: string;
  description: string;
  owner: string;
  price: number;
  size: number;
  type: 'tabular' | 'image' | 'text';
  status: 'listed' | 'unlisted' | 'trading' | 'sold';
  encryptionStatus: 'raw' | 'encrypted';
  privacyScore: number;
  metadata: {
    recordCount: number;
    schema?: string[];
    dataTypes?: { [key: string]: string };
    quality: {
      completeness: number;
      accuracy: number;
      consistency: number;
    };
    lastUpdated: Date;
  };
  accessControl: {
    allowedUsers: string[];
    allowedRoles: string[];
    restrictions: string[];
  };
}

interface DataToken {
  tokenId: string;
  assetId: string;
  owner: string;
  totalSupply: number;
  currentSupply: number;
  mintPrice: number;
  burnPrice: number;
  tradingHistory: {
    timestamp: Date;
    action: 'mint' | 'burn' | 'transfer';
    from: string;
    to: string;
    amount: number;
    price: number;
  }[];
}

interface PricingConfig {
  basePrice: number;
  qualityMultiplier: number;
  demandMultiplier: number;
  privacyMultiplier: number;
  volumeDiscount: number;
}

interface AccessRequest {
  id: string;
  assetId: string;
  requestor: string;
  status: 'pending' | 'approved' | 'rejected';
  purpose: string;
  requestedAt: Date;
  validUntil: Date;
}

export class DataMarketplace extends EventEmitter {
  private assets: Map<string, DataAsset> = new Map();
  private tokens: Map<string, DataToken> = new Map();
  private accessRequests: Map<string, AccessRequest> = new Map();
  private pricingConfig: PricingConfig;

  constructor(pricingConfig: PricingConfig) {
    super();
    this.pricingConfig = pricingConfig;
  }

  async listAsset(asset: Omit<DataAsset, 'id' | 'status'>): Promise<string> {
    try {
      // Generate unique asset ID
      const assetId = this.generateAssetId(asset);

      // Create asset listing
      const newAsset: DataAsset = {
        ...asset,
        id: assetId,
        status: 'listed',
        privacyScore: await this.calculatePrivacyScore(asset)
      };

      // Store asset
      this.assets.set(assetId, newAsset);

      // Create data token
      const token = await this.createDataToken(assetId, asset.owner);

      this.emit('assetListed', {
        assetId,
        owner: asset.owner,
        tokenId: token.tokenId
      });

      return assetId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async purchaseAccess(
    assetId: string,
    buyer: string,
    amount: number
  ): Promise<void> {
    try {
      const asset = this.assets.get(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      const token = this.tokens.get(assetId);
      if (!token) {
        throw new Error('Token not found');
      }

      // Verify buyer has sufficient funds (implement in production)
      // await this.verifyFunds(buyer, amount * asset.price);

      // Calculate total price with discounts
      const totalPrice = this.calculatePrice(asset, amount);

      // Update token state
      token.tradingHistory.push({
        timestamp: new Date(),
        action: 'transfer',
        from: asset.owner,
        to: buyer,
        amount,
        price: totalPrice
      });

      // Update access control
      asset.accessControl.allowedUsers.push(buyer);

      this.emit('accessPurchased', {
        assetId,
        buyer,
        amount,
        price: totalPrice
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async requestAccess(request: Omit<AccessRequest, 'id' | 'status' | 'requestedAt'>): Promise<string> {
    try {
      const requestId = this.generateRequestId(request);
      
      const newRequest: AccessRequest = {
        ...request,
        id: requestId,
        status: 'pending',
        requestedAt: new Date()
      };

      this.accessRequests.set(requestId, newRequest);

      this.emit('accessRequested', {
        requestId,
        assetId: request.assetId,
        requestor: request.requestor
      });

      return requestId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async approveAccess(requestId: string): Promise<void> {
    try {
      const request = this.accessRequests.get(requestId);
      if (!request) {
        throw new Error('Request not found');
      }

      const asset = this.assets.get(request.assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      // Update request status
      request.status = 'approved';

      // Update asset access control
      asset.accessControl.allowedUsers.push(request.requestor);

      this.emit('accessApproved', {
        requestId,
        assetId: request.assetId,
        requestor: request.requestor
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async updateAsset(assetId: string, updates: Partial<DataAsset>): Promise<void> {
    try {
      const asset = this.assets.get(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      // Update asset
      Object.assign(asset, updates);
      asset.metadata.lastUpdated = new Date();

      // Recalculate privacy score if necessary
      if (updates.encryptionStatus || updates.metadata?.quality) {
        asset.privacyScore = await this.calculatePrivacyScore(asset);
      }

      this.emit('assetUpdated', {
        assetId,
        updates
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getAsset(assetId: string): Promise<DataAsset | undefined> {
    return this.assets.get(assetId);
  }

  async getToken(tokenId: string): Promise<DataToken | undefined> {
    return this.tokens.get(tokenId);
  }

  async getAccessRequest(requestId: string): Promise<AccessRequest | undefined> {
    return this.accessRequests.get(requestId);
  }

  private async createDataToken(
    assetId: string,
    owner: string
  ): Promise<DataToken> {
    const tokenId = this.generateTokenId(assetId);
    
    const token: DataToken = {
      tokenId,
      assetId,
      owner,
      totalSupply: 1000000, // Initial supply
      currentSupply: 1000000,
      mintPrice: 1.0, // Initial prices
      burnPrice: 0.5,
      tradingHistory: []
    };

    this.tokens.set(tokenId, token);
    return token;
  }

  private calculatePrice(asset: DataAsset, amount: number): number {
    const basePrice = asset.price * amount;
    
    // Apply quality multiplier
    const qualityScore = (
      asset.metadata.quality.completeness +
      asset.metadata.quality.accuracy +
      asset.metadata.quality.consistency
    ) / 3;
    const qualityAdjustment = basePrice * (qualityScore * this.pricingConfig.qualityMultiplier);

    // Apply privacy multiplier
    const privacyAdjustment = basePrice * (asset.privacyScore * this.pricingConfig.privacyMultiplier);

    // Apply volume discount
    const volumeDiscount = basePrice * (amount * this.pricingConfig.volumeDiscount);

    return basePrice + qualityAdjustment + privacyAdjustment - volumeDiscount;
  }

  private async calculatePrivacyScore(asset: Partial<DataAsset>): Promise<number> {
    let score = 0;

    // Base score from encryption status
    if (asset.encryptionStatus === 'encrypted') {
      score += 0.5;
    }

    // Score from data quality
    if (asset.metadata?.quality) {
      const qualityScore = (
        asset.metadata.quality.completeness +
        asset.metadata.quality.accuracy +
        asset.metadata.quality.consistency
      ) / 3;
      score += qualityScore * 0.3;
    }

    // Score from access control
    if (asset.accessControl) {
      const restrictionScore = asset.accessControl.restrictions.length * 0.05;
      score += Math.min(restrictionScore, 0.2);
    }

    return Math.min(score, 1);
  }

  private generateAssetId(asset: Partial<DataAsset>): string {
    const hash = createHash('sha256');
    hash.update(asset.owner + asset.name + Date.now().toString());
    return hash.digest('hex').substring(0, 16);
  }

  private generateTokenId(assetId: string): string {
    const hash = createHash('sha256');
    hash.update(assetId + Date.now().toString());
    return hash.digest('hex').substring(0, 16);
  }

  private generateRequestId(request: Partial<AccessRequest>): string {
    const hash = createHash('sha256');
    hash.update(request.assetId + request.requestor + Date.now().toString());
    return hash.digest('hex').substring(0, 16);
  }
} 