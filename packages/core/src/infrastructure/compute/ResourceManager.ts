import { EventEmitter } from 'events';
import { ComputeResources, NodeMetrics } from './types';

interface ResourceAllocation {
  nodeId: string;
  allocated: {
    cpu: number;
    memory: number;
    gpu?: number;
  };
  taskId: string;
  timestamp: Date;
}

export class ResourceManager extends EventEmitter {
  private nodeResources: Map<string, ComputeResources> = new Map();
  private allocations: Map<string, ResourceAllocation[]> = new Map();
  private metrics: Map<string, NodeMetrics> = new Map();

  constructor(private readonly config: {
    overallocationThreshold: number;
    reservationTimeout: number;
    metricsRetention: number;
  }) {
    super();
  }

  registerNode(nodeId: string, resources: ComputeResources): void {
    this.nodeResources.set(nodeId, resources);
    this.allocations.set(nodeId, []);
    this.emit('nodeRegistered', { nodeId, resources });
  }

  unregisterNode(nodeId: string): void {
    this.nodeResources.delete(nodeId);
    this.allocations.delete(nodeId);
    this.metrics.delete(nodeId);
    this.emit('nodeUnregistered', { nodeId });
  }

  updateNodeMetrics(nodeId: string, metrics: NodeMetrics): void {
    this.metrics.set(nodeId, metrics);
    this.checkResourceUtilization(nodeId);
    this.emit('metricsUpdated', { nodeId, metrics });
  }

  async allocateResources(
    taskId: string,
    requirements: {
      cpu: number;
      memory: number;
      gpu?: number;
    }
  ): Promise<string | null> {
    // Find suitable node for allocation
    const nodeId = this.findSuitableNode(requirements);
    if (!nodeId) {
      return null;
    }

    // Create allocation record
    const allocation: ResourceAllocation = {
      nodeId,
      allocated: requirements,
      taskId,
      timestamp: new Date()
    };

    // Update allocations
    const nodeAllocations = this.allocations.get(nodeId) || [];
    nodeAllocations.push(allocation);
    this.allocations.set(nodeId, nodeAllocations);

    this.emit('resourcesAllocated', {
      nodeId,
      taskId,
      allocation: requirements
    });

    return nodeId;
  }

  releaseResources(taskId: string, nodeId: string): void {
    const nodeAllocations = this.allocations.get(nodeId);
    if (!nodeAllocations) {
      return;
    }

    // Remove allocation
    const updatedAllocations = nodeAllocations.filter(a => a.taskId !== taskId);
    this.allocations.set(nodeId, updatedAllocations);

    this.emit('resourcesReleased', {
      nodeId,
      taskId
    });
  }

  getNodeUtilization(nodeId: string): {
    cpu: number;
    memory: number;
    gpu?: number;
  } | null {
    const resources = this.nodeResources.get(nodeId);
    const allocations = this.allocations.get(nodeId);
    if (!resources || !allocations) {
      return null;
    }

    // Calculate total allocated resources
    const totalAllocated = allocations.reduce(
      (total, allocation) => ({
        cpu: total.cpu + allocation.allocated.cpu,
        memory: total.memory + allocation.allocated.memory,
        gpu: (total.gpu || 0) + (allocation.allocated.gpu || 0)
      }),
      { cpu: 0, memory: 0, gpu: 0 }
    );

    return {
      cpu: totalAllocated.cpu / resources.cpu.cores,
      memory: totalAllocated.memory / resources.memory.total,
      ...(resources.gpu && { gpu: totalAllocated.gpu / resources.gpu.count })
    };
  }

  private findSuitableNode(requirements: {
    cpu: number;
    memory: number;
    gpu?: number;
  }): string | null {
    for (const [nodeId, resources] of this.nodeResources.entries()) {
      if (this.canAllocate(nodeId, requirements)) {
        return nodeId;
      }
    }
    return null;
  }

  private canAllocate(
    nodeId: string,
    requirements: {
      cpu: number;
      memory: number;
      gpu?: number;
    }
  ): boolean {
    const resources = this.nodeResources.get(nodeId);
    const allocations = this.allocations.get(nodeId);
    if (!resources || !allocations) {
      return false;
    }

    // Calculate current utilization
    const utilization = this.getNodeUtilization(nodeId);
    if (!utilization) {
      return false;
    }

    // Check if we can allocate additional resources
    const wouldExceed = (current: number, required: number, max: number) =>
      (current + required) / max > this.config.overallocationThreshold;

    return !(
      wouldExceed(utilization.cpu * resources.cpu.cores, requirements.cpu, resources.cpu.cores) ||
      wouldExceed(utilization.memory * resources.memory.total, requirements.memory, resources.memory.total) ||
      (requirements.gpu &&
        resources.gpu &&
        wouldExceed(
          (utilization.gpu || 0) * resources.gpu.count,
          requirements.gpu,
          resources.gpu.count
        ))
    );
  }

  private checkResourceUtilization(nodeId: string): void {
    const metrics = this.metrics.get(nodeId);
    const resources = this.nodeResources.get(nodeId);
    if (!metrics || !resources) {
      return;
    }

    // Check for over-utilization
    if (
      metrics.cpuUsage > this.config.overallocationThreshold * 100 ||
      metrics.memoryUsage > this.config.overallocationThreshold * 100
    ) {
      this.emit('resourceAlert', {
        nodeId,
        type: 'OVER_UTILIZATION',
        metrics
      });
    }
  }
} 