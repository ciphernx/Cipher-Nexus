import { AugmentationType, AugmentationConfig } from '../core/types';

export class DataAugmentor {
  private config: AugmentationConfig;

  constructor(config: AugmentationConfig) {
    this.config = config;
  }

  public augment(data: number[][], types: AugmentationType[]): number[][] {
    let augmentedData = [...data];

    for (const type of types) {
      switch (type) {
        case AugmentationType.NOISE:
          augmentedData = this.addNoise(augmentedData);
          break;
        case AugmentationType.ROTATION:
          augmentedData = this.rotate(augmentedData);
          break;
        case AugmentationType.FLIP:
          augmentedData = this.flip(augmentedData);
          break;
        case AugmentationType.SCALE:
          augmentedData = this.scale(augmentedData);
          break;
        case AugmentationType.CROP:
          augmentedData = this.crop(augmentedData);
          break;
        case AugmentationType.MIXUP:
          augmentedData = this.mixup(augmentedData);
          break;
        case AugmentationType.CUTOUT:
          augmentedData = this.cutout(augmentedData);
          break;
      }
    }

    return augmentedData;
  }

  private addNoise(data: number[][]): number[][] {
    const { noiseScale = 0.1 } = this.config;
    return data.map(sample => 
      sample.map(value => 
        value + (Math.random() - 0.5) * 2 * noiseScale
      )
    );
  }

  private rotate(data: number[][]): number[][] {
    const { rotationRange = 30 } = this.config;
    // Implement rotation for 2D data
    // This is a simplified version - actual implementation would depend on data shape
    return data.map(sample => {
      const angle = (Math.random() - 0.5) * 2 * rotationRange;
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      if (sample.length >= 2) {
        const x = sample[0];
        const y = sample[1];
        sample[0] = x * cos - y * sin;
        sample[1] = x * sin + y * cos;
      }
      return sample;
    });
  }

  private flip(data: number[][]): number[][] {
    const { flipProbability = 0.5 } = this.config;
    return data.map(sample => 
      Math.random() < flipProbability ? sample.reverse() : sample
    );
  }

  private scale(data: number[][]): number[][] {
    const { scaleRange = [0.8, 1.2] } = this.config;
    return data.map(sample => {
      const scale = scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0]);
      return sample.map(value => value * scale);
    });
  }

  private crop(data: number[][]): number[][] {
    const { cropSize = 0.8 } = this.config;
    // Implement random cropping
    // This is a simplified version - actual implementation would depend on data shape
    return data.map(sample => {
      const start = Math.floor(Math.random() * (1 - cropSize) * sample.length);
      const end = start + Math.floor(cropSize * sample.length);
      return sample.slice(start, end);
    });
  }

  private mixup(data: number[][]): number[][] {
    const { mixupAlpha = 0.2 } = this.config;
    return data.map(sample => {
      const mixIdx = Math.floor(Math.random() * data.length);
      const lambda = Math.random() * mixupAlpha;
      return sample.map((value, i) => 
        value * (1 - lambda) + data[mixIdx][i] * lambda
      );
    });
  }

  private cutout(data: number[][]): number[][] {
    const { cutoutSize = 0.2 } = this.config;
    return data.map(sample => {
      const start = Math.floor(Math.random() * (1 - cutoutSize) * sample.length);
      const end = start + Math.floor(cutoutSize * sample.length);
      const result = [...sample];
      for (let i = start; i < end; i++) {
        result[i] = 0;
      }
      return result;
    });
  }
} 