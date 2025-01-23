import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import { ResourceMonitor } from '../resource/ResourceMonitor';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SecurityMeasurements } from './SecurityMeasurements';
import { TEEMetrics } from '../monitoring/TEEMetrics';
import { MetricsManager } from '../monitoring/MetricsManager';
import { MLAnomalyDetector, AnomalyScore } from '../monitoring/MLAnomalyDetector';

export enum AuditEventType {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  RESOURCE_ACCESS = 'RESOURCE_ACCESS',
  CONFIGURATION_CHANGE = 'CONFIGURATION_CHANGE',
  SECURITY_ALERT = 'SECURITY_ALERT',
  SYSTEM_EVENT = 'SYSTEM_EVENT'
}

export enum AuditSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  severity: AuditSeverity;
  timestamp: number;
  source: string;
  actor: string;
  action: string;
  target: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'ERROR';
  details: Record<string, any>;
  metadata: {
    sessionId?: string;
    correlationId?: string;
    clientIp?: string;
    userAgent?: string;
    [key: string]: any;
  };
  measurements?: SecurityMeasurements;
  anomalyScore?: AnomalyScore;
  signature?: string;
}

export interface AuditPolicy {
  id: string;
  name: string;
  description: string;
  eventTypes: AuditEventType[];
  severityThreshold: AuditSeverity;
  retentionDays: number;
  alertingEnabled: boolean;
  alertThreshold: number;
  complianceRules: {
    name: string;
    condition: string;
    required: boolean;
  }[];
}

export interface AuditSummary {
  startTime: number;
  endTime: number;
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  failureRate: number;
  complianceStatus: Record<string, boolean>;
  topSources: Array<{ source: string; count: number }>;
  topActors: Array<{ actor: string; count: number }>;
  anomalyCount: number;
}

export enum ComplianceFramework {
  GDPR = 'GDPR',
  HIPAA = 'HIPAA',
  PCI_DSS = 'PCI_DSS',
  SOC2 = 'SOC2',
  ISO27001 = 'ISO27001'
}

export enum ComplianceCategory {
  ACCESS_CONTROL = 'ACCESS_CONTROL',
  DATA_PROTECTION = 'DATA_PROTECTION',
  ENCRYPTION = 'ENCRYPTION',
  AUDIT_LOGGING = 'AUDIT_LOGGING',
  INCIDENT_RESPONSE = 'INCIDENT_RESPONSE',
  BUSINESS_CONTINUITY = 'BUSINESS_CONTINUITY'
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  framework: ComplianceFramework;
  category: ComplianceCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  checkFunction: (context: AuditContext) => Promise<ComplianceResult>;
  remediationSteps: string[];
  automatedRemediation?: (context: AuditContext) => Promise<void>;
  dependencies?: string[];  // IDs of other rules that must be checked first
}

export interface ComplianceResult {
  ruleId: string;
  compliant: boolean;
  evidence: string[];
  findings: Array<{
    description: string;
    severity: string;
    location?: string;
    context?: Record<string, any>;
  }>;
  remediationPlan?: Array<{
    step: string;
    automated: boolean;
    estimatedEffort: string;
    prerequisites?: string[];
  }>;
}

export interface AuditContext {
  timestamp: number;
  environment: string;
  resources: {
    compute: ResourceMetrics;
    storage: StorageMetrics;
    network: NetworkMetrics;
  };
  security: {
    encryption: EncryptionStatus;
    authentication: AuthenticationMetrics;
    authorization: AuthorizationMetrics;
  };
  compliance: {
    lastAudit?: number;
    waivers: Array<{
      ruleId: string;
      reason: string;
      expiry: number;
      approver: string;
    }>;
  };
}

export class SecurityAuditor extends EventEmitter {
  private readonly auditDir: string;
  private readonly policies: Map<string, AuditPolicy>;
  private readonly events: Map<string, AuditEvent>;
  private readonly violations: Map<string, ComplianceViolation>;
  private readonly resourceMonitor?: ResourceMonitor;
  private readonly maxEventsInMemory: number;
  private cleanupInterval: NodeJS.Timer | null;
  private readonly metricsManager: MetricsManager;
  private readonly anomalyDetector: MLAnomalyDetector;
  private readonly auditFile: string;
  private readonly signingKey: string;
  private readonly complianceRules: Map<string, ComplianceRule>;
  private readonly auditHistory: Map<string, ComplianceResult[]>;
  private readonly remediationQueue: Array<{
    ruleId: string;
    context: AuditContext;
    timestamp: number;
  }>;

  constructor(
    config: {
      auditDir: string;
      maxEventsInMemory?: number;
      cleanupIntervalMs?: number;
      resourceMonitoring?: boolean;
    },
    metricsManager: MetricsManager,
    anomalyDetector: MLAnomalyDetector
  ) {
    super();
    this.auditDir = config.auditDir;
    this.policies = new Map();
    this.events = new Map();
    this.violations = new Map();
    this.maxEventsInMemory = config.maxEventsInMemory || 10000;
    
    // Initialize resource monitoring if enabled
    if (config.resourceMonitoring) {
      this.resourceMonitor = new ResourceMonitor(process.pid, {
        cpu: 90,
        memory: 1024 * 1024 * 1024,  // 1GB
        disk: {
          read: 50 * 1024 * 1024,    // 50MB/s
          write: 20 * 1024 * 1024    // 20MB/s
        },
        network: {
          rx: 10 * 1024 * 1024,      // 10MB/s
          tx: 5 * 1024 * 1024        // 5MB/s
        }
      });

      this.resourceMonitor.on('alert', alert => {
        this.recordEvent({
          type: AuditEventType.RESOURCE_ACCESS,
          severity: AuditSeverity.HIGH,
          source: 'ResourceMonitor',
          action: 'THRESHOLD_EXCEEDED',
          outcome: 'failure',
          details: alert
        });
      });
    }

    // Start cleanup interval
    const cleanupIntervalMs = config.cleanupIntervalMs || 24 * 60 * 60 * 1000;  // 24 hours
    this.cleanupInterval = setInterval(
      () => this.cleanupOldEvents(),
      cleanupIntervalMs
    );

    this.metricsManager = metricsManager;
    this.anomalyDetector = anomalyDetector;
    this.auditFile = './audit.log';
    this.signingKey = './audit.key';
    this.complianceRules = new Map();
    this.auditHistory = new Map();
    this.remediationQueue = [];

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Create audit directory if it doesn't exist
      await fs.mkdir(this.auditDir, { recursive: true });

      // Load existing policies
      await this.loadPolicies();

      // Initialize signing key
      const keyExists = await fs.access(this.signingKey)
        .then(() => true)
        .catch(() => false);

      if (!keyExists) {
        const key = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        });

        await fs.writeFile(this.signingKey, key.privateKey);
        logger.info('Generated new audit signing key');
      }

      // Load existing audit events
      const auditExists = await fs.access(this.auditFile)
        .then(() => true)
        .catch(() => false);

      if (auditExists) {
        const data = await fs.readFile(this.auditFile, 'utf8');
        const events = JSON.parse(data);
        this.events.set(events[0].id, events[0]);
        logger.info('Loaded existing audit events', {
          count: events.length
        });
      }

      logger.info('Security auditor initialized', {
        auditDir: this.auditDir,
        policiesLoaded: this.policies.size
      });
    } catch (error) {
      logger.error('Failed to initialize security auditor', {}, error as Error);
      throw error;
    }
  }

  private async loadPolicies(): Promise<void> {
    try {
      const policyFile = path.join(this.auditDir, 'policies.json');
      const content = await fs.readFile(policyFile, 'utf8');
      const policies = JSON.parse(content) as AuditPolicy[];

      policies.forEach(policy => {
        this.policies.set(policy.id, policy);
      });
    } catch (error) {
      logger.warn('No existing audit policies found, using defaults');
      this.setupDefaultPolicies();
    }
  }

  private setupDefaultPolicies(): void {
    const defaultPolicy: AuditPolicy = {
      id: 'default',
      name: 'Default Audit Policy',
      description: 'Default policy for security auditing',
      eventTypes: Object.values(AuditEventType),
      severityThreshold: AuditSeverity.LOW,
      retentionDays: 90,
      alertingEnabled: true,
      alertThreshold: 5,
      complianceRules: [
        {
          name: 'auth-failures',
          condition: 'event.type === "AUTHENTICATION" && event.action === "AUTHENTICATE" && event.outcome === "FAILURE"',
          required: true
        },
        {
          name: 'resource-abuse',
          condition: 'event.type === "RESOURCE_ACCESS" && event.severity === "HIGH"',
          required: true
        }
      ]
    };

    this.policies.set(defaultPolicy.id, defaultPolicy);
  }

  async recordEvent(
    event: Omit<AuditEvent, 'id' | 'timestamp' | 'signature'>
  ): Promise<string> {
    try {
      const timestamp = Date.now();
      const id = this.generateEventId(timestamp);

      // Get security measurements
      const measurements = await this.metricsManager.getSecurityMeasurements();

      // Check for anomalies
      const anomalyScore = await this.anomalyDetector.detectAnomalies(
        measurements
      );

      // Create full event
      const fullEvent: AuditEvent = {
        ...event,
        id,
        timestamp,
        measurements,
        anomalyScore
      };

      // Sign the event
      fullEvent.signature = await this.signEvent(fullEvent);

      // Store event
      this.events.set(id, fullEvent);

      // Write to file
      await this.persistEvent(fullEvent);

      // Check compliance
      await this.checkCompliance(fullEvent);

      // Cleanup if needed
      if (this.events.size > this.maxEventsInMemory) {
        this.cleanupMemory();
      }

      logger.info('Audit event recorded', {
        eventId: id,
        type: event.type,
        severity: event.severity
      });

      return id;
    } catch (error) {
      logger.error('Failed to record audit event', {}, error as Error);
      throw error;
    }
  }

  private generateEventId(timestamp: number): string {
    const random = crypto.randomBytes(16).toString('hex');
    return `${timestamp}-${random}`;
  }

  private async signEvent(event: AuditEvent): Promise<string> {
    try {
      const key = await fs.readFile(this.signingKey, 'utf8');
      const sign = crypto.createSign('SHA256');
      sign.update(JSON.stringify(event));
      return sign.sign(key, 'base64');
    } catch (error) {
      logger.error('Failed to sign audit event', {}, error as Error);
      throw error;
    }
  }

  private async persistEvent(event: AuditEvent): Promise<void> {
    try {
      const fileName = `${event.timestamp}-${event.id}.json`;
      const filePath = path.join(this.auditDir, fileName);

      await fs.writeFile(
        filePath,
        JSON.stringify(event, null, 2),
        'utf8'
      );
    } catch (error) {
      logger.error('Failed to persist audit event', {}, error as Error);
      throw error;
    }
  }

  private async checkCompliance(event: AuditEvent): Promise<void> {
    try {
      for (const policy of this.policies.values()) {
        if (!policy.complianceRules) continue;

        for (const rule of policy.complianceRules) {
          try {
            // Create evaluation context
            const context = { event };
            
            // Evaluate rule condition
            const condition = new Function(
              'event',
              `return ${rule.condition};`
            );
            
            if (condition(event)) {
              const violation: ComplianceViolation = {
                ruleId: rule.name,
                eventId: event.id,
                timestamp: event.timestamp,
                severity: rule.severity,
                details: `Compliance rule "${rule.name}" violated`,
                remediation: rule.remediation
              };

              this.violations.set(
                `${rule.name}-${event.id}`,
                violation
              );

              this.emit('compliance-violation', violation);

              logger.warn('Compliance violation detected', { violation });
            }
          } catch (evalError) {
            logger.error(
              'Failed to evaluate compliance rule',
              { ruleId: rule.name },
              evalError as Error
            );
          }
        }
      }
    } catch (error) {
      logger.error('Failed to check compliance', {}, error as Error);
    }
  }

  private async cleanupOldEvents(): Promise<void> {
    try {
      const now = Date.now();

      // Cleanup files
      const files = await fs.readdir(this.auditDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.auditDir, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        // Check each policy's retention period
        let shouldDelete = true;
        for (const policy of this.policies.values()) {
          const retentionMs = policy.retentionDays * 24 * 60 * 60 * 1000;
          if (age < retentionMs) {
            shouldDelete = false;
            break;
          }
        }

        if (shouldDelete) {
          await fs.unlink(filePath);
          logger.info('Deleted old audit event file', { file });
        }
      }

      // Cleanup memory
      this.cleanupMemory();
    } catch (error) {
      logger.error('Failed to cleanup old events', {}, error as Error);
    }
  }

  private cleanupMemory(): void {
    // Keep only the most recent events up to maxEventsInMemory
    const events = Array.from(this.events.entries())
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .slice(0, this.maxEventsInMemory);

    this.events.clear();
    events.forEach(([id, event]) => {
      this.events.set(id, event);
    });
  }

  async getEvent(id: string): Promise<AuditEvent | null> {
    // Try memory first
    const event = this.events.get(id);
    if (event) return event;

    // Try file system
    try {
      const files = await fs.readdir(this.auditDir);
      const eventFile = files.find(f => f.includes(id));
      if (!eventFile) return null;

      const content = await fs.readFile(
        path.join(this.auditDir, eventFile),
        'utf8'
      );
      return JSON.parse(content);
    } catch (error) {
      logger.error('Failed to get audit event', { id }, error as Error);
      return null;
    }
  }

  async searchEvents(
    criteria: {
      startTime?: number;
      endTime?: number;
      types?: AuditEventType[];
      severities?: AuditSeverity[];
      source?: string;
      userId?: string;
      sessionId?: string;
      correlationId?: string;
    }
  ): Promise<AuditEvent[]> {
    try {
      const results: AuditEvent[] = [];
      const files = await fs.readdir(this.auditDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const content = await fs.readFile(
            path.join(this.auditDir, file),
            'utf8'
          );
          const event = JSON.parse(content) as AuditEvent;

          if (this.matchesCriteria(event, criteria)) {
            results.push(event);
          }
        } catch (error) {
          logger.error('Failed to read audit event file', { file }, error as Error);
        }
      }

      return results.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logger.error('Failed to search audit events', {}, error as Error);
      throw error;
    }
  }

  private matchesCriteria(
    event: AuditEvent,
    criteria: Record<string, any>
  ): boolean {
    if (criteria.startTime && event.timestamp < criteria.startTime) return false;
    if (criteria.endTime && event.timestamp > criteria.endTime) return false;
    if (criteria.types && !criteria.types.includes(event.type)) return false;
    if (criteria.severities && !criteria.severities.includes(event.severity)) return false;
    if (criteria.source && event.source !== criteria.source) return false;
    if (criteria.userId && event.userId !== criteria.userId) return false;
    if (criteria.sessionId && event.sessionId !== criteria.sessionId) return false;
    if (criteria.correlationId && event.correlationId !== criteria.correlationId) return false;

    return true;
  }

  async getAuditSummary(
    startTime: number,
    endTime: number = Date.now()
  ): Promise<AuditSummary> {
    try {
      const events = await this.searchEvents({ startTime, endTime });

      // Initialize counters
      const eventsByType: Record<AuditEventType, number> = Object.values(AuditEventType)
        .reduce((acc, type) => ({ ...acc, [type]: 0 }), {} as Record<AuditEventType, number>);

      const eventsBySeverity: Record<AuditSeverity, number> = Object.values(AuditSeverity)
        .reduce((acc, sev) => ({ ...acc, [sev]: 0 }), {} as Record<AuditSeverity, number>);

      // Count events
      events.forEach(event => {
        eventsByType[event.type]++;
        eventsBySeverity[event.severity]++;
      });

      // Get compliance violations
      const violations = Array.from(this.violations.values())
        .filter(v => v.timestamp >= startTime && v.timestamp <= endTime);

      // Get resource usage if available
      let resourceUsage;
      if (this.resourceMonitor) {
        resourceUsage = this.resourceMonitor.getAverageUsage(endTime - startTime);
      }

      // Calculate failure rate
      const failureCount = events.filter(e => e.outcome !== 'SUCCESS').length;
      const totalEvents = events.length;
      const failureRate = totalEvents > 0 ? failureCount / totalEvents : 0;

      // Calculate compliance status
      const complianceStatus: Record<string, boolean> = {};
      for (const policy of this.policies.values()) {
        complianceStatus[policy.name] = this.checkCompliance(events, policy);
      }

      // Get top sources and actors
      const sources = new Map<string, number>();
      const actors = new Map<string, number>();
      events.forEach(event => {
        sources.set(event.source, (sources.get(event.source) || 0) + 1);
        actors.set(event.actor, (actors.get(event.actor) || 0) + 1);
      });

      const topSources = Array.from(sources.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([source, count]) => ({ source, count }));

      const topActors = Array.from(actors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([actor, count]) => ({ actor, count }));

      // Get anomaly count
      const anomalyCount = events.filter(e => e.anomalyScore?.isAnomaly).length;

      return {
        startTime,
        endTime,
        totalEvents: events.length,
        eventsByType,
        eventsBySeverity,
        failureRate,
        complianceStatus,
        topSources,
        topActors,
        anomalyCount
      };
    } catch (error) {
      logger.error('Failed to generate audit summary', {}, error as Error);
      throw error;
    }
  }

  async addPolicy(policy: AuditPolicy): Promise<void> {
    try {
      this.policies.set(policy.id, policy);
      await this.savePolicies();

      logger.info('Audit policy added', { policyId: policy.id });
    } catch (error) {
      logger.error('Failed to add audit policy', {}, error as Error);
      throw error;
    }
  }

  async removePolicy(id: string): Promise<void> {
    try {
      this.policies.delete(id);
      await this.savePolicies();

      logger.info('Audit policy removed', { policyId: id });
    } catch (error) {
      logger.error('Failed to remove audit policy', {}, error as Error);
      throw error;
    }
  }

  private async savePolicies(): Promise<void> {
    try {
      const policyFile = path.join(this.auditDir, 'policies.json');
      const policies = Array.from(this.policies.values());

      await fs.writeFile(
        policyFile,
        JSON.stringify(policies, null, 2),
        'utf8'
      );
    } catch (error) {
      logger.error('Failed to save audit policies', {}, error as Error);
      throw error;
    }
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.resourceMonitor) {
      this.resourceMonitor.stop();
    }

    logger.info('Security auditor shutdown complete');
  }

  private initializeComplianceRules(): void {
    // Access Control Rules
    this.addComplianceRule({
      id: 'AC-1',
      name: 'Multi-Factor Authentication',
      description: 'Ensure MFA is enabled for all privileged accounts',
      framework: ComplianceFramework.SOC2,
      category: ComplianceCategory.ACCESS_CONTROL,
      severity: 'critical',
      checkFunction: async (context) => {
        const authMetrics = context.security.authentication;
        const findings = [];

        if (!authMetrics.mfaEnabled) {
          findings.push({
            description: 'MFA is not enabled for the system',
            severity: 'critical'
          });
        }

        if (authMetrics.privilegedAccounts > authMetrics.mfaEnrolledAccounts) {
          findings.push({
            description: 'Some privileged accounts do not have MFA enabled',
            severity: 'critical',
            context: {
              total: authMetrics.privilegedAccounts,
              enrolled: authMetrics.mfaEnrolledAccounts
            }
          });
        }

        return {
          ruleId: 'AC-1',
          compliant: findings.length === 0,
          evidence: [
            `Total privileged accounts: ${authMetrics.privilegedAccounts}`,
            `MFA enrolled accounts: ${authMetrics.mfaEnrolledAccounts}`
          ],
          findings,
          remediationPlan: findings.length > 0 ? [
            {
              step: 'Enable system-wide MFA requirement',
              automated: true,
              estimatedEffort: '1 hour'
            },
            {
              step: 'Identify and notify non-compliant users',
              automated: true,
              estimatedEffort: '2 hours'
            },
            {
              step: 'Enforce MFA enrollment through policy',
              automated: true,
              estimatedEffort: '1 hour'
            }
          ] : undefined
        };
      },
      remediationSteps: [
        'Enable system-wide MFA',
        'Notify non-compliant users',
        'Set deadline for MFA enrollment',
        'Enforce MFA policy'
      ]
    });

    // Data Protection Rules
    this.addComplianceRule({
      id: 'DP-1',
      name: 'Data Encryption at Rest',
      description: 'Ensure all sensitive data is encrypted at rest',
      framework: ComplianceFramework.GDPR,
      category: ComplianceCategory.DATA_PROTECTION,
      severity: 'critical',
      checkFunction: async (context) => {
        const encStatus = context.security.encryption;
        const findings = [];

        if (!encStatus.atRestEnabled) {
          findings.push({
            description: 'Data at rest encryption is not enabled',
            severity: 'critical'
          });
        }

        if (encStatus.unencryptedDataVolumes > 0) {
          findings.push({
            description: 'Unencrypted data volumes detected',
            severity: 'critical',
            context: {
              count: encStatus.unencryptedDataVolumes
            }
          });
        }

        return {
          ruleId: 'DP-1',
          compliant: findings.length === 0,
          evidence: [
            `Encryption status: ${encStatus.atRestEnabled ? 'Enabled' : 'Disabled'}`,
            `Unencrypted volumes: ${encStatus.unencryptedDataVolumes}`
          ],
          findings,
          remediationPlan: findings.length > 0 ? [
            {
              step: 'Enable system-wide encryption',
              automated: true,
              estimatedEffort: '4 hours'
            },
            {
              step: 'Encrypt existing data volumes',
              automated: true,
              estimatedEffort: '8 hours',
              prerequisites: ['Backup data', 'Schedule maintenance window']
            }
          ] : undefined
        };
      },
      remediationSteps: [
        'Enable system-wide encryption',
        'Identify unencrypted volumes',
        'Schedule encryption process',
        'Verify encryption status'
      ]
    });
  }

  async performAudit(context: AuditContext): Promise<Map<string, ComplianceResult>> {
    const results = new Map<string, ComplianceResult>();
    const timestamp = Date.now();

    try {
      // Sort rules by dependencies
      const sortedRules = this.sortRulesByDependencies(Array.from(this.complianceRules.values()));

      // Execute compliance checks
      for (const rule of sortedRules) {
        const result = await rule.checkFunction(context);
        results.set(rule.id, result);

        // Store in history
        if (!this.auditHistory.has(rule.id)) {
          this.auditHistory.set(rule.id, []);
        }
        this.auditHistory.get(rule.id)!.push(result);

        // Queue remediation if needed and available
        if (!result.compliant && rule.automatedRemediation) {
          this.queueRemediation(rule.id, context, timestamp);
        }

        // Emit events
        this.emit('rule-checked', {
          ruleId: rule.id,
          compliant: result.compliant,
          timestamp
        });
      }

      // Process remediation queue
      await this.processRemediationQueue();

      return results;
    } catch (error) {
      logger.error('Audit failed', { timestamp }, error as Error);
      throw error;
    }
  }

  private sortRulesByDependencies(rules: ComplianceRule[]): ComplianceRule[] {
    const sorted: ComplianceRule[] = [];
    const visited = new Set<string>();

    const visit = (rule: ComplianceRule) => {
      if (visited.has(rule.id)) return;
      visited.add(rule.id);

      if (rule.dependencies) {
        for (const depId of rule.dependencies) {
          const depRule = this.complianceRules.get(depId);
          if (depRule) {
            visit(depRule);
          }
        }
      }

      sorted.push(rule);
    };

    rules.forEach(visit);
    return sorted;
  }

  private queueRemediation(
    ruleId: string,
    context: AuditContext,
    timestamp: number
  ): void {
    this.remediationQueue.push({ ruleId, context, timestamp });
  }

  private async processRemediationQueue(): Promise<void> {
    while (this.remediationQueue.length > 0) {
      const item = this.remediationQueue.shift()!;
      const rule = this.complianceRules.get(item.ruleId);

      if (rule?.automatedRemediation) {
        try {
          await rule.automatedRemediation(item.context);
          this.emit('remediation-complete', {
            ruleId: item.ruleId,
            timestamp: Date.now()
          });
        } catch (error) {
          logger.error('Remediation failed', {
            ruleId: item.ruleId
          }, error as Error);
          this.emit('remediation-failed', {
            ruleId: item.ruleId,
            error: error as Error
          });
        }
      }
    }
  }

  addComplianceRule(rule: ComplianceRule): void {
    this.complianceRules.set(rule.id, rule);
  }

  getComplianceHistory(
    ruleId: string,
    startTime?: number,
    endTime?: number
  ): ComplianceResult[] {
    const history = this.auditHistory.get(ruleId) || [];
    return history.filter(result => {
      if (startTime && result.timestamp < startTime) return false;
      if (endTime && result.timestamp > endTime) return false;
      return true;
    });
  }

  generateComplianceReport(results: Map<string, ComplianceResult>): {
    summary: {
      total: number;
      compliant: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    byFramework: Record<ComplianceFramework, {
      total: number;
      compliant: number;
    }>;
    byCategory: Record<ComplianceCategory, {
      total: number;
      compliant: number;
    }>;
    criticalFindings: Array<{
      ruleId: string;
      finding: string;
      remediation: string[];
    }>;
  } {
    // Implementation of comprehensive compliance reporting
    // This would aggregate results and provide detailed analysis
    return {
      summary: {
        total: results.size,
        compliant: Array.from(results.values()).filter(r => r.compliant).length,
        critical: 0, // Calculate based on findings
        high: 0,
        medium: 0,
        low: 0
      },
      byFramework: {} as Record<ComplianceFramework, any>,
      byCategory: {} as Record<ComplianceCategory, any>,
      criticalFindings: []
    };
  }
} 