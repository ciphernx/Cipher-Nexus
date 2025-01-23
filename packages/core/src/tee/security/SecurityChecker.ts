import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import { SecurityAuditor } from './SecurityAuditor';
import { MetricsManager } from '../monitoring/MetricsManager';
import { MLAnomalyDetector } from '../monitoring/MLAnomalyDetector';
import * as crypto from 'crypto';

export enum SecurityCheckType {
  AUTHENTICATION = 'AUTHENTICATION',
  SESSION = 'SESSION',
  REQUEST = 'REQUEST',
  INPUT = 'INPUT',
  RESOURCE = 'RESOURCE',
  PLATFORM = 'PLATFORM'
}

export interface SecurityConfig {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number;
  };
  sessionPolicy: {
    maxAge: number;
    inactivityTimeout: number;
    maxConcurrentSessions: number;
  };
  requestPolicy: {
    rateLimitPerMinute: number;
    maxBodySize: number;
    allowedOrigins: string[];
    allowedMethods: string[];
    requiredHeaders: string[];
  };
  inputPolicy: {
    maxLength: number;
    allowedCharacters: string;
    disallowedPatterns: string[];
  };
  resourcePolicy: {
    maxConcurrentRequests: number;
    maxRequestSize: number;
    maxResponseTime: number;
  };
}

export interface SecurityCheck {
  type: SecurityCheckType;
  target: string;
  timestamp: number;
  result: boolean;
  details: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  violations: string[];
  details: Record<string, any>;
}

export class SecurityChecker extends EventEmitter {
  private readonly config: SecurityConfig;
  private readonly auditor: SecurityAuditor;
  private readonly metricsManager: MetricsManager;
  private readonly anomalyDetector: MLAnomalyDetector;
  private readonly failedAttempts: Map<string, number[]>;
  private readonly lockedAccounts: Map<string, number>;
  private cleanupTimer: NodeJS.Timer | null;

  constructor(
    config: SecurityConfig,
    auditor: SecurityAuditor,
    metricsManager: MetricsManager,
    anomalyDetector: MLAnomalyDetector,
    cleanupInterval = 60 * 60 * 1000  // 1 hour
  ) {
    super();
    this.config = config;
    this.auditor = auditor;
    this.metricsManager = metricsManager;
    this.anomalyDetector = anomalyDetector;
    this.failedAttempts = new Map();
    this.lockedAccounts = new Map();
    this.cleanupTimer = null;
    this.initialize();
  }

  private initialize(): void {
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupFailedAttempts();
      this.cleanupLockedAccounts();
    }, this.cleanupInterval);

    logger.info('Security checker initialized');
  }

  async validatePassword(password: string): Promise<ValidationResult> {
    try {
      const violations: string[] = [];

      // Check length
      if (password.length < this.config.passwordPolicy.minLength) {
        violations.push(`Password must be at least ${this.config.passwordPolicy.minLength} characters long`);
      }

      // Check uppercase
      if (this.config.passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
        violations.push('Password must contain at least one uppercase letter');
      }

      // Check lowercase
      if (this.config.passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
        violations.push('Password must contain at least one lowercase letter');
      }

      // Check numbers
      if (this.config.passwordPolicy.requireNumbers && !/\d/.test(password)) {
        violations.push('Password must contain at least one number');
      }

      // Check special characters
      if (this.config.passwordPolicy.requireSpecialChars && !/[!@#$%^&*]/.test(password)) {
        violations.push('Password must contain at least one special character');
      }

      const isValid = violations.length === 0;

      // Record check
      const check: SecurityCheck = {
        type: SecurityCheckType.AUTHENTICATION,
        target: 'password',
        timestamp: Date.now(),
        result: isValid,
        details: { violations }
      };

      await this.recordSecurityCheck(check);

      return {
        isValid,
        violations,
        details: {}
      };
    } catch (error) {
      logger.error('Failed to validate password', {}, error as Error);
      throw error;
    }
  }

  async validateLoginAttempt(userId: string): Promise<ValidationResult> {
    try {
      // Check if account is locked
      const lockExpiry = this.lockedAccounts.get(userId);
      if (lockExpiry && lockExpiry > Date.now()) {
        return {
          isValid: false,
          violations: ['Account is temporarily locked'],
          details: {
            lockExpiry
          }
        };
      }

      // Get failed attempts
      const attempts = this.failedAttempts.get(userId) || [];
      const recentAttempts = attempts.filter(
        timestamp => timestamp > Date.now() - 15 * 60 * 1000  // Last 15 minutes
      );

      // Check for brute force
      if (recentAttempts.length >= 5) {
        // Lock account for 30 minutes
        const lockExpiry = Date.now() + 30 * 60 * 1000;
        this.lockedAccounts.set(userId, lockExpiry);

        const check: SecurityCheck = {
          type: SecurityCheckType.AUTHENTICATION,
          target: userId,
          timestamp: Date.now(),
          result: false,
          details: {
            reason: 'Too many failed attempts',
            attempts: recentAttempts.length,
            lockExpiry
          }
        };

        await this.recordSecurityCheck(check);

        return {
          isValid: false,
          violations: ['Too many failed attempts. Account temporarily locked.'],
          details: {
            lockExpiry
          }
        };
      }

      return {
        isValid: true,
        violations: [],
        details: {
          remainingAttempts: 5 - recentAttempts.length
        }
      };
    } catch (error) {
      logger.error('Failed to validate login attempt', {
        userId
      }, error as Error);
      throw error;
    }
  }

  async recordFailedLogin(userId: string): Promise<void> {
    try {
      const attempts = this.failedAttempts.get(userId) || [];
      attempts.push(Date.now());
      this.failedAttempts.set(userId, attempts);

      const check: SecurityCheck = {
        type: SecurityCheckType.AUTHENTICATION,
        target: userId,
        timestamp: Date.now(),
        result: false,
        details: {
          failedAttempts: attempts.length
        }
      };

      await this.recordSecurityCheck(check);
    } catch (error) {
      logger.error('Failed to record failed login', {
        userId
      }, error as Error);
      throw error;
    }
  }

  async validateSession(
    sessionId: string,
    lastActivityTime: number
  ): Promise<ValidationResult> {
    try {
      const violations: string[] = [];
      const now = Date.now();

      // Check session age
      if (now - lastActivityTime > this.config.sessionPolicy.maxAge) {
        violations.push('Session has expired');
      }

      // Check inactivity
      if (now - lastActivityTime > this.config.sessionPolicy.inactivityTimeout) {
        violations.push('Session inactive for too long');
      }

      const isValid = violations.length === 0;

      const check: SecurityCheck = {
        type: SecurityCheckType.SESSION,
        target: sessionId,
        timestamp: now,
        result: isValid,
        details: {
          age: now - lastActivityTime,
          violations
        }
      };

      await this.recordSecurityCheck(check);

      return {
        isValid,
        violations,
        details: {
          sessionAge: now - lastActivityTime
        }
      };
    } catch (error) {
      logger.error('Failed to validate session', {
        sessionId
      }, error as Error);
      throw error;
    }
  }

  async validateRequest(
    method: string,
    origin: string,
    headers: Record<string, string>,
    body: any
  ): Promise<ValidationResult> {
    try {
      const violations: string[] = [];

      // Check method
      if (!this.config.requestPolicy.allowedMethods.includes(method)) {
        violations.push(`Method ${method} not allowed`);
      }

      // Check origin
      if (
        origin &&
        !this.config.requestPolicy.allowedOrigins.includes(origin) &&
        !this.config.requestPolicy.allowedOrigins.includes('*')
      ) {
        violations.push(`Origin ${origin} not allowed`);
      }

      // Check required headers
      for (const header of this.config.requestPolicy.requiredHeaders) {
        if (!headers[header]) {
          violations.push(`Missing required header: ${header}`);
        }
      }

      // Check body size
      const bodySize = JSON.stringify(body).length;
      if (bodySize > this.config.requestPolicy.maxBodySize) {
        violations.push(`Request body too large: ${bodySize} bytes`);
      }

      const isValid = violations.length === 0;

      const check: SecurityCheck = {
        type: SecurityCheckType.REQUEST,
        target: `${method} ${origin}`,
        timestamp: Date.now(),
        result: isValid,
        details: {
          method,
          origin,
          bodySize,
          violations
        }
      };

      await this.recordSecurityCheck(check);

      return {
        isValid,
        violations,
        details: {
          bodySize
        }
      };
    } catch (error) {
      logger.error('Failed to validate request', {
        method,
        origin
      }, error as Error);
      throw error;
    }
  }

  async validateInput(input: string): Promise<ValidationResult> {
    try {
      const violations: string[] = [];

      // Check length
      if (input.length > this.config.inputPolicy.maxLength) {
        violations.push(`Input too long: ${input.length} characters`);
      }

      // Check allowed characters
      const invalidChars = input
        .split('')
        .filter(char => !this.config.inputPolicy.allowedCharacters.includes(char));
      if (invalidChars.length > 0) {
        violations.push(`Invalid characters: ${invalidChars.join(', ')}`);
      }

      // Check disallowed patterns
      for (const pattern of this.config.inputPolicy.disallowedPatterns) {
        if (new RegExp(pattern).test(input)) {
          violations.push(`Input matches disallowed pattern: ${pattern}`);
        }
      }

      const isValid = violations.length === 0;

      const check: SecurityCheck = {
        type: SecurityCheckType.INPUT,
        target: 'input-validation',
        timestamp: Date.now(),
        result: isValid,
        details: {
          inputLength: input.length,
          violations
        }
      };

      await this.recordSecurityCheck(check);

      return {
        isValid,
        violations,
        details: {
          inputLength: input.length
        }
      };
    } catch (error) {
      logger.error('Failed to validate input', {}, error as Error);
      throw error;
    }
  }

  private async recordSecurityCheck(check: SecurityCheck): Promise<void> {
    try {
      // Record check in audit log
      await this.auditor.recordAuditEvent({
        type: check.type === SecurityCheckType.AUTHENTICATION
          ? 'AUTHENTICATION'
          : 'SECURITY_ALERT',
        severity: check.result ? 'INFO' : 'HIGH',
        source: 'SecurityChecker',
        actor: 'system',
        action: `validate_${check.type.toLowerCase()}`,
        target: check.target,
        outcome: check.result ? 'SUCCESS' : 'FAILURE',
        details: check.details,
        metadata: {}
      });

      // Emit check event
      this.emit('securityCheck', check);
    } catch (error) {
      logger.error('Failed to record security check', {}, error as Error);
    }
  }

  private cleanupFailedAttempts(): void {
    try {
      const now = Date.now();
      for (const [userId, attempts] of this.failedAttempts) {
        // Remove attempts older than 24 hours
        const recentAttempts = attempts.filter(
          timestamp => timestamp > now - 24 * 60 * 60 * 1000
        );

        if (recentAttempts.length === 0) {
          this.failedAttempts.delete(userId);
        } else {
          this.failedAttempts.set(userId, recentAttempts);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup failed attempts', {}, error as Error);
    }
  }

  private cleanupLockedAccounts(): void {
    try {
      const now = Date.now();
      for (const [userId, lockExpiry] of this.lockedAccounts) {
        if (lockExpiry <= now) {
          this.lockedAccounts.delete(userId);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup locked accounts', {}, error as Error);
    }
  }

  shutdown(): void {
    try {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      this.failedAttempts.clear();
      this.lockedAccounts.clear();

      logger.info('Security checker shutdown complete');
    } catch (error) {
      logger.error('Failed to shutdown security checker', {}, error as Error);
    }
  }
} 