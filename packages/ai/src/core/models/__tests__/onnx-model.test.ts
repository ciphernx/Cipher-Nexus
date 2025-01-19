import * as ort from 'onnxruntime-node';
import { ONNXModel } from '../onnx-model';
import { ModelConfig, ModelType, TaskType } from '../../types';

jest.mock('onnxruntime-node', () => ({
  InferenceSession: {
    create: jest.fn()
  },
  Tensor: jest.fn()
}));

describe('ONNXModel', () => {
  let config: ModelConfig;
  let model: ONNXModel;

  beforeEach(() => {
    config = {
      type: ModelType.ONNX,
      path: '/test/model',
      inputShape: [1, 28, 28],
      outputShape: [10],
      taskType: TaskType.CLASSIFICATION,
      encryptionEnabled: true,
      protocolEnabled: true
    };
    model = new ONNXModel(config);
  });

  describe('load', () => {
    it('should load model successfully', async () => {
      const mockSession = {
        inputNames: ['input'],
        outputNames: ['output'],
        run: jest.fn()
      };
      (ort.InferenceSession.create as jest.Mock).mockResolvedValue(mockSession);

      await model.load();
      expect(ort.InferenceSession.create).toHaveBeenCalledWith('/test/model');
      expect(model.getState().isLoaded).toBeTruthy();
    });

    it('should handle load errors', async () => {
      (ort.InferenceSession.create as jest.Mock).mockRejectedValue(new Error('Load failed'));
      await expect(model.load()).rejects.toThrow('Failed to load model');
    });
  });

  describe('train', () => {
    it('should throw error as training is not supported', async () => {
      const trainConfig = {
        batchSize: 32,
        epochs: 10,
        learningRate: 0.001,
        optimizer: 'adam',
        loss: 'categorical_crossentropy',
        metrics: ['accuracy']
      };

      await expect(model.train(
        [[1, 2, 3]],
        [[1, 0]],
        trainConfig
      )).rejects.toThrow('Training is not supported in ONNX runtime');
    });
  });

  describe('predict', () => {
    it('should make predictions successfully', async () => {
      const mockOutput = {
        data: new Float32Array([0.2, 0.8])
      };
      const mockSession = {
        inputNames: ['input'],
        outputNames: ['output'],
        run: jest.fn().mockResolvedValue({ output: mockOutput })
      };
      (ort.InferenceSession.create as jest.Mock).mockResolvedValue(mockSession);
      (ort.Tensor as jest.Mock).mockImplementation(() => ({}));

      await model.load();
      const result = await model.predict([1, 2, 3]);

      expect(result.output).toEqual([0.2, 0.8]);
      expect(result.confidence).toBe(0.8);
      expect(mockSession.run).toHaveBeenCalled();
      expect(ort.Tensor).toHaveBeenCalledWith('float32', expect.any(Float32Array), config.inputShape);
    });

    it('should handle prediction errors', async () => {
      const mockSession = {
        inputNames: ['input'],
        outputNames: ['output'],
        run: jest.fn().mockRejectedValue(new Error('Prediction failed'))
      };
      (ort.InferenceSession.create as jest.Mock).mockResolvedValue(mockSession);

      await model.load();
      await expect(model.predict([1, 2, 3])).rejects.toThrow('Prediction failed');
    });

    it('should throw error when model not loaded', async () => {
      await expect(model.predict([1, 2, 3])).rejects.toThrow('Model not loaded');
    });
  });

  describe('save', () => {
    it('should throw error as saving is not supported', async () => {
      await expect(model.save('/test/save/path')).rejects.toThrow('Saving is not supported in ONNX runtime');
    });
  });

  describe('encryption', () => {
    it('should handle encrypted predictions', async () => {
      const mockOutput = {
        data: new Float32Array([0.2, 0.8])
      };
      const mockSession = {
        inputNames: ['input'],
        outputNames: ['output'],
        run: jest.fn().mockResolvedValue({ output: mockOutput })
      };
      (ort.InferenceSession.create as jest.Mock).mockResolvedValue(mockSession);
      (ort.Tensor as jest.Mock).mockImplementation(() => ({}));

      await model.load();
      const result = await model.predict([1, 2, 3]);

      expect(result.output).toBeDefined();
      expect(result.metadata?.modelType).toBe('onnx');
    });
  });

  describe('secure computation', () => {
    it('should handle secure predictions', async () => {
      const mockOutput = {
        data: new Float32Array([0.2, 0.8])
      };
      const mockSession = {
        inputNames: ['input'],
        outputNames: ['output'],
        run: jest.fn().mockResolvedValue({ output: mockOutput })
      };
      (ort.InferenceSession.create as jest.Mock).mockResolvedValue(mockSession);
      (ort.Tensor as jest.Mock).mockImplementation(() => ({}));

      await model.load();
      const result = await model.predict([1, 2, 3]);

      expect(result.output).toBeDefined();
      expect(result.metadata?.timestamp).toBeDefined();
    });
  });
}); 