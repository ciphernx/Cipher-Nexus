import { FHE, FHEParams, FHECiphertext, FHEKeyPair } from './fhe';
import { AdvancedFHE } from './advanced';

/**
 * Machine learning operations for homomorphic encryption
 */
export class HEML extends AdvancedFHE {
  private epsilon: number;
  private delta: number;
  private noiseScale: number;

  constructor(
    params: FHEParams,
    primes: bigint[],
    epsilon: number = 1.0,
    delta: number = 1e-5
  ) {
    super(params, primes);
    this.epsilon = epsilon;
    this.delta = delta;
    this.noiseScale = this.computeNoiseScale();
  }

  /**
   * Compute noise scale for differential privacy
   */
  private computeNoiseScale(): number {
    return Math.sqrt(2 * Math.log(1.25 / this.delta)) / this.epsilon;
  }

  /**
   * Add Gaussian noise for differential privacy
   */
  private async addNoise(input: FHECiphertext): Promise<FHECiphertext> {
    const noise = this.generateGaussianNoise(this.noiseScale);
    const encryptedNoise = await this.encrypt(noise);
    return await this.add(input, encryptedNoise);
  }

  /**
   * Generate Gaussian noise
   */
  private generateGaussianNoise(scale: number): bigint {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    const noise = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return BigInt(Math.round(noise * scale));
  }

  /**
   * Linear layer (matrix multiplication)
   */
  public async linear(
    input: FHECiphertext[],
    weights: bigint[][],
    bias: bigint[],
    evaluationKey: Buffer
  ): Promise<FHECiphertext[]> {
    // Encrypt weights if not already encrypted
    const encryptedWeights = await Promise.all(
      weights.map(row => 
        Promise.all(row.map(w => this.encrypt(w, evaluationKey)))
      )
    );
    
    // Perform matrix multiplication
    const output = await this.matrixMultiply(
      [input],
      encryptedWeights,
      evaluationKey
    );
    
    // Add bias
    const encryptedBias = await Promise.all(
      bias.map(b => this.encrypt(b, evaluationKey))
    );
    
    return Promise.all(
      output[0].map((out, i) => this.add(out, encryptedBias[i]))
    );
  }

  /**
   * ReLU activation function
   */
  public async relu(
    input: FHECiphertext,
    evaluationKey: Buffer
  ): Promise<FHECiphertext> {
    // Approximate ReLU using polynomial
    const coefficients = [
      0n,                     // constant term
      1n,                     // x
      0n,                     // x^2
      0n                      // x^3
    ];
    
    const zero = await this.encrypt(0n, evaluationKey);
    const approximation = await this.evaluatePolynomial(
      input,
      coefficients,
      evaluationKey
    );
    
    // Compare with 0 and select
    const comparison = await this.compare(input, zero, evaluationKey);
    return await this.select(comparison, input, zero, evaluationKey);
  }

  /**
   * Softmax activation function
   */
  public async softmax(
    input: FHECiphertext[],
    evaluationKey: Buffer
  ): Promise<FHECiphertext[]> {
    // Compute exponentials using polynomial approximation
    const expCoefficients = [
      1n,                     // constant term
      1n,                     // x
      0n,                     // x^2/2!
      0n                      // x^3/3!
    ];
    
    const exps = await Promise.all(
      input.map(x => 
        this.evaluatePolynomial(x, expCoefficients, evaluationKey)
      )
    );
    
    // Compute sum for normalization
    let sum = await this.encrypt(0n, evaluationKey);
    for (const exp of exps) {
      sum = await this.add(sum, exp);
    }
    
    // Normalize
    return Promise.all(
      exps.map(exp => this.divide(exp, sum, evaluationKey))
    );
  }

  /**
   * Batch normalization
   */
  public async batchNorm(
    input: FHECiphertext[],
    mean: bigint[],
    variance: bigint[],
    gamma: bigint[],
    beta: bigint[],
    evaluationKey: Buffer
  ): Promise<FHECiphertext[]> {
    const epsilon = 1n;
    
    // Center
    const centered = await Promise.all(
      input.map((x, i) => 
        this.subtract(x, await this.encrypt(mean[i], evaluationKey))
      )
    );
    
    // Scale
    const scaled = await Promise.all(
      centered.map((x, i) => {
        const factor = gamma[i] / (variance[i] + epsilon);
        return this.scalarMultiply(x, factor, evaluationKey);
      })
    );
    
    // Shift
    return Promise.all(
      scaled.map((x, i) => 
        this.add(x, await this.encrypt(beta[i], evaluationKey))
      )
    );
  }

  /**
   * Secure aggregation protocol for federated learning
   */
  public async secureAggregate(
    models: FHECiphertext[][],
    weights: bigint[],
    evaluationKey: Buffer
  ): Promise<FHECiphertext[]> {
    if (models.length !== weights.length) {
      throw new Error('Number of models must match number of weights');
    }
    
    // Initialize result
    const result = await Promise.all(
      models[0].map(() => this.encrypt(0n, evaluationKey))
    );
    
    // Weighted sum of models
    for (let i = 0; i < models.length; i++) {
      const weightedModel = await Promise.all(
        models[i].map(param => 
          this.scalarMultiply(param, weights[i], evaluationKey)
        )
      );
      
      for (let j = 0; j < result.length; j++) {
        result[j] = await this.add(result[j], weightedModel[j]);
      }
    }
    
    return result;
  }

  /**
   * Secure comparison protocol
   */
  private async select(
    condition: FHECiphertext,
    a: FHECiphertext,
    b: FHECiphertext,
    evaluationKey: Buffer
  ): Promise<FHECiphertext> {
    // condition * (a - b) + b
    const diff = await this.subtract(a, b);
    const scaled = await this.multiply(condition, diff, evaluationKey);
    return await this.add(scaled, b);
  }

  /**
   * Division approximation using Newton-Raphson method
   */
  private async divide(
    a: FHECiphertext,
    b: FHECiphertext,
    evaluationKey: Buffer
  ): Promise<FHECiphertext> {
    // Initial approximation
    const x0 = await this.encrypt(1n, evaluationKey);
    
    // Newton iterations: x = x * (2 - b * x)
    let x = x0;
    for (let i = 0; i < 3; i++) {
      const bx = await this.multiply(b, x, evaluationKey);
      const two = await this.encrypt(2n, evaluationKey);
      const term = await this.subtract(two, bx);
      x = await this.multiply(x, term, evaluationKey);
    }
    
    // Final multiplication with a
    return await this.multiply(a, x, evaluationKey);
  }

  /**
   * Secure model inference
   */
  public async secureInference(
    model: {
      weights: bigint[][][],
      biases: bigint[][],
      evaluationKey: Buffer
    },
    input: FHECiphertext[]
  ): Promise<FHECiphertext[]> {
    let current = input;
    
    // Process each layer
    for (let i = 0; i < model.weights.length; i++) {
      // Linear transformation
      current = await this.linear(
        current,
        model.weights[i],
        model.biases[i],
        model.evaluationKey
      );
      
      // Apply activation function (except last layer)
      if (i < model.weights.length - 1) {
        current = await Promise.all(
          current.map(x => this.relu(x, model.evaluationKey))
        );
      }
    }
    
    // Apply softmax to final layer
    return await this.softmax(current, model.evaluationKey);
  }

  /**
   * Convolutional layer with differential privacy
   */
  public async conv2d(
    input: FHECiphertext[][],
    kernels: bigint[][][],
    stride: [number, number],
    padding: 'valid' | 'same',
    evaluationKey: Buffer
  ): Promise<FHECiphertext[][]> {
    const result: FHECiphertext[][] = [];
    const [height, width] = [input.length, input[0].length];
    const [kernelHeight, kernelWidth] = [kernels[0].length, kernels[0][0].length];
    
    // Add padding if needed
    if (padding === 'same') {
      const padH = Math.floor((kernelHeight - 1) / 2);
      const padW = Math.floor((kernelWidth - 1) / 2);
      input = this.pad2d(input, padH, padW);
    }
    
    // Perform convolution
    for (let i = 0; i < height; i += stride[0]) {
      const row: FHECiphertext[] = [];
      for (let j = 0; j < width; j += stride[1]) {
        const patch = this.extractPatch(input, i, j, kernelHeight, kernelWidth);
        const conv = await this.convolveWithKernels(patch, kernels, evaluationKey);
        row.push(await this.addNoise(conv)); // Add noise for differential privacy
      }
      result.push(row);
    }
    
    return result;
  }

  /**
   * Batch normalization with differential privacy
   */
  public async batchNormWithPrivacy(
    input: FHECiphertext[],
    mean: bigint[],
    variance: bigint[],
    gamma: bigint[],
    beta: bigint[],
    evaluationKey: Buffer
  ): Promise<FHECiphertext[]> {
    const normalized = await this.batchNorm(
      input,
      mean,
      variance,
      gamma,
      beta,
      evaluationKey
    );
    
    // Add noise to each normalized value
    return Promise.all(
      normalized.map(x => this.addNoise(x))
    );
  }

  /**
   * Dropout layer with noise
   */
  public async dropout(
    input: FHECiphertext[],
    rate: number,
    evaluationKey: Buffer
  ): Promise<FHECiphertext[]> {
    const scale = 1 / (1 - rate);
    return Promise.all(
      input.map(async x => {
        if (Math.random() > rate) {
          const scaled = await this.scalarMultiply(x, BigInt(Math.round(scale * 1000)) / 1000n);
          return this.addNoise(scaled);
        }
        return this.encrypt(0n);
      })
    );
  }

  /**
   * Attention layer with differential privacy
   */
  public async attention(
    queries: FHECiphertext[][],
    keys: FHECiphertext[][],
    values: FHECiphertext[][],
    evaluationKey: Buffer
  ): Promise<FHECiphertext[][]> {
    // Compute attention scores
    const scores = await Promise.all(
      queries.map(async q => 
        Promise.all(keys.map(async k => {
          const dot = await this.dotProduct(q, k);
          return this.addNoise(dot);
        }))
      )
    );
    
    // Apply softmax
    const attentionWeights = await Promise.all(
      scores.map(row => this.softmax(row, evaluationKey))
    );
    
    // Compute weighted sum
    return Promise.all(
      attentionWeights.map(async weights => {
        const weightedValues = await Promise.all(
          values.map(async (v, i) => {
            const scaled = await Promise.all(
              v.map(x => this.multiply(x, weights[i], evaluationKey))
            );
            return scaled;
          })
        );
        
        // Sum and add noise
        const sum = await Promise.all(
          weightedValues[0].map(async (_, j) => {
            let result = await this.encrypt(0n);
            for (const row of weightedValues) {
              result = await this.add(result, row[j]);
            }
            return this.addNoise(result);
          })
        );
        
        return sum;
      })
    );
  }

  /**
   * Secure federated averaging with differential privacy
   */
  public async federatedAverageWithPrivacy(
    models: FHECiphertext[][],
    weights: bigint[],
    evaluationKey: Buffer,
    clipNorm: number
  ): Promise<FHECiphertext[]> {
    // Clip gradients
    const clippedModels = await Promise.all(
      models.map(async model => {
        const norm = await this.computeNorm(model);
        const scale = Math.min(1, clipNorm / norm);
        return Promise.all(
          model.map(param => this.scalarMultiply(param, BigInt(Math.round(scale * 1000)) / 1000n))
        );
      })
    );
    
    // Add noise and compute weighted average
    const result = await this.secureAggregate(
      clippedModels,
      weights,
      evaluationKey
    );
    
    // Add final noise layer
    return Promise.all(
      result.map(x => this.addNoise(x))
    );
  }

  /**
   * Helper method to compute L2 norm
   */
  private async computeNorm(
    params: FHECiphertext[]
  ): Promise<number> {
    let sumSquares = 0n;
    for (const param of params) {
      const value = await this.decrypt(param);
      sumSquares += value * value;
    }
    return Math.sqrt(Number(sumSquares));
  }

  /**
   * LSTM layer with differential privacy
   */
  public async lstm(
    input: FHECiphertext[][],
    weights: {
      inputWeights: bigint[][],
      recurrentWeights: bigint[][],
      bias: bigint[]
    },
    initialState: {
      hidden: FHECiphertext[],
      cell: FHECiphertext[]
    },
    evaluationKey: Buffer
  ): Promise<{
    output: FHECiphertext[][],
    finalState: {
      hidden: FHECiphertext[],
      cell: FHECiphertext[]
    }
  }> {
    const output: FHECiphertext[][] = [];
    let currentHidden = initialState.hidden;
    let currentCell = initialState.cell;
    
    // Process each timestep
    for (const timestep of input) {
      // Compute gates
      const combined = await this.linear(
        [...timestep, ...currentHidden],
        [
          ...weights.inputWeights,
          ...weights.recurrentWeights
        ],
        weights.bias,
        evaluationKey
      );
      
      const gateSize = combined.length / 4;
      const [inputGate, forgetGate, cellGate, outputGate] = [
        combined.slice(0, gateSize),
        combined.slice(gateSize, 2 * gateSize),
        combined.slice(2 * gateSize, 3 * gateSize),
        combined.slice(3 * gateSize)
      ];
      
      // Apply activations with noise
      const sigmoidInputGate = await Promise.all(
        inputGate.map(x => this.sigmoidWithNoise(x))
      );
      const sigmoidForgetGate = await Promise.all(
        forgetGate.map(x => this.sigmoidWithNoise(x))
      );
      const tanhCellGate = await Promise.all(
        cellGate.map(x => this.tanhWithNoise(x))
      );
      const sigmoidOutputGate = await Promise.all(
        outputGate.map(x => this.sigmoidWithNoise(x))
      );
      
      // Update cell state
      const newCell = await Promise.all(
        currentCell.map(async (c, i) => {
          const forget = await this.multiply(c, sigmoidForgetGate[i], evaluationKey);
          const input = await this.multiply(tanhCellGate[i], sigmoidInputGate[i], evaluationKey);
          return this.addNoise(await this.add(forget, input));
        })
      );
      
      // Update hidden state
      const newHidden = await Promise.all(
        newCell.map(async (c, i) => {
          const tanh = await this.tanhWithNoise(c);
          return this.multiply(tanh, sigmoidOutputGate[i], evaluationKey);
        })
      );
      
      output.push(newHidden);
      currentHidden = newHidden;
      currentCell = newCell;
    }
    
    return {
      output,
      finalState: {
        hidden: currentHidden,
        cell: currentCell
      }
    };
  }

  /**
   * GRU layer with differential privacy
   */
  public async gru(
    input: FHECiphertext[][],
    weights: {
      inputWeights: bigint[][],
      recurrentWeights: bigint[][],
      bias: bigint[]
    },
    initialHidden: FHECiphertext[],
    evaluationKey: Buffer
  ): Promise<{
    output: FHECiphertext[][],
    finalHidden: FHECiphertext[]
  }> {
    const output: FHECiphertext[][] = [];
    let currentHidden = initialHidden;
    
    // Process each timestep
    for (const timestep of input) {
      // Compute gates
      const combined = await this.linear(
        [...timestep, ...currentHidden],
        [
          ...weights.inputWeights,
          ...weights.recurrentWeights
        ],
        weights.bias,
        evaluationKey
      );
      
      const gateSize = combined.length / 3;
      const [updateGate, resetGate, newGate] = [
        combined.slice(0, gateSize),
        combined.slice(gateSize, 2 * gateSize),
        combined.slice(2 * gateSize)
      ];
      
      // Apply activations with noise
      const sigmoidUpdateGate = await Promise.all(
        updateGate.map(x => this.sigmoidWithNoise(x))
      );
      const sigmoidResetGate = await Promise.all(
        resetGate.map(x => this.sigmoidWithNoise(x))
      );
      
      // Compute candidate hidden state
      const resetHidden = await Promise.all(
        currentHidden.map(async (h, i) => 
          this.multiply(h, sigmoidResetGate[i], evaluationKey)
        )
      );
      
      const candidateHidden = await Promise.all(
        newGate.map(x => this.tanhWithNoise(x))
      );
      
      // Update hidden state
      currentHidden = await Promise.all(
        currentHidden.map(async (h, i) => {
          const update = await this.multiply(
            sigmoidUpdateGate[i],
            await this.subtract(candidateHidden[i], h),
            evaluationKey
          );
          return this.addNoise(await this.add(h, update));
        })
      );
      
      output.push(currentHidden);
    }
    
    return {
      output,
      finalHidden: currentHidden
    };
  }

  /**
   * Enhanced privacy mechanisms
   */
  private async sigmoidWithNoise(x: FHECiphertext): Promise<FHECiphertext> {
    const sigmoid = await this.sigmoid(x);
    return this.addNoise(sigmoid);
  }

  private async tanhWithNoise(x: FHECiphertext): Promise<FHECiphertext> {
    // tanh(x) = 2sigmoid(2x) - 1
    const scaled = await this.scalarMultiply(x, 2n);
    const sigmoid = await this.sigmoidWithNoise(scaled);
    const doubled = await this.scalarMultiply(sigmoid, 2n);
    const one = await this.encrypt(1n);
    return this.subtract(doubled, one);
  }

  /**
   * Optimized distributed training with enhanced privacy
   */
  public async distributedTrainingStep(
    localModels: FHECiphertext[][],
    globalModel: FHECiphertext[],
    learningRate: bigint,
    batchSize: number,
    evaluationKey: Buffer,
    privacyBudget: {
      epsilon: number,
      delta: number,
      clipNorm: number
    }
  ): Promise<FHECiphertext[]> {
    // Compute local updates with gradient clipping
    const localUpdates = await Promise.all(
      localModels.map(async model => {
        const update = await Promise.all(
          model.map(async (param, i) => 
            this.subtract(param, globalModel[i])
          )
        );
        
        // Clip gradients
        const norm = await this.computeNorm(update);
        const scale = Math.min(1, privacyBudget.clipNorm / norm);
        return Promise.all(
          update.map(param => 
            this.scalarMultiply(param, BigInt(Math.round(scale * 1000)) / 1000n)
          )
        );
      })
    );
    
    // Compute noisy average
    const averageUpdate = await this.federatedAverageWithPrivacy(
      localUpdates,
      Array(localModels.length).fill(BigInt(1000000 / localModels.length)),
      evaluationKey,
      privacyBudget.clipNorm
    );
    
    // Apply updates with momentum
    return Promise.all(
      globalModel.map(async (param, i) => {
        const scaledUpdate = await this.scalarMultiply(
          averageUpdate[i],
          learningRate
        );
        return this.addNoise(await this.add(param, scaledUpdate));
      })
    );
  }

  /**
   * Transformer layer with differential privacy
   */
  public async transformer(
    input: FHECiphertext[][],
    weights: {
      queryWeight: bigint[][],
      keyWeight: bigint[][],
      valueWeight: bigint[][],
      outputWeight: bigint[][],
      bias: bigint[]
    },
    numHeads: number,
    evaluationKey: Buffer
  ): Promise<FHECiphertext[][]> {
    // Multi-head self attention
    const headDim = weights.queryWeight[0].length / numHeads;
    
    // Project queries, keys, and values
    const queries = await this.linear(
      input.flat(),
      weights.queryWeight,
      weights.bias.slice(0, weights.queryWeight[0].length),
      evaluationKey
    );
    const keys = await this.linear(
      input.flat(),
      weights.keyWeight,
      weights.bias.slice(weights.queryWeight[0].length, weights.queryWeight[0].length * 2),
      evaluationKey
    );
    const values = await this.linear(
      input.flat(),
      weights.valueWeight,
      weights.bias.slice(weights.queryWeight[0].length * 2, weights.queryWeight[0].length * 3),
      evaluationKey
    );
    
    // Split into heads
    const queryHeads = this.splitIntoHeads(queries, numHeads);
    const keyHeads = this.splitIntoHeads(keys, numHeads);
    const valueHeads = this.splitIntoHeads(values, numHeads);
    
    // Compute attention scores for each head
    const attentionHeads = await Promise.all(
      queryHeads.map(async (queryHead, i) => 
        this.attention(
          this.reshapeToSequence(queryHead, input.length),
          this.reshapeToSequence(keyHeads[i], input.length),
          this.reshapeToSequence(valueHeads[i], input.length),
          evaluationKey
        )
      )
    );
    
    // Concatenate heads
    const concatHeads = this.concatenateHeads(attentionHeads);
    
    // Final linear projection
    const output = await this.linear(
      concatHeads.flat(),
      weights.outputWeight,
      weights.bias.slice(weights.queryWeight[0].length * 3),
      evaluationKey
    );
    
    // Reshape back to sequence
    return this.reshapeToSequence(output, input.length);
  }

  /**
   * Secure multi-party computation protocols
   */
  public async secureMultiPartyComputation(
    parties: Array<{
      data: FHECiphertext[],
      weight: bigint
    }>,
    computeFunction: 'mean' | 'sum' | 'max',
    evaluationKey: Buffer,
    privacyBudget: {
      epsilon: number,
      delta: number
    }
  ): Promise<FHECiphertext[]> {
    // Initialize secure aggregation
    const aggregator = await this.initializeSecureAggregation(
      parties.length,
      evaluationKey
    );
    
    // Each party adds noise and shares encrypted data
    const encryptedShares = await Promise.all(
      parties.map(async party => {
        // Add noise based on privacy budget
        const noisyData = await Promise.all(
          party.data.map(x => this.addNoise(x))
        );
        
        // Generate secret shares
        return this.generateSecretShares(
          noisyData,
          parties.length,
          evaluationKey
        );
      })
    );
    
    // Exchange shares securely
    const combinedShares = await this.exchangeShares(
      encryptedShares,
      evaluationKey
    );
    
    // Compute final result based on function
    switch (computeFunction) {
      case 'mean':
        return this.computeSecureMean(
          combinedShares,
          parties.map(p => p.weight),
          evaluationKey
        );
      case 'sum':
        return this.computeSecureSum(
          combinedShares,
          evaluationKey
        );
      case 'max':
        return this.computeSecureMax(
          combinedShares,
          evaluationKey
        );
      default:
        throw new Error('Unsupported computation function');
    }
  }

  /**
   * Initialize secure aggregation protocol
   */
  private async initializeSecureAggregation(
    numParties: number,
    evaluationKey: Buffer
  ): Promise<{
    publicKey: Buffer,
    verificationKey: Buffer
  }> {
    // Generate aggregation keys
    const publicKey = await this.generateAggregationKey(evaluationKey);
    const verificationKey = await this.generateVerificationKey(evaluationKey);
    
    return {
      publicKey,
      verificationKey
    };
  }

  /**
   * Generate secret shares for secure computation
   */
  private async generateSecretShares(
    data: FHECiphertext[],
    numShares: number,
    evaluationKey: Buffer
  ): Promise<FHECiphertext[][]> {
    const shares: FHECiphertext[][] = [];
    
    for (let i = 0; i < numShares; i++) {
      const share = await Promise.all(
        data.map(async x => {
          const randomMask = await this.generateRandomMask(evaluationKey);
          return this.add(x, randomMask);
        })
      );
      shares.push(share);
    }
    
    return shares;
  }

  /**
   * Exchange shares between parties securely
   */
  private async exchangeShares(
    shares: FHECiphertext[][][],
    evaluationKey: Buffer
  ): Promise<FHECiphertext[][]> {
    // Verify share integrity
    await this.verifyShares(shares, evaluationKey);
    
    // Combine shares
    const combined: FHECiphertext[][] = [];
    for (let i = 0; i < shares[0].length; i++) {
      const partyShares = shares.map(s => s[i]);
      combined.push(partyShares);
    }
    
    return combined;
  }

  /**
   * Compute secure mean with differential privacy
   */
  private async computeSecureMean(
    shares: FHECiphertext[][],
    weights: bigint[],
    evaluationKey: Buffer
  ): Promise<FHECiphertext[]> {
    // First compute weighted sum
    const weightedSum = await Promise.all(
      shares[0].map(async (_, i) => {
        let sum = await this.encrypt(0n);
        for (let j = 0; j < shares.length; j++) {
          const weighted = await this.scalarMultiply(
            shares[j][i],
            weights[j]
          );
          sum = await this.add(sum, weighted);
        }
        return sum;
      })
    );
    
    // Compute total weight
    const totalWeight = weights.reduce((a, b) => a + b, 0n);
    
    // Divide by total weight
    return Promise.all(
      weightedSum.map(async sum => {
        const scaled = await this.scalarMultiply(
          sum,
          BigInt(1000000) / totalWeight
        );
        return this.addNoise(scaled);
      })
    );
  }

  /**
   * Helper methods for Transformer layer
   */
  private splitIntoHeads(
    tensor: FHECiphertext[],
    numHeads: number
  ): FHECiphertext[][] {
    const headSize = tensor.length / numHeads;
    const heads: FHECiphertext[][] = [];
    
    for (let i = 0; i < numHeads; i++) {
      heads.push(tensor.slice(i * headSize, (i + 1) * headSize));
    }
    
    return heads;
  }

  private concatenateHeads(
    heads: FHECiphertext[][][]
  ): FHECiphertext[] {
    return heads.reduce((acc, head) => [...acc, ...head.flat()], []);
  }

  private reshapeToSequence(
    tensor: FHECiphertext[],
    seqLength: number
  ): FHECiphertext[][] {
    const result: FHECiphertext[][] = [];
    const stepSize = tensor.length / seqLength;
    
    for (let i = 0; i < seqLength; i++) {
      result.push(tensor.slice(i * stepSize, (i + 1) * stepSize));
    }
    
    return result;
  }

  /**
   * Asynchronous distributed training
   */
  public async trainDistributed(
    parties: Array<{
      data: FHECiphertext[][],
      labels: FHECiphertext[],
      weight: bigint
    }>,
    model: {
      weights: bigint[][],
      bias: bigint[]
    },
    config: {
      learningRate: number,
      batchSize: number,
      numEpochs: number,
      staleness: number,
      privacyBudget: {
        epsilon: number,
        delta: number
      }
    },
    evaluationKey: Buffer
  ): Promise<{
    weights: bigint[][],
    bias: bigint[],
    metrics: {
      loss: number[],
      accuracy: number[]
    }
  }> {
    // Initialize training state
    const state = await this.initializeTrainingState(
      model,
      parties.length,
      evaluationKey
    );
    
    // Start asynchronous training
    const partyPromises = parties.map(async (party, partyId) => {
      let localModel = this.cloneModel(model);
      
      for (let epoch = 0; epoch < config.numEpochs; epoch++) {
        // Get batches
        const batches = this.getBatches(
          party.data,
          party.labels,
          config.batchSize
        );
        
        for (const batch of batches) {
          // Check staleness and update local model if needed
          if (await this.checkStaleness(
            localModel,
            state.globalModel,
            config.staleness
          )) {
            localModel = this.cloneModel(state.globalModel);
          }
          
          // Compute gradients
          const gradients = await this.computeGradients(
            batch.data,
            batch.labels,
            localModel,
            evaluationKey
          );
          
          // Add noise to gradients for privacy
          const noisyGradients = await this.addNoiseToGradients(
            gradients,
            config.privacyBudget,
            evaluationKey
          );
          
          // Update local model
          localModel = await this.updateModel(
            localModel,
            noisyGradients,
            config.learningRate,
            evaluationKey
          );
          
          // Asynchronously update global model
          await this.updateGlobalModel(
            state,
            localModel,
            party.weight,
            partyId,
            evaluationKey
          );
        }
      }
    });
    
    // Wait for all parties to complete
    await Promise.all(partyPromises);
    
    // Return final model and metrics
    return {
      weights: state.globalModel.weights,
      bias: state.globalModel.bias,
      metrics: state.metrics
    };
  }

  /**
   * Initialize distributed training state
   */
  private async initializeTrainingState(
    model: {
      weights: bigint[][],
      bias: bigint[]
    },
    numParties: number,
    evaluationKey: Buffer
  ): Promise<{
    globalModel: {
      weights: bigint[][],
      bias: bigint[]
    },
    versionMap: Map<number, number>,
    metrics: {
      loss: number[],
      accuracy: number[]
    },
    lock: any
  }> {
    return {
      globalModel: this.cloneModel(model),
      versionMap: new Map(
        Array.from({ length: numParties }, (_, i) => [i, 0])
      ),
      metrics: {
        loss: [],
        accuracy: []
      },
      lock: new AsyncLock()
    };
  }

  /**
   * Check model staleness
   */
  private async checkStaleness(
    localModel: {
      weights: bigint[][],
      bias: bigint[]
    },
    globalModel: {
      weights: bigint[][],
      bias: bigint[]
    },
    maxStaleness: number
  ): Promise<boolean> {
    const versionDiff = await this.computeVersionDifference(
      localModel,
      globalModel
    );
    return versionDiff > maxStaleness;
  }

  /**
   * Update global model asynchronously
   */
  private async updateGlobalModel(
    state: {
      globalModel: {
        weights: bigint[][],
        bias: bigint[]
      },
      versionMap: Map<number, number>,
      metrics: {
        loss: number[],
        accuracy: number[]
      },
      lock: any
    },
    localModel: {
      weights: bigint[][],
      bias: bigint[]
    },
    weight: bigint,
    partyId: number,
    evaluationKey: Buffer
  ): Promise<void> {
    await state.lock.acquire('globalModel', async () => {
      // Update version
      state.versionMap.set(
        partyId,
        state.versionMap.get(partyId)! + 1
      );
      
      // Weighted average of models
      state.globalModel = await this.weightedAverageModels(
        state.globalModel,
        localModel,
        weight,
        evaluationKey
      );
      
      // Update metrics
      const metrics = await this.computeMetrics(
        state.globalModel,
        evaluationKey
      );
      state.metrics.loss.push(metrics.loss);
      state.metrics.accuracy.push(metrics.accuracy);
    });
  }

  /**
   * Helper method to clone model
   */
  private cloneModel(
    model: {
      weights: bigint[][],
      bias: bigint[]
    }
  ): {
    weights: bigint[][],
    bias: bigint[]
  } {
    return {
      weights: model.weights.map(row => [...row]),
      bias: [...model.bias]
    };
  }

  /**
   * Get batches from data
   */
  private getBatches(
    data: FHECiphertext[][],
    labels: FHECiphertext[],
    batchSize: number
  ): Array<{
    data: FHECiphertext[][],
    labels: FHECiphertext[]
  }> {
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push({
        data: data.slice(i, i + batchSize),
        labels: labels.slice(i, i + batchSize)
      });
    }
    return batches;
  }
} 