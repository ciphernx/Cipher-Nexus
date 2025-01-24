import { EventEmitter } from 'events';
import { createHash } from 'crypto';

interface AssetMetadata {
  name: string;
  description: string;
  type: 'dataset' | 'model' | 'algorithm';
  format: string;
  size: number;
  schema?: Record<string, string>;
  tags: string[];
  license: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AssetQuality {
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  reliability: number;
  score: number;
}

interface AssetVerification {
  hash: string;
  signature: string;
  timestamp: Date;
  verifier: string;
  status: 'pending' | 'verified' | 'rejected';
}

export interface RegisteredAsset {
  id: string;
  owner: string;
  metadata: AssetMetadata;
  quality: AssetQuality;
  verification: AssetVerification;
  status: 'draft' | 'pending' | 'active' | 'suspended' | 'retired';
  pricing: {
    basePrice: number;
    currency: string;
    minimumPurchase: number;
    discountStrategy?: {
      volume: number;
      timeCommitment: number;
    };
  };
}

export class AssetRegistry extends EventEmitter {
  private assets: Map<string, RegisteredAsset> = new Map();
  private verificationQueue: string[] = [];

  constructor() {
    super();
  }

  async registerAsset(
    owner: string,
    metadata: AssetMetadata,
    pricing: RegisteredAsset['pricing']
  ): Promise<string> {
    try {
      const assetId = this.generateAssetId(owner, metadata);
      
      // Calculate initial quality metrics
      const quality = await this.assessQuality(metadata);
      
      // Create verification record
      const verification: AssetVerification = {
        hash: await this.calculateHash(metadata),
        signature: '',
        timestamp: new Date(),
        verifier: '',
        status: 'pending'
      };

      const asset: RegisteredAsset = {
        id: assetId,
        owner,
        metadata,
        quality,
        verification,
        status: 'draft',
        pricing
      };

      this.assets.set(assetId, asset);
      this.verificationQueue.push(assetId);

      this.emit('assetRegistered', {
        assetId,
        owner,
        timestamp: new Date()
      });

      return assetId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async verifyAsset(assetId: string, verifier: string): Promise<void> {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    try {
      // Verify asset hash
      const currentHash = await this.calculateHash(asset.metadata);
      if (currentHash !== asset.verification.hash) {
        throw new Error('Asset hash mismatch');
      }

      // Update verification status
      asset.verification = {
        ...asset.verification,
        verifier,
        status: 'verified',
        timestamp: new Date()
      };

      // Update asset status
      asset.status = 'active';

      this.emit('assetVerified', {
        assetId,
        verifier,
        timestamp: new Date()
      });
    } catch (error) {
      asset.verification.status = 'rejected';
      this.emit('error', error);
      throw error;
    }
  }

  async updateAsset(
    assetId: string,
    updates: Partial<RegisteredAsset>
  ): Promise<void> {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    try {
      // Update metadata if provided
      if (updates.metadata) {
        asset.metadata = {
          ...asset.metadata,
          ...updates.metadata,
          updatedAt: new Date()
        };
        
        // Recalculate quality and hash
        asset.quality = await this.assessQuality(asset.metadata);
        asset.verification.hash = await this.calculateHash(asset.metadata);
        asset.verification.status = 'pending';
        
        this.verificationQueue.push(assetId);
      }

      // Update pricing if provided
      if (updates.pricing) {
        asset.pricing = {
          ...asset.pricing,
          ...updates.pricing
        };
      }

      this.emit('assetUpdated', {
        assetId,
        updates,
        timestamp: new Date()
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getAsset(assetId: string): Promise<RegisteredAsset | undefined> {
    return this.assets.get(assetId);
  }

  async listAssets(
    filter?: {
      owner?: string;
      type?: string;
      status?: string;
      verificationStatus?: string;
    }
  ): Promise<RegisteredAsset[]> {
    let assets = Array.from(this.assets.values());

    if (filter) {
      assets = assets.filter(asset => {
        if (filter.owner && asset.owner !== filter.owner) return false;
        if (filter.type && asset.metadata.type !== filter.type) return false;
        if (filter.status && asset.status !== filter.status) return false;
        if (filter.verificationStatus && 
            asset.verification.status !== filter.verificationStatus) return false;
        return true;
      });
    }

    return assets;
  }

  private async assessQuality(metadata: AssetMetadata): Promise<AssetQuality> {
    // Implement quality assessment logic
    const quality: AssetQuality = {
      completeness: 0.9,  // Placeholder values
      accuracy: 0.85,
      consistency: 0.88,
      timeliness: 0.95,
      reliability: 0.92,
      score: 0
    };

    // Calculate overall quality score
    quality.score = (
      quality.completeness * 0.25 +
      quality.accuracy * 0.25 +
      quality.consistency * 0.2 +
      quality.timeliness * 0.15 +
      quality.reliability * 0.15
    );

    return quality;
  }

  private async calculateHash(metadata: AssetMetadata): Promise<string> {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(metadata));
    return hash.digest('hex');
  }

  private generateAssetId(owner: string, metadata: AssetMetadata): string {
    const hash = createHash('sha256');
    hash.update(owner + JSON.stringify(metadata) + Date.now().toString());
    return hash.digest('hex').substring(0, 16);
  }
} 