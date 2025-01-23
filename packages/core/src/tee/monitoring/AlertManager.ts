import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';

export enum AlertSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  SILENCED = 'SILENCED'
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string;  // Expression to evaluate
  severity: AlertSeverity;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  silenced?: boolean;
  silencedUntil?: number;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  startTime: number;
  endTime?: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  value: number;
  message: string;
}

export class AlertManager extends EventEmitter {
  private rules: Map<string, AlertRule>;
  private activeAlerts: Map<string, Alert>;
  private alertHistory: Alert[];
  private readonly maxHistorySize: number;

  constructor(maxHistorySize: number = 1000) {
    super();
    this.rules = new Map();
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.maxHistorySize = maxHistorySize;
  }

  addRule(rule: AlertRule): void {
    try {
      // Validate rule condition
      this.validateCondition(rule.condition);
      
      this.rules.set(rule.id, rule);
      logger.info('Alert rule added', { ruleId: rule.id, name: rule.name });
      
      this.emit('rule-added', rule);
    } catch (error) {
      logger.error('Failed to add alert rule', { rule }, error as Error);
      throw error;
    }
  }

  removeRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.delete(ruleId);
      logger.info('Alert rule removed', { ruleId });
      this.emit('rule-removed', rule);
    }
  }

  evaluateMetric(metric: string, value: number, labels: Record<string, string>): void {
    for (const rule of this.rules.values()) {
      if (rule.silenced && rule.silencedUntil && rule.silencedUntil > Date.now()) {
        continue;
      }

      try {
        if (this.evaluateCondition(rule.condition, metric, value)) {
          this.createAlert(rule, value, labels);
        }
      } catch (error) {
        logger.error('Failed to evaluate alert rule', 
          { ruleId: rule.id, metric, value }, 
          error as Error
        );
      }
    }
  }

  private createAlert(
    rule: AlertRule,
    value: number,
    labels: Record<string, string>
  ): void {
    const alertId = this.generateAlertId(rule.id, labels);
    
    // Check if alert already exists
    if (this.activeAlerts.has(alertId)) {
      return;
    }

    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      severity: rule.severity,
      status: AlertStatus.ACTIVE,
      startTime: Date.now(),
      labels: { ...rule.labels, ...labels },
      annotations: rule.annotations,
      value,
      message: this.formatAlertMessage(rule, value, labels)
    };

    this.activeAlerts.set(alertId, alert);
    this.addToHistory(alert);

    logger.warn('Alert triggered', {
      alertId,
      ruleId: rule.id,
      severity: rule.severity,
      value
    });

    this.emit('alert-triggered', alert);
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.status = AlertStatus.ACKNOWLEDGED;
      alert.annotations = {
        ...alert.annotations,
        acknowledgedBy,
        acknowledgedAt: Date.now().toString()
      };

      logger.info('Alert acknowledged', { alertId, acknowledgedBy });
      this.emit('alert-acknowledged', alert);
    }
  }

  resolveAlert(alertId: string, resolvedBy: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.status = AlertStatus.RESOLVED;
      alert.endTime = Date.now();
      alert.annotations = {
        ...alert.annotations,
        resolvedBy,
        resolvedAt: Date.now().toString()
      };

      this.activeAlerts.delete(alertId);
      this.addToHistory(alert);

      logger.info('Alert resolved', { alertId, resolvedBy });
      this.emit('alert-resolved', alert);
    }
  }

  silenceRule(ruleId: string, duration: number, silencedBy: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.silenced = true;
      rule.silencedUntil = Date.now() + duration;
      rule.annotations = {
        ...rule.annotations,
        silencedBy,
        silencedAt: Date.now().toString(),
        silencedUntil: rule.silencedUntil.toString()
      };

      logger.info('Rule silenced', {
        ruleId,
        silencedBy,
        duration
      });

      this.emit('rule-silenced', rule);
    }
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(
    startTime?: number,
    endTime?: number,
    severity?: AlertSeverity
  ): Alert[] {
    let filtered = this.alertHistory;

    if (startTime) {
      filtered = filtered.filter(alert => alert.startTime >= startTime);
    }

    if (endTime) {
      filtered = filtered.filter(alert => alert.startTime <= endTime);
    }

    if (severity) {
      filtered = filtered.filter(alert => alert.severity === severity);
    }

    return filtered;
  }

  private validateCondition(condition: string): void {
    // Implement condition validation
    // This is a placeholder - implement actual condition validation
    if (!condition) {
      throw new Error('Empty alert condition');
    }
  }

  private evaluateCondition(
    condition: string,
    metric: string,
    value: number
  ): boolean {
    // Implement condition evaluation
    // This is a placeholder - implement actual condition evaluation
    return true;
  }

  private generateAlertId(ruleId: string, labels: Record<string, string>): string {
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    return `${ruleId}:${labelString}`;
  }

  private formatAlertMessage(
    rule: AlertRule,
    value: number,
    labels: Record<string, string>
  ): string {
    return `${rule.name}: ${value} ${JSON.stringify(labels)}`;
  }

  private addToHistory(alert: Alert): void {
    this.alertHistory.push(alert);
    
    // Trim history if it exceeds maximum size
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(-this.maxHistorySize);
    }
  }
} 