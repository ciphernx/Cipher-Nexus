import { EventEmitter } from 'events';
import { NodeManager } from './NodeManager';
import { AnomalyAlert } from '../anomaly/types';
import { DetectionZone } from './DistributedDetector';

interface ConsensusState {
  alertId: string;
  votes: Map<string, boolean>;
  timestamp: number;
  timeoutId: NodeJS.Timeout;
}

interface ConsensusResult {
  reached: boolean;
  agreement: boolean;
  participants: string[];
  timestamp: number;
}

export class ConsensusManager extends EventEmitter {
  private nodeManager: NodeManager;
  private nodeId: string;
  private consensusStates: Map<string, ConsensusState>;
  private readonly CONSENSUS_TIMEOUT = 10000;  // 10 seconds

  constructor(options: {
    nodeId: string;
    nodeManager: NodeManager;
  }) {
    super();
    this.nodeId = options.nodeId;
    this.nodeManager = options.nodeManager;
    this.consensusStates = new Map();
  }

  async start(): Promise<void> {
    // Set up event listeners for node manager
    this.nodeManager.on('alert_received', this.handleAlertVote.bind(this));
    this.emit('started');
  }

  async stop(): Promise<void> {
    // Clear all consensus states and timeouts
    for (const state of this.consensusStates.values()) {
      clearTimeout(state.timeoutId);
    }
    this.consensusStates.clear();
    this.emit('stopped');
  }

  async reachConsensus(
    alert: AnomalyAlert,
    zone: DetectionZone
  ): Promise<ConsensusResult> {
    try {
      // Create consensus state
      const state = this.createConsensusState(alert);
      this.consensusStates.set(alert.id, state);

      // Add own vote
      await this.addVote(alert.id, this.nodeId, true);

      // Broadcast to other nodes in zone
      await this.broadcastVote(alert, zone);

      // Wait for consensus or timeout
      return await this.waitForConsensus(alert.id, zone);
    } catch (error) {
      throw new Error(`Failed to reach consensus: ${error}`);
    }
  }

  private createConsensusState(alert: AnomalyAlert): ConsensusState {
    const state: ConsensusState = {
      alertId: alert.id,
      votes: new Map(),
      timestamp: Date.now(),
      timeoutId: setTimeout(() => {
        this.handleConsensusTimeout(alert.id);
      }, this.CONSENSUS_TIMEOUT)
    };

    return state;
  }

  private async broadcastVote(
    alert: AnomalyAlert,
    zone: DetectionZone
  ): Promise<void> {
    const nodes = zone.nodes
      .filter(nodeId => nodeId !== this.nodeId)
      .map(nodeId => this.nodeManager.getNode(nodeId))
      .filter(node => node && node.status === 'active');

    await Promise.all(
      nodes.map(node => this.nodeManager.sendAlert(node!, alert))
    );
  }

  private async addVote(
    alertId: string,
    nodeId: string,
    vote: boolean
  ): Promise<void> {
    const state = this.consensusStates.get(alertId);
    if (!state) return;

    state.votes.set(nodeId, vote);
    await this.checkConsensus(alertId);
  }

  private async handleAlertVote(
    alert: AnomalyAlert,
    nodeId: string
  ): Promise<void> {
    // Add vote from remote node
    await this.addVote(alert.id, nodeId, true);
  }

  private async waitForConsensus(
    alertId: string,
    zone: DetectionZone
  ): Promise<ConsensusResult> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const state = this.consensusStates.get(alertId);
        if (!state) {
          clearInterval(checkInterval);
          reject(new Error('Consensus state not found'));
          return;
        }

        const result = this.calculateConsensus(state, zone);
        if (result.reached) {
          clearInterval(checkInterval);
          clearTimeout(state.timeoutId);
          this.consensusStates.delete(alertId);
          resolve(result);
        }
      }, 100);  // Check every 100ms
    });
  }

  private calculateConsensus(
    state: ConsensusState,
    zone: DetectionZone
  ): ConsensusResult {
    const activeNodes = zone.nodes
      .map(nodeId => this.nodeManager.getNode(nodeId))
      .filter(node => node && node.status === 'active');

    const requiredVotes = Math.ceil(
      activeNodes.length * zone.alertPolicy.consensusThreshold
    );

    const positiveVotes = Array.from(state.votes.values())
      .filter(vote => vote)
      .length;

    const result: ConsensusResult = {
      reached: state.votes.size >= requiredVotes,
      agreement: positiveVotes >= requiredVotes,
      participants: Array.from(state.votes.keys()),
      timestamp: Date.now()
    };

    return result;
  }

  private async checkConsensus(alertId: string): Promise<void> {
    const state = this.consensusStates.get(alertId);
    if (!state) return;

    // Find relevant zone
    const zone = this.findRelevantZone(alertId);
    if (!zone) return;

    const result = this.calculateConsensus(state, zone);
    if (result.reached) {
      // Emit consensus event
      if (result.agreement) {
        this.emit('consensus_reached', {
          alertId,
          result
        });
      } else {
        this.emit('consensus_failed', {
          alertId,
          result
        });
      }

      // Clean up
      clearTimeout(state.timeoutId);
      this.consensusStates.delete(alertId);
    }
  }

  private findRelevantZone(alertId: string): DetectionZone | undefined {
    // Implementation depends on how zones are stored and managed
    // This should be implemented based on the actual zone management logic
    return undefined;
  }

  private handleConsensusTimeout(alertId: string): void {
    const state = this.consensusStates.get(alertId);
    if (!state) return;

    // Find relevant zone
    const zone = this.findRelevantZone(alertId);
    if (!zone) return;

    // Calculate final result
    const result = this.calculateConsensus(state, zone);

    // Emit timeout event
    this.emit('consensus_timeout', {
      alertId,
      result
    });

    // Clean up
    this.consensusStates.delete(alertId);
  }
} 