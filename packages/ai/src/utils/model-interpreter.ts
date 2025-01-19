import { InterpretabilityConfig } from '../core/types';
import * as tf from '@tensorflow/tfjs-node';

export class ModelInterpreter {
  private config: InterpretabilityConfig;

  constructor(config: InterpretabilityConfig) {
    this.config = config;
  }

  public async interpret(
    model: tf.LayersModel,
    input: number[],
    targetClass?: number
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    for (const method of this.config.methods) {
      switch (method) {
        case 'gradientBased':
          results.gradients = await this.computeGradients(model, input, targetClass);
          break;
        case 'layerActivation':
          results.activations = await this.getLayerActivations(model, input);
          break;
        case 'featureImportance':
          results.importance = await this.computeFeatureImportance(model, input);
          break;
        case 'attentionMap':
          results.attention = await this.generateAttentionMap(model, input);
          break;
        case 'lime':
          results.lime = await this.explainWithLIME(model, input);
          break;
        case 'shap':
          results.shap = await this.computeSHAPValues(model, input);
          break;
        default:
          throw new Error(`Unsupported interpretation method: ${method}`);
      }
    }

    return results;
  }

  private async computeGradients(
    model: tf.LayersModel,
    input: number[],
    targetClass?: number
  ): Promise<number[]> {
    return tf.tidy(() => {
      const inputTensor = tf.tensor2d([input]);
      const gradientFunc = tf.grad(x => {
        const prediction = model.predict(x) as tf.Tensor;
        if (targetClass !== undefined) {
          return prediction.slice([0, targetClass], [1, 1]);
        }
        return prediction;
      });
      
      const gradients = gradientFunc(inputTensor);
      return Array.from(gradients.dataSync());
    });
  }

  private async getLayerActivations(
    model: tf.LayersModel,
    input: number[]
  ): Promise<Record<string, number[]>> {
    const activations: Record<string, number[]> = {};
    const { targetLayers = [] } = this.config;

    // Create intermediate models for each layer
    for (const layer of model.layers) {
      if (targetLayers.length === 0 || targetLayers.includes(layer.name)) {
        const intermediateModel = tf.model({
          inputs: model.inputs,
          outputs: layer.output
        });

        const inputTensor = tf.tensor2d([input]);
        const activation = intermediateModel.predict(inputTensor) as tf.Tensor;
        activations[layer.name] = Array.from(activation.dataSync());
      }
    }

    return activations;
  }

  private async computeFeatureImportance(
    model: tf.LayersModel,
    input: number[]
  ): Promise<number[]> {
    const importance: number[] = [];
    const baseline = tf.zeros([1, input.length]);
    const inputTensor = tf.tensor2d([input]);

    // Compute importance for each feature
    for (let i = 0; i < input.length; i++) {
      const perturbedInput = baseline.clone();
      perturbedInput.slice([0, i], [1, 1]).assign(inputTensor.slice([0, i], [1, 1]));
      
      const baselinePred = model.predict(baseline) as tf.Tensor;
      const perturbedPred = model.predict(perturbedInput) as tf.Tensor;
      
      const diff = tf.sub(perturbedPred, baselinePred);
      importance[i] = Math.abs(diff.dataSync()[0]);
    }

    return importance;
  }

  private async generateAttentionMap(
    model: tf.LayersModel,
    input: number[]
  ): Promise<number[][]> {
    // Find attention layers in the model
    const attentionLayers = model.layers.filter(layer => 
      layer.name.toLowerCase().includes('attention')
    );

    if (attentionLayers.length === 0) {
      throw new Error('No attention layers found in the model');
    }

    const attentionMaps: number[][] = [];
    const inputTensor = tf.tensor2d([input]);

    // Extract attention weights from each attention layer
    for (const layer of attentionLayers) {
      const intermediateModel = tf.model({
        inputs: model.inputs,
        outputs: layer.output
      });

      const attention = intermediateModel.predict(inputTensor) as tf.Tensor;
      attentionMaps.push(Array.from(attention.dataSync()));
    }

    return attentionMaps;
  }

  private async explainWithLIME(
    model: tf.LayersModel,
    input: number[]
  ): Promise<Record<string, number>> {
    const { numSamples = 1000 } = this.config;
    const explanations: Record<string, number> = {};

    // Generate perturbed samples around the input
    const samples = this.generatePerturbedSamples(input, numSamples);
    
    // Get predictions for all samples
    const predictions = await this.getPredictionsForSamples(model, samples);
    
    // Compute weights based on distance from original input
    const weights = samples.map(sample => 
      this.computeKernelWeight(input, sample)
    );

    // Fit a linear model to explain the predictions
    const coefficients = this.fitLinearModel(samples, predictions, weights);
    
    // Store feature importance scores
    input.forEach((_, i) => {
      explanations[`feature_${i}`] = coefficients[i];
    });

    return explanations;
  }

  private async computeSHAPValues(
    model: tf.LayersModel,
    input: number[]
  ): Promise<number[]> {
    const { numSamples = 100 } = this.config;
    const shapValues: number[] = [];

    // Generate background samples
    const backgroundSamples = this.generateBackgroundSamples(input, numSamples);
    
    // Compute SHAP values for each feature
    for (let i = 0; i < input.length; i++) {
      let shapValue = 0;
      
      // Compute marginal contributions
      for (const sample of backgroundSamples) {
        const withFeature = [...sample];
        withFeature[i] = input[i];
        
        const pred1 = await this.getPrediction(model, withFeature);
        const pred2 = await this.getPrediction(model, sample);
        
        shapValue += (pred1 - pred2) / numSamples;
      }
      
      shapValues.push(shapValue);
    }

    return shapValues;
  }

  private generatePerturbedSamples(input: number[], numSamples: number): number[][] {
    const samples: number[][] = [];
    
    for (let i = 0; i < numSamples; i++) {
      const sample = input.map(value => {
        const noise = (Math.random() - 0.5) * 0.1;
        return value + noise;
      });
      samples.push(sample);
    }
    
    return samples;
  }

  private async getPredictionsForSamples(
    model: tf.LayersModel,
    samples: number[][]
  ): Promise<number[]> {
    const predictions: number[] = [];
    
    for (const sample of samples) {
      const pred = await this.getPrediction(model, sample);
      predictions.push(pred);
    }
    
    return predictions;
  }

  private computeKernelWeight(original: number[], perturbed: number[]): number {
    const distance = Math.sqrt(
      original.reduce((sum, value, i) => 
        sum + Math.pow(value - perturbed[i], 2), 0
      )
    );
    
    // RBF kernel
    const width = 0.75;
    return Math.exp(-(Math.pow(distance, 2)) / (2 * Math.pow(width, 2)));
  }

  private fitLinearModel(
    samples: number[][],
    predictions: number[],
    weights: number[]
  ): number[] {
    // Simple weighted linear regression
    const numFeatures = samples[0].length;
    const coefficients = new Array(numFeatures).fill(0);
    
    // Gradient descent
    const learningRate = 0.01;
    const numIterations = 100;
    
    for (let iter = 0; iter < numIterations; iter++) {
      for (let i = 0; i < samples.length; i++) {
        const prediction = samples[i].reduce((sum, value, j) => 
          sum + value * coefficients[j], 0
        );
        
        const error = predictions[i] - prediction;
        
        for (let j = 0; j < numFeatures; j++) {
          coefficients[j] += learningRate * error * samples[i][j] * weights[i];
        }
      }
    }
    
    return coefficients;
  }

  private generateBackgroundSamples(input: number[], numSamples: number): number[][] {
    const samples: number[][] = [];
    
    for (let i = 0; i < numSamples; i++) {
      const sample = input.map(() => Math.random());
      samples.push(sample);
    }
    
    return samples;
  }

  private async getPrediction(model: tf.LayersModel, input: number[]): Promise<number> {
    const inputTensor = tf.tensor2d([input]);
    const prediction = model.predict(inputTensor) as tf.Tensor;
    return prediction.dataSync()[0];
  }
} 