import { EventEmitter } from 'events';
import { Node, DetectionZone } from './DistributedDetector';
import { AnomalyAlert } from '../anomaly/types';
import * as grpc from '@grpc/grpc-js';
import { NodeService } from './proto/node_grpc_pb';
import { 
  JoinRequest, 
  JoinResponse,
  HeartbeatRequest,
  AlertMessage,
  ZoneMessage,
  GetZonesRequest,
  GetZonesResponse
} from './proto/node_pb';
import { RetryManager } from './RetryManager';

export class NodeManager extends EventEmitter {
  private nodes: Map<string, Node>;
  private localNode: Node;
  private server: grpc.Server;
  private clients: Map<string, any>;
  private heartbeatInterval: NodeJS.Timeout | null;
  private retryManager: RetryManager;
  private readonly HEARTBEAT_INTERVAL = 5000;  // 5 seconds
  private readonly HEARTBEAT_TIMEOUT = 15000;  // 15 seconds

  constructor(options: {
    localNode: Node;
    seeds?: string[];
    retryOptions?: {
      maxAttempts?: number;
      initialDelay?: number;
      maxDelay?: number;
      backoffFactor?: number;
      timeout?: number;
    };
  }) {
    super();
    this.localNode = options.localNode;
    this.nodes = new Map([[this.localNode.id, this.localNode]]);
    this.clients = new Map();
    this.server = new grpc.Server();
    this.heartbeatInterval = null;
    this.retryManager = new RetryManager(options.retryOptions);

    // Set up retry event handlers
    this.setupRetryEventHandlers();

    // Initialize gRPC server
    this.initializeServer();

    // Connect to seed nodes
    if (options.seeds) {
      this.connectToSeeds(options.seeds);
    }
  }

  private setupRetryEventHandlers(): void {
    this.retryManager.on('retry_failed', ({ context, error, attempt, nextDelay }) => {
      this.emit('operation_retry', {
        context,
        error,
        attempt,
        nextDelay
      });
    });

    this.retryManager.on('retry_exhausted', ({ context, error, attempts }) => {
      this.emit('operation_failed', {
        context,
        error,
        attempts
      });
    });
  }

  async start(): Promise<void> {
    try {
      // Start gRPC server
      await this.startServer();

      // Start heartbeat mechanism
      this.startHeartbeat();

      // Set local node as active
      this.localNode.status = 'active';
      this.emit('started');
    } catch (error) {
      throw new Error(`Failed to start node manager: ${error}`);
    }
  }

  async stop(): Promise<void> {
    try {
      // Stop heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Close all client connections
      for (const client of this.clients.values()) {
        client.close();
      }
      this.clients.clear();

      // Stop server
      await new Promise<void>((resolve, reject) => {
        this.server.tryShutdown((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      this.emit('stopped');
    } catch (error) {
      throw new Error(`Failed to stop node manager: ${error}`);
    }
  }

  getNode(nodeId: string): Node | undefined {
    return this.nodes.get(nodeId);
  }

  async sendAlert(node: Node, alert: AnomalyAlert): Promise<void> {
    return this.retryManager.retry(
      async () => {
        const client = this.getOrCreateClient(node);
        const message = this.createAlertMessage(alert);
        
        await new Promise<void>((resolve, reject) => {
          client.sendAlert(message, (error: any) => {
            if (error) reject(error);
            else resolve();
          });
        });
      },
      `send_alert_to_${node.id}`
    );
  }

  async broadcastZone(zone: DetectionZone): Promise<void> {
    const message = this.createZoneMessage(zone);
    const promises: Promise<void>[] = [];

    for (const node of this.nodes.values()) {
      if (node.id !== this.localNode.id && node.status === 'active') {
        promises.push(
          this.retryManager.retry(
            async () => this.sendZone(node, message),
            `broadcast_zone_to_${node.id}`
          )
        );
      }
    }

    await Promise.allSettled(promises);
  }

  private async sendZone(node: Node, message: ZoneMessage): Promise<void> {
    const client = this.getOrCreateClient(node);
    
    await new Promise<void>((resolve, reject) => {
      client.sendZone(message, (error: any) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  private initializeServer(): void {
    // Add service handlers
    this.server.addService(NodeService.service, {
      join: this.handleJoin.bind(this),
      heartbeat: this.handleHeartbeat.bind(this),
      sendAlert: this.handleAlert.bind(this),
      sendZone: this.handleZone.bind(this),
      getZones: this.handleGetZones.bind(this)
    });
  }

  private async startServer(): Promise<void> {
    const address = `${this.localNode.host}:${this.localNode.port}`;
    
    await new Promise<void>((resolve, reject) => {
      this.server.bindAsync(
        address,
        grpc.ServerCredentials.createInsecure(),
        (error, port) => {
          if (error) reject(error);
          else {
            this.server.start();
            resolve();
          }
        }
      );
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeats();
      this.checkHeartbeats();
    }, this.HEARTBEAT_INTERVAL);
  }

  private async sendHeartbeats(): Promise<void> {
    const message = new HeartbeatRequest()
      .setNodeId(this.localNode.id)
      .setTimestamp(Date.now());

    for (const node of this.nodes.values()) {
      if (node.id !== this.localNode.id && node.status === 'active') {
        try {
          const client = this.getOrCreateClient(node);
          await new Promise<void>((resolve, reject) => {
            client.heartbeat(message, (error: any) => {
              if (error) reject(error);
              else resolve();
            });
          });
        } catch (error) {
          this.handleNodeFailure(node, error);
        }
      }
    }
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    for (const node of this.nodes.values()) {
      if (node.id !== this.localNode.id && 
          node.status === 'active' && 
          now - node.lastHeartbeat > this.HEARTBEAT_TIMEOUT) {
        this.handleNodeFailure(node, 'Heartbeat timeout');
      }
    }
  }

  private handleNodeFailure(node: Node, error: any): void {
    node.status = 'failed';
    this.emit('node_failed', node);
    
    // Close client connection
    const client = this.clients.get(node.id);
    if (client) {
      client.close();
      this.clients.delete(node.id);
    }
  }

  private async connectToSeeds(seeds: string[]): Promise<void> {
    for (const seed of seeds) {
      try {
        const [host, portStr] = seed.split(':');
        const port = parseInt(portStr, 10);
        
        if (host === this.localNode.host && port === this.localNode.port) {
          continue;  // Skip self
        }

        const client = this.createClient(host, port);
        const request = new JoinRequest()
          .setNode(this.createNodeMessage(this.localNode));

        const response = await new Promise<JoinResponse>((resolve, reject) => {
          client.join(request, (error: any, response: JoinResponse) => {
            if (error) reject(error);
            else resolve(response);
          });
        });

        // Process response
        this.handleJoinResponse(response);
      } catch (error) {
        this.emit('error', `Failed to connect to seed ${seed}: ${error}`);
      }
    }
  }

  private createClient(host: string, port: number): any {
    const address = `${host}:${port}`;
    return new NodeService(
      address,
      grpc.credentials.createInsecure()
    );
  }

  private getOrCreateClient(node: Node): any {
    let client = this.clients.get(node.id);
    if (!client) {
      client = this.createClient(node.host, node.port);
      this.clients.set(node.id, client);
    }
    return client;
  }

  private handleJoin(call: any, callback: any): void {
    try {
      const request: JoinRequest = call.request;
      const node = this.parseNodeMessage(request.getNode());

      // Add node to network
      this.addNode(node);

      // Create response with current network state
      const response = new JoinResponse();
      for (const node of this.nodes.values()) {
        response.addNodes(this.createNodeMessage(node));
      }

      callback(null, response);
    } catch (error) {
      callback(error);
    }
  }

  private handleHeartbeat(call: any, callback: any): void {
    try {
      const request: HeartbeatRequest = call.request;
      const nodeId = request.getNodeId();
      const timestamp = request.getTimestamp();

      const node = this.nodes.get(nodeId);
      if (node) {
        node.lastHeartbeat = timestamp;
        node.status = 'active';
      }

      callback(null, {});
    } catch (error) {
      callback(error);
    }
  }

  private handleAlert(call: any, callback: any): void {
    try {
      const message: AlertMessage = call.request;
      const alert = this.parseAlertMessage(message);
      
      this.emit('alert_received', alert);
      callback(null, {});
    } catch (error) {
      callback(error);
    }
  }

  private handleZone(call: any, callback: any): void {
    try {
      const message: ZoneMessage = call.request;
      const zone = this.parseZoneMessage(message);
      
      this.emit('zone_received', zone);
      callback(null, {});
    } catch (error) {
      callback(error);
    }
  }

  private handleJoinResponse(response: JoinResponse): void {
    const nodes = response.getNodesList().map(msg => this.parseNodeMessage(msg));
    for (const node of nodes) {
      this.addNode(node);
    }
  }

  private addNode(node: Node): void {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, node);
      this.emit('node_joined', node);
    }
  }

  private createNodeMessage(node: Node): any {
    // Implementation depends on protobuf definition
    return {
      id: node.id,
      host: node.host,
      port: node.port,
      role: node.role,
      status: node.status,
      lastHeartbeat: node.lastHeartbeat,
      capabilities: node.capabilities
    };
  }

  private parseNodeMessage(message: any): Node {
    return {
      id: message.id,
      host: message.host,
      port: message.port,
      role: message.role,
      status: message.status,
      lastHeartbeat: message.lastHeartbeat,
      capabilities: message.capabilities
    };
  }

  private createAlertMessage(alert: AnomalyAlert): AlertMessage {
    // Implementation depends on protobuf definition
    const message = new AlertMessage();
    // Set message fields
    return message;
  }

  private parseAlertMessage(message: AlertMessage): AnomalyAlert {
    // Implementation depends on protobuf definition
    return {
      id: '',
      result: {
        isAnomaly: false,
        ensembleScore: 0,
        type: '',
        severity: 'low',
        explanation: '',
        timestamp: 0,
        modelScores: [],
        confidence: 0
      },
      timestamp: 0,
      context: {
        features: {},
        measurements: {}
      },
      status: 'new',
      priority: 'low'
    };
  }

  private createZoneMessage(zone: DetectionZone): ZoneMessage {
    const message = new ZoneMessage();
    
    message.setId(zone.id);
    message.setNodesList(zone.nodes);
    
    // Set rules
    const rules = zone.rules.map(rule => {
      const ruleMsg = new ZoneMessage.Rule();
      ruleMsg.setId(rule.id);
      ruleMsg.setType(rule.type);
      ruleMsg.setSeverity(rule.severity);
      ruleMsg.setActionsList(rule.actions);
      ruleMsg.setConditionsList(rule.conditions);
      return ruleMsg;
    });
    message.setRulesList(rules);
    
    // Set alert policy
    const policy = new ZoneMessage.AlertPolicy();
    policy.setMinConfidence(zone.alertPolicy.minConfidence);
    policy.setConsensusThreshold(zone.alertPolicy.consensusThreshold);
    policy.setTimeWindow(zone.alertPolicy.timeWindow);
    policy.setCorrelationRulesList(zone.alertPolicy.correlationRules);
    message.setAlertPolicy(policy);

    return message;
  }

  private parseZoneMessage(message: ZoneMessage): DetectionZone {
    const rules = message.getRulesList().map(ruleMsg => ({
      id: ruleMsg.getId(),
      type: ruleMsg.getType(),
      severity: ruleMsg.getSeverity() as 'low' | 'medium' | 'high',
      actions: ruleMsg.getActionsList(),
      conditions: ruleMsg.getConditionsList()
    }));

    const policy = message.getAlertPolicy();
    
    return {
      id: message.getId(),
      nodes: message.getNodesList(),
      rules,
      alertPolicy: {
        minConfidence: policy.getMinConfidence(),
        consensusThreshold: policy.getConsensusThreshold(),
        timeWindow: policy.getTimeWindow(),
        correlationRules: policy.getCorrelationRulesList()
      }
    };
  }

  getAllNodes(): Map<string, Node> {
    return this.nodes;
  }

  async requestZones(node: Node): Promise<DetectionZone[]> {
    return this.retryManager.retry(
      async () => {
        const client = this.getOrCreateClient(node);
        const request = new GetZonesRequest()
          .setNodeId(this.localNode.id)
          .setTimestamp(Date.now());

        const response = await new Promise<GetZonesResponse>((resolve, reject) => {
          client.getZones(request, (error: any, response: GetZonesResponse) => {
            if (error) reject(error);
            else resolve(response);
          });
        });

        return response.getZonesList().map(msg => this.parseZoneMessage(msg));
      },
      `request_zones_from_${node.id}`
    );
  }

  private handleGetZones(call: any, callback: any): void {
    try {
      const request: GetZonesRequest = call.request;
      const nodeId = request.getNodeId();
      const timestamp = request.getTimestamp();

      // Create response with all zones
      const response = new GetZonesResponse();
      this.emit('get_zones_requested', { nodeId, timestamp });

      // Add zones to response
      this.emit('get_zones', (zones: DetectionZone[]) => {
        zones.forEach(zone => {
          response.addZones(this.createZoneMessage(zone));
        });
        callback(null, response);
      });
    } catch (error) {
      callback(error);
    }
  }

  async reconnect(node: Node): Promise<any> {
    try {
      // Close existing client if any
      const existingClient = this.clients.get(node.id);
      if (existingClient) {
        existingClient.close();
        this.clients.delete(node.id);
      }

      // Create new client
      const client = this.createClient(node.host, node.port);

      // Test connection with join request
      const request = new JoinRequest()
        .setNode(this.createNodeMessage(this.localNode));

      const response = await new Promise<JoinResponse>((resolve, reject) => {
        client.join(request, (error: any, response: JoinResponse) => {
          if (error) reject(error);
          else resolve(response);
        });
      });

      // Update node status and store client
      node.status = 'active';
      node.lastHeartbeat = Date.now();
      this.clients.set(node.id, client);

      // Process response
      this.handleJoinResponse(response);

      this.emit('node_reconnected', node);
      return client;
    } catch (error) {
      throw new Error(`Failed to reconnect to node ${node.id}: ${error}`);
    }
  }
} 