import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { FederatedLearning } from '../src/core/federated';
import { ModelConfig, FederatedConfig } from '../src/types';
import { PrivacyProtocol } from '../src/core/privacy';

use(chaiAsPromised);

describe('FederatedLearning', () => {
  const modelConfig: ModelConfig = {
    layers: [
      { units: 10, inputDim: 5 },
      { units: 5, inputDim: 10 },
      { units: 1, inputDim: 5 }
    ]
  };

  const fedConfig: FederatedConfig = {
    enablePrivacy: true,
    maxWeightMagnitude: 10,
    minClientUpdates: 2
  };

  let privacyProtocol: PrivacyProtocol;
  let federated: FederatedLearning;

  beforeEach(() => {
    privacyProtocol = new PrivacyProtocol({
      encryptionLevel: 'basic',
      useHomomorphicEncryption: false,
      useZeroKnowledgeProof: false
    });
    federated = new FederatedLearning(modelConfig, fedConfig, privacyProtocol);
  });

  describe('Model Initialization', () => {
    it('should initialize model with random weights', async () => {
      await federated.initializeModel();
      const model = await federated.distributeModel();
      
      expect(model.weights).to.be.an('array');
      expect(model.weights).to.have.lengthOf(modelConfig.layers.length);
      expect(model.round).to.equal(0);
      expect(model.metrics).to.have.all.keys(['accuracy', 'loss', 'timestamp']);
    });
  });

  describe('Update Aggregation', () => {
    beforeEach(async () => {
      await federated.initializeModel();
    });

    it('should aggregate valid client updates', async () => {
      const clientUpdates = [
        {
          clientId: 'client1',
          weights: [
            [[0.1, 0.2], [0.3, 0.4]],
            [[0.5, 0.6]]
          ],
          metrics: { accuracy: 0.8, loss: 0.2 }
        },
        {
          clientId: 'client2',
          weights: [
            [[0.2, 0.3], [0.4, 0.5]],
            [[0.6, 0.7]]
          ],
          metrics: { accuracy: 0.9, loss: 0.1 }
        }
      ];

      const result = await federated.aggregateUpdates(clientUpdates);
      expect(result.round).to.equal(1);
      expect(result.metrics.accuracy).to.be.closeTo(0.85, 0.01);
      expect(result.metrics.loss).to.be.closeTo(0.15, 0.01);
    });

    it('should reject invalid updates', async () => {
      const invalidUpdates = [
        {
          clientId: 'client1',
          weights: [
            [[NaN, 0.2], [0.3, 0.4]],
            [[0.5, 0.6]]
          ],
          metrics: { accuracy: 0.8, loss: 0.2 }
        }
      ];

      await expect(federated.aggregateUpdates(invalidUpdates))
        .to.be.rejectedWith(Error);
    });
  });

  describe('Model Distribution', () => {
    it('should throw error if model not initialized', async () => {
      await expect(federated.distributeModel())
        .to.be.rejectedWith('Global model not initialized');
    });

    it('should distribute initialized model', async () => {
      await federated.initializeModel();
      const model = await federated.distributeModel();
      
      expect(model).to.have.all.keys(['weights', 'round', 'metrics']);
      expect(model.round).to.equal(0);
    });
  });
}); 