import { EventEmitter } from 'events';
import { Node, DetectionZone } from './DistributedDetector';
import { NodeManager } from './NodeManager';
import { RetryManager } from './RetryManager';

interface RecoveryOptions {
  maxRecoveryAttempts: number;
  recoveryInterval: number;
  healthCheckInterval: number;
  stateValidationInterval: number;
}

interface RecoveryState {
  failedNodes: Map<string, {
    node: Node;
    lastAttempt: number;
    attempts: number;
    error: Error;
  }>;
  inconsistentZones: Map<string, {
    zone: DetectionZone;
    lastAttempt: number;
    attempts: number;
  }>;
  isRecovering: boolean;
}

export class RecoveryManager extends EventEmitter {
  private readonly defaultOptions: RecoveryOptions = {
    maxRecoveryAttempts: 5,
    recoveryInterval: 60000,    // 1 minute
    healthCheckInterval: 30000, // 30 seconds
    stateValidationInterval: 300000 // 5 minutes
  };

  private options: RecoveryOptions;
  private state: RecoveryState;
  private nodeManager: NodeManager;
  private retryManager: RetryManager;
  private healthCheckInterval: NodeJS.Timeout | null;
  private stateValidationInterval: NodeJS.Timeout | null;

  constructor(
    nodeManager: NodeManager,
    retryManager: RetryManager,
    options: Partial<RecoveryOptions> = {}
  ) {
    super();
    this.options = { ...this.defaultOptions, ...options };
    this.nodeManager = nodeManager;
    this.retryManager = retryManager;
    this.state = {
      failedNodes: new Map(),
      inconsistentZones: new Map(),
      isRecovering: false
    };
    this.healthCheckInterval = null;
    this.stateValidationInterval = null;

    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    this.startHealthCheck();
    this.startStateValidation();
    this.emit('started');
  }

  async stop(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.stateValidationInterval) {
      clearInterval(this.stateValidationInterval);
      this.stateValidationInterval = null;
    }
    this.emit('stopped');
  }

  private setupEventHandlers(): void {
    this.nodeManager.on('node_failed', this.handleNodeFailure.bind(this));
    this.nodeManager.on('zone_inconsistency', this.handleZoneInconsistency.bind(this));
    
    this.retryManager.on('retry_exhausted', this.handleRetryExhaustion.bind(this));
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.options.healthCheckInterval
    );
  }

  private startStateValidation(): void {
    this.stateValidationInterval = setInterval(
      () => this.validateState(),
      this.options.stateValidationInterval
    );
  }

  private async performHealthCheck(): Promise<void> {
    if (this.state.isRecovering) return;

    try {
      // Check failed nodes
      for (const [nodeId, info] of this.state.failedNodes) {
        if (Date.now() - info.lastAttempt >= this.options.recoveryInterval) {
          await this.attemptNodeRecovery(nodeId, info);
        }
      }

      // Check inconsistent zones
      for (const [zoneId, info] of this.state.inconsistentZones) {
        if (Date.now() - info.lastAttempt >= this.options.recoveryInterval) {
          await this.attemptZoneRecovery(zoneId, info);
        }
      }
    } catch (error) {
      this.emit('health_check_error', error);
    }
  }

  private async validateState(): Promise<void> {
    if (this.state.isRecovering) return;

    try {
      this.state.isRecovering = true;
      
      // Get all active nodes
      const activeNodes = Array.from(this.nodeManager.getAllNodes().values())
        .filter(node => node.status === 'active');

      // Validate zone consistency across nodes
      for (const node of activeNodes) {
        try {
          const zones = await this.nodeManager.requestZones(node);
          await this.validateZones(node, zones);
        } catch (error) {
          this.emit('validation_error', { node, error });
        }
      }
    } finally {
      this.state.isRecovering = false;
    }
  }

  private async validateZones(node: Node, zones: DetectionZone[]): Promise<void> {
    const localZones = await this.getLocalZones();
    
    // Compare zones
    for (const zone of zones) {
      const localZone = localZones.find(z => z.id === zone.id);
      if (!localZone) {
        // Missing zone
        this.handleZoneInconsistency(zone);
      } else if (!this.areZonesEqual(zone, localZone)) {
        // Inconsistent zone
        this.handleZoneInconsistency(zone);
      }
    }

    // Check for extra zones
    for (const localZone of localZones) {
      if (!zones.some(z => z.id === localZone.id)) {
        this.handleZoneInconsistency(localZone);
      }
    }
  }

  private async attemptNodeRecovery(
    nodeId: string,
    info: { node: Node; attempts: number; lastAttempt: number; error: Error }
  ): Promise<void> {
    if (info.attempts >= this.options.maxRecoveryAttempts) {
      this.emit('node_recovery_failed', {
        node: info.node,
        attempts: info.attempts,
        error: info.error
      });
      this.state.failedNodes.delete(nodeId);
      return;
    }

    try {
      // Attempt to reconnect
      await this.retryManager.retry(
        async () => {
          const client = await this.nodeManager.reconnect(info.node);
          if (client) {
            this.state.failedNodes.delete(nodeId);
            this.emit('node_recovered', info.node);
          }
        },
        `recover_node_${nodeId}`
      );
    } catch (error) {
      info.attempts++;
      info.lastAttempt = Date.now();
      info.error = error as Error;
      this.emit('node_recovery_attempt_failed', {
        node: info.node,
        attempt: info.attempts,
        error
      });
    }
  }

  private async attemptZoneRecovery(
    zoneId: string,
    info: { zone: DetectionZone; attempts: number; lastAttempt: number }
  ): Promise<void> {
    if (info.attempts >= this.options.maxRecoveryAttempts) {
      this.emit('zone_recovery_failed', {
        zone: info.zone,
        attempts: info.attempts
      });
      this.state.inconsistentZones.delete(zoneId);
      return;
    }

    try {
      // Get majority state
      const majorityState = await this.getMajorityZoneState(info.zone);
      if (majorityState) {
        await this.nodeManager.broadcastZone(majorityState);
        this.state.inconsistentZones.delete(zoneId);
        this.emit('zone_recovered', majorityState);
      }
    } catch (error) {
      info.attempts++;
      info.lastAttempt = Date.now();
      this.emit('zone_recovery_attempt_failed', {
        zone: info.zone,
        attempt: info.attempts,
        error
      });
    }
  }

  private handleNodeFailure(node: Node): void {
    if (!this.state.failedNodes.has(node.id)) {
      this.state.failedNodes.set(node.id, {
        node,
        lastAttempt: Date.now(),
        attempts: 0,
        error: new Error('Initial failure')
      });
    }
  }

  private handleZoneInconsistency(zone: DetectionZone): void {
    if (!this.state.inconsistentZones.has(zone.id)) {
      this.state.inconsistentZones.set(zone.id, {
        zone,
        lastAttempt: Date.now(),
        attempts: 0
      });
    }
  }

  private handleRetryExhaustion({ context, error, attempts }: any): void {
    this.emit('recovery_exhausted', { context, error, attempts });
  }

  private async getLocalZones(): Promise<DetectionZone[]> {
    return new Promise((resolve) => {
      this.nodeManager.emit('get_zones', resolve);
    });
  }

  private async getMajorityZoneState(zone: DetectionZone): Promise<DetectionZone | null> {
    const nodes = Array.from(this.nodeManager.getAllNodes().values())
      .filter(node => node.status === 'active');

    const zoneStates = await Promise.all(
      nodes.map(async node => {
        try {
          const zones = await this.nodeManager.requestZones(node);
          return zones.find(z => z.id === zone.id);
        } catch (error) {
          return null;
        }
      })
    );

    // Group identical states
    const stateGroups = new Map<string, { state: DetectionZone; count: number }>();
    zoneStates.forEach(state => {
      if (state) {
        const key = this.getZoneStateKey(state);
        const group = stateGroups.get(key) || { state, count: 0 };
        group.count++;
        stateGroups.set(key, group);
      }
    });

    // Find majority
    let majorityState: DetectionZone | null = null;
    let maxCount = 0;
    for (const { state, count } of stateGroups.values()) {
      if (count > maxCount) {
        maxCount = count;
        majorityState = state;
      }
    }

    return majorityState;
  }

  private getZoneStateKey(zone: DetectionZone): string {
    return JSON.stringify({
      nodes: zone.nodes.sort(),
      rules: zone.rules.sort((a, b) => a.id.localeCompare(b.id)),
      alertPolicy: zone.alertPolicy
    });
  }

  private areZonesEqual(zone1: DetectionZone, zone2: DetectionZone): boolean {
    return this.getZoneStateKey(zone1) === this.getZoneStateKey(zone2);
  }
} 