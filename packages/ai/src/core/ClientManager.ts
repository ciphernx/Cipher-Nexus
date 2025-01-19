import { EventEmitter } from 'events';
import { ClientState } from '../types/federated';

interface ClientMetrics {
  trainingTime: number[];
  accuracy: number[];
  loss: number[];
  participationRate: number;
  lastParticipation: Date;
}

export class ClientManager extends EventEmitter {
  private clients: Map<string, ClientState> = new Map();
  private metrics: Map<string, ClientMetrics> = new Map();
  private readonly HISTORY_SIZE = 10;

  constructor(private selectionStrategy: 'Random' | 'PowerOfChoice' | 'Reputation') {
    super();
  }

  async registerClient(client: ClientState): Promise<void> {
    try {
      this.clients.set(client.clientId, client);
      this.metrics.set(client.clientId, this.initializeMetrics());
      
      this.emit('clientRegistered', { clientId: client.clientId });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async selectClients(minClients: number): Promise<ClientState[]> {
    try {
      const availableClients = Array.from(this.clients.values()).filter(
        client => client.status === 'IDLE'
      );

      if (availableClients.length < minClients) {
        throw new Error('Insufficient available clients');
      }

      let selectedClients: ClientState[];
      switch (this.selectionStrategy) {
        case 'Random':
          selectedClients = this.randomSelection(availableClients, minClients);
          break;
        case 'PowerOfChoice':
          selectedClients = this.powerOfChoiceSelection(availableClients, minClients);
          break;
        case 'Reputation':
          selectedClients = this.reputationBasedSelection(availableClients, minClients);
          break;
        default:
          throw new Error(`Unknown selection strategy: ${this.selectionStrategy}`);
      }

      // Update client status
      for (const client of selectedClients) {
        client.status = 'TRAINING';
        this.emit('clientStatusChanged', {
          clientId: client.clientId,
          status: 'TRAINING'
        });
      }

      return selectedClients;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async updateClientReputation(
    clientId: string,
    metrics: { loss: number; accuracy: number; trainingDuration: number }
  ): Promise<void> {
    const client = this.clients.get(clientId);
    const clientMetrics = this.metrics.get(clientId);

    if (!client || !clientMetrics) {
      throw new Error(`Client ${clientId} not found`);
    }

    try {
      // Update metrics history
      clientMetrics.trainingTime.push(metrics.trainingDuration);
      clientMetrics.accuracy.push(metrics.accuracy);
      clientMetrics.loss.push(metrics.loss);

      // Maintain history size
      if (clientMetrics.trainingTime.length > this.HISTORY_SIZE) {
        clientMetrics.trainingTime.shift();
        clientMetrics.accuracy.shift();
        clientMetrics.loss.shift();
      }

      // Update participation metrics
      clientMetrics.participationRate = this.computeParticipationRate(clientId);
      clientMetrics.lastParticipation = new Date();

      // Update client reputation
      client.reputation = this.computeReputation(clientMetrics);
      
      // Update client status
      client.status = 'IDLE';
      
      this.emit('clientStatusChanged', {
        clientId,
        status: 'IDLE',
        reputation: client.reputation
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  getClientState(clientId: string): ClientState | undefined {
    return this.clients.get(clientId);
  }

  getClientMetrics(clientId: string): ClientMetrics | undefined {
    return this.metrics.get(clientId);
  }

  private randomSelection(clients: ClientState[], count: number): ClientState[] {
    // Simple random selection
    return this.shuffle(clients).slice(0, count);
  }

  private powerOfChoiceSelection(clients: ClientState[], count: number): ClientState[] {
    const selected: ClientState[] = [];
    const remaining = [...clients];

    while (selected.length < count && remaining.length >= 2) {
      // Randomly select two clients
      const candidates = this.shuffle(remaining).slice(0, 2);
      
      // Choose the one with better metrics
      const better = this.compareCandidates(candidates[0], candidates[1]);
      selected.push(better);
      
      // Remove selected client from remaining pool
      const index = remaining.findIndex(c => c.clientId === better.clientId);
      remaining.splice(index, 1);
    }

    // If we still need more clients, add remaining ones
    while (selected.length < count && remaining.length > 0) {
      selected.push(remaining.pop()!);
    }

    return selected;
  }

  private reputationBasedSelection(clients: ClientState[], count: number): ClientState[] {
    // Sort by reputation and select top performers
    return [...clients]
      .sort((a, b) => b.reputation - a.reputation)
      .slice(0, count);
  }

  private compareCandidates(a: ClientState, b: ClientState): ClientState {
    const metricsA = this.metrics.get(a.clientId)!;
    const metricsB = this.metrics.get(b.clientId)!;

    // Compare based on multiple factors
    const scoreA = this.computeSelectionScore(a, metricsA);
    const scoreB = this.computeSelectionScore(b, metricsB);

    return scoreA >= scoreB ? a : b;
  }

  private computeSelectionScore(client: ClientState, metrics: ClientMetrics): number {
    // Compute weighted score based on:
    // - Historical accuracy
    // - Training time
    // - Participation rate
    // - Computational capability
    // - Current reputation

    const avgAccuracy = this.average(metrics.accuracy);
    const avgTrainingTime = this.average(metrics.trainingTime);
    const normalizedTime = avgTrainingTime ? 1 / avgTrainingTime : 0;

    return (
      0.3 * avgAccuracy +
      0.2 * normalizedTime +
      0.2 * metrics.participationRate +
      0.15 * (client.computeCapability.flops / 1e9) + // Normalize FLOPS
      0.15 * client.reputation
    );
  }

  private computeReputation(metrics: ClientMetrics): number {
    // Compute reputation score based on:
    // - Average accuracy
    // - Training time stability
    // - Participation rate
    // - Recent performance trend

    const avgAccuracy = this.average(metrics.accuracy);
    const timeStability = 1 - this.standardDeviation(metrics.trainingTime);
    const recentPerformance = this.computeRecentTrend(metrics.accuracy);

    return (
      0.4 * avgAccuracy +
      0.2 * timeStability +
      0.2 * metrics.participationRate +
      0.2 * recentPerformance
    );
  }

  private computeParticipationRate(clientId: string): number {
    // Implement participation rate calculation
    // This could be based on historical participation records
    return 1.0; // Placeholder
  }

  private computeRecentTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    // Compute trend using simple linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Normalize slope to [-1, 1] range
    return Math.tanh(slope);
  }

  private initializeMetrics(): ClientMetrics {
    return {
      trainingTime: [],
      accuracy: [],
      loss: [],
      participationRate: 0,
      lastParticipation: new Date()
    };
  }

  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  private average(values: number[]): number {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private standardDeviation(values: number[]): number {
    const avg = this.average(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(this.average(squareDiffs));
  }
} 