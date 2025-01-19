import { EventEmitter } from 'events';
import { ComputeNode } from './compute/ComputeNode';
import { TaskScheduler } from './compute/TaskScheduler';
import { ResourceManager } from './compute/ResourceManager';
import { TaskSpecification, ComputeResources, NodeConfiguration } from './compute/types';

export class InfrastructureManager extends EventEmitter {
  private taskScheduler: TaskScheduler;
  private resourceManager: ResourceManager;
  private nodes: Map<string, ComputeNode> = new Map();

  constructor(
    private readonly config: {
      scheduling: {
        maxRetries: number;
        queueTimeout: number;
        schedulingInterval: number;
      };
      resources: {
        overallocationThreshold: number;
        reservationTimeout: number;
        metricsRetention: number;
      };
    }
  ) {
    super();
    this.taskScheduler = new TaskScheduler(config.scheduling);
    this.resourceManager = new ResourceManager(config.resources);
    
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    // Initialize components
    this.emit('initializing');
    
    try {
      await this.discoverNodes();
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async addNode(nodeId: string, resources: ComputeResources, config: NodeConfiguration): Promise<void> {
    try {
      // Create and initialize node
      const node = new ComputeNode(nodeId, resources, config);
      await node.initialize();

      // Register with managers
      this.nodes.set(nodeId, node);
      this.taskScheduler.registerNode(node);
      this.resourceManager.registerNode(nodeId, resources);

      this.emit('nodeAdded', { nodeId, resources });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async removeNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }

    try {
      // Stop node and cleanup
      await node.stop();
      
      // Unregister from managers
      this.taskScheduler.unregisterNode(nodeId);
      this.resourceManager.unregisterNode(nodeId);
      this.nodes.delete(nodeId);

      this.emit('nodeRemoved', { nodeId });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async submitTask(task: TaskSpecification): Promise<string> {
    try {
      // Validate resource requirements
      const nodeId = await this.resourceManager.allocateResources(
        task.id,
        task.requirements
      );

      if (!nodeId) {
        throw new Error('No suitable node found for task');
      }

      // Submit to scheduler
      const taskId = await this.taskScheduler.submitTask(task);
      
      this.emit('taskSubmitted', { taskId, nodeId });
      return taskId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  getTaskStatus(taskId: string): any {
    return this.taskScheduler.getTaskStatus(taskId);
  }

  getNodeStatus(nodeId: string): any {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return null;
    }

    return {
      status: node.getStatus(),
      metrics: node.getMetrics(),
      utilization: this.resourceManager.getNodeUtilization(nodeId)
    };
  }

  private setupEventHandlers(): void {
    // Task Scheduler events
    this.taskScheduler.on('taskScheduled', (event) => {
      this.emit('taskScheduled', event);
    });

    this.taskScheduler.on('taskCompleted', (event) => {
      this.resourceManager.releaseResources(event.taskId, event.nodeId);
      this.emit('taskCompleted', event);
    });

    this.taskScheduler.on('taskFailed', (event) => {
      this.resourceManager.releaseResources(event.taskId, event.nodeId);
      this.emit('taskFailed', event);
    });

    // Resource Manager events
    this.resourceManager.on('resourceAlert', (event) => {
      this.emit('resourceAlert', event);
    });

    // Node events
    this.nodes.forEach(node => {
      node.on('error', (error) => {
        this.emit('nodeError', { nodeId: node.nodeId, error });
      });

      node.on('metrics', (metrics) => {
        this.resourceManager.updateNodeMetrics(node.nodeId, metrics);
      });
    });
  }

  private async discoverNodes(): Promise<void> {
    // Implement node discovery logic
    // This could involve:
    // - Reading from configuration
    // - Service discovery
    // - Cloud provider API integration
  }

  async getSystemStatus(): Promise<{
    nodes: number;
    tasks: {
      pending: number;
      running: number;
      completed: number;
      failed: number;
    };
    resources: {
      totalCpu: number;
      totalMemory: number;
      totalGpu: number;
      utilizationCpu: number;
      utilizationMemory: number;
      utilizationGpu: number;
    };
  }> {
    const tasks = Array.from(this.taskScheduler.getTasks().values());
    const nodes = Array.from(this.nodes.values());

    const taskStats = {
      pending: tasks.filter(t => t.status === 'PENDING').length,
      running: tasks.filter(t => t.status === 'RUNNING').length,
      completed: tasks.filter(t => t.status === 'COMPLETED').length,
      failed: tasks.filter(t => t.status === 'FAILED').length
    };

    const resourceStats = nodes.reduce(
      (stats, node) => {
        const resources = node.getResources();
        const utilization = this.resourceManager.getNodeUtilization(node.nodeId);

        return {
          totalCpu: stats.totalCpu + resources.cpu.cores,
          totalMemory: stats.totalMemory + resources.memory.total,
          totalGpu: stats.totalGpu + (resources.gpu?.count || 0),
          utilizationCpu: stats.utilizationCpu + (utilization?.cpu || 0),
          utilizationMemory: stats.utilizationMemory + (utilization?.memory || 0),
          utilizationGpu: stats.utilizationGpu + (utilization?.gpu || 0)
        };
      },
      {
        totalCpu: 0,
        totalMemory: 0,
        totalGpu: 0,
        utilizationCpu: 0,
        utilizationMemory: 0,
        utilizationGpu: 0
      }
    );

    return {
      nodes: nodes.length,
      tasks: taskStats,
      resources: resourceStats
    };
  }
} 