import { DataProcessor } from '../data-processor';
import { TaskType } from '../../core/types';

describe('DataProcessor', () => {
  describe('normalizeData', () => {
    it('should normalize data correctly', () => {
      const data = [[1, 2, 3], [4, 5, 6]];
      const normalized = DataProcessor.normalizeData(data);
      
      // Check if mean is approximately 0 and std is approximately 1
      normalized.forEach(row => {
        const mean = row.reduce((a, b) => a + b) / row.length;
        const std = Math.sqrt(row.reduce((a, b) => a + Math.pow(b - mean, 2)) / row.length);
        expect(mean).toBeCloseTo(0, 5);
        expect(std).toBeCloseTo(1, 5);
      });
    });

    it('should handle zero standard deviation', () => {
      const data = [[1, 1, 1], [2, 2, 2]];
      const normalized = DataProcessor.normalizeData(data);
      expect(normalized).toEqual([[0, 0, 0], [0, 0, 0]]);
    });
  });

  describe('standardizeData', () => {
    it('should standardize data to [0,1] range', () => {
      const data = [[1, 2, 3], [4, 5, 6]];
      const standardized = DataProcessor.standardizeData(data);
      
      standardized.forEach(row => {
        row.forEach(value => {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        });
      });
    });

    it('should handle same min and max values', () => {
      const data = [[1, 1, 1], [2, 2, 2]];
      const standardized = DataProcessor.standardizeData(data);
      expect(standardized).toEqual([[0, 0, 0], [0, 0, 0]]);
    });
  });

  describe('oneHotEncode', () => {
    it('should encode labels correctly', () => {
      const labels = [0, 1, 2];
      const encoded = DataProcessor.oneHotEncode(labels, 3);
      expect(encoded).toEqual([
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
      ]);
    });

    it('should handle single class', () => {
      const labels = [0, 0, 0];
      const encoded = DataProcessor.oneHotEncode(labels, 1);
      expect(encoded).toEqual([[1], [1], [1]]);
    });
  });

  describe('processOutput', () => {
    it('should process classification output', () => {
      const output = [0.1, 0.8, 0.1];
      const result = DataProcessor.processOutput(output, TaskType.CLASSIFICATION);
      expect(result.class).toBe(1);
      expect(result.probabilities).toEqual(output);
    });

    it('should process regression output', () => {
      const output = [0.5];
      const result = DataProcessor.processOutput(output, TaskType.REGRESSION);
      expect(result).toBe(0.5);
    });

    it('should process clustering output', () => {
      const output = [0.1, 0.8, 0.1];
      const result = DataProcessor.processOutput(output, TaskType.CLUSTERING);
      expect(result).toBe(1);
    });

    it('should process anomaly detection output', () => {
      const output = [0.7];
      const result = DataProcessor.processOutput(output, TaskType.ANOMALY_DETECTION);
      expect(result).toBe(true);
    });
  });

  describe('splitData', () => {
    it('should split data correctly', () => {
      const data = [[1], [2], [3], [4]];
      const labels = [[1], [2], [3], [4]];
      const split = DataProcessor.splitData(data, labels, 0.25);
      
      expect(split.trainData.length).toBe(3);
      expect(split.trainLabels.length).toBe(3);
      expect(split.validationData.length).toBe(1);
      expect(split.validationLabels.length).toBe(1);
    });

    it('should handle edge case splits', () => {
      const data = [[1], [2]];
      const labels = [[1], [2]];
      const split = DataProcessor.splitData(data, labels, 0);
      
      expect(split.trainData.length).toBe(2);
      expect(split.validationData.length).toBe(0);
    });
  });

  describe('shuffleData', () => {
    it('should maintain data-label correspondence', () => {
      const data = [[1], [2], [3]];
      const labels = [[1], [2], [3]];
      const { shuffledData, shuffledLabels } = DataProcessor.shuffleData(data, labels);
      
      expect(shuffledData.length).toBe(data.length);
      expect(shuffledLabels.length).toBe(labels.length);
      
      // Check if each data point corresponds to its label after shuffling
      shuffledData.forEach((d, i) => {
        const originalIndex = data.findIndex(x => x[0] === d[0]);
        expect(shuffledLabels[i][0]).toBe(labels[originalIndex][0]);
      });
    });
  });

  describe('validateData', () => {
    it('should validate correct data', () => {
      const data = [[1, 2], [3, 4]];
      const labels = [[1], [2]];
      expect(() => DataProcessor.validateData(data, labels)).not.toThrow();
    });

    it('should throw error for mismatched lengths', () => {
      const data = [[1, 2], [3, 4]];
      const labels = [[1]];
      expect(() => DataProcessor.validateData(data, labels))
        .toThrow('Data and labels must have the same length');
    });

    it('should throw error for empty data', () => {
      const data: number[][] = [];
      const labels: number[][] = [];
      expect(() => DataProcessor.validateData(data, labels))
        .toThrow('Data cannot be empty');
    });

    it('should throw error for inconsistent dimensions', () => {
      const data = [[1, 2], [3]];
      const labels = [[1], [2]];
      expect(() => DataProcessor.validateData(data, labels))
        .toThrow('All input samples must have the same dimension');
    });
  });

  describe('augmentData', () => {
    it('should augment data while maintaining shape', () => {
      const data = [[1, 2], [3, 4]];
      const augmented = DataProcessor.augmentData(data);
      
      expect(augmented.length).toBe(data.length);
      expect(augmented[0].length).toBe(data[0].length);
      
      // Check if values are different but close to original
      augmented.forEach((row, i) => {
        row.forEach((value, j) => {
          expect(value).not.toBe(data[i][j]);
          expect(Math.abs(value - data[i][j])).toBeLessThan(0.1);
        });
      });
    });
  });
}); 