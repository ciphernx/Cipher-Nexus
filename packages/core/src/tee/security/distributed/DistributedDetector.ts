import { EventEmitter } from 'events';
import { AnomalyDetector } from '../anomaly/AnomalyDetector';
import { DetectionResult, AnomalyAlert } from '../anomaly/types';
import { SecurityMeasurements } from '../../types';
import { NodeManager } from './NodeManager';
import { ConsensusManager } from './ConsensusManager';
import { AlertCorrelator } from './AlertCorrelator';

export interface Node {
  id: string;
  host: string;
  port: number;
  role: 'master' | 'worker';
  status: 'active' | 'inactive' | 'failed';
  lastHeartbeat: number;
  capabilities: string[];
}

export interface DetectionZone {
  id: string;
  nodes: string[];  // Node IDs
  rules: DetectionRule[];
  alertPolicy: AlertPolicy;
}

export interface DetectionRule {
  id: string;
  type: string;
  conditions: any[];
  severity: 'low' | 'medium' | 'high';
  actions: string[];
}

export interface AlertPolicy {
  minConfidence: number;
  consensusThreshold: number;
  timeWindow: number;
  correlationRules: string[];
}

export class DistributedDetector extends EventEmitter {
  private nodeManager: NodeManager;
  private consensusManager: ConsensusManager;
  private alertCorrelator: AlertCorrelator;
  private anomalyDetector: AnomalyDetector;
  private zones: Map<string, DetectionZone>;
  private localNodeId: string;
  private isRunning: boolean;

  constructor(options: {
    nodeId: string;
    host: string;
    port: number;
    seeds?: string[];
    role?: 'master' | 'worker';
  }) {
    super();
    this.localNodeId = options.nodeId;
    this.zones = new Map();
    this.isRunning = false;

    // Initialize components
    this.nodeManager = new NodeManager({
      localNode: {
        id: options.nodeId,
        host: options.host,
        port: options.port,
        role: options.role || 'worker',
        status: 'inactive',
        lastHeartbeat: Date.now(),
        capabilities: ['anomaly_detection', 'correlation']
      },
      seeds: options.seeds
    });

    this.consensusManager = new ConsensusManager({
      nodeId: options.nodeId,
      nodeManager: this.nodeManager
    });

    this.alertCorrelator = new AlertCorrelator({
      nodeId: options.nodeId,
      consensusManager: this.consensusManager
    });

    this.anomalyDetector = new AnomalyDetector();

    // Set up event handlers
    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      // Initialize components
      await this.anomalyDetector.initialize();
      await this.nodeManager.start();
      await this.consensusManager.start();
      await this.alertCorrelator.start();

      this.isRunning = true;
      this.emit('started');
    } catch (error) {
      throw new Error(`Failed to start distributed detector: ${error}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.nodeManager.stop();
      await this.consensusManager.stop();
      await this.alertCorrelator.stop();
      this.isRunning = false;
      this.emit('stopped');
    } catch (error) {
      throw new Error(`Failed to stop distributed detector: ${error}`);
    }
  }

  async detect(measurements: SecurityMeasurements): Promise<DetectionResult> {
    if (!this.isRunning) {
      throw new Error('Distributed detector is not running');
    }

    try {
      // Local detection
      const localResult = await this.anomalyDetector.detect(measurements);

      // If anomaly detected, initiate distributed detection
      if (localResult.isAnomaly) {
        await this.handleLocalAnomaly(localResult, measurements);
      }

      return localResult;
    } catch (error) {
      throw new Error(`Detection failed: ${error}`);
    }
  }

  private async handleLocalAnomaly(
    result: DetectionResult,
    measurements: SecurityMeasurements
  ): Promise<void> {
    try {
      // Create alert
      const alert = await this.createAlert(result, measurements);

      // Get relevant detection zone
      const zone = this.getRelevantZone(alert);

      if (zone) {
        // Broadcast to zone nodes
        await this.broadcastAlert(alert, zone);

        // Wait for consensus
        const consensus = await this.consensusManager.reachConsensus(alert, zone);

        if (consensus.reached) {
          // Correlate with other alerts
          const correlatedAlerts = await this.alertCorrelator.correlate(alert, zone);

          // Take actions based on correlation results
          await this.handleCorrelatedAlerts(correlatedAlerts, zone);
        }
      }
    } catch (error) {
      this.emit('error', `Failed to handle local anomaly: ${error}`);
    }
  }

  private async createAlert(
    result: DetectionResult,
    measurements: SecurityMeasurements
  ): Promise<AnomalyAlert> {
    return {
      id: `${this.localNodeId}-${Date.now()}`,
      result,
      timestamp: Date.now(),
      context: {
        features: result.modelScores[0],
        measurements
      },
      status: 'new',
      priority: result.severity === 'high' ? 'critical' : result.severity
    };
  }

  private getRelevantZone(alert: AnomalyAlert): DetectionZone | undefined {
    // Find zone based on alert characteristics
    for (const zone of this.zones.values()) {
      if (this.isAlertRelevantToZone(alert, zone)) {
        return zone;
      }
    }
    return undefined;
  }

  private isAlertRelevantToZone(alert: AnomalyAlert, zone: DetectionZone): boolean {
    // Check if alert matches zone rules
    return zone.rules.some(rule => 
      rule.type === alert.result.type && 
      rule.severity === alert.result.severity
    );
  }

  private async broadcastAlert(alert: AnomalyAlert, zone: DetectionZone): Promise<void> {
    const nodes = zone.nodes
      .filter(nodeId => nodeId !== this.localNodeId)
      .map(nodeId => this.nodeManager.getNode(nodeId))
      .filter(node => node && node.status === 'active');

    await Promise.all(
      nodes.map(node => this.nodeManager.sendAlert(node!, alert))
    );
  }

  private async handleCorrelatedAlerts(
    alerts: AnomalyAlert[],
    zone: DetectionZone
  ): Promise<void> {
    if (alerts.length === 0) return;

    // Group alerts by type and severity
    const groups = this.groupAlerts(alerts);

    // Process each group
    for (const [key, groupAlerts] of groups.entries()) {
      const [type, severity] = key.split(':');
      
      // Find matching rules
      const rules = zone.rules.filter(r => 
        r.type === type && r.severity === severity
      );

      // Execute rule actions
      await this.executeRuleActions(rules, groupAlerts);
    }
  }

  private groupAlerts(alerts: AnomalyAlert[]): Map<string, AnomalyAlert[]> {
    const groups = new Map<string, AnomalyAlert[]>();

    for (const alert of alerts) {
      const key = `${alert.result.type}:${alert.result.severity}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(alert);
    }

    return groups;
  }

  private async executeRuleActions(
    rules: DetectionRule[],
    alerts: AnomalyAlert[]
  ): Promise<void> {
    for (const rule of rules) {
      for (const action of rule.actions) {
        try {
          await this.executeAction(action, alerts);
        } catch (error) {
          this.emit('error', `Failed to execute action ${action}: ${error}`);
        }
      }
    }
  }

  private async executeAction(action: string, alerts: AnomalyAlert[]): Promise<void> {
    // Implementation depends on supported actions
    switch (action) {
      case 'notify':
        this.emit('alerts', alerts);
        break;
      case 'block':
        await this.blockThreats(alerts);
        break;
      case 'isolate':
        await this.isolateNodes(alerts);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async blockThreats(alerts: AnomalyAlert[]): Promise<void> {
    // Implementation for blocking threats
    this.emit('blocking_threats', alerts);
  }

  private async isolateNodes(alerts: AnomalyAlert[]): Promise<void> {
    // Implementation for isolating affected nodes
    this.emit('isolating_nodes', alerts);
  }

  private setupEventHandlers(): void {
    // Handle node events
    this.nodeManager.on('node_joined', (node: Node) => {
      this.emit('node_joined', node);
    });

    this.nodeManager.on('node_left', (node: Node) => {
      this.emit('node_left', node);
    });

    this.nodeManager.on('node_failed', (node: Node) => {
      this.emit('node_failed', node);
    });

    // Handle consensus events
    this.consensusManager.on('consensus_reached', (alert: AnomalyAlert) => {
      this.emit('consensus_reached', alert);
    });

    this.consensusManager.on('consensus_failed', (alert: AnomalyAlert) => {
      this.emit('consensus_failed', alert);
    });

    // Handle correlation events
    this.alertCorrelator.on('correlation_found', (alerts: AnomalyAlert[]) => {
      this.emit('correlation_found', alerts);
    });
  }

  // Zone management methods
  async createZone(zone: DetectionZone): Promise<void> {
    if (this.zones.has(zone.id)) {
      throw new Error(`Zone ${zone.id} already exists`);
    }

    // Validate zone configuration
    this.validateZone(zone);

    // Store zone
    this.zones.set(zone.id, zone);

    // Broadcast zone creation to other nodes
    await this.nodeManager.broadcastZone(zone);
  }

  private validateZone(zone: DetectionZone): void {
    if (!zone.id || !zone.nodes || zone.nodes.length === 0) {
      throw new Error('Invalid zone configuration');
    }

    // Validate nodes exist
    for (const nodeId of zone.nodes) {
      if (!this.nodeManager.getNode(nodeId)) {
        throw new Error(`Node ${nodeId} not found`);
      }
    }

    // Validate rules
    if (!zone.rules || zone.rules.length === 0) {
      throw new Error('Zone must have at least one rule');
    }

    // Validate alert policy
    if (!zone.alertPolicy || 
        zone.alertPolicy.minConfidence < 0 || 
        zone.alertPolicy.minConfidence > 1) {
      throw new Error('Invalid alert policy');
    }
  }
} 