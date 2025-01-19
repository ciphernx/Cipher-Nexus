import { ModelFactory } from '../src/core/models/model-factory';
import { 
  ModelType, 
  TaskType, 
  AugmentationType,
  CompressionType,
  DistributedStrategy
} from '../src/core/types';
import { DataAugmentor } from '../src/utils/data-augmentor';
import { ModelCompressor } from '../src/utils/model-compressor';
import { DistributedTrainer } from '../src/utils/distributed-trainer';
import { ModelInterpreter } from '../src/utils/model-interpreter';
import * as fs from 'fs/promises';
import * as path from 'path';

// Data loading functions
async function loadData(): Promise<number[][]> {
  try {
    const dataPath = path.join(__dirname, '../data/training-data.json');
    const rawData = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Error loading training data:', error);
    return [];
  }
}

async function loadLabels(): Promise<number[][]> {
  try {
    const labelsPath = path.join(__dirname, '../data/training-labels.json');
    const rawLabels = await fs.readFile(labelsPath, 'utf-8');
    const labels = JSON.parse(rawLabels);
    // Convert single labels to one-hot encoded arrays
    return labels.map((label: number) => {
      const oneHot = new Array(10).fill(0);
      oneHot[label] = 1;
      return oneHot;
    });
  } catch (error) {
    console.error('Error loading training labels:', error);
    return [];
  }
}

async function main() {
  // 1. Create and configure the model
  const model = await ModelFactory.createModel({
    type: ModelType.TENSORFLOW,
    path: 'models/classifier',
    inputShape: [28, 28, 1],
    outputShape: [10],
    taskType: TaskType.CLASSIFICATION,
    encryptionEnabled: true,
    compressionConfig: {
      type: CompressionType.QUANTIZATION,
      quantizationBits: 8
    },
    distributedConfig: {
      strategy: DistributedStrategy.DATA_PARALLEL,
      numWorkers: 4
    },
    interpretabilityConfig: {
      methods: ['gradientBased', 'layerActivation', 'featureImportance'],
      numSamples: 1000
    }
  });

  // 2. Load sample data
  const data = await loadData(); // Your data loading function
  const labels = await loadLabels(); // Your label loading function

  // 3. Configure data augmentation
  const augmentor = new DataAugmentor({
    noiseScale: 0.1,
    rotationRange: 30,
    flipProbability: 0.5,
    scaleRange: [0.8, 1.2],
    cropSize: 0.8,
    mixupAlpha: 0.2,
    cutoutSize: 0.2
  });

  // Apply data augmentation
  const augmentedData = augmentor.augment(data, [
    AugmentationType.NOISE,
    AugmentationType.ROTATION,
    AugmentationType.FLIP
  ]);

  // 4. Configure distributed training
  const trainer = new DistributedTrainer({
    strategy: DistributedStrategy.DATA_PARALLEL,
    numWorkers: 4,
    batchSizePerWorker: 32
  });

  // Train the model
  const trainingMetrics = await trainer.train(
    model,
    augmentedData,
    labels,
    10 // epochs
  );

  console.log('Training metrics:', trainingMetrics);

  // 5. Compress the model
  const compressor = new ModelCompressor({
    type: CompressionType.QUANTIZATION,
    quantizationBits: 8,
    accuracy: 0.95
  });

  const compressedModel = await compressor.compress(model);
  console.log('Model compressed successfully');

  // 6. Interpret model predictions
  const interpreter = new ModelInterpreter({
    methods: ['gradientBased', 'layerActivation', 'featureImportance'],
    numSamples: 1000,
    targetLayers: ['conv1', 'conv2']
  });

  // Get interpretations for a sample input
  const sampleInput = data[0];
  const interpretations = await interpreter.interpret(
    compressedModel,
    sampleInput,
    labels[0]
  );

  console.log('Model interpretations:', interpretations);

  // Save the compressed model
  await compressedModel.save('models/compressed-classifier');
}

main().catch(console.error); 