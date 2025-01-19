import { CompressionType, CompressionConfig } from '../core/types';
import * as tf from '@tensorflow/tfjs-node';

export class ModelCompressor {
  private config: CompressionConfig;

  constructor(config: CompressionConfig) {
    this.config = config;
  }

  public async compress(model: tf.LayersModel): Promise<tf.LayersModel> {
    switch (this.config.type) {
      case CompressionType.QUANTIZATION:
        return await this.quantize(model);
      case CompressionType.PRUNING:
        return await this.prune(model);
      case CompressionType.KNOWLEDGE_DISTILLATION:
        return await this.distill(model);
      case CompressionType.WEIGHT_CLUSTERING:
        return await this.clusterWeights(model);
      default:
        throw new Error(`Unsupported compression type: ${this.config.type}`);
    }
  }

  private async quantize(model: tf.LayersModel): Promise<tf.LayersModel> {
    const { quantizationBits = 8 } = this.config;
    
    // Convert weights to integers with specified bits
    const quantizedModel = tf.sequential();
    
    for (const layer of model.layers) {
      const weights = layer.getWeights();
      const quantizedWeights = weights.map(weight => {
        const { min, max } = this.getMinMax(weight);
        const scale = (max - min) / (Math.pow(2, quantizationBits) - 1);
        
        // Quantize weights
        const quantized = weight.arraySync().map((w: number) => 
          Math.round((w - min) / scale)
        );
        
        // Dequantize for inference
        return tf.tensor(quantized.map((q: number) => 
          q * scale + min
        ), weight.shape);
      });
      
      layer.setWeights(quantizedWeights);
      quantizedModel.add(layer);
    }
    
    return quantizedModel;
  }

  private async prune(model: tf.LayersModel): Promise<tf.LayersModel> {
    const { sparsity = 0.5 } = this.config;
    
    // Implement magnitude-based pruning
    const prunedModel = tf.sequential();
    
    for (const layer of model.layers) {
      const weights = layer.getWeights();
      const prunedWeights = weights.map(weight => {
        const values = weight.arraySync().flat();
        const threshold = this.findThreshold(values, sparsity);
        
        // Zero out weights below threshold
        return tf.tensor(values.map((w: number) => 
          Math.abs(w) < threshold ? 0 : w
        ), weight.shape);
      });
      
      layer.setWeights(prunedWeights);
      prunedModel.add(layer);
    }
    
    return prunedModel;
  }

  private async distill(model: tf.LayersModel): Promise<tf.LayersModel> {
    const { teacherModel } = this.config;
    if (!teacherModel) {
      throw new Error('Teacher model is required for knowledge distillation');
    }

    // Load teacher model
    const teacher = await tf.loadLayersModel(`file://${teacherModel}`);
    
    // Create smaller student model
    const student = this.createStudentModel(model);
    
    // Transfer knowledge from teacher to student
    // This is a simplified version - actual implementation would involve training
    return student;
  }

  private async clusterWeights(model: tf.LayersModel): Promise<tf.LayersModel> {
    const { targetSize = 32 } = this.config;
    
    // Implement k-means clustering on weights
    const clusteredModel = tf.sequential();
    
    for (const layer of model.layers) {
      const weights = layer.getWeights();
      const clusteredWeights = weights.map(weight => {
        const values = weight.arraySync().flat();
        const centroids = this.kMeansClustering(values, targetSize);
        
        // Map weights to nearest centroids
        return tf.tensor(values.map((w: number) => 
          this.findNearestCentroid(w, centroids)
        ), weight.shape);
      });
      
      layer.setWeights(clusteredWeights);
      clusteredModel.add(layer);
    }
    
    return clusteredModel;
  }

  private getMinMax(tensor: tf.Tensor): { min: number; max: number } {
    const values = tensor.arraySync().flat();
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  private findThreshold(values: number[], sparsity: number): number {
    const sorted = values.map(Math.abs).sort((a, b) => b - a);
    const k = Math.floor(values.length * (1 - sparsity));
    return sorted[k];
  }

  private createStudentModel(teacherModel: tf.LayersModel): tf.LayersModel {
    // Create a smaller version of the teacher model
    const student = tf.sequential();
    
    // Add layers with reduced size
    for (const layer of teacherModel.layers) {
      const config = layer.getConfig();
      if (config.units) {
        config.units = Math.floor(config.units / 2);
      }
      student.add(tf.layers.dense(config));
    }
    
    return student;
  }

  private kMeansClustering(values: number[], k: number): number[] {
    // Initialize centroids
    let centroids = Array.from({ length: k }, (_, i) => 
      values[Math.floor(Math.random() * values.length)]
    );
    
    // Implement k-means clustering
    const maxIterations = 100;
    for (let i = 0; i < maxIterations; i++) {
      const clusters = Array.from({ length: k }, () => [] as number[]);
      
      // Assign points to clusters
      values.forEach(value => {
        const centroidIndex = this.findNearestCentroidIndex(value, centroids);
        clusters[centroidIndex].push(value);
      });
      
      // Update centroids
      const newCentroids = clusters.map(cluster => 
        cluster.length > 0 
          ? cluster.reduce((a, b) => a + b) / cluster.length 
          : centroids[clusters.indexOf(cluster)]
      );
      
      // Check convergence
      if (this.arraysEqual(centroids, newCentroids)) {
        break;
      }
      
      centroids = newCentroids;
    }
    
    return centroids;
  }

  private findNearestCentroid(value: number, centroids: number[]): number {
    return centroids[this.findNearestCentroidIndex(value, centroids)];
  }

  private findNearestCentroidIndex(value: number, centroids: number[]): number {
    let minDist = Infinity;
    let nearestIndex = 0;
    
    centroids.forEach((centroid, index) => {
      const dist = Math.abs(value - centroid);
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = index;
      }
    });
    
    return nearestIndex;
  }

  private arraysEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && 
           a.every((value, index) => Math.abs(value - b[index]) < 1e-6);
  }
} 