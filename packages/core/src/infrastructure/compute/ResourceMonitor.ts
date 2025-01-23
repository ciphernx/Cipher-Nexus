import * as si from 'systeminformation';
import { EventEmitter } from 'events';
import { nvidiaSmi } from 'node-nvidia-smi';

export interface ResourceMetrics {
  cpu: {
    usage: number;        // CPU utilization (0-1)
    temperature: number;  // CPU temperature (Celsius)
    frequency: number;    // CPU frequency (MHz)
  };
  memory: {
    total: number;       // Total memory (bytes)
    used: number;        // Used memory (bytes)
    free: number;        // Available memory (bytes)
    usage: number;       // Memory utilization (0-1)
  };
  gpu?: {
    usage: number;       // GPU utilization (0-1)
    memoryUsed: number;  // GPU memory used (bytes)
    temperature: number; // GPU temperature (Celsius)
  }[];
  network: {
    rx_bytes: number;    // Received bytes per second
    tx_bytes: number;    // Transmitted bytes per second
    rx_packets: number;  // Received packets per second
    tx_packets: number;  // Transmitted packets per second
  };
  disk: {
    read_bytes: number;  // Read bytes per second
    write_bytes: number; // Written bytes per second
    usage: number;       // Disk utilization (0-1)
  };
}

export class ResourceMonitor extends EventEmitter {
  private metrics: ResourceMetrics;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private previousNetworkStats: any = null;
  private previousDiskStats: any = null;
  private readonly updateInterval: number;

  constructor(updateInterval: number = 1000) {
    super();
    this.updateInterval = updateInterval;
    this.metrics = this.getEmptyMetrics();
  }

  async start(): Promise<void> {
    try {
      // Initialize baseline network and disk statistics
      this.previousNetworkStats = await si.networkStats();
      this.previousDiskStats = await si.disksIO();

      // Start periodic monitoring
      this.monitoringInterval = setInterval(
        () => this.updateMetrics(),
        this.updateInterval
      );

      this.emit('monitoring:started');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.emit('monitoring:stopped');
  }

  getMetrics(): ResourceMetrics {
    return { ...this.metrics };
  }

  private async updateMetrics(): Promise<void> {
    try {
      const [
        cpuMetrics,
        memoryMetrics,
        gpuMetrics,
        networkMetrics,
        diskMetrics
      ] = await Promise.all([
        this.getCpuMetrics(),
        this.getMemoryMetrics(),
        this.getGpuMetrics(),
        this.getNetworkMetrics(),
        this.getDiskMetrics()
      ]);

      this.metrics = {
        cpu: cpuMetrics,
        memory: memoryMetrics,
        gpu: gpuMetrics,
        network: networkMetrics,
        disk: diskMetrics
      };

      this.emit('metrics:updated', this.metrics);
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async getCpuMetrics(): Promise<ResourceMetrics['cpu']> {
    try {
      const [currentLoad, temp, speed] = await Promise.all([
        si.currentLoad(),
        si.cpuTemperature(),
        si.cpu()
      ]);

      return {
        usage: currentLoad.currentLoad / 100,
        temperature: temp.main || 0,
        frequency: speed.speed
      };
    } catch (error) {
      console.error('Error getting CPU metrics:', error);
      return {
        usage: 0,
        temperature: 0,
        frequency: 0
      };
    }
  }

  private async getMemoryMetrics(): Promise<ResourceMetrics['memory']> {
    try {
      const mem = await si.mem();
      return {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        usage: mem.used / mem.total
      };
    } catch (error) {
      console.error('Error getting memory metrics:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        usage: 0
      };
    }
  }

  private async getGpuMetrics(): Promise<ResourceMetrics['gpu']> {
    try {
      const gpuData = await new Promise<any>((resolve, reject) => {
        nvidiaSmi((err: Error, data: any) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      if (!gpuData) return undefined;

      return gpuData.map((gpu: any) => ({
        usage: parseInt(gpu.utilization.gpu) / 100,
        memoryUsed: parseInt(gpu.memory.used) * 1024 * 1024, // Convert MB to bytes
        temperature: parseInt(gpu.temperature)
      }));
    } catch (error) {
      console.error('Error getting GPU metrics:', error);
      return undefined;
    }
  }

  private async getNetworkMetrics(): Promise<ResourceMetrics['network']> {
    try {
      const currentStats = await si.networkStats();
      if (!this.previousNetworkStats) {
        this.previousNetworkStats = currentStats;
        return {
          rx_bytes: 0,
          tx_bytes: 0,
          rx_packets: 0,
          tx_packets: 0
        };
      }

      const deltaTime = (currentStats[0].ts - this.previousNetworkStats[0].ts) / 1000; // Convert to seconds
      const metrics = {
        rx_bytes: (currentStats[0].rx_bytes - this.previousNetworkStats[0].rx_bytes) / deltaTime,
        tx_bytes: (currentStats[0].tx_bytes - this.previousNetworkStats[0].tx_bytes) / deltaTime,
        rx_packets: (currentStats[0].rx_packets - this.previousNetworkStats[0].rx_packets) / deltaTime,
        tx_packets: (currentStats[0].tx_packets - this.previousNetworkStats[0].tx_packets) / deltaTime
      };

      this.previousNetworkStats = currentStats;
      return metrics;
    } catch (error) {
      console.error('Error getting network metrics:', error);
      return {
        rx_bytes: 0,
        tx_bytes: 0,
        rx_packets: 0,
        tx_packets: 0
      };
    }
  }

  private async getDiskMetrics(): Promise<ResourceMetrics['disk']> {
    try {
      const [currentIO, fsSize] = await Promise.all([
        si.disksIO(),
        si.fsSize()
      ]);

      if (!this.previousDiskStats) {
        this.previousDiskStats = currentIO;
        return {
          read_bytes: 0,
          write_bytes: 0,
          usage: fsSize[0].use / 100
        };
      }

      const deltaTime = (currentIO.ts - this.previousDiskStats.ts) / 1000; // Convert to seconds
      const metrics = {
        read_bytes: (currentIO.rIO - this.previousDiskStats.rIO) / deltaTime,
        write_bytes: (currentIO.wIO - this.previousDiskStats.wIO) / deltaTime,
        usage: fsSize[0].use / 100
      };

      this.previousDiskStats = currentIO;
      return metrics;
    } catch (error) {
      console.error('Error getting disk metrics:', error);
      return {
        read_bytes: 0,
        write_bytes: 0,
        usage: 0
      };
    }
  }

  private getEmptyMetrics(): ResourceMetrics {
    return {
      cpu: {
        usage: 0,
        temperature: 0,
        frequency: 0
      },
      memory: {
        total: 0,
        used: 0,
        free: 0,
        usage: 0
      },
      network: {
        rx_bytes: 0,
        tx_bytes: 0,
        rx_packets: 0,
        tx_packets: 0
      },
      disk: {
        read_bytes: 0,
        write_bytes: 0,
        usage: 0
      }
    };
  }
} 