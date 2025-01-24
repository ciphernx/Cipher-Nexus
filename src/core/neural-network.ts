import { Model, ModelConfig, ModelMetrics } from './model';

/**
 * Interface representing a layer in the neural network
 */
interface Layer {
  /** Weight matrix for the layer */
  weights: number[][];
  /** Bias vector for the layer */
  biases: number[];
  /** Activation function type for the layer */
  activation: 'relu' | 'leakyRelu' | 'elu' | 'sigmoid' | 'tanh' | 'swish';
  /** Dropout rate for the layer (optional) */
  dropout?: number;
  /** Batch normalization parameters (optional) */
  batchNorm?: {
    /** Scale parameter */
    gamma: number[];
    /** Shift parameter */
    beta: number[];
    /** Running mean for inference */
    movingMean: number[];
    /** Running variance for inference */
    movingVariance: number[];
  };
}

/**
 * Interface for storing optimizer state
 */
interface OptimizerState {
  /** Momentum optimizer state */
  momentum?: {
    velocityWeights: number[][][];
    velocityBiases: number[][];
  };
  /** Adam optimizer state */
  adam?: {
    momentWeights: number[][][];
    momentBiases: number[][];
    velocityWeights: number[][][];
    velocityBiases: number[][];
    iteration: number;
  };
  /** RMSprop optimizer state */
  rmsprop?: {
    cacheWeights: number[][][];
    cacheBiases: number[][];
  };
  /** Adagrad optimizer state */
  adagrad?: {
    cacheWeights: number[][][];
    cacheBiases: number[][];
  };
}

/**
 * Configuration for regularization techniques
 */
interface RegularizationConfig {
  /** L1 regularization strength */
  l1?: number;
  /** L2 regularization strength */
  l2?: number;
  /** Dropout rate */
  dropout?: number;
  /** Whether to use batch normalization */
  batchNorm?: boolean;
}

/**
 * Configuration for learning rate scheduling
 */
interface LearningRateSchedule {
  /** Type of learning rate schedule */
  type: 'step' | 'exponential' | 'cosine';
  /** Initial learning rate */
  initialLr: number;
  /** Decay factor */
  decay: number;
  /** Number of steps for step decay */
  steps?: number;
}

/**
 * Configuration for weight initialization
 */
interface InitializationConfig {
  /** Type of initialization strategy */
  type: 'xavier' | 'he' | 'lecun' | 'normal' | 'uniform';
  /** Gain factor for initialization */
  gain?: number;
  /** Mean for normal distribution */
  mean?: number;
  /** Standard deviation for normal distribution */
  std?: number;
  /** Minimum value for uniform distribution */
  min?: number;
  /** Maximum value for uniform distribution */
  max?: number;
}

/**
 * Configuration for validation during training
 */
interface ValidationConfig {
  /** Fraction of training data to use for validation */
  validationSplit?: number;
  /** Explicit validation dataset */
  validationData?: {
    data: number[][];
    labels: number[][];
  };
  /** Number of validation steps */
  validationSteps?: number;
}

/**
 * Neural Network implementation with support for various modern techniques
 * including multiple activation functions, optimizers, regularization methods,
 * and advanced training features.
 */
export class NeuralNetwork extends Model {
  private layers: Layer[] = [];
  private initialized: boolean = false;
  private optimizerState: OptimizerState = {};
  private regularization: RegularizationConfig;
  private lrSchedule?: LearningRateSchedule;
  private dropoutMasks: boolean[][][] = [];
  private currentLearningRate: number;
  private bestLoss: number = Infinity;
  private patienceCount: number = 0;
  private initConfig: InitializationConfig;
  private validationConfig?: ValidationConfig;
  private gradientClipNorm?: number;

  /**
   * Creates a new neural network instance
   * @param config Model configuration
   * @param regularization Regularization configuration
   * @param lrSchedule Learning rate schedule configuration
   * @param initConfig Weight initialization configuration
   * @param validationConfig Validation configuration
   * @param gradientClipNorm Maximum gradient norm for clipping
   */
  constructor(
    config: ModelConfig,
    regularization: RegularizationConfig = {},
    lrSchedule?: LearningRateSchedule,
    initConfig: InitializationConfig = { type: 'he' },
    validationConfig?: ValidationConfig,
    gradientClipNorm?: number
  ) {
    super(config);
    this.regularization = regularization;
    this.lrSchedule = lrSchedule;
    this.currentLearningRate = config.learningRate;
    this.initConfig = initConfig;
    this.validationConfig = validationConfig;
    this.gradientClipNorm = gradientClipNorm;
  }

  /**
   * Initializes the neural network layers and parameters
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // 根据配置初始化网络层
    for (const layerConfig of this.config.architecture.layers) {
      if (layerConfig.type !== 'dense') {
        throw new Error('Only dense layers are supported');
      }

      const inputSize = this.layers.length === 0 
        ? 784  // 假设输入是MNIST数据集大小
        : this.layers[this.layers.length - 1].weights[0].length;
      
      const outputSize = layerConfig.units || 10;  // 默认输出类别数为10
      
      // 初始化权重和偏置
      const weights = this.initializeWeights(inputSize, outputSize, layerConfig.activation);
      const biases = this.initializeBiases(outputSize);

      this.layers.push({
        weights,
        biases,
        activation: layerConfig.activation || 'relu'
      });
    }

    // 初始化优化器状态
    this.initializeOptimizerState();

    // 将所有参数展平到一维数组
    this.parameters = this.flattenParameters();
    this.initialized = true;
  }

  /**
   * Trains the neural network on the provided dataset
   * @param data Training data
   * @param labels Training labels
   * @returns Training metrics
   */
  async train(data: number[][], labels: number[][]): Promise<ModelMetrics> {
    if (!this.initialized) {
      throw new Error('Model not initialized');
    }

    // 准备验证数据
    let validationData: number[][] | undefined;
    let validationLabels: number[][] | undefined;

    if (this.validationConfig) {
      if (this.validationConfig.validationData) {
        validationData = this.validationConfig.validationData.data;
        validationLabels = this.validationConfig.validationData.labels;
      } else if (this.validationConfig.validationSplit) {
        const splitIndex = Math.floor(data.length * (1 - this.validationConfig.validationSplit));
        validationData = data.slice(splitIndex);
        validationLabels = labels.slice(splitIndex);
        data = data.slice(0, splitIndex);
        labels = labels.slice(0, splitIndex);
      }
    }

    const batchSize = this.config.batchSize;
    const totalBatches = Math.ceil(data.length / batchSize);
    
    for (let epoch = 0; epoch < this.config.epochs; epoch++) {
      let totalLoss = 0;
      let correctPredictions = 0;

      // 更新学习率
      this.updateLearningRate(epoch);

      // 随机打乱数据
      const indices = Array.from({length: data.length}, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      for (let batch = 0; batch < totalBatches; batch++) {
        const start = batch * batchSize;
        const end = Math.min(start + batchSize, data.length);
        const batchIndices = indices.slice(start, end);

        const batchData = batchIndices.map(i => data[i]);
        const batchLabels = batchIndices.map(i => labels[i]);

        // 前向传播
        const predictions = await this.forwardPass(batchData);
        
        // 计算损失和准确率
        for (let i = 0; i < predictions.length; i++) {
          const loss = this.computeLoss(predictions[i], batchLabels[i]);
          totalLoss += loss;

          const predicted = predictions[i].indexOf(Math.max(...predictions[i]));
          const actual = batchLabels[i].indexOf(Math.max(...batchLabels[i]));
          if (predicted === actual) {
            correctPredictions++;
          }
        }

        // 计算梯度
        const gradients = await this.computeGradients(batchData, batchLabels);
        
        // 应用梯度更新
        await this.applyGradients(gradients);

        // 更新指标
        this.metrics = {
          loss: totalLoss / (batch + 1),
          accuracy: correctPredictions / ((batch + 1) * batchSize),
          epoch,
          step: batch,
          totalSteps: totalBatches
        };
      }

      // 在验证集上评估
      if (validationData && validationLabels) {
        const validationMetrics = await this.evaluate(validationData, validationLabels);
        this.metrics.validationLoss = validationMetrics.loss;
        this.metrics.validationAccuracy = validationMetrics.accuracy;

        // 检查早停
        if (this.checkEarlyStopping(validationMetrics.loss)) {
          console.log('Early stopping triggered');
          break;
        }
      }
    }

    return this.metrics;
  }

  /**
   * Makes predictions using the trained model
   * @param data Input data
   * @returns Predicted outputs
   */
  async predict(data: number[][]): Promise<number[][]> {
    if (!this.initialized) {
      throw new Error('Model not initialized');
    }

    return this.forwardPass(data);
  }

  /**
   * Evaluates the model on a test dataset
   * @param data Test data
   * @param labels Test labels
   * @returns Evaluation metrics
   */
  async evaluate(data: number[][], labels: number[][]): Promise<ModelMetrics> {
    if (!this.initialized) {
      throw new Error('Model not initialized');
    }

    let totalLoss = 0;
    let correctPredictions = 0;

    // 在评估模式下进行前向传播
    const predictions = await this.forwardPass(data);

    // 计算损失和准确率
    for (let i = 0; i < predictions.length; i++) {
      const loss = this.computeLoss(predictions[i], labels[i]);
      totalLoss += loss;

      const predicted = predictions[i].indexOf(Math.max(...predictions[i]));
      const actual = labels[i].indexOf(Math.max(...labels[i]));
      if (predicted === actual) {
        correctPredictions++;
      }
    }

    return {
      loss: totalLoss / data.length,
      accuracy: correctPredictions / data.length,
      epoch: this.metrics.epoch,
      step: this.metrics.step,
      totalSteps: this.metrics.totalSteps
    };
  }

  protected async computeGradients(
    data: number[][],
    labels: number[][]
  ): Promise<number[]> {
    // 前向传播
    const activations: number[][][] = [];
    const outputs = await this.forwardPassWithActivations(data, activations);

    // 反向传播
    const gradients: number[] = [];
    const layerGradients = this.backpropagate(
      data,
      labels,
      outputs,
      activations
    );

    // 展平梯度
    for (const layer of layerGradients) {
      for (const row of layer.weights) {
        gradients.push(...row);
      }
      gradients.push(...layer.biases);
    }

    return gradients;
  }

  /**
   * Applies gradients to update model parameters
   * @param gradients Computed gradients
   */
  protected async applyGradients(gradients: number[]): Promise<void> {
    if (gradients.length !== this.parameters.length) {
      throw new Error('Gradient length mismatch');
    }

    // 应用梯度裁剪
    if (this.gradientClipNorm) {
      gradients = this.clipGradients(gradients);
    }

    // 应用正则化
    if (this.regularization.l1 || this.regularization.l2) {
      gradients = this.applyRegularization(gradients);
    }

    // 将一维梯度数组重构为每层的权重和偏置梯度
    const layerGradients = this.reconstructGradients(gradients);

    // 根据优化器更新参数
    switch (this.config.optimizer) {
      case 'sgd':
        this.applySGD(layerGradients);
        break;
      case 'adam':
        this.applyAdam(layerGradients);
        break;
      case 'rmsprop':
        this.applyRMSprop(layerGradients);
        break;
      case 'adagrad':
        this.applyAdagrad(layerGradients);
        break;
      default:
        throw new Error('Unsupported optimizer');
    }

    // 更新展平的参数数组
    this.parameters = this.flattenParameters();
  }

  // 私有辅助方法

  /**
   * Performs forward pass through the network
   * @param data Input data
   * @returns Network outputs
   */
  private async forwardPass(data: number[][]): Promise<number[][]> {
    const [outputs] = await this.forwardPassWithActivations(data, []);
    return outputs;
  }

  /**
   * Performs forward pass and stores activations
   * @param data Input data
   * @param activations Array to store activations
   * @param isTraining Whether in training mode
   * @returns Tuple of outputs and activations
   */
  private async forwardPassWithActivations(
    data: number[][],
    activations: number[][][],
    isTraining: boolean = true
  ): Promise<[number[][], number[][][]]> {
    let current = data;
    activations.length = 0;
    this.dropoutMasks = [];

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const layerOutputs: number[][] = [];
      
      for (const input of current) {
        const output = Array(layer.weights.length).fill(0);
        
        // 计算线性组合
        for (let i = 0; i < layer.weights.length; i++) {
          for (let j = 0; j < input.length; j++) {
            output[i] += layer.weights[i][j] * input[j];
          }
          output[i] += layer.biases[i];
        }

        layerOutputs.push(output);
      }

      // 应用批归一化
      if (layer.batchNorm) {
        const batchNormOutput = this.applyBatchNorm(layerOutputs, layer, isTraining);
        layerOutputs.splice(0, layerOutputs.length, ...batchNormOutput);
      }

      // 应用激活函数
      for (const output of layerOutputs) {
        for (let i = 0; i < output.length; i++) {
          output[i] = this.activate(output[i], layer.activation);
        }
      }

      // 应用dropout
      if (isTraining && layer.dropout && layer.dropout > 0) {
        const mask = this.generateDropoutMask(layer, layerOutputs.length);
        this.dropoutMasks.push(mask);
        const dropoutOutput = this.applyDropout(layerOutputs, mask);
        layerOutputs.splice(0, layerOutputs.length, ...dropoutOutput);
      }

      activations.push(current);
      current = layerOutputs;
    }

    return [current, activations];
  }

  /**
   * Performs backpropagation to compute gradients
   * @param inputs Input data
   * @param labels Target labels
   * @param outputs Network outputs
   * @param activations Layer activations
   * @returns Layer gradients
   */
  private backpropagate(
    inputs: number[][],
    labels: number[][],
    outputs: number[][],
    activations: number[][][]
  ): Array<{weights: number[][], biases: number[]}> {
    const layerGradients: Array<{weights: number[][], biases: number[]}> = [];
    const batchSize = inputs.length;

    // 计算输出层误差
    const outputDeltas = outputs.map((output, i) => 
      output.map((o, j) => o - labels[i][j])
    );

    // 反向传播误差
    let deltas = outputDeltas;
    for (let l = this.layers.length - 1; l >= 0; l--) {
      const layer = this.layers[l];
      const layerInput = l === 0 ? inputs : activations[l - 1];

      // 初始化权重和偏置的梯度
      const weightGradients = Array(layer.weights.length).fill(0).map(() =>
        Array(layer.weights[0].length).fill(0)
      );
      const biasGradients = Array(layer.biases.length).fill(0);

      // 累积梯度
      for (let i = 0; i < batchSize; i++) {
        for (let j = 0; j < layer.weights.length; j++) {
          for (let k = 0; k < layer.weights[0].length; k++) {
            weightGradients[j][k] += deltas[i][j] * layerInput[i][k];
          }
          biasGradients[j] += deltas[i][j];
        }
      }

      // 计算下一层的deltas
      if (l > 0) {
        const newDeltas: number[][] = [];
        for (let i = 0; i < batchSize; i++) {
          const delta = Array(layer.weights[0].length).fill(0);
          for (let j = 0; j < layer.weights.length; j++) {
            for (let k = 0; k < layer.weights[0].length; k++) {
              delta[k] += deltas[i][j] * layer.weights[j][k];
            }
          }
          // 应用激活函数的导数
          for (let k = 0; k < delta.length; k++) {
            delta[k] *= this.activateDerivative(
              activations[l - 1][i][k],
              layer.activation
            );
          }
          newDeltas.push(delta);
        }
        deltas = newDeltas;
      }

      // 归一化梯度
      for (let i = 0; i < weightGradients.length; i++) {
        for (let j = 0; j < weightGradients[0].length; j++) {
          weightGradients[i][j] /= batchSize;
        }
        biasGradients[i] /= batchSize;
      }

      layerGradients.unshift({weights: weightGradients, biases: biasGradients});
    }

    return layerGradients;
  }

  /**
   * Initializes weights for a layer using the specified initialization strategy
   * @param inputSize Number of input features
   * @param outputSize Number of output features
   * @param activation Activation function type
   * @returns Initialized weight matrix
   */
  private initializeWeights(inputSize: number, outputSize: number, activation?: string): number[][] {
    // ... 实现保持不变 ...
  }

  /**
   * Initializes bias values for a layer
   * @param size Number of neurons in the layer
   * @returns Initialized bias vector
   */
  private initializeBiases(size: number): number[] {
    // ... 实现保持不变 ...
  }

  /**
   * Generates a matrix of normally distributed random numbers
   * @param rows Number of rows
   * @param cols Number of columns
   * @param mean Mean of the distribution
   * @param std Standard deviation of the distribution
   * @returns Matrix of random numbers
   */
  private generateNormalMatrix(rows: number, cols: number, mean: number, std: number): number[][] {
    // ... 实现保持不变 ...
  }

  /**
   * Generates a matrix of uniformly distributed random numbers
   * @param rows Number of rows
   * @param cols Number of columns
   * @param min Minimum value
   * @param max Maximum value
   * @returns Matrix of random numbers
   */
  private generateUniformMatrix(rows: number, cols: number, min: number, max: number): number[][] {
    // ... 实现保持不变 ...
  }

  /**
   * Gets the gain factor for weight initialization based on activation function
   * @param activation Activation function type
   * @returns Gain factor
   */
  private getActivationGain(activation?: string): number {
    // ... 实现保持不变 ...
  }

  /**
   * Applies activation function to a single value
   * @param x Input value
   * @param activation Activation function type
   * @returns Activated value
   */
  private activate(x: number, activation: string): number {
    // ... 实现保持不变 ...
  }

  /**
   * Computes derivative of activation function
   * @param x Input value
   * @param activation Activation function type
   * @returns Derivative value
   */
  private activateDerivative(x: number, activation: string): number {
    // ... 实现保持不变 ...
  }

  /**
   * Computes loss between prediction and target
   * @param prediction Predicted values
   * @param label Target values
   * @returns Loss value
   */
  private computeLoss(prediction: number[], label: number[]): number {
    // ... 实现保持不变 ...
  }

  /**
   * Flattens all network parameters into a single array
   * @returns Flattened parameters array
   */
  private flattenParameters(): number[] {
    // ... 实现保持不变 ...
  }

  /**
   * Reconstructs network parameters from flattened array
   */
  private reconstructParameters(): void {
    // ... 实现保持不变 ...
  }

  /**
   * Initializes optimizer state based on selected optimizer
   */
  private initializeOptimizerState(): void {
    // ... 实现保持不变 ...
  }

  /**
   * Applies SGD optimizer update with momentum
   * @param layerGradients Gradients for each layer
   */
  private applySGD(layerGradients: Array<{weights: number[][], biases: number[]}>): void {
    // ... 实现保持不变 ...
  }

  /**
   * Applies Adam optimizer update
   * @param layerGradients Gradients for each layer
   */
  private applyAdam(layerGradients: Array<{weights: number[][], biases: number[]}>): void {
    // ... 实现保持不变 ...
  }

  /**
   * Applies RMSprop optimizer update
   * @param layerGradients Gradients for each layer
   */
  private applyRMSprop(layerGradients: Array<{weights: number[][], biases: number[]}>): void {
    // ... 实现保持不变 ...
  }

  /**
   * Applies Adagrad optimizer update
   * @param layerGradients Gradients for each layer
   */
  private applyAdagrad(layerGradients: Array<{weights: number[][], biases: number[]}>): void {
    // ... 实现保持不变 ...
  }

  /**
   * Applies regularization to gradients
   * @param gradients Input gradients
   * @returns Regularized gradients
   */
  private applyRegularization(gradients: number[]): number[] {
    // ... 实现保持不变 ...
  }

  /**
   * Reconstructs layer gradients from flattened array
   * @param gradients Flattened gradients array
   * @returns Layer gradients
   */
  private reconstructGradients(
    gradients: number[]
  ): Array<{weights: number[][], biases: number[]}> {
    // ... 实现保持不变 ...
  }

  /**
   * Generates dropout mask for a layer
   * @param layer Layer to generate mask for
   * @param batchSize Batch size
   * @returns Dropout mask
   */
  private generateDropoutMask(layer: Layer, batchSize: number): boolean[][] {
    // ... 实现保持不变 ...
  }

  /**
   * Applies dropout mask to layer outputs
   * @param output Layer outputs
   * @param mask Dropout mask
   * @returns Masked outputs
   */
  private applyDropout(output: number[][], mask: boolean[][]): number[][] {
    // ... 实现保持不变 ...
  }

  /**
   * Checks if early stopping should be triggered
   * @param validationLoss Current validation loss
   * @param patience Number of epochs to wait before early stopping
   * @returns Whether to stop training
   */
  private checkEarlyStopping(validationLoss: number, patience: number = 5): boolean {
    // ... 实现保持不变 ...
  }

  /**
   * Initializes batch normalization parameters for a layer
   * @param layer Layer to initialize batch norm for
   */
  private initializeBatchNorm(layer: Layer): void {
    // ... 实现保持不变 ...
  }

  /**
   * Clips gradients to prevent exploding gradients
   * @param gradients Input gradients
   * @returns Clipped gradients
   */
  private clipGradients(gradients: number[]): number[] {
    const norm = Math.sqrt(
      gradients.reduce((sum, grad) => sum + grad * grad, 0)
    );

    if (norm > this.gradientClipNorm!) {
      const scale = this.gradientClipNorm! / norm;
      return gradients.map(grad => grad * scale);
    }

    return gradients;
  }

  /**
   * Updates learning rate according to schedule
   * @param epoch Current epoch
   */
  private updateLearningRate(epoch: number): void {
    if (!this.lrSchedule) return;

    switch (this.lrSchedule.type) {
      case 'step':
        if (this.lrSchedule.steps && epoch % this.lrSchedule.steps === 0) {
          this.currentLearningRate *= this.lrSchedule.decay;
        }
        break;
      case 'exponential':
        this.currentLearningRate = this.lrSchedule.initialLr * 
          Math.pow(this.lrSchedule.decay, epoch);
        break;
      case 'cosine':
        const totalEpochs = this.config.epochs;
        this.currentLearningRate = this.lrSchedule.initialLr * 
          (1 + Math.cos(Math.PI * epoch / totalEpochs)) / 2;
        break;
    }
  }

  /**
   * Applies batch normalization to layer outputs
   * @param inputs Layer inputs
   * @param layer Current layer
   * @param isTraining Whether in training mode
   * @returns Normalized outputs
   */
  private applyBatchNorm(
    inputs: number[][],
    layer: Layer,
    isTraining: boolean
  ): number[][] {
    const batchSize = inputs.length;
    const featureSize = inputs[0].length;
    const epsilon = 1e-8;

    // 计算每个特征的均值和方差
    const mean = Array(featureSize).fill(0);
    const variance = Array(featureSize).fill(0);

    // 计算均值
    for (let i = 0; i < batchSize; i++) {
      for (let j = 0; j < featureSize; j++) {
        mean[j] += inputs[i][j];
      }
    }
    for (let j = 0; j < featureSize; j++) {
      mean[j] /= batchSize;
    }

    // 计算方差
    for (let i = 0; i < batchSize; i++) {
      for (let j = 0; j < featureSize; j++) {
        variance[j] += Math.pow(inputs[i][j] - mean[j], 2);
      }
    }
    for (let j = 0; j < featureSize; j++) {
      variance[j] /= batchSize;
    }

    if (isTraining) {
      // 更新移动平均
      const momentum = 0.9;
      for (let j = 0; j < featureSize; j++) {
        layer.batchNorm!.movingMean[j] = momentum * layer.batchNorm!.movingMean[j] +
          (1 - momentum) * mean[j];
        layer.batchNorm!.movingVariance[j] = momentum * layer.batchNorm!.movingVariance[j] +
          (1 - momentum) * variance[j];
      }
    } else {
      // 使用移动平均
      for (let j = 0; j < featureSize; j++) {
        mean[j] = layer.batchNorm!.movingMean[j];
        variance[j] = layer.batchNorm!.movingVariance[j];
      }
    }

    // 归一化和缩放
    const normalized = inputs.map(input =>
      input.map((value, j) => {
        const norm = (value - mean[j]) / Math.sqrt(variance[j] + epsilon);
        return layer.batchNorm!.gamma[j] * norm + layer.batchNorm!.beta[j];
      })
    );

    return normalized;
  }

  /**
   * Saves the model state to a file
   * @param path File path to save the model
   */
  async save(path: string): Promise<void> {
    const modelState = {
      config: this.config,
      regularization: this.regularization,
      lrSchedule: this.lrSchedule,
      initConfig: this.initConfig,
      validationConfig: this.validationConfig,
      gradientClipNorm: this.gradientClipNorm,
      layers: this.layers.map(layer => ({
        weights: layer.weights,
        biases: layer.biases,
        activation: layer.activation,
        dropout: layer.dropout,
        batchNorm: layer.batchNorm ? {
          gamma: layer.batchNorm.gamma,
          beta: layer.batchNorm.beta,
          movingMean: layer.batchNorm.movingMean,
          movingVariance: layer.batchNorm.movingVariance
        } : undefined
      })),
      currentLearningRate: this.currentLearningRate,
      bestLoss: this.bestLoss
    };

    try {
      const fs = require('fs');
      await fs.promises.writeFile(path, JSON.stringify(modelState, null, 2));
      console.log(`Model saved successfully to ${path}`);
    } catch (error) {
      console.error('Error saving model:', error);
      throw error;
    }
  }

  /**
   * Loads the model state from a file
   * @param path File path to load the model from
   */
  async load(path: string): Promise<void> {
    try {
      const fs = require('fs');
      const data = await fs.promises.readFile(path, 'utf8');
      const modelState = JSON.parse(data);

      // 恢复模型配置
      this.config = modelState.config;
      this.regularization = modelState.regularization;
      this.lrSchedule = modelState.lrSchedule;
      this.initConfig = modelState.initConfig;
      this.validationConfig = modelState.validationConfig;
      this.gradientClipNorm = modelState.gradientClipNorm;
      
      // 恢复层参数
      this.layers = modelState.layers.map(layerState => ({
        weights: layerState.weights,
        biases: layerState.biases,
        activation: layerState.activation,
        dropout: layerState.dropout,
        batchNorm: layerState.batchNorm ? {
          gamma: layerState.batchNorm.gamma,
          beta: layerState.batchNorm.beta,
          movingMean: layerState.batchNorm.movingMean,
          movingVariance: layerState.batchNorm.movingVariance
        } : undefined
      }));

      this.currentLearningRate = modelState.currentLearningRate;
      this.bestLoss = modelState.bestLoss;
      this.initialized = true;
      this.parameters = this.flattenParameters();

      // 重新初始化优化器状态
      this.initializeOptimizerState();

      console.log(`Model loaded successfully from ${path}`);
    } catch (error) {
      console.error('Error loading model:', error);
      throw error;
    }
  }
} 