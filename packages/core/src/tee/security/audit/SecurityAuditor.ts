import { EventEmitter } from 'events';
import { logger } from '../../logging/Logger';
import { SecurityMeasurements, TEEMetrics } from '../../types';
import { MetricsManager } from '../../monitoring/MetricsManager';
import { MLAnomalyDetector, AnomalyScore } from '../anomaly/MLAnomalyDetector';

export interface AuditEvent {
  id: string;
  timestamp: number;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  details: any;
  context?: {
    tenantId?: string;
    contextId?: string;
    operation?: string;
  };
  relatedEvents?: string[];
}

export interface AuditPolicy {
  retentionPeriod: number;     // Days to retain audit logs
  severityThresholds: {
    warning: number;
    error: number;
    critical: number;
  };
  alertingRules: {
    eventTypes: string[];
    minSeverity: string;
    timeWindow: number;
    threshold: number;
  }[];
}

export interface AuditSummary {
  startTime: number;
  endTime: number;
  totalEvents: number;
  eventsByType: Map<string, number>;
  eventsBySeverity: Map<string, number>;
  topSources: Array<{ source: string; count: number }>;
  anomalies: AnomalyScore[];
  complianceScore: number;
}

export class SecurityAuditor extends EventEmitter {
  private events: AuditEvent[] = [];
  private policy: AuditPolicy;
  private metricsManager: MetricsManager;
  private anomalyDetector: MLAnomalyDetector;
  private readonly CLEANUP_INTERVAL = 86400000; // 24 hours

  constructor(
    policy: AuditPolicy,
    metricsManager: MetricsManager,
    anomalyDetector: MLAnomalyDetector
  ) {
    super();
    this.policy = policy;
    this.metricsManager = metricsManager;
    this.anomalyDetector = anomalyDetector;

    // Setup event handlers
    this.setupEventHandlers();

    // Start cleanup job
    setInterval(() => this.cleanupOldEvents(), this.CLEANUP_INTERVAL);
  }

  private setupEventHandlers(): void {
    this.anomalyDetector.on('anomaly', (anomaly: AnomalyScore) => {
      this.recordAuditEvent({
        type: 'security.anomaly',
        severity: this.calculateAnomalySeverity(anomaly),
        source: 'anomaly_detector',
        details: anomaly
      });
    });
  }

  async recordAuditEvent(event: Partial<AuditEvent>): Promise<void> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: event.type || 'unknown',
      severity: event.severity || 'info',
      source: event.source || 'system',
      details: event.details || {},
      context: event.context,
      relatedEvents: event.relatedEvents
    };

    this.events.push(auditEvent);
    
    // Log the event
    logger.auditLog(auditEvent.type, {
      severity: auditEvent.severity,
      source: auditEvent.source,
      details: auditEvent.details,
      context: auditEvent.context
    });

    // Check alerting rules
    await this.checkAlertingRules(auditEvent);

    this.emit('audit-event', auditEvent);
  }

  async getAuditSummary(
    startTime: number,
    endTime: number = Date.now()
  ): Promise<AuditSummary> {
    const relevantEvents = this.events.filter(
      e => e.timestamp >= startTime && e.timestamp <= endTime
    );

    const eventsByType = new Map<string, number>();
    const eventsBySeverity = new Map<string, number>();
    const sourceCount = new Map<string, number>();

    relevantEvents.forEach(event => {
      // Count by type
      eventsByType.set(
        event.type,
        (eventsByType.get(event.type) || 0) + 1
      );

      // Count by severity
      eventsBySeverity.set(
        event.severity,
        (eventsBySeverity.get(event.severity) || 0) + 1
      );

      // Count by source
      sourceCount.set(
        event.source,
        (sourceCount.get(event.source) || 0) + 1
      );
    });

    // Get top sources
    const topSources = Array.from(sourceCount.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get anomalies
    const anomalies = await this.getAnomalies(startTime, endTime);

    // Calculate compliance score
    const complianceScore = this.calculateComplianceScore(
      eventsBySeverity,
      relevantEvents.length
    );

    return {
      startTime,
      endTime,
      totalEvents: relevantEvents.length,
      eventsByType,
      eventsBySeverity,
      topSources,
      anomalies,
      complianceScore
    };
  }

  async searchAuditEvents(
    criteria: {
      types?: string[];
      severities?: string[];
      sources?: string[];
      startTime?: number;
      endTime?: number;
      context?: Partial<AuditEvent['context']>;
    }
  ): Promise<AuditEvent[]> {
    let events = this.events;

    if (criteria.startTime) {
      events = events.filter(e => e.timestamp >= criteria.startTime!);
    }

    if (criteria.endTime) {
      events = events.filter(e => e.timestamp <= criteria.endTime!);
    }

    if (criteria.types) {
      events = events.filter(e => criteria.types!.includes(e.type));
    }

    if (criteria.severities) {
      events = events.filter(e => criteria.severities!.includes(e.severity));
    }

    if (criteria.sources) {
      events = events.filter(e => criteria.sources!.includes(e.source));
    }

    if (criteria.context) {
      events = events.filter(e => this.matchContext(e.context, criteria.context));
    }

    return events;
  }

  async getRelatedEvents(eventId: string): Promise<AuditEvent[]> {
    const event = this.events.find(e => e.id === eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    const relatedEvents = new Set<string>();
    
    // Add directly related events
    if (event.relatedEvents) {
      event.relatedEvents.forEach(id => relatedEvents.add(id));
    }

    // Add events with the same context
    if (event.context) {
      this.events
        .filter(e => this.matchContext(e.context, event.context))
        .forEach(e => relatedEvents.add(e.id));
    }

    // Add events of the same type in a time window
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    this.events
      .filter(e =>
        e.type === event.type &&
        Math.abs(e.timestamp - event.timestamp) <= timeWindow
      )
      .forEach(e => relatedEvents.add(e.id));

    return this.events.filter(e => relatedEvents.has(e.id));
  }

  private async checkAlertingRules(event: AuditEvent): Promise<void> {
    for (const rule of this.policy.alertingRules) {
      if (
        rule.eventTypes.includes(event.type) &&
        this.getSeverityLevel(event.severity) >= this.getSeverityLevel(rule.minSeverity)
      ) {
        // Count events in time window
        const windowStart = Date.now() - rule.timeWindow;
        const count = this.events.filter(e =>
          e.type === event.type &&
          e.timestamp >= windowStart &&
          this.getSeverityLevel(e.severity) >= this.getSeverityLevel(rule.minSeverity)
        ).length;

        if (count >= rule.threshold) {
          this.emit('alert', {
            rule,
            event,
            count,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  private getSeverityLevel(severity: string): number {
    const levels = {
      'info': 0,
      'warning': 1,
      'error': 2,
      'critical': 3
    };
    return levels[severity as keyof typeof levels] || 0;
  }

  private calculateAnomalySeverity(anomaly: AnomalyScore): AuditEvent['severity'] {
    if (anomaly.score > this.policy.severityThresholds.critical) {
      return 'critical';
    }
    if (anomaly.score > this.policy.severityThresholds.error) {
      return 'error';
    }
    if (anomaly.score > this.policy.severityThresholds.warning) {
      return 'warning';
    }
    return 'info';
  }

  private async getAnomalies(
    startTime: number,
    endTime: number
  ): Promise<AnomalyScore[]> {
    const metrics = await this.metricsManager.getMetricsHistory(
      'security_score',
      startTime,
      endTime
    );

    return metrics
      .filter(m => m.value < this.policy.severityThresholds.warning)
      .map(m => ({
        score: m.value,
        threshold: this.policy.severityThresholds.warning,
        isAnomaly: true,
        features: {},
        timestamp: m.timestamp
      }));
  }

  private calculateComplianceScore(
    eventsBySeverity: Map<string, number>,
    totalEvents: number
  ): number {
    if (totalEvents === 0) return 100;

    const weights = {
      'info': 0,
      'warning': 0.2,
      'error': 0.5,
      'critical': 1
    };

    let weightedSum = 0;
    for (const [severity, count] of eventsBySeverity.entries()) {
      weightedSum += (count * weights[severity as keyof typeof weights]);
    }

    const score = 100 * (1 - (weightedSum / totalEvents));
    return Math.max(0, Math.min(100, score));
  }

  private matchContext(
    eventContext?: AuditEvent['context'],
    searchContext?: Partial<AuditEvent['context']>
  ): boolean {
    if (!eventContext || !searchContext) return false;

    return Object.entries(searchContext).every(([key, value]) =>
      eventContext[key as keyof typeof eventContext] === value
    );
  }

  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupOldEvents(): void {
    const cutoff = Date.now() - (this.policy.retentionPeriod * 86400000);
    const initialCount = this.events.length;
    
    this.events = this.events.filter(e => e.timestamp >= cutoff);
    
    const removedCount = initialCount - this.events.length;
    if (removedCount > 0) {
      logger.info('Cleaned up old audit events', { removedCount });
    }
  }
} 