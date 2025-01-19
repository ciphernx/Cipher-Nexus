import { ModelConfig } from '../types';

export abstract class BaseModel {
  constructor(protected config: ModelConfig) {}

  abstract async train(data: any[], labels: any[]): Promise<void>;
  abstract async predict(data: any[]): Promise<any[]>;
  abstract async save(): Promise<string>;
  abstract async load(path: string): Promise<void>;

  protected validateConfig(): boolean {
    if (!this.config.layers || this.config.layers.length === 0) {
      throw new Error('Invalid model configuration: layers not specified');
    }
    if (this.config.layers.length !== this.config.activations.length + 1) {
      throw new Error('Invalid model configuration: mismatched layers and activations');
    }
    return true;
  }
}
