import { EventEmitter } from 'events';
import { TaskSpecification, NodeStatus } from './types';
import { ComputeNode } from './ComputeNode';

interface Task extends TaskSpecification {
  status: 'PENDING' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  assignedNode?: string;
  startTime?: Date;
  endTime?: Date;
  error?: Error;
}

export class TaskScheduler extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private nodes: Map<string, ComputeNode> = new Map();
  private taskQueue: string[] = [];

  constructor(private readonly config: {
    maxRetries: number;
    queueTimeout: number;
    schedulingInterval: number;
  }) {
    super();
    this.startScheduling();
  }

  registerNode(node: ComputeNode): void {
    this.nodes.set(node.nodeId, node);
    
    node.on('metrics', (metrics) => {
      this.updateNodeMetrics(node.nodeId, metrics);
    });

    node.on('error', (error) => {
      this.handleNodeError(node.nodeId, error);
    });

    this.emit('nodeRegistered', { nodeId: node.nodeId });
  }

  unregisterNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.removeAllListeners();
      this.nodes.delete(nodeId);
      this.reassignTasks(nodeId);
      this.emit('nodeUnregistered', { nodeId });
    }
  }

  async submitTask(task: TaskSpecification): Promise<string> {
    const newTask: Task = {
      ...task,
      status: 'PENDING'
    };

    this.tasks.set(task.id, newTask);
    this.taskQueue.push(task.id);
    this.emit('taskSubmitted', { taskId: task.id });

    return task.id;
  }

  getTaskStatus(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  private startScheduling(): void {
    setInterval(() => {
      this.scheduleTasks();
    }, this.config.schedulingInterval);
  }

  private async scheduleTasks(): Promise<void> {
    const availableNodes = Array.from(this.nodes.values())
      .filter(node => node.getStatus() === NodeStatus.RUNNING);

    if (availableNodes.length === 0 || this.taskQueue.length === 0) {
      return;
    }

    for (const taskId of this.taskQueue) {
      const task = this.tasks.get(taskId);
      if (!task || task.status !== 'PENDING') {
        continue;
      }

      const suitableNode = this.findSuitableNode(task, availableNodes);
      if (suitableNode) {
        await this.assignTask(task, suitableNode);
      }
    }

    // Clean up completed tasks
    this.taskQueue = this.taskQueue.filter(taskId => {
      const task = this.tasks.get(taskId);
      return task && task.status === 'PENDING';
    });
  }

  private findSuitableNode(task: Task, nodes: ComputeNode[]): ComputeNode | undefined {
    // Implement node selection logic based on:
    // - Resource requirements
    // - Current load
    // - Historical performance
    // - Network proximity
    return nodes[0]; // Placeholder implementation
  }

  private async assignTask(task: Task, node: ComputeNode): Promise<void> {
    try {
      task.status = 'SCHEDULED';
      task.assignedNode = node.nodeId;
      task.startTime = new Date();

      // Implement actual task assignment logic
      this.emit('taskScheduled', {
        taskId: task.id,
        nodeId: node.nodeId
      });

    } catch (error) {
      task.status = 'FAILED';
      task.error = error as Error;
      this.emit('taskFailed', {
        taskId: task.id,
        error
      });
    }
  }

  private async reassignTasks(failedNodeId: string): Promise<void> {
    const affectedTasks = Array.from(this.tasks.values())
      .filter(task => task.assignedNode === failedNodeId && task.status === 'RUNNING');

    for (const task of affectedTasks) {
      task.status = 'PENDING';
      task.assignedNode = undefined;
      this.taskQueue.push(task.id);
      
      this.emit('taskRequeued', {
        taskId: task.id,
        previousNode: failedNodeId
      });
    }
  }

  private updateNodeMetrics(nodeId: string, metrics: any): void {
    // Update node metrics and potentially trigger task reassignment
    this.emit('nodeMetricsUpdated', {
      nodeId,
      metrics
    });
  }

  private handleNodeError(nodeId: string, error: Error): void {
    this.emit('nodeError', {
      nodeId,
      error
    });
    
    // Implement error handling logic
    this.reassignTasks(nodeId);
  }
} 