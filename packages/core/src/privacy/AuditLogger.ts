import { PrivacyMechanism } from './DifferentialPrivacy';
import { BudgetStrategy } from './BudgetManager';

/**
 * Audit event types
 */
export enum AuditEventType {
  KEY_GENERATION = 'KEY_GENERATION',
  KEY_ROTATION = 'KEY_ROTATION',
  KEY_REVOCATION = 'KEY_REVOCATION',
  BUDGET_INITIALIZATION = 'BUDGET_INITIALIZATION',
  BUDGET_EXHAUSTION = 'BUDGET_EXHAUSTION',
  QUERY_EXECUTION = 'QUERY_EXECUTION',
  PRIVACY_VIOLATION = 'PRIVACY_VIOLATION',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

/**
 * Audit event severity levels
 */
export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

/**
 * Audit event metadata
 */
export interface AuditEvent {
  eventId: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  datasetId?: string;
  keyId?: string;
  queryId?: string;
  details: {
    mechanism?: PrivacyMechanism;
    budgetStrategy?: BudgetStrategy;
    epsilon?: number;
    delta?: number;
    sensitivity?: number;
    error?: string;
    [key: string]: any;
  };
  metadata?: Record<string, any>;
}

/**
 * Audit storage configuration
 */
export interface AuditConfig {
  storageType: 'file' | 'database';
  retentionPeriod: number; // Days to retain audit logs
  filePath?: string;
  databaseUrl?: string;
  alertThresholds?: {
    privacyViolations: number;
    budgetExhaustions: number;
    systemErrors: number;
  };
}

export class AuditLogger {
  private events: AuditEvent[] = [];
  private alertCounts: Record<AuditEventType, number> = {
    [AuditEventType.PRIVACY_VIOLATION]: 0,
    [AuditEventType.BUDGET_EXHAUSTION]: 0,
    [AuditEventType.SYSTEM_ERROR]: 0
  };

  constructor(private readonly config: AuditConfig) {}

  /**
   * Log an audit event
   * @param event Audit event to log
   */
  async logEvent(event: Omit<AuditEvent, 'eventId' | 'timestamp'>): Promise<void> {
    const fullEvent: AuditEvent = {
      ...event,
      eventId: this.generateEventId(),
      timestamp: new Date()
    };

    this.events.push(fullEvent);
    await this.persistEvent(fullEvent);
    await this.checkAlertThresholds(fullEvent);
    await this.enforceRetention();
  }

  /**
   * Query audit logs with filters
   * @param filters Query filters
   * @returns Filtered audit events
   */
  async queryEvents(filters: {
    startTime?: Date;
    endTime?: Date;
    eventTypes?: AuditEventType[];
    severities?: AuditSeverity[];
    userId?: string;
    datasetId?: string;
    keyId?: string;
    queryId?: string;
  }): Promise<AuditEvent[]> {
    let results = [...this.events];

    if (filters.startTime) {
      results = results.filter(e => e.timestamp >= filters.startTime!);
    }
    if (filters.endTime) {
      results = results.filter(e => e.timestamp <= filters.endTime!);
    }
    if (filters.eventTypes) {
      results = results.filter(e => filters.eventTypes!.includes(e.eventType));
    }
    if (filters.severities) {
      results = results.filter(e => filters.severities!.includes(e.severity));
    }
    if (filters.userId) {
      results = results.filter(e => e.userId === filters.userId);
    }
    if (filters.datasetId) {
      results = results.filter(e => e.datasetId === filters.datasetId);
    }
    if (filters.keyId) {
      results = results.filter(e => e.keyId === filters.keyId);
    }
    if (filters.queryId) {
      results = results.filter(e => e.queryId === filters.queryId);
    }

    return results;
  }

  /**
   * Generate audit reports
   * @param reportType Report type
   * @param startTime Start time
   * @param endTime End time
   * @returns Report data
   */
  async generateReport(
    reportType: 'privacy' | 'security' | 'usage',
    startTime: Date,
    endTime: Date
  ): Promise<any> {
    const events = await this.queryEvents({ startTime, endTime });

    switch (reportType) {
      case 'privacy':
        return this.generatePrivacyReport(events);
      case 'security':
        return this.generateSecurityReport(events);
      case 'usage':
        return this.generateUsageReport(events);
      default:
        throw new Error('Unknown report type');
    }
  }

  /**
   * Export audit logs
   * @param format Export format
   * @param filters Export filters
   * @returns Exported data
   */
  async exportLogs(
    format: 'json' | 'csv',
    filters?: Parameters<AuditLogger['queryEvents']>[0]
  ): Promise<string> {
    const events = await this.queryEvents(filters || {});

    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2);
      case 'csv':
        return this.convertToCSV(events);
      default:
        throw new Error('Unknown export format');
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Persist audit event to storage
   */
  private async persistEvent(event: AuditEvent): Promise<void> {
    switch (this.config.storageType) {
      case 'file':
        await this.persistToFile(event);
        break;
      case 'database':
        await this.persistToDatabase(event);
        break;
    }
  }

  /**
   * Persist event to file
   */
  private async persistToFile(event: AuditEvent): Promise<void> {
    // Implementation for file persistence
  }

  /**
   * Persist event to database
   */
  private async persistToDatabase(event: AuditEvent): Promise<void> {
    // Implementation for database persistence
  }

  /**
   * Check alert thresholds and trigger alerts if needed
   */
  private async checkAlertThresholds(event: AuditEvent): Promise<void> {
    const { alertThresholds } = this.config;
    if (!alertThresholds) return;

    if (this.shouldIncrementAlert(event.eventType)) {
      this.alertCounts[event.eventType]++;

      if (
        event.eventType === AuditEventType.PRIVACY_VIOLATION &&
        this.alertCounts[event.eventType] >= alertThresholds.privacyViolations
      ) {
        await this.triggerAlert('Privacy violations threshold exceeded');
      }
      else if (
        event.eventType === AuditEventType.BUDGET_EXHAUSTION &&
        this.alertCounts[event.eventType] >= alertThresholds.budgetExhaustions
      ) {
        await this.triggerAlert('Budget exhaustions threshold exceeded');
      }
      else if (
        event.eventType === AuditEventType.SYSTEM_ERROR &&
        this.alertCounts[event.eventType] >= alertThresholds.systemErrors
      ) {
        await this.triggerAlert('System errors threshold exceeded');
      }
    }
  }

  /**
   * Check if event type should increment alert counter
   */
  private shouldIncrementAlert(eventType: AuditEventType): boolean {
    return eventType === AuditEventType.PRIVACY_VIOLATION ||
           eventType === AuditEventType.BUDGET_EXHAUSTION ||
           eventType === AuditEventType.SYSTEM_ERROR;
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(message: string): Promise<void> {
    // Implementation for alert notification
    console.error(`ALERT: ${message}`);
  }

  /**
   * Enforce log retention policy
   */
  private async enforceRetention(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.retentionPeriod);

    this.events = this.events.filter(e => e.timestamp >= cutoff);
    
    // Also clean up storage
    if (this.config.storageType === 'file') {
      await this.cleanupFileStorage(cutoff);
    } else {
      await this.cleanupDatabaseStorage(cutoff);
    }
  }

  /**
   * Clean up file storage
   */
  private async cleanupFileStorage(cutoff: Date): Promise<void> {
    // Implementation for file storage cleanup
  }

  /**
   * Clean up database storage
   */
  private async cleanupDatabaseStorage(cutoff: Date): Promise<void> {
    // Implementation for database storage cleanup
  }

  /**
   * Generate privacy report
   */
  private generatePrivacyReport(events: AuditEvent[]): any {
    return {
      totalQueries: events.filter(e => e.eventType === AuditEventType.QUERY_EXECUTION).length,
      privacyViolations: events.filter(e => e.eventType === AuditEventType.PRIVACY_VIOLATION).length,
      budgetExhaustions: events.filter(e => e.eventType === AuditEventType.BUDGET_EXHAUSTION).length,
      mechanismUsage: this.aggregateMechanismUsage(events),
      averageEpsilon: this.calculateAverageEpsilon(events)
    };
  }

  /**
   * Generate security report
   */
  private generateSecurityReport(events: AuditEvent[]): any {
    return {
      keyOperations: {
        generated: events.filter(e => e.eventType === AuditEventType.KEY_GENERATION).length,
        rotated: events.filter(e => e.eventType === AuditEventType.KEY_ROTATION).length,
        revoked: events.filter(e => e.eventType === AuditEventType.KEY_REVOCATION).length
      },
      systemErrors: events.filter(e => e.eventType === AuditEventType.SYSTEM_ERROR).length,
      errorTypes: this.aggregateErrorTypes(events)
    };
  }

  /**
   * Generate usage report
   */
  private generateUsageReport(events: AuditEvent[]): any {
    return {
      queryCount: events.filter(e => e.eventType === AuditEventType.QUERY_EXECUTION).length,
      userActivity: this.aggregateUserActivity(events),
      datasetUsage: this.aggregateDatasetUsage(events),
      timeDistribution: this.aggregateTimeDistribution(events)
    };
  }

  /**
   * Aggregate mechanism usage statistics
   */
  private aggregateMechanismUsage(events: AuditEvent[]): Record<string, number> {
    const usage: Record<string, number> = {};
    events
      .filter(e => e.eventType === AuditEventType.QUERY_EXECUTION)
      .forEach(e => {
        const mechanism = e.details.mechanism;
        if (mechanism) {
          usage[mechanism] = (usage[mechanism] || 0) + 1;
        }
      });
    return usage;
  }

  /**
   * Calculate average epsilon value
   */
  private calculateAverageEpsilon(events: AuditEvent[]): number {
    const epsilons = events
      .filter(e => e.eventType === AuditEventType.QUERY_EXECUTION)
      .map(e => e.details.epsilon)
      .filter(e => e !== undefined) as number[];
    
    return epsilons.length > 0
      ? epsilons.reduce((a, b) => a + b, 0) / epsilons.length
      : 0;
  }

  /**
   * Aggregate error types
   */
  private aggregateErrorTypes(events: AuditEvent[]): Record<string, number> {
    const errors: Record<string, number> = {};
    events
      .filter(e => e.eventType === AuditEventType.SYSTEM_ERROR)
      .forEach(e => {
        const errorType = e.details.error || 'Unknown';
        errors[errorType] = (errors[errorType] || 0) + 1;
      });
    return errors;
  }

  /**
   * Aggregate user activity
   */
  private aggregateUserActivity(events: AuditEvent[]): Record<string, number> {
    const activity: Record<string, number> = {};
    events
      .filter(e => e.userId)
      .forEach(e => {
        activity[e.userId!] = (activity[e.userId!] || 0) + 1;
      });
    return activity;
  }

  /**
   * Aggregate dataset usage
   */
  private aggregateDatasetUsage(events: AuditEvent[]): Record<string, number> {
    const usage: Record<string, number> = {};
    events
      .filter(e => e.datasetId)
      .forEach(e => {
        usage[e.datasetId!] = (usage[e.datasetId!] || 0) + 1;
      });
    return usage;
  }

  /**
   * Aggregate time distribution of events
   */
  private aggregateTimeDistribution(events: AuditEvent[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    events.forEach(e => {
      const hour = e.timestamp.getHours();
      distribution[hour] = (distribution[hour] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Convert events to CSV format
   */
  private convertToCSV(events: AuditEvent[]): string {
    const headers = [
      'eventId',
      'timestamp',
      'eventType',
      'severity',
      'userId',
      'datasetId',
      'keyId',
      'queryId',
      'details'
    ];

    const rows = events.map(e => [
      e.eventId,
      e.timestamp.toISOString(),
      e.eventType,
      e.severity,
      e.userId || '',
      e.datasetId || '',
      e.keyId || '',
      e.queryId || '',
      JSON.stringify(e.details)
    ]);

    return [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');
  }
} 