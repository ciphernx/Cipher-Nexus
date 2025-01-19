import { TaskType } from '../core/types';

export class DataProcessor {
  static normalizeData(data: number[][]): number[][] {
    const normalized = data.map(row => {
      const mean = row.reduce((a, b) => a + b) / row.length;
      const std = Math.sqrt(row.reduce((a, b) => a + Math.pow(b - mean, 2)) / row.length);
      return row.map(value => (value - mean) / (std || 1));
    });
    return normalized;
  }

  static standardizeData(data: number[][]): number[][] {
    const standardized = data.map(row => {
      const min = Math.min(...row);
      const max = Math.max(...row);
      return row.map(value => (value - min) / (max - min || 1));
    });
    return standardized;
  }

  static oneHotEncode(labels: number[], numClasses: number): number[][] {
    return labels.map(label => {
      const encoded = new Array(numClasses).fill(0);
      encoded[label] = 1;
      return encoded;
    });
  }

  static processOutput(output: number[], taskType: TaskType): any {
    switch (taskType) {
      case TaskType.CLASSIFICATION:
        return {
          class: output.indexOf(Math.max(...output)),
          probabilities: output
        };
      case TaskType.REGRESSION:
        return output[0];
      case TaskType.CLUSTERING:
        return output.indexOf(Math.max(...output));
      case TaskType.ANOMALY_DETECTION:
        return output[0] > 0.5;
      default:
        return output;
    }
  }

  static splitData(data: number[][], labels: number[][], validationSplit: number): {
    trainData: number[][],
    trainLabels: number[][],
    validationData: number[][],
    validationLabels: number[][]
  } {
    const splitIndex = Math.floor(data.length * (1 - validationSplit));
    return {
      trainData: data.slice(0, splitIndex),
      trainLabels: labels.slice(0, splitIndex),
      validationData: data.slice(splitIndex),
      validationLabels: labels.slice(splitIndex)
    };
  }

  static shuffleData(data: number[][], labels: number[][]): {
    shuffledData: number[][],
    shuffledLabels: number[][]
  } {
    const indices = Array.from(Array(data.length).keys());
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return {
      shuffledData: indices.map(i => data[i]),
      shuffledLabels: indices.map(i => labels[i])
    };
  }

  static validateData(data: number[][], labels: number[][]): void {
    if (data.length !== labels.length) {
      throw new Error('Data and labels must have the same length');
    }
    if (data.length === 0) {
      throw new Error('Data cannot be empty');
    }
    const inputDim = data[0].length;
    if (!data.every(row => row.length === inputDim)) {
      throw new Error('All input samples must have the same dimension');
    }
  }

  static augmentData(data: number[][]): number[][] {
    // Implement data augmentation techniques here
    // This is a placeholder implementation
    return data.map(row => {
      // Add small random noise
      return row.map(value => value + (Math.random() - 0.5) * 0.1);
    });
  }
} 