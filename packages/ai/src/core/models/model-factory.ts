import { ModelConfig, ModelType } from '../types';
import { BaseModel } from './base-model';
import { TensorFlowModel } from './tensorflow-model';
import { ONNXModel } from './onnx-model';

export class ModelFactory {
  static createModel(config: ModelConfig): BaseModel {
    switch (config.type) {
      case ModelType.TENSORFLOW:
        return new TensorFlowModel(config);
      case ModelType.ONNX:
        return new ONNXModel(config);
      default:
        throw new Error(`Unsupported model type: ${config.type}`);
    }
  }

  static async loadModel(config: ModelConfig): Promise<BaseModel> {
    const model = ModelFactory.createModel(config);
    await model.load();
    return model;
  }

  static validateModelConfig(config: ModelConfig): void {
    if (!config.type) {
      throw new Error('Model type is required');
    }
    if (!Object.values(ModelType).includes(config.type)) {
      throw new Error(`Invalid model type: ${config.type}`);
    }
    if (!config.path) {
      throw new Error('Model path is required');
    }
    if (!config.inputShape || !config.outputShape) {
      throw new Error('Input and output shapes are required');
    }
  }
} 