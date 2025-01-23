import { EventEmitter } from 'events';
import { TaskSpecification, NodeStatus, TaskPriority, TaskHistory } from './types';
import { ComputeNode } from './ComputeNode';
import { NodeHistory } from './NodeHistory';

interface Task extends TaskSpecification {
  status: 'PENDING' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  assignedNode?: string;
  startTime?: Date;
  endTime?: Date;
  error?: Error;
}

interface NodeScore {
  nodeId: string;
  totalScore: number;
  scores: {
    resourceMatch: number;    // 0-1: How well the node's resources match task requirements
    loadBalance: number;      // 0-1: Current load level of the node
    performance: number;      // 0-1: Historical performance score
    networkQuality: number;   // 0-1: Network conditions score
    healthStatus: number;     // 0-1: Node health status score
  };
}

export class TaskScheduler extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private nodes: Map<string, ComputeNode> = new Map();
  private taskQueue: string[] = [];
  private nodeHistory: NodeHistory;
  private nodePerformanceHistory: Map<string, TaskHistory[]> = new Map();
  private readonly weights = {
    resourceMatch: 0.3,
    loadBalance: 0.2,
    performance: 0.2,
    networkQuality: 0.15,
    healthStatus: 0.15
  };

  constructor(private readonly config: {
    maxRetries: number;
    queueTimeout: number;
    schedulingInterval: number;
    maxHistorySize?: number;
    historyWindowSize: number;      // Number of historical tasks to consider
    networkLatencyThreshold: number; // Maximum acceptable latency (ms)
    loadBalanceThreshold: number;    // Desired maximum load (0-1)
    minHealthScore: number;          // Minimum health score to consider a node (0-1)
  }) {
    super();
    this.nodeHistory = new NodeHistory(config.maxHistorySize || 100);
    this.startScheduling();
  }

  registerNode(node: ComputeNode): void {
    this.nodes.set(node.nodeId, node);
    
    // Initialize performance history
    this.nodePerformanceHistory.set(node.nodeId, []);
    
    node.on('metrics', (metrics) => {
      this.updateNodeMetrics(node.nodeId, metrics);
    });

    node.on('error', (error) => {
      this.handleNodeError(node.nodeId, error);
    });

    // Listen for task completion events
    node.on('taskCompleted', (event) => {
      this.updateNodePerformance(node.nodeId, {
        taskId: event.taskId,
        success: true,
        duration: event.duration,
        metrics: event.metrics
      });
    });
    
    node.on('taskFailed', (event) => {
      this.updateNodePerformance(node.nodeId, {
        taskId: event.taskId,
        success: false,
        duration: event.duration,
        error: event.error
      });
    });

    this.emit('nodeRegistered', { nodeId: node.nodeId });
  }

  unregisterNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.removeAllListeners();
      this.nodes.delete(nodeId);
      this.reassignTasks(nodeId);
      this.nodePerformanceHistory.delete(nodeId);
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

      const suitableNode = await this.findSuitableNode(task);
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

  private async findSuitableNode(task: Task): Promise<ComputeNode | null> {
    const eligibleNodes = Array.from(this.nodes.values()).filter(node => 
      this.isNodeEligible(node, task)
    );

    if (eligibleNodes.length === 0) {
      return null;
    }

    // Score all eligible nodes
    const nodeScores = await Promise.all(
      eligibleNodes.map(node => this.scoreNode(node, task))
    );

    // Sort nodes by total score
    nodeScores.sort((a, b) => b.totalScore - a.totalScore);

    // Return the node with the highest score
    return this.nodes.get(nodeScores[0].nodeId) || null;
  }

  private isNodeEligible(node: ComputeNode, task: Task): boolean {
    // Check node status
    if (node.getStatus() !== NodeStatus.RUNNING) {
      return false;
    }

    // Check basic resource requirements
    const resources = node.getResources();
    const metrics = node.getMetrics();

    // CPU check
    const availableCpu = 1 - metrics.cpuUsage;
    if (task.requirements.minCpu > availableCpu) {
      return false;
    }

    // Memory check
    const availableMemory = resources.memory.total * (1 - metrics.memoryUsage);
    if (task.requirements.minMemory > availableMemory) {
      return false;
    }

    // GPU check (if required)
    if (task.requirements.minGpu) {
      if (!resources.gpu || resources.gpu.count === 0) {
        return false;
      }
    }

    // Health check
    const healthScore = this.calculateHealthScore(node);
    if (healthScore < this.config.minHealthScore) {
      return false;
    }

    return true;
  }

  private async scoreNode(node: ComputeNode, task: Task): Promise<NodeScore> {
    const resourceMatchScore = this.calculateResourceMatchScore(node, task);
    const loadBalanceScore = this.calculateLoadBalanceScore(node);
    const performanceScore = this.calculatePerformanceScore(node.nodeId, task);
    const networkQualityScore = await this.calculateNetworkQualityScore(node);
    const healthScore = this.calculateHealthScore(node);

    const totalScore = 
      this.weights.resourceMatch * resourceMatchScore +
      this.weights.loadBalance * loadBalanceScore +
      this.weights.performance * performanceScore +
      this.weights.networkQuality * networkQualityScore +
      this.weights.healthStatus * healthScore;

    return {
      nodeId: node.nodeId,
      totalScore,
      scores: {
        resourceMatch: resourceMatchScore,
        loadBalance: loadBalanceScore,
        performance: performanceScore,
        networkQuality: networkQualityScore,
        healthStatus: healthScore
      }
    };
  }

  private calculateResourceMatchScore(node: ComputeNode, task: Task): number {
    const resources = node.getResources();
    const metrics = node.getMetrics();
    let score = 0;

    // CPU score
    const availableCpu = 1 - metrics.cpuUsage;
    const cpuScore = Math.min(availableCpu / task.requirements.minCpu, 2);
    score += cpuScore * 0.4; // CPU weight: 40%

    // Memory score
    const availableMemory = resources.memory.total * (1 - metrics.memoryUsage);
    const memoryScore = Math.min(availableMemory / task.requirements.minMemory, 2);
    score += memoryScore * 0.4; // Memory weight: 40%

    // GPU score (if required)
    if (task.requirements.minGpu && resources.gpu) {
      const gpuScore = Math.min(resources.gpu.count, 2);
      score += gpuScore * 0.2; // GPU weight: 20%
    } else if (!task.requirements.minGpu) {
      score += 0.2; // Full GPU score if GPU not required
    }

    return Math.min(score, 1);
  }

  private calculateLoadBalanceScore(node: ComputeNode): number {
    const metrics = node.getMetrics();
    const currentLoad = metrics.cpuUsage; // Consider CPU usage as primary load indicator
    
    // Prefer nodes with load under the threshold
    if (currentLoad <= this.config.loadBalanceThreshold) {
      return 1 - (currentLoad / this.config.loadBalanceThreshold);
    } else {
      return 0.5 * (1 - ((currentLoad - this.config.loadBalanceThreshold) / 
                         (1 - this.config.loadBalanceThreshold)));
    }
  }

  private calculatePerformanceScore(nodeId: string, task: Task): number {
    const history = this.nodePerformanceHistory.get(nodeId) || [];
    if (history.length === 0) {
      return 0.5; // Default score for nodes without history
    }

    // Filter relevant history (same task type)
    const relevantHistory = history
      .filter(h => h.type === task.type)
      .slice(-this.config.historyWindowSize);

    if (relevantHistory.length === 0) {
      return 0.5;
    }

    // Calculate success rate
    const successRate = relevantHistory.filter(h => h.status === 'COMPLETED').length / 
                       relevantHistory.length;

    // Calculate average duration ratio (actual/expected)
    const durationScores = relevantHistory
      .filter(h => h.duration !== undefined)
      .map(h => {
        const ratio = h.duration! / task.requirements.expectedDuration;
        return ratio <= 1 ? 1 : 1 / ratio;
      });

    const avgDurationScore = durationScores.length > 0
      ? durationScores.reduce((a, b) => a + b, 0) / durationScores.length
      : 0.5;

    // Combine scores (70% success rate, 30% duration score)
    return (successRate * 0.7) + (avgDurationScore * 0.3);
  }

  private async calculateNetworkQualityScore(node: ComputeNode): Promise<number> {
    const metrics = node.getMetrics();
    const networkIO = metrics.networkIO;

    // Calculate bandwidth utilization
    const resources = node.getResources();
    const bandwidthUtilization = (networkIO.in + networkIO.out) / 
                                (resources.network.bandwidth * 1024 * 1024 / 8); // Convert Mbps to bytes/s

    // Measure latency (implement actual latency check in production)
    const latency = await this.measureNodeLatency(node);
    const latencyScore = Math.max(0, 1 - (latency / this.config.networkLatencyThreshold));

    // Combine scores (50% bandwidth, 50% latency)
    return (Math.max(0, 1 - bandwidthUtilization) * 0.5) + (latencyScore * 0.5);
  }

  private calculateHealthScore(node: ComputeNode): number {
    const metrics = node.getMetrics();
    let score = 1;

    // CPU health (penalize if usage is too high)
    if (metrics.cpuUsage > 0.9) {
      score *= 0.5;
    }

    // Memory health
    if (metrics.memoryUsage > 0.9) {
      score *= 0.5;
    }

    // Consider recent errors or warnings
    // This would need to be implemented based on your error tracking mechanism
    
    return score;
  }

  private async measureNodeLatency(node: ComputeNode): Promise<number> {
    // In production, implement actual latency measurement
    // For now, return a mock value
    return 50; // Mock 50ms latency
  }

  private updateNodePerformance(nodeId: string, performance: {
    taskId: string;
    success: boolean;
    duration: number;
    metrics?: any;
    error?: any;
  }): void {
    const history = this.nodePerformanceHistory.get(nodeId) || [];
    
    // Add new performance record
    history.push({
      taskId: performance.taskId,
      type: 'UNKNOWN', // This should be retrieved from task history
      status: performance.success ? 'COMPLETED' : 'FAILED',
      priority: TaskPriority.MEDIUM, // This should be retrieved from task history
      startTime: new Date(Date.now() - performance.duration),
      endTime: new Date(),
      duration: performance.duration,
      resourceUsage: {
        cpu: performance.metrics?.avgCpuUsage || 0,
        memory: performance.metrics?.peakMemoryUsage || 0,
        gpu: performance.metrics?.avgGpuUsage
      },
      error: performance.error?.message
    });

    // Maintain history window size
    if (history.length > this.config.historyWindowSize) {
      history.shift();
    }

    this.nodePerformanceHistory.set(nodeId, history);
  }

  private async assignTask(task: Task, node: ComputeNode): Promise<void> {
    try {
      task.status = 'SCHEDULED';
      task.assignedNode = node.nodeId;
      task.startTime = new Date();

      // 记录任务开始
      this.nodeHistory.recordTaskStart(node.nodeId, task);

      // 实现实际的任务分配逻辑
      await node.executeTask(task);
      
      task.status = 'RUNNING';
      this.emit('taskScheduled', {
        taskId: task.id,
        nodeId: node.nodeId
      });

    } catch (error) {
      task.status = 'FAILED';
      task.error = error as Error;
      task.endTime = new Date();
      
      // 记录任务失败
      this.nodeHistory.recordTaskCompletion(node.nodeId, task.id, 'failed', error as Error);
      
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

  // 添加任务完成处理方法
  handleTaskCompletion(nodeId: string, taskId: string, success: boolean, error?: Error): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.endTime = new Date();
    task.status = success ? 'COMPLETED' : 'FAILED';
    task.error = error;

    // 记录任务完成
    this.nodeHistory.recordTaskCompletion(
      nodeId,
      taskId,
      success ? 'completed' : 'failed',
      error
    );

    // 发出任务完成事件
    this.emit(success ? 'taskCompleted' : 'taskFailed', {
      taskId,
      nodeId,
      duration: task.endTime.getTime() - (task.startTime?.getTime() || 0),
      error
    });
  }
} 