import { EventEmitter } from 'events';
import { createHash, randomBytes } from 'crypto';

interface SecureAggregationConfig {
  threshold: number;
  keySize: number;
  timeout: number;
}

interface SharePair {
  share: Buffer;
  commitment: Buffer;
}

interface MaskingKey {
  key: Buffer;
  nonce: Buffer;
}

export class SecureAggregation extends EventEmitter {
  private clientKeys: Map<string, MaskingKey> = new Map();
  private clientShares: Map<string, Map<string, SharePair>> = new Map();
  private reconstructionShares: Map<string, Buffer[]> = new Map();
  private aggregationResult: Float32Array[] | null = null;

  constructor(private config: SecureAggregationConfig) {
    super();
  }

  async initializeRound(clientIds: string[]): Promise<void> {
    try {
      // Generate masking keys for each client
      for (const clientId of clientIds) {
        const key = randomBytes(this.config.keySize);
        const nonce = randomBytes(16);
        this.clientKeys.set(clientId, { key, nonce });
      }

      // Generate secret shares for each client
      for (const clientId of clientIds) {
        const shares = await this.generateSecretShares(
          this.clientKeys.get(clientId)!.key,
          clientIds.length,
          this.config.threshold
        );
        this.clientShares.set(clientId, shares);
      }

      this.emit('roundInitialized', { clientIds });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async submitMaskedUpdate(
    clientId: string,
    weights: Float32Array[],
    shares: Map<string, Buffer>
  ): Promise<void> {
    try {
      // Verify shares
      if (!this.verifyShares(clientId, shares)) {
        throw new Error('Invalid shares submitted');
      }

      // Store reconstruction shares
      this.reconstructionShares.set(clientId, Array.from(shares.values()));

      // Apply masking to weights
      const maskedWeights = await this.maskWeights(
        weights,
        this.clientKeys.get(clientId)!
      );

      this.emit('updateMasked', {
        clientId,
        maskedWeights
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async reconstructMasks(
    survivingClients: string[]
  ): Promise<Map<string, Buffer>> {
    try {
      const reconstructedKeys = new Map<string, Buffer>();

      // Check if we have enough shares for reconstruction
      if (survivingClients.length < this.config.threshold) {
        throw new Error('Insufficient shares for reconstruction');
      }

      // Reconstruct keys for each dropped client
      for (const clientId of this.clientKeys.keys()) {
        if (!survivingClients.includes(clientId)) {
          const shares = survivingClients
            .map(id => this.reconstructionShares.get(id)!)
            .filter(Boolean);
          
          const key = await this.reconstructSecret(shares);
          reconstructedKeys.set(clientId, key);
        }
      }

      this.emit('masksReconstructed', {
        reconstructedCount: reconstructedKeys.size
      });

      return reconstructedKeys;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async unmaskAggregation(
    maskedWeights: Float32Array[],
    reconstructedKeys: Map<string, Buffer>
  ): Promise<Float32Array[]> {
    try {
      // Remove all masks using reconstructed keys
      const unmaskedWeights = await this.removeMasks(
        maskedWeights,
        reconstructedKeys
      );

      this.aggregationResult = unmaskedWeights;
      
      this.emit('aggregationUnmasked', {
        weightCount: unmaskedWeights.length
      });

      return unmaskedWeights;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async generateSecretShares(
    secret: Buffer,
    n: number,
    t: number
  ): Promise<Map<string, SharePair>> {
    const shares = new Map<string, SharePair>();
    
    // Generate random coefficients for polynomial
    const coefficients = Array(t - 1)
      .fill(0)
      .map(() => randomBytes(secret.length));
    
    // Generate shares using Shamir's Secret Sharing
    for (let i = 1; i <= n; i++) {
      const x = Buffer.from([i]);
      const share = this.evaluatePolynomial(x, secret, coefficients);
      const commitment = this.computeCommitment(share);
      shares.set(i.toString(), { share, commitment });
    }

    return shares;
  }

  private evaluatePolynomial(
    x: Buffer,
    secret: Buffer,
    coefficients: Buffer[]
  ): Buffer {
    const result = Buffer.alloc(secret.length);
    
    // Evaluate polynomial using Horner's method
    for (let i = 0; i < secret.length; i++) {
      let value = secret[i];
      for (let j = 0; j < coefficients.length; j++) {
        value = (value * x[0] + coefficients[j][i]) % 256;
      }
      result[i] = value;
    }

    return result;
  }

  private computeCommitment(share: Buffer): Buffer {
    return createHash('sha256').update(share).digest();
  }

  private verifyShares(
    clientId: string,
    shares: Map<string, Buffer>
  ): boolean {
    const expectedShares = this.clientShares.get(clientId);
    if (!expectedShares) {
      return false;
    }

    // Verify each share against stored commitments
    for (const [id, share] of shares.entries()) {
      const expectedShare = expectedShares.get(id);
      if (!expectedShare) {
        return false;
      }

      const commitment = this.computeCommitment(share);
      if (!commitment.equals(expectedShare.commitment)) {
        return false;
      }
    }

    return true;
  }

  private async maskWeights(
    weights: Float32Array[],
    key: MaskingKey
  ): Promise<Float32Array[]> {
    const maskedWeights: Float32Array[] = [];

    for (const layerWeights of weights) {
      const maskedLayer = new Float32Array(layerWeights.length);
      
      // Generate deterministic mask using key and nonce
      const mask = await this.generateMask(
        key.key,
        key.nonce,
        layerWeights.length
      );

      // Apply mask to weights
      for (let i = 0; i < layerWeights.length; i++) {
        maskedLayer[i] = layerWeights[i] + mask[i];
      }

      maskedWeights.push(maskedLayer);
    }

    return maskedWeights;
  }

  private async generateMask(
    key: Buffer,
    nonce: Buffer,
    length: number
  ): Promise<Float32Array> {
    // Generate pseudo-random mask using key and nonce
    const mask = new Float32Array(length);
    const hash = createHash('sha256');
    
    for (let i = 0; i < length; i += 32) {
      const counter = Buffer.alloc(4);
      counter.writeUInt32BE(i / 32, 0);
      
      const bytes = hash
        .update(Buffer.concat([key, nonce, counter]))
        .digest();

      for (let j = 0; j < Math.min(32, length - i); j++) {
        mask[i + j] = bytes[j] / 255.0; // Normalize to [0, 1]
      }
    }

    return mask;
  }

  private async reconstructSecret(shares: Buffer[][]): Promise<Buffer> {
    if (shares.length < this.config.threshold) {
      throw new Error('Insufficient shares for reconstruction');
    }

    const secret = Buffer.alloc(shares[0][0].length);
    
    // Lagrange interpolation at x = 0
    for (let i = 0; i < shares.length; i++) {
      let numerator = 1;
      let denominator = 1;

      for (let j = 0; j < shares.length; j++) {
        if (i !== j) {
          numerator *= -j - 1;
          denominator *= i - j;
        }
      }

      const coefficient = numerator / denominator;
      
      for (let k = 0; k < secret.length; k++) {
        secret[k] = (secret[k] + coefficient * shares[i][0][k]) % 256;
      }
    }

    return secret;
  }

  private async removeMasks(
    maskedWeights: Float32Array[],
    reconstructedKeys: Map<string, Buffer>
  ): Promise<Float32Array[]> {
    const unmaskedWeights: Float32Array[] = [];

    for (let layer = 0; layer < maskedWeights.length; layer++) {
      const unmaskedLayer = new Float32Array(maskedWeights[layer].length);
      
      // Start with masked weights
      for (let i = 0; i < unmaskedLayer.length; i++) {
        unmaskedLayer[i] = maskedWeights[layer][i];
      }

      // Remove each mask
      for (const [clientId, key] of reconstructedKeys.entries()) {
        const clientKey = this.clientKeys.get(clientId);
        if (!clientKey) continue;

        const mask = await this.generateMask(
          key,
          clientKey.nonce,
          unmaskedLayer.length
        );

        // Subtract mask
        for (let i = 0; i < unmaskedLayer.length; i++) {
          unmaskedLayer[i] -= mask[i];
        }
      }

      unmaskedWeights.push(unmaskedLayer);
    }

    return unmaskedWeights;
  }
} 