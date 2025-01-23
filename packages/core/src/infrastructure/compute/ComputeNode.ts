import { EventEmitter } from 'events';
import { 
  NodeStatus, 
  ComputeResources, 
  NodeMetrics, 
  Task, 
  TaskPriority,
  TaskStatus,
  ResourceReservation,
  TaskHistory
} from './types';
import { ResourceMonitor, ResourceMetrics } from './ResourceMonitor';

interface ActiveTask {
  task: Task;
  startTime: Date;
  status: TaskStatus;
  resources: {
    cpu: number;
    memory: number;
    gpu?: number;
  };
  metrics: {
    cpuUsage: number[];
    memoryUsage: number;
    gpuUsage?: number[];
  };
  controller?: AbortController;
}

interface TaskQueue {
  [TaskPriority.LOW]: Task[];
  [TaskPriority.MEDIUM]: Task[];
  [TaskPriority.HIGH]: Task[];
  [TaskPriority.CRITICAL]: Task[];
}

export class ComputeNode extends EventEmitter {
  private status: NodeStatus = NodeStatus.INITIALIZING;
  private metrics: NodeMetrics = {
    cpuUsage: 0,
    memoryUsage: 0,
    networkIO: { in: 0, out: 0 },
    lastUpdated: new Date()
  };
  private activeTasks: Map<string, ActiveTask> = new Map();
  private taskQueue: TaskQueue = {
    [TaskPriority.LOW]: [],
    [TaskPriority.MEDIUM]: [],
    [TaskPriority.HIGH]: [],
    [TaskPriority.CRITICAL]: []
  };
  private resourceReservations: ResourceReservation[] = [];
  private taskHistory: Map<string, TaskHistory> = new Map();
  private resourceMonitor: ResourceMonitor;

  constructor(
    readonly nodeId: string,
    private readonly resources: ComputeResources,
    private readonly config: {
      metricsInterval: number;
      healthCheckInterval: number;
      maxConcurrentTasks: number;
      historyRetentionDays: number;
    }
  ) {
    super();
    this.resourceMonitor = new ResourceMonitor(config.metricsInterval);
    
    // Listen for resource monitoring events
    this.resourceMonitor.on('metrics:updated', this.handleMetricsUpdate.bind(this));
    this.resourceMonitor.on('error', this.handleMonitorError.bind(this));

    // Start task queue processing
    setInterval(() => this.processTaskQueue(), 1000);
    
    // Start resource reservation cleanup
    setInterval(() => this.cleanupExpiredReservations(), 60000);
    
    // Start history cleanup
    setInterval(() => this.cleanupOldHistory(), 24 * 60 * 60 * 1000);
  }

  async queueTask(task: Task): Promise<void> {
    // Add task to appropriate priority queue
    this.taskQueue[task.priority].push(task);
    
    // Sort tasks within the priority level by creation time
    this.taskQueue[task.priority].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    // Record initial history entry
    this.recordTaskHistory({
      taskId: task.id,
      type: task.type,
      status: TaskStatus.QUEUED,
      priority: task.priority,
      startTime: new Date(),
      resourceUsage: {
        cpu: 0,
        memory: 0
      }
    });
    
    this.emit('taskQueued', {
      taskId: task.id,
      priority: task.priority
    });
  }

  async reserveResources(reservation: ResourceReservation): Promise<boolean> {
    // Check if resources are available for the requested time period
    if (!this.canReserveResources(reservation)) {
      return false;
    }
    
    this.resourceReservations.push(reservation);
    this.emit('resourcesReserved', reservation);
    return true;
  }

  async cancelTask(taskId: string): Promise<void> {
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask) {
      // Cancel running task
      if (activeTask.controller) {
        activeTask.controller.abort();
      }
      await this.stopTask(activeTask.task);
      this.activeTasks.delete(taskId);
      
      // Update task history
      this.updateTaskHistory(taskId, {
        status: TaskStatus.CANCELLED,
        endTime: new Date()
      });
    } else {
      // Remove from queue if not yet started
      for (const priority of Object.values(TaskPriority)) {
        const index = this.taskQueue[priority].findIndex(task => task.id === taskId);
        if (index !== -1) {
          this.taskQueue[priority].splice(index, 1);
          this.updateTaskHistory(taskId, {
            status: TaskStatus.CANCELLED,
            endTime: new Date()
          });
          break;
        }
      }
    }
    
    this.emit('taskCancelled', { taskId });
  }

  async pauseTask(taskId: string): Promise<void> {
    const activeTask = this.activeTasks.get(taskId);
    if (!activeTask) {
      throw new Error('Task not found or not running');
    }
    
    // Implement task-specific pause mechanism
    await this.pauseTaskExecution(activeTask);
    activeTask.status = TaskStatus.PAUSED;
    
    this.updateTaskHistory(taskId, {
      status: TaskStatus.PAUSED
    });
    
    this.emit('taskPaused', { taskId });
  }

  async resumeTask(taskId: string): Promise<void> {
    const activeTask = this.activeTasks.get(taskId);
    if (!activeTask || activeTask.status !== TaskStatus.PAUSED) {
      throw new Error('Task not found or not paused');
    }
    
    // Implement task-specific resume mechanism
    await this.resumeTaskExecution(activeTask);
    activeTask.status = TaskStatus.RUNNING;
    
    this.updateTaskHistory(taskId, {
      status: TaskStatus.RUNNING
    });
    
    this.emit('taskResumed', { taskId });
  }

  getTaskHistory(taskId: string): TaskHistory | undefined {
    return this.taskHistory.get(taskId);
  }

  getAllTaskHistory(): TaskHistory[] {
    return Array.from(this.taskHistory.values());
  }

  private async processTaskQueue(): Promise<void> {
    if (this.status !== NodeStatus.RUNNING) {
      return;
    }

    // Process tasks from highest to lowest priority
    for (let priority = TaskPriority.CRITICAL; priority >= TaskPriority.LOW; priority--) {
      const tasks = this.taskQueue[priority];
      
      while (tasks.length > 0 && this.activeTasks.size < this.config.maxConcurrentTasks) {
        const task = tasks[0];
        
        // Check if resources are available and not reserved
        if (this.hasAvailableResources(task.requirements) && !this.isResourceReserved(task.requirements)) {
          tasks.shift(); // Remove task from queue
          await this.executeTask(task).catch(error => {
            this.emit('error', {
              taskId: task.id,
              error: `Task execution failed: ${error.message}`
            });
          });
        } else {
          // If we can't run the highest priority task, we can't run any lower priority tasks
          break;
        }
      }
    }
  }

  private async executeTask(task: Task): Promise<void> {
    if (this.status !== NodeStatus.RUNNING) {
      throw new Error('Node not in RUNNING state');
    }

    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      throw new Error('Maximum concurrent tasks reached');
    }

    // Check resource availability and reservations
    if (!this.hasAvailableResources(task.requirements) || this.isResourceReserved(task.requirements)) {
      throw new Error('Insufficient resources or resources reserved');
    }

    const controller = new AbortController();
    const activeTask: ActiveTask = {
      task,
      startTime: new Date(),
      status: TaskStatus.RUNNING,
      resources: {
        cpu: task.requirements.minCpu,
        memory: task.requirements.minMemory,
        gpu: task.requirements.minGpu
      },
      metrics: {
        cpuUsage: [],
        memoryUsage: 0,
        gpuUsage: task.requirements.minGpu ? [] : undefined
      },
      controller
    };

    this.activeTasks.set(task.id, activeTask);
    
    try {
      // Update task history
      this.updateTaskHistory(task.id, {
        status: TaskStatus.RUNNING,
        startTime: activeTask.startTime
      });
      
      // Execute the task
      await this.runTask(task, controller.signal);
      
      // Calculate final metrics
      const avgCpuUsage = activeTask.metrics.cpuUsage.reduce((a, b) => a + b, 0) / activeTask.metrics.cpuUsage.length;
      const avgGpuUsage = activeTask.metrics.gpuUsage 
        ? activeTask.metrics.gpuUsage.reduce((a, b) => a + b, 0) / activeTask.metrics.gpuUsage.length 
        : undefined;
      
      const endTime = new Date();
      const duration = endTime.getTime() - activeTask.startTime.getTime();
      
      // Update task history with completion details
      this.updateTaskHistory(task.id, {
        status: TaskStatus.COMPLETED,
        endTime,
        duration,
        resourceUsage: {
          cpu: avgCpuUsage,
          memory: activeTask.metrics.memoryUsage,
          gpu: avgGpuUsage
        }
      });
      
      this.emit('taskCompleted', {
        taskId: task.id,
        success: true,
        duration,
        metrics: {
          avgCpuUsage,
          peakMemoryUsage: activeTask.metrics.memoryUsage,
          avgGpuUsage
        }
      });
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - activeTask.startTime.getTime();
      
      // Update task history with failure details
      this.updateTaskHistory(task.id, {
        status: TaskStatus.FAILED,
        endTime,
        duration,
        error: error.message,
        resourceUsage: {
          cpu: activeTask.metrics.cpuUsage.reduce((a, b) => a + b, 0) / activeTask.metrics.cpuUsage.length,
          memory: activeTask.metrics.memoryUsage,
          gpu: activeTask.metrics.gpuUsage 
            ? activeTask.metrics.gpuUsage.reduce((a, b) => a + b, 0) / activeTask.metrics.gpuUsage.length 
            : undefined
        }
      });
      
      this.emit('taskFailed', {
        taskId: task.id,
        error,
        duration
      });
      throw error;
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  private canReserveResources(reservation: ResourceReservation): boolean {
    // Check if resources are available for the entire reservation period
    const conflictingReservations = this.resourceReservations.filter(existing => {
      return (
        (reservation.startTime <= existing.endTime && reservation.endTime >= existing.startTime) &&
        (
          existing.resources.cpu + reservation.resources.cpu > 1 ||
          existing.resources.memory + reservation.resources.memory > this.resources.memory.total ||
          (existing.resources.gpu && reservation.resources.gpu && 
           existing.resources.gpu + reservation.resources.gpu > 1)
        )
      );
    });
    
    return conflictingReservations.length === 0;
  }

  private isResourceReserved(requirements: {
    minCpu: number;
    minMemory: number;
    minGpu?: number;
  }): boolean {
    const now = new Date();
    const activeReservations = this.resourceReservations.filter(
      reservation => reservation.startTime <= now && reservation.endTime >= now
    );
    
    const totalReservedCpu = activeReservations.reduce((sum, res) => sum + res.resources.cpu, 0);
    const totalReservedMemory = activeReservations.reduce((sum, res) => sum + res.resources.memory, 0);
    const totalReservedGpu = activeReservations.reduce((sum, res) => sum + (res.resources.gpu || 0), 0);
    
    return (
      totalReservedCpu + requirements.minCpu > 1 ||
      totalReservedMemory + requirements.minMemory > this.resources.memory.total ||
      (requirements.minGpu && totalReservedGpu + requirements.minGpu > 1)
    );
  }

  private cleanupExpiredReservations(): void {
    const now = new Date();
    this.resourceReservations = this.resourceReservations.filter(
      reservation => reservation.endTime > now
    );
  }

  private cleanupOldHistory(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.historyRetentionDays);
    
    for (const [taskId, history] of this.taskHistory.entries()) {
      if (history.endTime && history.endTime < cutoffDate) {
        this.taskHistory.delete(taskId);
      }
    }
  }

  private recordTaskHistory(history: TaskHistory): void {
    this.taskHistory.set(history.taskId, history);
  }

  private updateTaskHistory(taskId: string, update: Partial<TaskHistory>): void {
    const existing = this.taskHistory.get(taskId);
    if (existing) {
      this.taskHistory.set(taskId, { ...existing, ...update });
    }
  }

  private async pauseTaskExecution(activeTask: ActiveTask): Promise<void> {
    // Implementation depends on the specific task execution environment
    // For example, if using containers, this would pause the container
    return Promise.resolve();
  }

  private async resumeTaskExecution(activeTask: ActiveTask): Promise<void> {
    // Implementation depends on the specific task execution environment
    // For example, if using containers, this would resume the container
    return Promise.resolve();
  }

  getResources(): ComputeResources {
    return { ...this.resources };
  }

  getMetrics(): NodeMetrics {
    return { ...this.metrics };
  }

  getStatus(): NodeStatus {
    return this.status;
  }

  async stop(): Promise<void> {
    try {
      this.status = NodeStatus.STOPPING;
      
      // Stop all active tasks
      await this.stopActiveTasks();
      
      // Stop resource monitoring
      this.resourceMonitor.stop();
      
      // Clean up resources
      await this.cleanup();
      
      this.status = NodeStatus.STOPPED;
      this.emit('stopped', { nodeId: this.nodeId });
    } catch (error) {
      this.status = NodeStatus.ERROR;
      this.emit('error', error);
      throw error;
    }
  }

  private async validateResources(): Promise<void> {
    const validation = await this.validateSystemResources();
    if (!validation.success) {
      throw new Error(`Resource validation failed: ${validation.reason}`);
    }
  }

  private handleMetricsUpdate(resourceMetrics: ResourceMetrics): void {
    // Update node metrics
    this.metrics = {
      cpuUsage: resourceMetrics.cpu.usage,
      memoryUsage: resourceMetrics.memory.usage,
      networkIO: {
        in: resourceMetrics.network.rx_bytes,
        out: resourceMetrics.network.tx_bytes
      },
      lastUpdated: new Date()
    };

    // Emit metrics update event
    this.emit('metrics', {
      ...this.metrics,
      detailed: resourceMetrics
    });

    // Check resource health status
    this.checkResourceHealth(resourceMetrics);
  }

  private handleMonitorError(error: Error): void {
    this.emit('error', {
      type: 'MONITOR_ERROR',
      error
    });
  }

  private checkResourceHealth(metrics: ResourceMetrics): void {
    const warnings = [];

    // Check CPU usage
    if (metrics.cpu.usage > 0.9) {
      warnings.push('High CPU usage');
    }

    // Check memory usage
    if (metrics.memory.usage > 0.9) {
      warnings.push('High memory usage');
    }

    // Check GPU usage
    if (metrics.gpu) {
      metrics.gpu.forEach((gpu, index) => {
        if (gpu.usage > 0.9) {
          warnings.push(`High GPU ${index} usage`);
        }
        if (gpu.temperature > 80) {
          warnings.push(`High GPU ${index} temperature`);
        }
      });
    }

    // Check disk usage
    if (metrics.disk.usage > 0.9) {
      warnings.push('High disk usage');
    }

    if (warnings.length > 0) {
      this.emit('resourceWarning', {
        nodeId: this.nodeId,
        warnings
      });
    }
  }

  private async validateSystemResources(): Promise<{ success: boolean; reason?: string }> {
    try {
      const metrics = this.resourceMonitor.getMetrics();

      // Validate CPU availability
      if (metrics.cpu.usage > 0.9) {
        return { success: false, reason: 'CPU utilization too high' };
      }

      // Validate memory availability
      if (metrics.memory.usage > 0.9) {
        return { success: false, reason: 'Memory utilization too high' };
      }

      // If GPU is configured, validate GPU availability
      if (this.resources.gpu && metrics.gpu) {
        const gpuOverloaded = metrics.gpu.some(gpu => gpu.usage > 0.9);
        if (gpuOverloaded) {
          return { success: false, reason: 'GPU utilization too high' };
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, reason: `Validation error: ${error.message}` };
    }
  }

  private async cleanup(): Promise<void> {
    try {
      // Stop resource monitoring
      this.resourceMonitor.stop();

      // Stop all active tasks
      await this.stopActiveTasks();

      // Reset state
      this.activeTasks.clear();
      this.metrics = {
        cpuUsage: 0,
        memoryUsage: 0,
        networkIO: { in: 0, out: 0 },
        lastUpdated: new Date()
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async stopActiveTasks(): Promise<void> {
    const stopPromises = Array.from(this.activeTasks.values()).map(async (activeTask) => {
      try {
        await this.stopTask(activeTask.task);
      } catch (error) {
        this.emit('error', {
          taskId: activeTask.task.id,
          error: `Failed to stop task: ${error.message}`
        });
      }
    });

    await Promise.all(stopPromises);
  }

  private hasAvailableResources(requirements: {
    minCpu: number;
    minMemory: number;
    minGpu?: number;
  }): boolean {
    const metrics = this.resourceMonitor.getMetrics();
    
    // Check CPU availability
    const availableCpu = 1 - metrics.cpu.usage;
    if (requirements.minCpu > availableCpu) {
      return false;
    }

    // Check memory availability
    const availableMemory = metrics.memory.free;
    if (requirements.minMemory > availableMemory) {
      return false;
    }

    // Check GPU availability (if required)
    if (requirements.minGpu && metrics.gpu) {
      const availableGpus = metrics.gpu.filter(gpu => 1 - gpu.usage >= requirements.minGpu!);
      if (availableGpus.length === 0) {
        return false;
      }
    }

    return true;
  }

  private async runTask(task: Task, signal: AbortSignal): Promise<void> {
    // In actual implementation, this would interact with container runtime or other execution environment
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Task execution timed out'));
      }, task.requirements.expectedDuration);

      const abortHandler = () => {
        clearTimeout(timeout);
        reject(new Error('Task execution aborted'));
      };

      signal.addEventListener('abort', abortHandler);

      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          resolve();
        } else {
          reject(new Error('Task execution failed'));
        }
      }, task.requirements.expectedDuration);
    });
  }

  private async stopTask(task: Task): Promise<void> {
    // In actual implementation, this would interact with container runtime or other execution environment
    return Promise.resolve();
  }
} 