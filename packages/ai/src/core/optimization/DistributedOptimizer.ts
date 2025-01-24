import { EventEmitter } from 'events';
import { ModelUpdate } from '../../types/federated';

interface OptimizerConfig {
  // Gradient compression
  compressionRate: number;
  useSparsification: boolean;
  errorFeedback: boolean;
  
  // Communication optimization
  batchSize: number;
  useAdaptiveBatching: boolean;
  bandwidthThreshold: number;
  
  // Asynchronous training
  staleness: number;
  useAdaptiveStaleness: boolean;
  maxStaleness: number;
}

interface CompressionState {
  residuals: Float32Array[];
  sparseMask: boolean[][];
  lastUpdate: Float32Array[];
}

export class DistributedOptimizer extends EventEmitter {
  private compressionStates: Map<string, CompressionState> = new Map();
  private updateQueue: ModelUpdate[] = [];
  private clientLatencies: Map<string, number[]> = new Map();
  private lastGlobalUpdate: number = Date.now();

  constructor(private config: OptimizerConfig) {
    super();
  }

  async optimizeUpdate(
    update: ModelUpdate,
    globalVersion: number
  ): Promise<ModelUpdate> {
    try {
      // 1. Check staleness
      const staleness = this.checkStaleness(update, globalVersion);
      if (staleness > this.getMaxStaleness(update.clientId)) {
        throw new Error('Update too stale');
      }

      // 2. Apply gradient compression
      const compressedUpdate = await this.compressGradients(update);

      // 3. Update compression state
      await this.updateCompressionState(update.clientId, compressedUpdate);

      // 4. Optimize communication
      const optimizedUpdate = await this.optimizeCommunication(compressedUpdate);

      this.emit('updateOptimized', {
        clientId: update.clientId,
        staleness,
        compressionRate: this.getCompressionRate(compressedUpdate)
      });

      return optimizedUpdate;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async batchOptimize(updates: ModelUpdate[]): Promise<ModelUpdate[]> {
    try {
      // Add updates to queue
      this.updateQueue.push(...updates);

      // Check if we have enough updates for batching
      if (this.updateQueue.length < this.getBatchSize()) {
        return [];
      }

      // Process batch
      const batch = this.updateQueue.splice(0, this.getBatchSize());
      const optimizedBatch: ModelUpdate[] = [];

      for (const update of batch) {
        const optimizedUpdate = await this.optimizeUpdate(
          update,
          this.getGlobalVersion()
        );
        optimizedBatch.push(optimizedUpdate);
      }

      this.emit('batchOptimized', {
        batchSize: optimizedBatch.length,
        queueSize: this.updateQueue.length
      });

      return optimizedBatch;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  updateClientLatency(clientId: string, latency: number): void {
    if (!this.clientLatencies.has(clientId)) {
      this.clientLatencies.set(clientId, []);
    }
    
    const latencies = this.clientLatencies.get(clientId)!;
    latencies.push(latency);
    
    // Keep only recent latencies
    if (latencies.length > 10) {
      latencies.shift();
    }
  }

  private async compressGradients(
    update: ModelUpdate
  ): Promise<ModelUpdate> {
    const compressedWeights: Float32Array[] = [];
    const compressionState = this.getCompressionState(update.clientId);

    for (let layer = 0; layer < update.weights.length; layer++) {
      const layerWeights = update.weights[layer];
      let compressedLayer: Float32Array;

      if (this.config.useSparsification) {
        // Apply gradient sparsification
        compressedLayer = await this.sparsifyGradients(
          layerWeights,
          compressionState.sparseMask[layer]
        );
      } else {
        // Apply quantization
        compressedLayer = await this.quantizeGradients(
          layerWeights,
          this.config.compressionRate
        );
      }

      // Apply error feedback if enabled
      if (this.config.errorFeedback) {
        compressedLayer = this.applyErrorFeedback(
          compressedLayer,
          compressionState.residuals[layer]
        );
      }

      compressedWeights.push(compressedLayer);
    }

    return {
      ...update,
      weights: compressedWeights
    };
  }

  private async sparsifyGradients(
    weights: Float32Array,
    sparseMask: boolean[]
  ): Promise<Float32Array> {
    const compressed = new Float32Array(weights.length);
    const threshold = this.computeSparsificationThreshold(weights);

    for (let i = 0; i < weights.length; i++) {
      if (Math.abs(weights[i]) >= threshold) {
        compressed[i] = weights[i];
        sparseMask[i] = true;
      } else {
        compressed[i] = 0;
        sparseMask[i] = false;
      }
    }

    return compressed;
  }

  private async quantizeGradients(
    weights: Float32Array,
    bits: number
  ): Promise<Float32Array> {
    const compressed = new Float32Array(weights.length);
    const scale = this.computeQuantizationScale(weights, bits);
    const maxVal = Math.pow(2, bits - 1) - 1;

    for (let i = 0; i < weights.length; i++) {
      // Quantize to specified bits
      const quantized = Math.round(weights[i] / scale);
      compressed[i] = Math.max(-maxVal, Math.min(maxVal, quantized)) * scale;
    }

    return compressed;
  }

  private applyErrorFeedback(
    compressed: Float32Array,
    residuals: Float32Array
  ): Float32Array {
    const feedback = new Float32Array(compressed.length);

    for (let i = 0; i < compressed.length; i++) {
      // Add residual error from previous compression
      feedback[i] = compressed[i] + residuals[i];
      // Update residual
      residuals[i] = feedback[i] - compressed[i];
    }

    return feedback;
  }

  private async optimizeCommunication(
    update: ModelUpdate
  ): Promise<ModelUpdate> {
    // Implement communication optimization strategies
    // 1. Adaptive batch size based on network conditions
    if (this.config.useAdaptiveBatching) {
      const avgLatency = this.getAverageLatency(update.clientId);
      if (avgLatency > this.config.bandwidthThreshold) {
        // Increase batch size to reduce communication frequency
        this.increaseBatchSize();
      } else {
        // Decrease batch size to reduce latency
        this.decreaseBatchSize();
      }
    }

    return update;
  }

  private getCompressionState(clientId: string): CompressionState {
    if (!this.compressionStates.has(clientId)) {
      // Initialize compression state for new client
      this.compressionStates.set(clientId, {
        residuals: [],
        sparseMask: [],
        lastUpdate: []
      });
    }
    return this.compressionStates.get(clientId)!;
  }

  private async updateCompressionState(
    clientId: string,
    update: ModelUpdate
  ): Promise<void> {
    const state = this.getCompressionState(clientId);

    // Initialize or resize arrays if needed
    if (state.residuals.length !== update.weights.length) {
      state.residuals = update.weights.map(layer => 
        new Float32Array(layer.length)
      );
      state.sparseMask = update.weights.map(layer =>
        new Array(layer.length).fill(false)
      );
      state.lastUpdate = update.weights.map(layer =>
        new Float32Array(layer.length)
      );
    }

    // Update last update
    for (let layer = 0; layer < update.weights.length; layer++) {
      state.lastUpdate[layer] = new Float32Array(update.weights[layer]);
    }
  }

  private computeSparsificationThreshold(weights: Float32Array): number {
    // Compute threshold for top-k sparsification
    const sorted = Array.from(weights)
      .map(Math.abs)
      .sort((a, b) => b - a);
    const k = Math.ceil(weights.length * (1 - this.config.compressionRate));
    return sorted[k - 1];
  }

  private computeQuantizationScale(weights: Float32Array, bits: number): number {
    // Compute scaling factor for quantization
    const maxAbs = Math.max(...Array.from(weights).map(Math.abs));
    return maxAbs / (Math.pow(2, bits - 1) - 1);
  }

  private checkStaleness(update: ModelUpdate, globalVersion: number): number {
    return globalVersion - update.round;
  }

  private getMaxStaleness(clientId: string): number {
    if (!this.config.useAdaptiveStaleness) {
      return this.config.staleness;
    }

    // Compute adaptive staleness based on client performance
    const avgLatency = this.getAverageLatency(clientId);
    const baselineStaleness = this.config.staleness;
    
    // Increase staleness for slower clients
    const adaptiveStaleness = Math.min(
      this.config.maxStaleness,
      baselineStaleness * (1 + avgLatency / 1000) // Adjust based on latency in seconds
    );

    return Math.floor(adaptiveStaleness);
  }

  private getAverageLatency(clientId: string): number {
    const latencies = this.clientLatencies.get(clientId);
    if (!latencies || latencies.length === 0) {
      return 0;
    }
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  private getBatchSize(): number {
    if (!this.config.useAdaptiveBatching) {
      return this.config.batchSize;
    }
    // TODO: Implement adaptive batch size based on system metrics
    return this.config.batchSize;
  }

  private increaseBatchSize(): void {
    // Implement adaptive batch size increase
    this.config.batchSize = Math.min(
      this.config.batchSize * 2,
      100 // Maximum batch size
    );
  }

  private decreaseBatchSize(): void {
    // Implement adaptive batch size decrease
    this.config.batchSize = Math.max(
      Math.floor(this.config.batchSize / 2),
      1 // Minimum batch size
    );
  }

  private getGlobalVersion(): number {
    return Math.floor((Date.now() - this.lastGlobalUpdate) / 1000);
  }

  private getCompressionRate(update: ModelUpdate): number {
    let originalSize = 0;
    let compressedSize = 0;

    for (const layer of update.weights) {
      originalSize += layer.length * 4; // 4 bytes per float32
      compressedSize += this.getCompressedLayerSize(layer);
    }

    return compressedSize / originalSize;
  }

  private getCompressedLayerSize(layer: Float32Array): number {
    if (this.config.useSparsification) {
      // Count non-zero elements
      let nonZero = 0;
      for (let i = 0; i < layer.length; i++) {
        if (layer[i] !== 0) nonZero++;
      }
      // Size = indices (4 bytes each) + values (4 bytes each)
      return nonZero * 8;
    } else {
      // Size with quantization
      return layer.length * (this.config.compressionRate / 8);
    }
  }
} 