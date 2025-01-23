import { writeFile, appendFile, readFile, readdir, unlink } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * Audit event types
 */
export enum AuditEventType {
  KEY_GENERATION = 'KEY_GENERATION',
  KEY_ROTATION = 'KEY_ROTATION',
  KEY_DELETION = 'KEY_DELETION',
  ENCRYPTION = 'ENCRYPTION',
  DECRYPTION = 'DECRYPTION',
  HOMOMORPHIC_OPERATION = 'HOMOMORPHIC_OPERATION',
  BACKUP = 'BACKUP',
  RESTORE = 'RESTORE',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
  SECURITY_ALERT = 'SECURITY_ALERT'
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
 * Audit event interface
 */
export interface AuditEvent {
  id: string;
  timestamp: string;
  type: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  operation: string;
  details: Record<string, any>;
  status: 'SUCCESS' | 'FAILURE';
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Audit logger configuration
 */
export interface AuditConfig {
  logPath: string;
  rotationSize: number;  // Size in bytes before rotation
  retentionDays: number;
  enableEncryption?: boolean;
  encryptionKey?: Buffer;
}

/**
 * Audit logger for cryptographic operations
 */
export class AuditLogger {
  private config: Required<AuditConfig>;
  private currentLogFile: string;
  private currentSize: number;

  constructor(config: AuditConfig) {
    this.config = {
      ...config,
      enableEncryption: config.enableEncryption ?? true,
      encryptionKey: config.encryptionKey || Buffer.from(createHash('sha256').update(Date.now().toString()).digest())
    };
    this.currentLogFile = this.getLogFileName();
    this.currentSize = 0;
  }

  /**
   * Log audit event
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date().toISOString()
    };

    // Check if rotation needed
    if (this.currentSize >= this.config.rotationSize) {
      await this.rotateLog();
    }

    const eventString = JSON.stringify(auditEvent);
    const data = this.config.enableEncryption 
      ? this.encrypt(eventString)
      : eventString;

    await writeFile(this.currentLogFile, data + '\n', { flag: 'a' });
    this.currentSize += Buffer.byteLength(data + '\n');

    // Handle critical events
    if (auditEvent.severity === AuditSeverity.CRITICAL) {
      await this.handleCriticalEvent(auditEvent);
    }
  }

  /**
   * Search audit logs
   */
  async search(criteria: {
    startDate?: Date;
    endDate?: Date;
    type?: AuditEventType;
    severity?: AuditSeverity;
    userId?: string;
    status?: 'SUCCESS' | 'FAILURE';
  }): Promise<AuditEvent[]> {
    const files = await readdir(this.config.logPath);
    const logFiles = files.filter(f => f.endsWith('.log'));
    const results: AuditEvent[] = [];

    for (const file of logFiles) {
      const content = await readFile(join(this.config.logPath, file), 'utf8');
      const events = content.split('\n')
        .filter(Boolean)
        .map(line => this.config.enableEncryption ? this.decrypt(line) : line)
        .map(line => JSON.parse(line) as AuditEvent)
        .filter(event => this.matchesCriteria(event, criteria));

      results.push(...events);
    }

    return results;
  }

  /**
   * Generate audit report
   */
  async generateReport(startDate: Date, endDate: Date): Promise<{
    totalEvents: number;
    byType: Record<AuditEventType, number>;
    bySeverity: Record<AuditSeverity, number>;
    failureRate: number;
    topErrors: Array<{ error: string; count: number }>;
  }> {
    const events = await this.search({ startDate, endDate });
    const report = {
      totalEvents: events.length,
      byType: {} as Record<AuditEventType, number>,
      bySeverity: {} as Record<AuditSeverity, number>,
      failureRate: 0,
      topErrors: [] as Array<{ error: string; count: number }>
    };

    // Calculate statistics
    events.forEach(event => {
      report.byType[event.type] = (report.byType[event.type] || 0) + 1;
      report.bySeverity[event.severity] = (report.bySeverity[event.severity] || 0) + 1;
    });

    const failures = events.filter(e => e.status === 'FAILURE');
    report.failureRate = failures.length / events.length;

    // Calculate top errors
    const errorCounts = new Map<string, number>();
    failures.forEach(f => {
      if (f.error) {
        errorCounts.set(f.error, (errorCounts.get(f.error) || 0) + 1);
      }
    });

    report.topErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return report;
  }

  /**
   * Clean up old log files
   */
  async cleanup(): Promise<void> {
    const files = await readdir(this.config.logPath);
    const now = Date.now();
    const maxAge = this.config.retentionDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!file.endsWith('.log')) continue;

      const filePath = join(this.config.logPath, file);
      const stats = await readFile(filePath).catch(() => null);
      if (!stats) continue;

      const fileDate = new Date(file.split('.')[0]).getTime();
      if (now - fileDate > maxAge) {
        await unlink(filePath);
      }
    }
  }

  private generateEventId(): string {
    return createHash('sha256')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex')
      .slice(0, 32);
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return join(this.config.logPath, `${date}.log`);
  }

  private async rotateLog(): Promise<void> {
    this.currentLogFile = this.getLogFileName();
    this.currentSize = 0;
  }

  private encrypt(data: string): string {
    // Implement encryption using this.config.encryptionKey
    // This is a placeholder - implement proper encryption
    return Buffer.from(data).toString('base64');
  }

  private decrypt(data: string): string {
    // Implement decryption using this.config.encryptionKey
    // This is a placeholder - implement proper decryption
    return Buffer.from(data, 'base64').toString();
  }

  private matchesCriteria(event: AuditEvent, criteria: any): boolean {
    if (criteria.startDate && new Date(event.timestamp) < criteria.startDate) return false;
    if (criteria.endDate && new Date(event.timestamp) > criteria.endDate) return false;
    if (criteria.type && event.type !== criteria.type) return false;
    if (criteria.severity && event.severity !== criteria.severity) return false;
    if (criteria.userId && event.userId !== criteria.userId) return false;
    if (criteria.status && event.status !== criteria.status) return false;
    return true;
  }

  private async handleCriticalEvent(event: AuditEvent): Promise<void> {
    // TODO: Implement alert mechanism for critical events
    // This could include:
    // - Sending notifications
    // - Triggering automated responses
    // - Escalating to security team
  }
} 