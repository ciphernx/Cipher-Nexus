import { EventEmitter } from 'events';
import {
  ModelConfig,
  FederatedConfig,
  ClientState,
  ModelUpdate,
  TrainingRound,
  PrivacyMetrics
} from '../types/federated';
import { ModelAggregator } from './ModelAggregator';
import { PrivacyManager } from './PrivacyManager';
import { ClientManager } from './ClientManager';
import { DifferentialPrivacy } from './privacy/DifferentialPrivacy';
import { HomomorphicEncryption } from './privacy/HomomorphicEncryption';
import { ZeroKnowledgeProof } from './privacy/ZeroKnowledgeProof';

export class FederatedLearningProtocol extends EventEmitter {
  private modelAggregator: ModelAggregator;
  private privacyManager: PrivacyManager;
  private clientManager: ClientManager;
  private differentialPrivacy: DifferentialPrivacy;
  private homomorphicEncryption: HomomorphicEncryption;
  private zeroKnowledgeProof: ZeroKnowledgeProof;
  
  private currentRound: TrainingRound | null = null;
  private globalModel: Float32Array[] | null = null;
  private rounds: Map<number, TrainingRound> = new Map();

  constructor(
    private readonly modelConfig: ModelConfig,
    private readonly fedConfig: FederatedConfig
  ) {
    super();
    this.modelAggregator = new ModelAggregator(fedConfig.aggregationStrategy);
    this.privacyManager = new PrivacyManager(fedConfig.privacyConfig);
    this.clientManager = new ClientManager(fedConfig.clientSelectionStrategy);
    
    // Initialize privacy mechanisms
    this.differentialPrivacy = new DifferentialPrivacy({
      epsilon: fedConfig.privacyConfig.differentialPrivacy.epsilon,
      delta: fedConfig.privacyConfig.differentialPrivacy.delta,
      maxGradientNorm: 1.0,
      noiseMultiplier: 0.1,
      minBatchSize: 1,
      maxReservedBudget: 10.0
    });

    this.homomorphicEncryption = new HomomorphicEncryption({
      polyModulusDegree: 8192,
      coeffModulusBits: [60, 40, 40, 60],
      scaleBits: 40,
      maxThreads: 4,
      useGPU: false,
      securityLevel: 128
    });

    this.zeroKnowledgeProof = new ZeroKnowledgeProof({
      securityParameter: 128,
      numIterations: 10,
      hashFunction: 'sha256',
      proofTimeout: 30000,
      maxProofSize: 1024 * 1024,
      maxConstraints: 1000,
      fieldSize: BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')
    });

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize global model
      this.globalModel = await this.initializeModel();
      
      // Initialize privacy mechanisms
      await Promise.all([
        this.privacyManager.initialize(),
        this.differentialPrivacy.initialize(),
        this.homomorphicEncryption.initialize(),
        this.zeroKnowledgeProof.initialize()
      ]);

      this.emit('initialized', {
        modelConfig: this.modelConfig,
        fedConfig: this.fedConfig
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async registerClient(clientState: ClientState): Promise<void> {
    try {
      await this.clientManager.registerClient(clientState);
      
      // Reserve privacy budget for the client
      await this.differentialPrivacy.reservePrivacyBudget(
        clientState.clientId,
        this.fedConfig.privacyConfig.differentialPrivacy.epsilon / 10
      );

      this.emit('clientRegistered', {
        clientId: clientState.clientId,
        status: clientState.status
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async startTrainingRound(): Promise<void> {
    if (this.currentRound) {
      throw new Error('Training round already in progress');
    }

    try {
      // Select clients for this round
      const selectedClients = await this.clientManager.selectClients(
        this.fedConfig.minClients
      );

      if (selectedClients.length < this.fedConfig.minClients) {
        throw new Error('Insufficient clients available for training');
      }

      // Create new training round
      const roundId = this.rounds.size + 1;
      this.currentRound = {
        roundId,
        startTime: new Date(),
        selectedClients: selectedClients.map(client => client.clientId),
        status: 'INITIALIZING',
        updates: []
      };

      this.rounds.set(roundId, this.currentRound);
      
      // Encrypt and distribute global model to selected clients
      const encryptedModel = await this.homomorphicEncryption.encryptWeights(
        this.globalModel!
      );
      await this.distributeModel(selectedClients, encryptedModel);

      this.currentRound.status = 'IN_PROGRESS';
      this.emit('roundStarted', {
        roundId,
        selectedClients: selectedClients.map(client => client.clientId)
      });

      // Set timeout for round completion
      setTimeout(() => {
        this.handleRoundTimeout(roundId);
      }, this.fedConfig.roundTimeout);

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async submitUpdate(clientId: string, update: ModelUpdate): Promise<void> {
    if (!this.currentRound) {
      throw new Error('No active training round');
    }

    if (!this.currentRound.selectedClients.includes(clientId)) {
      throw new Error('Client not selected for current round');
    }

    try {
      // 1. Apply differential privacy
      const privatizedUpdate = await this.differentialPrivacy.applyDifferentialPrivacy(
        update,
        this.fedConfig.minClients
      );

      // 2. Generate zero-knowledge proof
      const proof = await this.zeroKnowledgeProof.generateProof(
        update,
        {
          weights: update.weights,
          randomness: new Uint8Array(32),
          timestamp: Date.now()
        },
        {
          modelHash: 'model-hash',
          updateHash: 'update-hash',
          constraints: await this.zeroKnowledgeProof.generateConstraints(update)
        }
      );

      // 3. Verify and process update
      const isValid = await this.zeroKnowledgeProof.verifyProof(
        proof,
        {
          modelHash: 'model-hash',
          updateHash: 'update-hash',
          constraints: await this.zeroKnowledgeProof.generateConstraints(update)
        }
      );

      if (!isValid) {
        throw new Error('Invalid zero-knowledge proof');
      }

      // 4. Process the update through privacy manager
      const processedUpdate = await this.processClientUpdate(privatizedUpdate);
      
      this.currentRound.updates.push(processedUpdate);
      this.emit('updateReceived', {
        clientId,
        roundId: this.currentRound.roundId,
        proof
      });

      // Check if we have received all updates
      if (this.currentRound.updates.length === this.currentRound.selectedClients.length) {
        await this.finalizeRound();
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  getGlobalModel(): Float32Array[] | null {
    return this.globalModel;
  }

  getRoundStatus(roundId: number): TrainingRound | undefined {
    return this.rounds.get(roundId);
  }

  private async initializeModel(): Promise<Float32Array[]> {
    // Initialize model weights based on architecture
    const layers = this.modelConfig.layers || [];
    const weights: Float32Array[] = [];

    for (let i = 0; i < layers.length - 1; i++) {
      const inputSize = layers[i];
      const outputSize = layers[i + 1];
      
      // Initialize weights with Xavier/Glorot initialization
      const stddev = Math.sqrt(2.0 / (inputSize + outputSize));
      const layerWeights = new Float32Array(inputSize * outputSize);
      
      for (let j = 0; j < layerWeights.length; j++) {
        layerWeights[j] = this.generateNormalRandom(0, stddev);
      }
      
      weights.push(layerWeights);
    }

    return weights;
  }

  private async distributeModel(
    clients: ClientState[],
    encryptedModel: any[]
  ): Promise<void> {
    if (!this.globalModel) {
      throw new Error('Global model not initialized');
    }

    // Implement secure model distribution logic
    this.emit('modelDistributed', {
      roundId: this.currentRound?.roundId,
      clients: clients.map(c => c.clientId),
      encryptedModel
    });
  }

  private async processClientUpdate(update: ModelUpdate): Promise<ModelUpdate> {
    // Apply privacy mechanisms
    const privacyMetrics = await this.privacyManager.processUpdate(update);
    
    // Update client reputation
    await this.clientManager.updateClientReputation(
      update.clientId,
      update.metrics
    );

    this.emit('updateProcessed', {
      clientId: update.clientId,
      privacyMetrics
    });

    return update;
  }

  private async finalizeRound(): Promise<void> {
    if (!this.currentRound || !this.globalModel) {
      return;
    }

    try {
      this.currentRound.status = 'AGGREGATING';

      // 1. Decrypt updates
      const decryptedUpdates = await Promise.all(
        this.currentRound.updates.map(async update => {
          const decryptedWeights = await this.homomorphicEncryption.decryptWeights(
            update.weights as any
          );
          return {
            ...update,
            weights: decryptedWeights
          };
        })
      );

      // 2. Aggregate model updates
      const aggregationResult = await this.modelAggregator.aggregateUpdates(
        decryptedUpdates,
        this.globalModel
      );

      // 3. Update global model
      this.globalModel = aggregationResult.aggregatedWeights;

      // 4. Update round status
      this.currentRound.endTime = new Date();
      this.currentRound.status = 'COMPLETED';
      this.currentRound.aggregatedMetrics = {
        globalLoss: aggregationResult.metrics.loss,
        globalAccuracy: aggregationResult.metrics.accuracy,
        participationRate: this.currentRound.updates.length / this.currentRound.selectedClients.length
      };

      this.emit('roundCompleted', {
        roundId: this.currentRound.roundId,
        metrics: this.currentRound.aggregatedMetrics
      });

      // Reset current round
      this.currentRound = null;

    } catch (error) {
      if (this.currentRound) {
        this.currentRound.status = 'FAILED';
      }
      this.emit('error', error);
      throw error;
    }
  }

  private handleRoundTimeout(roundId: number): void {
    const round = this.rounds.get(roundId);
    if (round && round.status === 'IN_PROGRESS') {
      round.status = 'FAILED';
      round.endTime = new Date();
      
      this.emit('roundTimeout', { roundId });
      this.currentRound = null;
    }
  }

  private setupEventHandlers(): void {
    // Client events
    this.clientManager.on('clientStatusChanged', (event) => {
      this.emit('clientStatusChanged', event);
    });

    // Privacy events
    this.privacyManager.on('privacyBudgetExceeded', (event) => {
      this.emit('privacyBudgetExceeded', event);
    });

    this.differentialPrivacy.on('privacyApplied', (event) => {
      this.emit('differentialPrivacyApplied', event);
    });

    // Model events
    this.modelAggregator.on('aggregationProgress', (event) => {
      this.emit('aggregationProgress', event);
    });

    // Encryption events
    this.homomorphicEncryption.on('weightsEncrypted', (event) => {
      this.emit('modelEncrypted', event);
    });

    this.homomorphicEncryption.on('weightsDecrypted', (event) => {
      this.emit('modelDecrypted', event);
    });

    // ZKP events
    this.zeroKnowledgeProof.on('proofGenerated', (event) => {
      this.emit('zkProofGenerated', event);
    });

    this.zeroKnowledgeProof.on('proofVerified', (event) => {
      this.emit('zkProofVerified', event);
    });
  }

  private generateNormalRandom(mean: number, stddev: number): number {
    let u1 = 0;
    let u2 = 0;
    
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();
    
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + stddev * z0;
  }
} 