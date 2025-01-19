import * as ort from 'onnxruntime-node';
import { BaseModel } from './base-model';
import { ModelConfig, TrainingConfig, PredictionResult, ModelMetrics } from '../types';

export class ONNXModel extends BaseModel {
  private session: ort.InferenceSession | null = null;

  constructor(config: ModelConfig) {
    super(config);
    this.validateConfig();
  }

  async load(): Promise<void> {
    try {
      this.session = await ort.InferenceSession.create(this.config.path);
      this.state.isLoaded = true;
    } catch (error) {
      throw new Error(`Failed to load model: ${error}`);
    }
  }

  async train(data: number[][], labels: number[][], config: TrainingConfig): Promise<ModelMetrics> {
    throw new Error('Training is not supported in ONNX runtime. Please train the model in another framework and export to ONNX format.');
  }

  async predict(input: number[]): Promise<PredictionResult> {
    if (!this.session) {
      throw new Error('Model not loaded');
    }

    try {
      let processedInput = input;

      // Handle encrypted data if encryption is enabled
      if (this.config.encryptionEnabled && this.encryptionService) {
        const encryptedInput = await this.encryptData([input]);
        processedInput = (await this.decryptData(encryptedInput))[0];
      }

      // Handle secure computation if protocol is enabled
      if (this.config.protocolEnabled && this.mpcProtocol) {
        processedInput = (await this.computeSecurely([input], 'predict'))[0];
      }

      // Prepare input tensor
      const inputTensor = new ort.Tensor('float32', new Float32Array(processedInput), this.config.inputShape);
      const feeds: Record<string, ort.Tensor> = {};
      feeds[this.session.inputNames[0]] = inputTensor;

      // Run inference
      const outputMap = await this.session.run(feeds);
      const output = Array.from(outputMap[this.session.outputNames[0]].data as Float32Array);

      // Calculate confidence for classification tasks
      let confidence: number | undefined;
      if (this.config.taskType === 'classification') {
        confidence = Math.max(...output);
      }

      return {
        output: output,
        confidence,
        metadata: {
          modelType: 'onnx',
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      throw new Error(`Prediction failed: ${error}`);
    }
  }

  async save(path: string): Promise<void> {
    throw new Error('Saving is not supported in ONNX runtime. Please use the original framework to save the model and export to ONNX format.');
  }

  protected validateConfig(): void {
    super.validateConfig();
    // Add ONNX-specific validation if needed
  }
} 