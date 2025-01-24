# AI Package API Documentation

## Overview

The AI package provides core functionality for federated learning, model management, and distributed training.

## Core Components

### FederatedLearningProtocol

```typescript
class FederatedLearningProtocol extends EventEmitter {
  constructor(modelConfig: ModelConfig, fedConfig: FederatedConfig);
  
  async initialize(): Promise<void>;
  async registerClient(clientState: ClientState): Promise<void>;
  async startTrainingRound(): Promise<void>;
  async submitUpdate(clientId: string, update: ModelUpdate): Promise<void>;
  getGlobalModel(): Float32Array[] | null;
  getRoundStatus(roundId: number): TrainingRound | undefined;
}
```

### DistributedTrainer

```typescript
class DistributedTrainer {
  constructor(config: DistributedConfig);
  
  async train(
    model: tf.LayersModel,
    data: number[][],
    labels: number[][],
    epochs: number
  ): Promise<ModelMetrics>;
}
```

### ModelCompressor

```typescript
class ModelCompressor {
  constructor(config: CompressionConfig);
  
  async compress(model: tf.LayersModel): Promise<tf.LayersModel>;
  async quantize(model: tf.LayersModel): Promise<tf.LayersModel>;
  async prune(model: tf.LayersModel): Promise<tf.LayersModel>;
}
```

### DataProcessor

```typescript
class DataProcessor {
  static normalizeData(data: number[][]): number[][];
  static standardizeData(data: number[][]): number[][];
  static oneHotEncode(labels: number[], numClasses: number): number[][];
  static processOutput(output: number[], taskType: TaskType): any;
}
```

## Configuration Types

### ModelConfig

```typescript
interface ModelConfig {
  architecture: string;
  hyperparameters: {
    learningRate: number;
    batchSize: number;
    epochs: number;
    optimizer: string;
  };
  inputShape: number[];
  outputShape: number[];
}
```

### FederatedConfig

```typescript
interface FederatedConfig {
  minClients: number;
  roundTimeout: number;
  aggregationStrategy: 'FedAvg' | 'FedProx' | 'FedMA';
  clientSelectionStrategy: 'Random' | 'PowerOfChoice' | 'Reputation';
  privacyConfig: {
    differentialPrivacy: {
      enabled: boolean;
      epsilon: number;
      delta: number;
    };
    secureSummation: {
      enabled: boolean;
      threshold: number;
    };
  };
}
```

### DistributedConfig

```typescript
interface DistributedConfig {
  strategy: DistributedStrategy;
  numWorkers: number;
  batchSizePerWorker: number;
}
```

### CompressionConfig

```typescript
interface CompressionConfig {
  type: CompressionType;
  quantizationBits?: number;
  pruningThreshold?: number;
  accuracy?: number;
}
```

## Events

The FederatedLearningProtocol emits the following events:

- `initialized`: When protocol is initialized
- `clientRegistered`: When a new client is registered
- `roundStarted`: When a training round begins
- `updateReceived`: When a client update is received
- `roundCompleted`: When a training round is completed
- `error`: When an error occurs

## Usage Examples

### Initialize Federated Learning

```typescript
const protocol = new FederatedLearningProtocol(modelConfig, fedConfig);
await protocol.initialize();
```

### Start Training Round

```typescript
await protocol.startTrainingRound();
```

### Submit Client Update

```typescript
await protocol.submitUpdate(clientId, update);
```

### Compress Model

```typescript
const compressor = new ModelCompressor({
  type: CompressionType.QUANTIZATION,
  quantizationBits: 8
});

const compressedModel = await compressor.compress(model);
```

### Process Data

```typescript
const normalizedData = DataProcessor.normalizeData(data);
const encodedLabels = DataProcessor.oneHotEncode(labels, numClasses);
``` 