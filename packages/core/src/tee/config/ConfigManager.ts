import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import { TEESecurityLevel } from '../types';

export interface SystemConfig {
  version: string;
  environment: 'development' | 'staging' | 'production';
  tee: {
    securityLevel: TEESecurityLevel;
    memoryLimit: number;
    timeLimit: number;
    enableRemoteAttestation: boolean;
    trustedServices: string[];
  };
  monitoring: {
    metricsInterval: number;
    retentionPeriod: number;
    alertThresholds: {
      cpuUsage: number;
      memoryUsage: number;
      queueSize: number;
      errorRate: number;
    };
  };
  security: {
    minSecurityLevel: TEESecurityLevel;
    requireRemoteAttestation: boolean;
    attestationValidityPeriod: number;
    allowedOperations: string[];
    trustedSigners: string[];
    platformPreference: string[];
  };
  resources: {
    maxMemoryPerContext: number;
    maxCpuPerContext: number;
    maxActiveContexts: number;
    maxQueuedRequests: number;
    contextTimeout: number;
  };
  notifications: {
    channels: {
      email?: {
        enabled: boolean;
        recipients: string[];
        smtpConfig?: {
          host: string;
          port: number;
          secure: boolean;
          auth: {
            user: string;
            pass: string;
          };
        };
      };
      slack?: {
        enabled: boolean;
        webhookUrl: string;
        channel: string;
      };
      webhook?: {
        enabled: boolean;
        url: string;
        headers?: Record<string, string>;
      };
    };
    throttling: {
      maxNotificationsPerMinute: number;
      cooldownPeriod: number;
    };
  };
}

export interface ConfigValidationError {
  path: string[];
  message: string;
  value?: any;
}

export class ConfigManager extends EventEmitter {
  private config: SystemConfig;
  private readonly configPath: string;
  private readonly validators: Map<string, (value: any) => boolean>;
  private readonly watchers: Set<string>;

  constructor(initialConfig: Partial<SystemConfig>) {
    super();
    this.configPath = process.env.CONFIG_PATH || 'config/tee.json';
    this.validators = new Map();
    this.watchers = new Set();

    // Initialize with default values
    this.config = this.mergeWithDefaults(initialConfig);

    // Setup validators
    this.setupValidators();

    // Validate initial config
    this.validateConfig();

    // Watch for environment variable changes
    this.watchEnvironmentVariables();
  }

  getConfig<T = any>(path: string): T {
    return this.getConfigValue(path.split('.'));
  }

  setConfig<T = any>(path: string, value: T): void {
    const pathParts = path.split('.');
    const configCopy = { ...this.config };
    
    this.setConfigValue(configCopy, pathParts, value);
    
    // Validate before applying
    const validationErrors = this.validateConfigObject(configCopy);
    if (validationErrors.length > 0) {
      throw new Error(
        `Invalid configuration: ${validationErrors.map(e => e.message).join(', ')}`
      );
    }

    // Apply changes
    this.config = configCopy;
    
    // Emit change event
    this.emit('config-changed', { path, value, oldValue: this.getConfig(path) });
    
    logger.info('Configuration updated', { path, value });
  }

  watchConfig(path: string, callback: (newValue: any, oldValue: any) => void): void {
    this.watchers.add(path);
    this.on('config-changed', ({ path: changedPath, value, oldValue }) => {
      if (changedPath === path) {
        callback(value, oldValue);
      }
    });
  }

  validateConfig(): ConfigValidationError[] {
    return this.validateConfigObject(this.config);
  }

  private validateConfigObject(config: any): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];

    for (const [path, validator] of this.validators) {
      const value = this.getConfigValue(path.split('.'), config);
      if (!validator(value)) {
        errors.push({
          path: path.split('.'),
          message: `Invalid value for ${path}`,
          value
        });
      }
    }

    return errors;
  }

  private getConfigValue(path: string[], config: any = this.config): any {
    return path.reduce((obj, key) => obj?.[key], config);
  }

  private setConfigValue(obj: any, path: string[], value: any): void {
    const lastKey = path.pop()!;
    const target = path.reduce((obj, key) => {
      if (!(key in obj)) {
        obj[key] = {};
      }
      return obj[key];
    }, obj);
    target[lastKey] = value;
  }

  private setupValidators(): void {
    // TEE security level
    this.validators.set('tee.securityLevel', (value: TEESecurityLevel) =>
      Object.values(TEESecurityLevel).includes(value)
    );

    // Memory limits
    this.validators.set('tee.memoryLimit', (value: number) =>
      typeof value === 'number' && value > 0
    );
    this.validators.set('resources.maxMemoryPerContext', (value: number) =>
      typeof value === 'number' && value > 0
    );

    // Time limits
    this.validators.set('tee.timeLimit', (value: number) =>
      typeof value === 'number' && value > 0
    );
    this.validators.set('resources.contextTimeout', (value: number) =>
      typeof value === 'number' && value > 0
    );

    // Resource limits
    this.validators.set('resources.maxCpuPerContext', (value: number) =>
      typeof value === 'number' && value > 0 && value <= 100
    );
    this.validators.set('resources.maxActiveContexts', (value: number) =>
      typeof value === 'number' && value > 0
    );
    this.validators.set('resources.maxQueuedRequests', (value: number) =>
      typeof value === 'number' && value > 0
    );

    // Monitoring thresholds
    this.validators.set('monitoring.alertThresholds.cpuUsage', (value: number) =>
      typeof value === 'number' && value > 0 && value <= 100
    );
    this.validators.set('monitoring.alertThresholds.memoryUsage', (value: number) =>
      typeof value === 'number' && value > 0 && value <= 100
    );
    this.validators.set('monitoring.alertThresholds.errorRate', (value: number) =>
      typeof value === 'number' && value >= 0 && value <= 100
    );

    // Notification settings
    this.validators.set('notifications.throttling.maxNotificationsPerMinute', (value: number) =>
      typeof value === 'number' && value > 0
    );
    this.validators.set('notifications.throttling.cooldownPeriod', (value: number) =>
      typeof value === 'number' && value > 0
    );
  }

  private mergeWithDefaults(config: Partial<SystemConfig>): SystemConfig {
    const defaults: SystemConfig = {
      version: '1.0.0',
      environment: 'development',
      tee: {
        securityLevel: TEESecurityLevel.MEDIUM,
        memoryLimit: 1024,
        timeLimit: 300,
        enableRemoteAttestation: true,
        trustedServices: []
      },
      monitoring: {
        metricsInterval: 1000,
        retentionPeriod: 86400,
        alertThresholds: {
          cpuUsage: 80,
          memoryUsage: 80,
          queueSize: 50,
          errorRate: 5
        }
      },
      security: {
        minSecurityLevel: TEESecurityLevel.MEDIUM,
        requireRemoteAttestation: true,
        attestationValidityPeriod: 300,
        allowedOperations: ['encrypt', 'decrypt', 'sign', 'verify'],
        trustedSigners: [],
        platformPreference: ['sgx', 'sev', 'trustzone']
      },
      resources: {
        maxMemoryPerContext: 512,
        maxCpuPerContext: 50,
        maxActiveContexts: 10,
        maxQueuedRequests: 100,
        contextTimeout: 300
      },
      notifications: {
        channels: {
          email: {
            enabled: false,
            recipients: []
          },
          slack: {
            enabled: false,
            webhookUrl: '',
            channel: 'tee-alerts'
          },
          webhook: {
            enabled: false,
            url: '',
            headers: {}
          }
        },
        throttling: {
          maxNotificationsPerMinute: 10,
          cooldownPeriod: 60000
        }
      }
    };

    return this.deepMerge(defaults, config);
  }

  private deepMerge(target: any, source: any): any {
    if (!source) {
      return target;
    }

    const output = { ...target };
    
    Object.keys(source).forEach(key => {
      if (source[key] instanceof Object && key in target) {
        output[key] = this.deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    });

    return output;
  }

  private watchEnvironmentVariables(): void {
    // Map of environment variables to config paths
    const envMapping: Record<string, string> = {
      'TEE_SECURITY_LEVEL': 'tee.securityLevel',
      'TEE_MEMORY_LIMIT': 'tee.memoryLimit',
      'TEE_TIME_LIMIT': 'tee.timeLimit',
      'MAX_MEMORY_PER_CONTEXT': 'resources.maxMemoryPerContext',
      'MAX_CPU_PER_CONTEXT': 'resources.maxCpuPerContext',
      'MAX_ACTIVE_CONTEXTS': 'resources.maxActiveContexts',
      'METRICS_INTERVAL': 'monitoring.metricsInterval',
      'ALERT_CPU_THRESHOLD': 'monitoring.alertThresholds.cpuUsage',
      'ALERT_MEMORY_THRESHOLD': 'monitoring.alertThresholds.memoryUsage',
      'ALERT_ERROR_RATE': 'monitoring.alertThresholds.errorRate'
    };

    // Watch for changes in environment variables
    Object.entries(envMapping).forEach(([envVar, configPath]) => {
      const value = process.env[envVar];
      if (value !== undefined) {
        try {
          // Parse and validate value
          const parsedValue = this.parseEnvValue(value);
          this.setConfig(configPath, parsedValue);
        } catch (error) {
          logger.error(
            `Invalid environment variable value`,
            { envVar, value },
            error as Error
          );
        }
      }
    });
  }

  private parseEnvValue(value: string): any {
    // Try parsing as number
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^\d*\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    // Try parsing as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    // Try parsing as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if all else fails
      return value;
    }
  }
} 