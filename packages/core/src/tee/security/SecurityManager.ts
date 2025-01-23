import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import { PerformanceMonitor, MetricType, AlertSeverity } from '../monitoring/PerformanceMonitor';

export enum SecurityLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export enum ThreatType {
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  CODE_INTEGRITY_VIOLATION = 'CODE_INTEGRITY_VIOLATION',
  ABNORMAL_BEHAVIOR = 'ABNORMAL_BEHAVIOR',
  RESOURCE_ABUSE = 'RESOURCE_ABUSE',
  DATA_LEAK = 'DATA_LEAK',
  REPLAY_ATTACK = 'REPLAY_ATTACK',
  TAMPERING = 'TAMPERING'
}

export interface SecurityCheck {
  id: string;
  name: string;
  description: string;
  level: SecurityLevel;
  enabled: boolean;
  checkFn: (context: SecurityContext) => Promise<SecurityCheckResult>;
}

export interface SecurityContext {
  sessionId: string;
  userId?: string;
  operation: string;
  resource: string;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface SecurityCheckResult {
  passed: boolean;
  threatType?: ThreatType;
  details?: string;
  evidence?: Record<string, any>;
}

export interface SecurityIncident {
  id: string;
  timestamp: number;
  level: SecurityLevel;
  threatType: ThreatType;
  context: SecurityContext;
  details: string;
  evidence: Record<string, any>;
  status: 'detected' | 'investigating' | 'mitigated' | 'resolved';
  resolution?: string;
}

export interface SecurityPattern {
  id: string;
  name: string;
  description: string;
  threatType: ThreatType;
  level: SecurityLevel;
  conditions: {
    timeWindowMs: number;
    minOccurrences: number;
    matchFields: string[];
  };
}

export class SecurityManager extends EventEmitter {
  private readonly securityChecks: Map<string, SecurityCheck>;
  private readonly securityPatterns: Map<string, SecurityPattern>;
  private readonly incidents: Map<string, SecurityIncident>;
  private readonly recentEvents: SecurityCheckResult[];
  private readonly monitor: PerformanceMonitor;
  private readonly eventRetentionMs: number;
  private checkTimer: NodeJS.Timeout | null;

  constructor(monitor: PerformanceMonitor, eventRetentionMs: number = 24 * 60 * 60 * 1000) {
    super();
    this.securityChecks = new Map();
    this.securityPatterns = new Map();
    this.incidents = new Map();
    this.recentEvents = [];
    this.monitor = monitor;
    this.eventRetentionMs = eventRetentionMs;
    this.checkTimer = null;
    this.initializeDefaultChecks();
    this.startPatternDetection();
  }

  private initializeDefaultChecks(): void {
    // Code integrity check
    this.addSecurityCheck({
      id: 'code-integrity',
      name: 'Code Integrity Verification',
      description: 'Verifies the integrity of code before execution',
      level: SecurityLevel.CRITICAL,
      enabled: true,
      checkFn: async (context) => {
        // TODO: Implement actual code integrity check
        return {
          passed: true
        };
      }
    });

    // Authentication check
    this.addSecurityCheck({
      id: 'auth-check',
      name: 'Authentication Verification',
      description: 'Verifies user authentication and session validity',
      level: SecurityLevel.HIGH,
      enabled: true,
      checkFn: async (context) => {
        // TODO: Implement actual authentication check
        return {
          passed: true
        };
      }
    });

    // Resource access check
    this.addSecurityCheck({
      id: 'resource-access',
      name: 'Resource Access Control',
      description: 'Verifies access permissions for resources',
      level: SecurityLevel.HIGH,
      enabled: true,
      checkFn: async (context) => {
        // TODO: Implement actual resource access check
        return {
          passed: true
        };
      }
    });
  }

  private startPatternDetection(): void {
    if (this.checkTimer) {
      return;
    }
    this.checkTimer = setInterval(() => this.detectPatterns(), 5000);
  }

  async performSecurityChecks(context: SecurityContext): Promise<boolean> {
    let allPassed = true;
    const timestamp = Date.now();

    for (const check of this.securityChecks.values()) {
      if (!check.enabled) continue;

      try {
        const result = await check.checkFn(context);
        this.recentEvents.push(result);

        if (!result.passed) {
          allPassed = false;
          await this.handleSecurityViolation(check, context, result);
        }

        // Record metric
        this.monitor.recordSecurityMetric(
          `security_check_${check.id}`,
          result.passed ? 1 : 0,
          'boolean',
          {
            checkId: check.id,
            level: check.level,
            context: JSON.stringify(context)
          }
        );
      } catch (error) {
        logger.error(`Security check ${check.id} failed`, { context }, error as Error);
        allPassed = false;
      }
    }

    // Cleanup old events
    this.cleanupOldEvents(timestamp);
    return allPassed;
  }

  private async handleSecurityViolation(
    check: SecurityCheck,
    context: SecurityContext,
    result: SecurityCheckResult
  ): Promise<void> {
    const incident: SecurityIncident = {
      id: `${check.id}-${Date.now()}`,
      timestamp: Date.now(),
      level: check.level,
      threatType: result.threatType || ThreatType.ABNORMAL_BEHAVIOR,
      context,
      details: result.details || `Security check '${check.name}' failed`,
      evidence: result.evidence || {},
      status: 'detected'
    };

    this.incidents.set(incident.id, incident);
    this.emit('securityViolation', incident);

    // Log the incident
    logger.error('Security violation detected', {
      checkId: check.id,
      level: check.level,
      context
    });

    // Record security metric
    this.monitor.recordSecurityMetric(
      'security_violations',
      1,
      'count',
      {
        checkId: check.id,
        level: check.level,
        threatType: incident.threatType
      }
    );
  }

  private async detectPatterns(): Promise<void> {
    try {
      for (const pattern of this.securityPatterns.values()) {
        const matches = this.findPatternMatches(pattern);
        if (matches.length >= pattern.conditions.minOccurrences) {
          await this.handlePatternMatch(pattern, matches);
        }
      }
    } catch (error) {
      logger.error('Pattern detection failed', {}, error as Error);
    }
  }

  private findPatternMatches(pattern: SecurityPattern): SecurityCheckResult[] {
    const cutoff = Date.now() - pattern.conditions.timeWindowMs;
    return this.recentEvents.filter(event => {
      if (!event.threatType || event.threatType !== pattern.threatType) {
        return false;
      }
      // TODO: Implement actual pattern matching logic
      return true;
    });
  }

  private async handlePatternMatch(
    pattern: SecurityPattern,
    matches: SecurityCheckResult[]
  ): Promise<void> {
    const incident: SecurityIncident = {
      id: `pattern-${pattern.id}-${Date.now()}`,
      timestamp: Date.now(),
      level: pattern.level,
      threatType: pattern.threatType,
      context: {
        sessionId: 'pattern-detection',
        operation: 'pattern-match',
        resource: pattern.id,
        timestamp: Date.now(),
        metadata: {
          patternName: pattern.name,
          matchCount: matches.length
        }
      },
      details: `Pattern '${pattern.name}' detected with ${matches.length} matches`,
      evidence: {
        matches: matches.map(m => m.evidence)
      },
      status: 'detected'
    };

    this.incidents.set(incident.id, incident);
    this.emit('patternDetected', incident);

    // Log the incident
    logger.warn('Security pattern detected', {
      patternId: pattern.id,
      level: pattern.level,
      matchCount: matches.length
    });

    // Record security metric
    this.monitor.recordSecurityMetric(
      'security_patterns',
      matches.length,
      'count',
      {
        patternId: pattern.id,
        level: pattern.level,
        threatType: pattern.threatType
      }
    );
  }

  addSecurityCheck(check: SecurityCheck): void {
    this.securityChecks.set(check.id, check);
    logger.info('Security check added', { checkId: check.id, name: check.name });
  }

  removeSecurityCheck(checkId: string): void {
    this.securityChecks.delete(checkId);
    logger.info('Security check removed', { checkId });
  }

  addSecurityPattern(pattern: SecurityPattern): void {
    this.securityPatterns.set(pattern.id, pattern);
    logger.info('Security pattern added', { patternId: pattern.id, name: pattern.name });
  }

  removeSecurityPattern(patternId: string): void {
    this.securityPatterns.delete(patternId);
    logger.info('Security pattern removed', { patternId });
  }

  updateIncidentStatus(
    incidentId: string,
    status: SecurityIncident['status'],
    resolution?: string
  ): void {
    const incident = this.incidents.get(incidentId);
    if (incident) {
      incident.status = status;
      if (resolution) {
        incident.resolution = resolution;
      }
      this.emit('incidentUpdated', incident);
      logger.info('Security incident updated', {
        incidentId,
        status,
        resolution
      });
    }
  }

  getActiveIncidents(): SecurityIncident[] {
    return Array.from(this.incidents.values()).filter(
      i => i.status !== 'resolved'
    );
  }

  private cleanupOldEvents(timestamp: number): void {
    const cutoff = timestamp - this.eventRetentionMs;
    this.recentEvents.splice(
      0,
      this.recentEvents.findIndex(e => e.timestamp >= cutoff)
    );
  }

  shutdown(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    // Clear all data
    this.recentEvents.length = 0;
    this.incidents.clear();
    logger.info('Security manager shutdown complete');
  }
} 