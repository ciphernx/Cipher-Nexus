import * as tf from '@tensorflow/tfjs-node';
import { TensorFlowModel } from '../tensorflow-model';
import { ModelConfig, ModelType, TaskType } from '../../types';

jest.mock('@tensorflow/tfjs-node', () => ({
  loadLayersModel: jest.fn(),
  tensor2d: jest.fn(),
  train: {
    adam: jest.fn()
  }
}));

describe('TensorFlowModel', () => {
  let config: ModelConfig;
  let model: TensorFlowModel;

  beforeEach(() => {
    config = {
      type: ModelType.TENSORFLOW,
      path: '/test/model',
      inputShape: [1, 28, 28],
      outputShape: [10],
      taskType: TaskType.CLASSIFICATION,
      encryptionEnabled: true,
      protocolEnabled: true
    };
    model = new TensorFlowModel(config);
  });

  describe('load', () => {
    it('should load model successfully', async () => {
      const mockLayersModel = {
        compile: jest.fn(),
        fit: jest.fn(),
        predict: jest.fn()
      };
      (tf.loadLayersModel as jest.Mock).mockResolvedValue(mockLayersModel);

      await model.load();
      expect(tf.loadLayersModel).toHaveBeenCalledWith('file:///test/model');
      expect(model.getState().isLoaded).toBeTruthy();
    });

    it('should handle load errors', async () => {
      (tf.loadLayersModel as jest.Mock).mockRejectedValue(new Error('Load failed'));
      await expect(model.load()).rejects.toThrow('Failed to load model');
    });
  });

  describe('train', () => {
    it('should train model successfully', async () => {
      const mockLayersModel = {
        compile: jest.fn(),
        fit: jest.fn().mockResolvedValue({
          history: {
            loss: [0.5],
            acc: [0.8]
          }
        }),
        predict: jest.fn()
      };
      (tf.loadLayersModel as jest.Mock).mockResolvedValue(mockLayersModel);
      (tf.tensor2d as jest.Mock).mockReturnValue({});
      (tf.train.adam as jest.Mock).mockReturnValue({});

      await model.load();

      const trainConfig = {
        batchSize: 32,
        epochs: 10,
        learningRate: 0.001,
        optimizer: 'adam',
        loss: 'categorical_crossentropy',
        metrics: ['accuracy'],
        validationSplit: 0.2
      };

      const result = await model.train(
        [[1, 2, 3], [4, 5, 6]],
        [[1, 0], [0, 1]],
        trainConfig
      );

      expect(result.accuracy).toBe(0.8);
      expect(result.loss).toBe(0.5);
      expect(mockLayersModel.compile).toHaveBeenCalled();
      expect(mockLayersModel.fit).toHaveBeenCalled();
    });

    it('should handle training errors', async () => {
      const mockLayersModel = {
        compile: jest.fn(),
        fit: jest.fn().mockRejectedValue(new Error('Training failed')),
        predict: jest.fn()
      };
      (tf.loadLayersModel as jest.Mock).mockResolvedValue(mockLayersModel);

      await model.load();

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
      )).rejects.toThrow('Training failed');
    });
  });

  describe('predict', () => {
    it('should make predictions successfully', async () => {
      const mockOutput = {
        data: jest.fn().mockResolvedValue(new Float32Array([0.2, 0.8]))
      };
      const mockLayersModel = {
        compile: jest.fn(),
        fit: jest.fn(),
        predict: jest.fn().mockReturnValue(mockOutput)
      };
      (tf.loadLayersModel as jest.Mock).mockResolvedValue(mockLayersModel);
      (tf.tensor2d as jest.Mock).mockReturnValue({});

      await model.load();
      const result = await model.predict([1, 2, 3]);

      expect(result.output).toEqual([0.2, 0.8]);
      expect(result.confidence).toBe(0.8);
      expect(mockLayersModel.predict).toHaveBeenCalled();
    });

    it('should handle prediction errors', async () => {
      const mockLayersModel = {
        compile: jest.fn(),
        fit: jest.fn(),
        predict: jest.fn().mockImplementation(() => {
          throw new Error('Prediction failed');
        })
      };
      (tf.loadLayersModel as jest.Mock).mockResolvedValue(mockLayersModel);

      await model.load();
      await expect(model.predict([1, 2, 3])).rejects.toThrow('Prediction failed');
    });
  });

  describe('save', () => {
    it('should save model successfully', async () => {
      const mockLayersModel = {
        compile: jest.fn(),
        fit: jest.fn(),
        predict: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined)
      };
      (tf.loadLayersModel as jest.Mock).mockResolvedValue(mockLayersModel);

      await model.load();
      await model.save('/test/save/path');
      expect(mockLayersModel.save).toHaveBeenCalledWith('file:///test/save/path');
    });

    it('should handle save errors', async () => {
      const mockLayersModel = {
        compile: jest.fn(),
        fit: jest.fn(),
        predict: jest.fn(),
        save: jest.fn().mockRejectedValue(new Error('Save failed'))
      };
      (tf.loadLayersModel as jest.Mock).mockResolvedValue(mockLayersModel);

      await model.load();
      await expect(model.save('/test/save/path')).rejects.toThrow('Failed to save model');
    });
  });
}); 