import { EventEmitter } from 'events';
import { RegisteredAsset } from './AssetRegistry';

interface QualityMetrics {
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  validity: number;
  uniqueness: number;
  integrity: number;
  score: number;
  details: {
    missingValues: number;
    duplicateRows: number;
    invalidValues: number;
    outliers: number;
    schemaViolations: number;
    formatErrors: number;
    lastUpdated: Date;
  };
}

interface ValidationRule {
  id: string;
  name: string;
  description: string;
  type: 'schema' | 'format' | 'range' | 'regex' | 'custom';
  config: {
    field?: string;
    pattern?: string;
    min?: number;
    max?: number;
    allowedValues?: any[];
    customValidator?: (value: any) => boolean;
  };
  severity: 'error' | 'warning' | 'info';
  weight: number;
}

interface ValidationResult {
  ruleId: string;
  passed: boolean;
  errors: Array<{
    field: string;
    value: any;
    message: string;
  }>;
  score: number;
}

interface QualityAssessment {
  assetId: string;
  metrics: QualityMetrics;
  score: number;
  timestamp: Date;
}

export class QualityAssessor extends EventEmitter {
  private rules: Map<string, ValidationRule> = new Map();
  private results: Map<string, ValidationResult[]> = new Map();
  private metrics: Map<string, QualityMetrics> = new Map();
  private assessments: Map<string, QualityAssessment> = new Map();
  
  private readonly METRIC_WEIGHTS = {
    completeness: 0.2,
    accuracy: 0.2,
    consistency: 0.15,
    timeliness: 0.1,
    validity: 0.15,
    uniqueness: 0.1,
    integrity: 0.1
  };

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  async assessQuality(
    assetId: string,
    metadata: any,
    options?: {
      weights?: Partial<typeof QualityAssessor.prototype.METRIC_WEIGHTS>
    }
  ): Promise<number> {
    try {
      const metrics = await this.calculateMetrics(metadata);
      const score = this.calculateScore(metrics, options?.weights);

      const assessment: QualityAssessment = {
        assetId,
        metrics,
        score,
        timestamp: new Date()
      };

      this.assessments.set(assetId, assessment);

      this.emit('qualityAssessed', {
        assetId,
        score,
        metrics,
        timestamp: new Date()
      });

      return score;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getQualityScore(assetId: string): Promise<number> {
    const assessment = this.assessments.get(assetId);
    if (!assessment) {
      throw new Error('No quality assessment found for asset');
    }
    return assessment.score;
  }

  async getQualityMetrics(assetId: string): Promise<QualityMetrics> {
    const assessment = this.assessments.get(assetId);
    if (!assessment) {
      throw new Error('No quality assessment found for asset');
    }
    return assessment.metrics;
  }

  async addRule(rule: Omit<ValidationRule, 'id'>): Promise<string> {
    try {
      const ruleId = this.generateRuleId();
      
      const newRule: ValidationRule = {
        ...rule,
        id: ruleId
      };

      this.rules.set(ruleId, newRule);

      this.emit('ruleAdded', {
        ruleId,
        name: rule.name,
        timestamp: new Date()
      });

      return ruleId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getMetrics(assetId: string): Promise<QualityMetrics | undefined> {
    return this.metrics.get(assetId);
  }

  async getValidationResults(assetId: string): Promise<ValidationResult[]> {
    return this.results.get(assetId) || [];
  }

  private async calculateMetrics(metadata: any): Promise<QualityMetrics> {
    // In a real implementation, this would perform detailed analysis of the data
    // For now, we'll use simplified calculations
    
    const metrics: QualityMetrics = {
      completeness: this.calculateCompleteness(metadata),
      accuracy: this.calculateAccuracy(metadata),
      consistency: this.calculateConsistency(metadata),
      timeliness: this.calculateTimeliness(metadata),
      validity: this.calculateValidity(metadata),
      uniqueness: this.calculateUniqueness(metadata),
      integrity: this.calculateIntegrity(metadata),
      score: 0,
      details: {
        missingValues: 0,
        duplicateRows: 0,
        invalidValues: 0,
        outliers: 0,
        schemaViolations: 0,
        formatErrors: 0,
        lastUpdated: new Date()
      }
    };

    return metrics;
  }

  private calculateScore(
    metrics: QualityMetrics,
    weights: Partial<typeof QualityAssessor.prototype.METRIC_WEIGHTS> = {}
  ): number {
    const finalWeights = { ...this.METRIC_WEIGHTS, ...weights };
    
    let score = 0;
    let totalWeight = 0;

    for (const [metric, value] of Object.entries(metrics)) {
      const weight = finalWeights[metric as keyof typeof finalWeights];
      score += value * weight;
      totalWeight += weight;
    }

    return score / totalWeight;
  }

  private calculateCompleteness(metadata: any): number {
    // Check for missing or null values
    const fields = Object.keys(metadata);
    const nonEmptyFields = fields.filter(field => {
      const value = metadata[field];
      return value !== null && value !== undefined && value !== '';
    });
    return nonEmptyFields.length / fields.length;
  }

  private calculateAccuracy(metadata: any): number {
    // In a real implementation, this would validate data against known correct values
    // For now, return a random score between 0.8 and 1
    return 0.8 + Math.random() * 0.2;
  }

  private calculateConsistency(metadata: any): number {
    // In a real implementation, this would check for data format consistency
    // For now, return a random score between 0.7 and 1
    return 0.7 + Math.random() * 0.3;
  }

  private calculateTimeliness(metadata: any): number {
    // Check how recent the data is
    const timestamp = metadata.timestamp || metadata.updatedAt || metadata.createdAt;
    if (!timestamp) return 0.5;

    const age = Date.now() - new Date(timestamp).getTime();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    return Math.max(0, 1 - age / maxAge);
  }

  private calculateValidity(metadata: any): number {
    // In a real implementation, this would validate data against schema/rules
    // For now, return a random score between 0.85 and 1
    return 0.85 + Math.random() * 0.15;
  }

  private calculateUniqueness(metadata: any): number {
    // In a real implementation, this would check for duplicates
    // For now, return a random score between 0.9 and 1
    return 0.9 + Math.random() * 0.1;
  }

  private calculateIntegrity(metadata: any): number {
    // In a real implementation, this would check data integrity (checksums, etc)
    // For now, return a random score between 0.95 and 1
    return 0.95 + Math.random() * 0.05;
  }

  private async applyRule(
    rule: ValidationRule,
    data: any[]
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      ruleId: rule.id,
      passed: true,
      errors: [],
      score: 1
    };

    try {
      for (const item of data) {
        switch (rule.type) {
          case 'schema':
            if (rule.config.field && !this.validateSchema(item[rule.config.field])) {
              result.errors.push({
                field: rule.config.field,
                value: item[rule.config.field],
                message: 'Schema validation failed'
              });
            }
            break;

          case 'format':
            if (rule.config.field && rule.config.pattern) {
              const regex = new RegExp(rule.config.pattern);
              if (!regex.test(item[rule.config.field])) {
                result.errors.push({
                  field: rule.config.field,
                  value: item[rule.config.field],
                  message: 'Format validation failed'
                });
              }
            }
            break;

          case 'range':
            if (rule.config.field && 
                (typeof rule.config.min === 'number' || typeof rule.config.max === 'number')) {
              const value = item[rule.config.field];
              if (typeof value === 'number') {
                if (typeof rule.config.min === 'number' && value < rule.config.min) {
                  result.errors.push({
                    field: rule.config.field,
                    value,
                    message: 'Value below minimum'
                  });
                }
                if (typeof rule.config.max === 'number' && value > rule.config.max) {
                  result.errors.push({
                    field: rule.config.field,
                    value,
                    message: 'Value above maximum'
                  });
                }
              }
            }
            break;

          case 'custom':
            if (rule.config.field && rule.config.customValidator) {
              if (!rule.config.customValidator(item[rule.config.field])) {
                result.errors.push({
                  field: rule.config.field,
                  value: item[rule.config.field],
                  message: 'Custom validation failed'
                });
              }
            }
            break;
        }
      }

      result.passed = result.errors.length === 0;
      result.score = result.passed ? 1 : Math.max(0, 1 - (result.errors.length / data.length));

      return result;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private validateSchema(value: any): boolean {
    // Implement schema validation logic
    return true;
  }

  private countMissingValues(data: any[]): number {
    let count = 0;
    for (const item of data) {
      for (const value of Object.values(item)) {
        if (value === null || value === undefined || value === '') {
          count++;
        }
      }
    }
    return count;
  }

  private countDuplicates(data: any[]): number {
    const seen = new Set();
    let duplicates = 0;
    
    for (const item of data) {
      const key = JSON.stringify(item);
      if (seen.has(key)) {
        duplicates++;
      } else {
        seen.add(key);
      }
    }
    
    return duplicates;
  }

  private initializeDefaultRules(): void {
    // Add default validation rules
    this.addRule({
      name: 'Required Fields',
      description: 'Checks for presence of required fields',
      type: 'schema',
      config: {},
      severity: 'error',
      weight: 1
    });

    this.addRule({
      name: 'Date Format',
      description: 'Validates date format',
      type: 'format',
      config: {
        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
      },
      severity: 'error',
      weight: 0.8
    });

    this.addRule({
      name: 'Numeric Range',
      description: 'Validates numeric values within range',
      type: 'range',
      config: {
        min: 0,
        max: 1000000
      },
      severity: 'warning',
      weight: 0.6
    });
  }

  private generateRuleId(): string {
    return 'rule_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 