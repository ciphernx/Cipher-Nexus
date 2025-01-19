import { BaseModel } from '../base-model';
import { ModelConfig, ModelType, TaskType } from '../../types';

class TestModel extends BaseModel {
  async load(): Promise<void> {
    this.state.isLoaded = true;
  }

  async train(): Promise<any> {
    return {};
  }

  async predict(): Promise<any> {
    return { output: [0.5] };
  }

  async save(): Promise<void> {}
}

describe('BaseModel', () => {
  let config: ModelConfig;
  let model: TestModel;

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
    model = new TestModel(config);
  });

  describe('initialization', () => {
    it('should initialize with correct config', () => {
      expect(model.getConfig()).toEqual(config);
    });

    it('should initialize with correct state', () => {
      const state = model.getState();
      expect(state.isLoaded).toBeFalsy();
      expect(state.isTraining).toBeFalsy();
    });

    it('should initialize encryption service when enabled', () => {
      expect(model['encryptionService']).toBeDefined();
    });

    it('should initialize MPC protocol when enabled', () => {
      expect(model['mpcProtocol']).toBeDefined();
    });
  });

  describe('encryption', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const data = [[1, 2, 3], [4, 5, 6]];
      const encrypted = await model['encryptData'](data);
      expect(encrypted).toBeInstanceOf(Buffer);

      const decrypted = await model['decryptData'](encrypted);
      expect(decrypted).toEqual(data);
    });

    it('should throw error when encryption service not initialized', async () => {
      const modelWithoutEncryption = new TestModel({
        ...config,
        encryptionEnabled: false
      });
      await expect(modelWithoutEncryption['encryptData']([[1, 2, 3]]))
        .rejects
        .toThrow('Encryption service not initialized');
    });
  });

  describe('secure computation', () => {
    it('should handle secure computation when protocol enabled', async () => {
      const data = [[1, 2, 3], [4, 5, 6]];
      const result = await model['computeSecurely'](data, 'test');
      expect(result).toBeDefined();
    });

    it('should throw error when protocol not initialized', async () => {
      const modelWithoutProtocol = new TestModel({
        ...config,
        protocolEnabled: false
      });
      await expect(modelWithoutProtocol['computeSecurely']([[1, 2, 3]], 'test'))
        .rejects
        .toThrow('MPC protocol not initialized');
    });
  });

  describe('validation', () => {
    it('should validate config correctly', () => {
      expect(() => model['validateConfig']()).not.toThrow();
    });

    it('should throw error for invalid config', () => {
      const invalidConfig = { ...config, path: '' };
      const invalidModel = new TestModel(invalidConfig);
      expect(() => invalidModel['validateConfig']())
        .toThrow('Model path is required');
    });

    it('should validate training config correctly', () => {
      const validConfig = {
        batchSize: 32,
        epochs: 10,
        learningRate: 0.001,
        optimizer: 'adam',
        loss: 'categorical_crossentropy',
        metrics: ['accuracy']
      };
      expect(() => model['validateTrainingConfig'](validConfig)).not.toThrow();
    });

    it('should throw error for invalid training config', () => {
      const invalidConfig = {
        batchSize: -1,
        epochs: 10,
        learningRate: 0.001,
        optimizer: 'adam',
        loss: 'categorical_crossentropy',
        metrics: ['accuracy']
      };
      expect(() => model['validateTrainingConfig'](invalidConfig))
        .toThrow('Batch size must be positive');
    });
  });
}); 