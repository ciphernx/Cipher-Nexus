import { EventEmitter } from 'events';
import { DetectionZone, DetectionRule, AlertPolicy, Node } from './DistributedDetector';
import { NodeManager } from './NodeManager';

interface ZoneUpdate {
  type: 'create' | 'update' | 'delete';
  zone: DetectionZone;
  timestamp: number;
}

export class ZoneManager extends EventEmitter {
  private zones: Map<string, DetectionZone>;
  private nodeManager: NodeManager;
  private nodeId: string;
  private updates: ZoneUpdate[];
  private readonly MAX_UPDATES = 1000;

  constructor(options: {
    nodeId: string;
    nodeManager: NodeManager;
  }) {
    super();
    this.nodeId = options.nodeId;
    this.nodeManager = options.nodeManager;
    this.zones = new Map();
    this.updates = [];

    // Set up event handlers
    this.nodeManager.on('zone_received', this.handleZoneUpdate.bind(this));
  }

  async start(): Promise<void> {
    // Initialize zones from other nodes if joining existing network
    await this.syncZones();
    this.emit('started');
  }

  async stop(): Promise<void> {
    this.zones.clear();
    this.updates = [];
    this.emit('stopped');
  }

  async createZone(zone: DetectionZone): Promise<void> {
    // Validate zone configuration
    this.validateZone(zone);

    // Check if zone already exists
    if (this.zones.has(zone.id)) {
      throw new Error(`Zone ${zone.id} already exists`);
    }

    // Store zone
    this.zones.set(zone.id, zone);

    // Record update
    this.recordUpdate({
      type: 'create',
      zone,
      timestamp: Date.now()
    });

    // Broadcast to other nodes
    await this.nodeManager.broadcastZone(zone);

    this.emit('zone_created', zone);
  }

  async updateZone(zone: DetectionZone): Promise<void> {
    // Validate zone configuration
    this.validateZone(zone);

    // Check if zone exists
    if (!this.zones.has(zone.id)) {
      throw new Error(`Zone ${zone.id} not found`);
    }

    // Update zone
    this.zones.set(zone.id, zone);

    // Record update
    this.recordUpdate({
      type: 'update',
      zone,
      timestamp: Date.now()
    });

    // Broadcast to other nodes
    await this.nodeManager.broadcastZone(zone);

    this.emit('zone_updated', zone);
  }

  async deleteZone(zoneId: string): Promise<void> {
    // Check if zone exists
    const zone = this.zones.get(zoneId);
    if (!zone) {
      throw new Error(`Zone ${zoneId} not found`);
    }

    // Delete zone
    this.zones.delete(zoneId);

    // Record update
    this.recordUpdate({
      type: 'delete',
      zone,
      timestamp: Date.now()
    });

    // Broadcast to other nodes
    await this.nodeManager.broadcastZone({
      ...zone,
      nodes: []  // Empty nodes indicates deletion
    });

    this.emit('zone_deleted', zone);
  }

  getZone(zoneId: string): DetectionZone | undefined {
    return this.zones.get(zoneId);
  }

  getAllZones(): DetectionZone[] {
    return Array.from(this.zones.values());
  }

  findZonesForNode(nodeId: string): DetectionZone[] {
    return Array.from(this.zones.values())
      .filter(zone => zone.nodes.includes(nodeId));
  }

  findZonesByRule(ruleType: string, severity?: string): DetectionZone[] {
    return Array.from(this.zones.values())
      .filter(zone => zone.rules.some(rule => 
        rule.type === ruleType && 
        (!severity || rule.severity === severity)
      ));
  }

  private validateZone(zone: DetectionZone): void {
    if (!zone.id || !zone.nodes || zone.nodes.length === 0) {
      throw new Error('Invalid zone configuration: missing required fields');
    }

    // Validate nodes exist
    for (const nodeId of zone.nodes) {
      if (!this.nodeManager.getNode(nodeId)) {
        throw new Error(`Invalid zone configuration: node ${nodeId} not found`);
      }
    }

    // Validate rules
    if (!zone.rules || zone.rules.length === 0) {
      throw new Error('Invalid zone configuration: no rules defined');
    }

    for (const rule of zone.rules) {
      this.validateRule(rule);
    }

    // Validate alert policy
    this.validateAlertPolicy(zone.alertPolicy);
  }

  private validateRule(rule: DetectionRule): void {
    if (!rule.id || !rule.type) {
      throw new Error('Invalid rule configuration: missing required fields');
    }

    if (!['low', 'medium', 'high'].includes(rule.severity)) {
      throw new Error('Invalid rule configuration: invalid severity level');
    }

    if (!rule.actions || rule.actions.length === 0) {
      throw new Error('Invalid rule configuration: no actions defined');
    }

    // Validate action types
    const validActions = ['notify', 'block', 'isolate'];
    for (const action of rule.actions) {
      if (!validActions.includes(action)) {
        throw new Error(`Invalid rule configuration: unknown action ${action}`);
      }
    }
  }

  private validateAlertPolicy(policy: AlertPolicy): void {
    if (policy.minConfidence < 0 || policy.minConfidence > 1) {
      throw new Error('Invalid alert policy: minConfidence must be between 0 and 1');
    }

    if (policy.consensusThreshold < 0 || policy.consensusThreshold > 1) {
      throw new Error('Invalid alert policy: consensusThreshold must be between 0 and 1');
    }

    if (policy.timeWindow <= 0) {
      throw new Error('Invalid alert policy: timeWindow must be positive');
    }
  }

  private async syncZones(): Promise<void> {
    // Get active nodes
    const nodes = Array.from(this.nodeManager.getAllNodes().values())
      .filter(node => node.status === 'active' && node.id !== this.nodeId);

    // Request zones from each node
    for (const node of nodes) {
      try {
        const zones = await this.nodeManager.requestZones(node);
        for (const zone of zones) {
          if (!this.zones.has(zone.id)) {
            this.zones.set(zone.id, zone);
          }
        }
      } catch (error) {
        this.emit('error', `Failed to sync zones from node ${node.id}: ${error}`);
      }
    }
  }

  private handleZoneUpdate(zone: DetectionZone): void {
    try {
      if (zone.nodes.length === 0) {
        // Zone deletion
        this.zones.delete(zone.id);
        this.emit('zone_deleted', zone);
      } else if (this.zones.has(zone.id)) {
        // Zone update
        this.zones.set(zone.id, zone);
        this.emit('zone_updated', zone);
      } else {
        // New zone
        this.zones.set(zone.id, zone);
        this.emit('zone_created', zone);
      }
    } catch (error) {
      this.emit('error', `Failed to handle zone update: ${error}`);
    }
  }

  private recordUpdate(update: ZoneUpdate): void {
    this.updates.push(update);
    if (this.updates.length > this.MAX_UPDATES) {
      this.updates = this.updates.slice(-this.MAX_UPDATES);
    }
  }
} 