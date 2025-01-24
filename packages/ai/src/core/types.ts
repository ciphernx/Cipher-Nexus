import { Buffer } from 'buffer';

export enum ModelType {
  TENSORFLOW = 'tensorflow',
  ONNX = 'onnx',
  PYTORCH = 'pytorch',
  SCIKIT = 'scikit',
  XGBOOST = 'xgboost',
  LIGHTGBM = 'lightgbm'
}

export enum TaskType {
  CLASSIFICATION = 'classification',
  REGRESSION = 'regression',
  CLUSTERING = 'clustering',
  ANOMALY_DETECTION = 'anomaly_detection',
  OBJECT_DETECTION = 'object_detection',
  SEGMENTATION = 'segmentation',
  NLP = 'nlp'
}

export enum AugmentationType {
  NOISE = 'noise',
  ROTATION = 'rotation',
  FLIP = 'flip',
  SCALE = 'scale',
  CROP = 'crop',
  MIXUP = 'mixup',
  CUTOUT = 'cutout'
}

export enum CompressionType {
  QUANTIZATION = 'quantization',
  PRUNING = 'pruning',
  KNOWLEDGE_DISTILLATION = 'knowledge_distillation',
  WEIGHT_CLUSTERING = 'weight_clustering'
}

export enum DistributedStrategy {
  DATA_PARALLEL = 'data_parallel',
  MODEL_PARALLEL = 'model_parallel',
  PIPELINE_PARALLEL = 'pipeline_parallel',
  FEDERATED = 'federated'
}

export interface ModelConfig {
  layers: {
    units: number;
    inputDim: number;
  }[];
}

export interface TrainingConfig {
  batchSize: number;
  epochs: number;
  learningRate: number;
  optimizer: string;
  loss: string;
  metrics: string[];
  validationSplit?: number;
  augmentationTypes?: AugmentationType[];
  augmentationConfig?: AugmentationConfig;
  distributedStrategy?: DistributedStrategy;
}

export interface PredictionResult {
  output: number[] | number[][];
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface ModelMetrics {
  accuracy?: number;
  loss?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  [key: string]: number | undefined;
}

export interface EncryptedData {
  data: Buffer;
  iv: Buffer;
  tag?: Buffer;
}

export interface SecureModelConfig extends ModelConfig {
  encryptionKey?: Buffer;
  threshold?: number;
  participants?: string[];
}

export interface ModelState {
  weights: number[][][];
  round: number;
  metrics: {
    accuracy: number;
    loss: number;
    timestamp: Date;
  };
}

export interface ModelUpdate {
  clientId: string;
  weights: number[][][];
  metrics?: {
    accuracy: number;
    loss: number;
  };
}

export interface CompressionConfig {
  type: CompressionType;
  targetSize?: number;
  accuracy?: number;
  sparsity?: number;
  quantizationBits?: number;
  teacherModel?: string;
}

export interface DistributedConfig {
  strategy: DistributedStrategy;
  numWorkers: number;
  workerEndpoints?: string[];
  batchSizePerWorker?: number;
  communicationProtocol?: string;
}

export interface InterpretabilityConfig {
  methods: string[];
  numSamples?: number;
  targetLayers?: string[];
  visualizationFormat?: string;
}

export interface AugmentationConfig {
  noiseScale?: number;
  rotationRange?: number;
  flipProbability?: number;
  scaleRange?: [number, number];
  cropSize?: number;
  mixupAlpha?: number;
  cutoutSize?: number;
}

export interface FederatedConfig {
  enablePrivacy: boolean;
  maxWeightMagnitude: number;
  minClientUpdates: number;
} 