import { ModelFactory } from '../model-factory';
import { TensorFlowModel } from '../tensorflow-model';
import { ONNXModel } from '../onnx-model';
import { ModelConfig, ModelType, TaskType } from '../../types';

jest.mock('../tensorflow-model');
jest.mock('../onnx-model');

describe('ModelFactory', () => {
  let config: ModelConfig;

  beforeEach(() => {
    config = {
      type: ModelType.TENSORFLOW,
      path: '/test/model',
      inputShape: [1, 28, 28],
      outputShape: [10],
      taskType: TaskType.CLASSIFICATION
    };
  });

  describe('createModel', () => {
    it('should create TensorFlow model', () => {
      const model = ModelFactory.createModel(config);
      expect(model).toBeInstanceOf(TensorFlowModel);
    });

    it('should create ONNX model', () => {
      config.type = ModelType.ONNX;
      const model = ModelFactory.createModel(config);
      expect(model).toBeInstanceOf(ONNXModel);
    });

    it('should throw error for unsupported model type', () => {
      config.type = 'unsupported' as ModelType;
      expect(() => ModelFactory.createModel(config)).toThrow('Unsupported model type');
    });
  });

  describe('loadModel', () => {
    it('should load TensorFlow model successfully', async () => {
      const mockLoad = jest.fn();
      (TensorFlowModel as jest.Mock).mockImplementation(() => ({
        load: mockLoad
      }));

      await ModelFactory.loadModel(config);
      expect(mockLoad).toHaveBeenCalled();
    });

    it('should load ONNX model successfully', async () => {
      config.type = ModelType.ONNX;
      const mockLoad = jest.fn();
      (ONNXModel as jest.Mock).mockImplementation(() => ({
        load: mockLoad
      }));

      await ModelFactory.loadModel(config);
      expect(mockLoad).toHaveBeenCalled();
    });

    it('should handle load errors', async () => {
      const mockLoad = jest.fn().mockRejectedValue(new Error('Load failed'));
      (TensorFlowModel as jest.Mock).mockImplementation(() => ({
        load: mockLoad
      }));

      await expect(ModelFactory.loadModel(config)).rejects.toThrow('Load failed');
    });
  });

  describe('validateModelConfig', () => {
    it('should validate correct config', () => {
      expect(() => ModelFactory.validateModelConfig(config)).not.toThrow();
    });

    it('should throw error for missing type', () => {
      const invalidConfig = { ...config, type: undefined };
      expect(() => ModelFactory.validateModelConfig(invalidConfig as ModelConfig))
        .toThrow('Model type is required');
    });

    it('should throw error for invalid type', () => {
      const invalidConfig = { ...config, type: 'invalid' as ModelType };
      expect(() => ModelFactory.validateModelConfig(invalidConfig))
        .toThrow('Invalid model type');
    });

    it('should throw error for missing path', () => {
      const invalidConfig = { ...config, path: undefined };
      expect(() => ModelFactory.validateModelConfig(invalidConfig as ModelConfig))
        .toThrow('Model path is required');
    });

    it('should throw error for missing shapes', () => {
      const invalidConfig = { ...config, inputShape: undefined };
      expect(() => ModelFactory.validateModelConfig(invalidConfig as ModelConfig))
        .toThrow('Input and output shapes are required');
    });
  });
}); 