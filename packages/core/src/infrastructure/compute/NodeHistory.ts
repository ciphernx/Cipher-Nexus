import { Task } from './types';

interface TaskExecution {
  taskId: string;
  startTime: Date;
  endTime?: Date;
  expectedDuration: number;
  actualDuration?: number;
  status: 'running' | 'completed' | 'failed';
  error?: Error;
}

interface NodeHistoryMetrics {
  completedTasks: number;
  totalTasks: number;
  averageExecutionTime: number;
  expectedExecutionTime: number;
  successRate: number;
  lastUpdated: Date;
}

export class NodeHistory {
  private executions: Map<string, TaskExecution> = new Map();
  private metrics: Map<string, NodeHistoryMetrics> = new Map();
  
  // 保留最近 N 次执行的历史记录
  private readonly maxHistorySize: number;
  
  constructor(maxHistorySize: number = 100) {
    this.maxHistorySize = maxHistorySize;
  }

  recordTaskStart(nodeId: string, task: Task): void {
    const execution: TaskExecution = {
      taskId: task.id,
      startTime: new Date(),
      expectedDuration: task.requirements.expectedDuration,
      status: 'running'
    };

    this.executions.set(this.getExecutionKey(nodeId, task.id), execution);
    this.updateMetrics(nodeId);
  }

  recordTaskCompletion(nodeId: string, taskId: string, status: 'completed' | 'failed', error?: Error): void {
    const key = this.getExecutionKey(nodeId, taskId);
    const execution = this.executions.get(key);
    
    if (execution) {
      execution.endTime = new Date();
      execution.status = status;
      execution.error = error;
      execution.actualDuration = execution.endTime.getTime() - execution.startTime.getTime();
      
      this.executions.set(key, execution);
      this.updateMetrics(nodeId);
      this.pruneHistory(nodeId);
    }
  }

  getNodeMetrics(nodeId: string): NodeHistoryMetrics {
    return this.metrics.get(nodeId) || this.getEmptyMetrics();
  }

  private updateMetrics(nodeId: string): void {
    const nodeExecutions = Array.from(this.executions.entries())
      .filter(([key]) => key.startsWith(nodeId))
      .map(([_, execution]) => execution);

    const completed = nodeExecutions.filter(e => e.status === 'completed');
    const total = nodeExecutions.length;

    const metrics: NodeHistoryMetrics = {
      completedTasks: completed.length,
      totalTasks: total,
      averageExecutionTime: this.calculateAverageExecutionTime(completed),
      expectedExecutionTime: this.calculateAverageExpectedTime(nodeExecutions),
      successRate: total > 0 ? completed.length / total : 0,
      lastUpdated: new Date()
    };

    this.metrics.set(nodeId, metrics);
  }

  private calculateAverageExecutionTime(executions: TaskExecution[]): number {
    if (executions.length === 0) return 0;
    
    const totalTime = executions.reduce((sum, execution) => {
      return sum + (execution.actualDuration || 0);
    }, 0);
    
    return totalTime / executions.length;
  }

  private calculateAverageExpectedTime(executions: TaskExecution[]): number {
    if (executions.length === 0) return 0;
    
    const totalExpected = executions.reduce((sum, execution) => {
      return sum + execution.expectedDuration;
    }, 0);
    
    return totalExpected / executions.length;
  }

  private pruneHistory(nodeId: string): void {
    const nodeExecutions = Array.from(this.executions.entries())
      .filter(([key]) => key.startsWith(nodeId))
      .sort((a, b) => {
        const timeA = a[1].endTime || a[1].startTime;
        const timeB = b[1].endTime || b[1].startTime;
        return timeB.getTime() - timeA.getTime();
      });

    // 只保留最近的 maxHistorySize 条记录
    if (nodeExecutions.length > this.maxHistorySize) {
      const toRemove = nodeExecutions.slice(this.maxHistorySize);
      toRemove.forEach(([key]) => {
        this.executions.delete(key);
      });
    }
  }

  private getExecutionKey(nodeId: string, taskId: string): string {
    return `${nodeId}:${taskId}`;
  }

  private getEmptyMetrics(): NodeHistoryMetrics {
    return {
      completedTasks: 0,
      totalTasks: 0,
      averageExecutionTime: 0,
      expectedExecutionTime: 0,
      successRate: 0,
      lastUpdated: new Date()
    };
  }
} 