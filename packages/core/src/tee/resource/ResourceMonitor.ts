import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import * as os from 'os';
import * as pidusage from 'pidusage';

interface ResourceUsage {
  cpu: number;      // CPU usage percentage
  memory: number;   // Memory usage in bytes
  disk: {
    read: number;   // Bytes read from disk
    write: number;  // Bytes written to disk
  };
  network: {
    rx: number;     // Bytes received
    tx: number;     // Bytes transmitted
  };
  timestamp: number;
}

interface ResourceThresholds {
  cpu: number;      // Maximum CPU usage percentage
  memory: number;   // Maximum memory usage in bytes
  disk: {
    read: number;   // Maximum disk read rate (bytes/sec)
    write: number;  // Maximum disk write rate (bytes/sec)
  };
  network: {
    rx: number;     // Maximum network receive rate (bytes/sec)
    tx: number;     // Maximum network transmit rate (bytes/sec)
  };
}

interface ResourceAlert {
  type: 'cpu' | 'memory' | 'disk' | 'network';
  metric: string;
  current: number;
  threshold: number;
  timestamp: number;
}

export class ResourceMonitor extends EventEmitter {
  private readonly pid: number;
  private readonly thresholds: ResourceThresholds;
  private readonly usageHistory: ResourceUsage[];
  private readonly historyLimit: number;
  private readonly monitorInterval: number;
  private monitorTimer: NodeJS.Timer | null;
  private lastDiskStats: { read: number; write: number };
  private lastNetworkStats: { rx: number; tx: number };
  private lastTimestamp: number;

  constructor(
    pid: number,
    thresholds: ResourceThresholds,
    options: {
      historyLimit?: number;
      monitorInterval?: number;
    } = {}
  ) {
    super();
    this.pid = pid;
    this.thresholds = thresholds;
    this.usageHistory = [];
    this.historyLimit = options.historyLimit || 1000;
    this.monitorInterval = options.monitorInterval || 1000;
    this.monitorTimer = null;
    this.lastDiskStats = { read: 0, write: 0 };
    this.lastNetworkStats = { rx: 0, tx: 0 };
    this.lastTimestamp = Date.now();
  }

  async start(): Promise<void> {
    try {
      // Initialize last stats
      const initialStats = await this.collectResourceUsage();
      this.lastDiskStats = initialStats.disk;
      this.lastNetworkStats = initialStats.network;
      this.lastTimestamp = initialStats.timestamp;

      // Start monitoring
      this.monitorTimer = setInterval(
        () => this.monitor(),
        this.monitorInterval
      );

      logger.info('Resource monitoring started', {
        pid: this.pid,
        interval: this.monitorInterval
      });
    } catch (error) {
      logger.error('Failed to start resource monitoring', {}, error as Error);
      throw error;
    }
  }

  stop(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
      logger.info('Resource monitoring stopped', { pid: this.pid });
    }
  }

  private async monitor(): Promise<void> {
    try {
      const usage = await this.collectResourceUsage();
      this.updateHistory(usage);
      this.checkThresholds(usage);
    } catch (error) {
      logger.error('Resource monitoring failed', {}, error as Error);
    }
  }

  private async collectResourceUsage(): Promise<ResourceUsage> {
    try {
      // Get process resource usage
      const stats = await pidusage(this.pid);

      // Get disk I/O stats
      const diskStats = await this.getDiskStats();

      // Get network stats
      const networkStats = await this.getNetworkStats();

      const usage: ResourceUsage = {
        cpu: stats.cpu,
        memory: stats.memory,
        disk: {
          read: diskStats.read,
          write: diskStats.write
        },
        network: {
          rx: networkStats.rx,
          tx: networkStats.tx
        },
        timestamp: Date.now()
      };

      return usage;
    } catch (error) {
      logger.error('Failed to collect resource usage', {}, error as Error);
      throw error;
    }
  }

  private async getDiskStats(): Promise<{ read: number; write: number }> {
    try {
      // Read process disk I/O stats from /proc/[pid]/io
      const ioStats = await this.readProcIO(this.pid);
      
      const currentTime = Date.now();
      const timeDiff = (currentTime - this.lastTimestamp) / 1000; // Convert to seconds

      const stats = {
        read: (ioStats.read - this.lastDiskStats.read) / timeDiff,
        write: (ioStats.write - this.lastDiskStats.write) / timeDiff
      };

      this.lastDiskStats = ioStats;
      this.lastTimestamp = currentTime;

      return stats;
    } catch (error) {
      logger.error('Failed to get disk stats', {}, error as Error);
      return { read: 0, write: 0 };
    }
  }

  private async readProcIO(pid: number): Promise<{ read: number; write: number }> {
    try {
      // Read /proc/[pid]/io file
      const fs = require('fs').promises;
      const content = await fs.readFile(`/proc/${pid}/io`, 'utf8');
      
      const stats = {
        read: 0,
        write: 0
      };

      // Parse read_bytes and write_bytes
      content.split('\n').forEach(line => {
        if (line.startsWith('read_bytes:')) {
          stats.read = parseInt(line.split(':')[1].trim(), 10);
        } else if (line.startsWith('write_bytes:')) {
          stats.write = parseInt(line.split(':')[1].trim(), 10);
        }
      });

      return stats;
    } catch (error) {
      logger.error('Failed to read process I/O stats', {}, error as Error);
      return { read: 0, write: 0 };
    }
  }

  private async getNetworkStats(): Promise<{ rx: number; tx: number }> {
    try {
      // Get network interface statistics
      const networkInterfaces = os.networkInterfaces();
      let totalRx = 0;
      let totalTx = 0;

      // Sum up statistics for all interfaces
      Object.values(networkInterfaces).forEach(interfaces => {
        interfaces?.forEach(iface => {
          if (iface.internal) return; // Skip loopback interface
          
          // Read interface statistics from /sys/class/net/[iface]/statistics
          const stats = this.readNetworkInterfaceStats(iface.address);
          totalRx += stats.rx;
          totalTx += stats.tx;
        });
      });

      const currentTime = Date.now();
      const timeDiff = (currentTime - this.lastTimestamp) / 1000; // Convert to seconds

      const stats = {
        rx: (totalRx - this.lastNetworkStats.rx) / timeDiff,
        tx: (totalTx - this.lastNetworkStats.tx) / timeDiff
      };

      this.lastNetworkStats = { rx: totalRx, tx: totalTx };
      this.lastTimestamp = currentTime;

      return stats;
    } catch (error) {
      logger.error('Failed to get network stats', {}, error as Error);
      return { rx: 0, tx: 0 };
    }
  }

  private readNetworkInterfaceStats(
    iface: string
  ): { rx: number; tx: number } {
    try {
      const fs = require('fs');
      
      // Read RX bytes
      const rxBytes = parseInt(
        fs.readFileSync(
          `/sys/class/net/${iface}/statistics/rx_bytes`,
          'utf8'
        ),
        10
      );

      // Read TX bytes
      const txBytes = parseInt(
        fs.readFileSync(
          `/sys/class/net/${iface}/statistics/tx_bytes`,
          'utf8'
        ),
        10
      );

      return { rx: rxBytes, tx: txBytes };
    } catch (error) {
      logger.error('Failed to read network interface stats', {}, error as Error);
      return { rx: 0, tx: 0 };
    }
  }

  private updateHistory(usage: ResourceUsage): void {
    this.usageHistory.push(usage);
    
    // Remove old entries if history limit is exceeded
    if (this.usageHistory.length > this.historyLimit) {
      this.usageHistory.shift();
    }
  }

  private checkThresholds(usage: ResourceUsage): void {
    // Check CPU usage
    if (usage.cpu > this.thresholds.cpu) {
      this.emitAlert({
        type: 'cpu',
        metric: 'usage',
        current: usage.cpu,
        threshold: this.thresholds.cpu,
        timestamp: usage.timestamp
      });
    }

    // Check memory usage
    if (usage.memory > this.thresholds.memory) {
      this.emitAlert({
        type: 'memory',
        metric: 'usage',
        current: usage.memory,
        threshold: this.thresholds.memory,
        timestamp: usage.timestamp
      });
    }

    // Check disk read rate
    if (usage.disk.read > this.thresholds.disk.read) {
      this.emitAlert({
        type: 'disk',
        metric: 'read',
        current: usage.disk.read,
        threshold: this.thresholds.disk.read,
        timestamp: usage.timestamp
      });
    }

    // Check disk write rate
    if (usage.disk.write > this.thresholds.disk.write) {
      this.emitAlert({
        type: 'disk',
        metric: 'write',
        current: usage.disk.write,
        threshold: this.thresholds.disk.write,
        timestamp: usage.timestamp
      });
    }

    // Check network receive rate
    if (usage.network.rx > this.thresholds.network.rx) {
      this.emitAlert({
        type: 'network',
        metric: 'rx',
        current: usage.network.rx,
        threshold: this.thresholds.network.rx,
        timestamp: usage.timestamp
      });
    }

    // Check network transmit rate
    if (usage.network.tx > this.thresholds.network.tx) {
      this.emitAlert({
        type: 'network',
        metric: 'tx',
        current: usage.network.tx,
        threshold: this.thresholds.network.tx,
        timestamp: usage.timestamp
      });
    }
  }

  private emitAlert(alert: ResourceAlert): void {
    this.emit('alert', alert);
    logger.warn('Resource threshold exceeded', { alert });
  }

  getUsageHistory(): ResourceUsage[] {
    return [...this.usageHistory];
  }

  getLatestUsage(): ResourceUsage | null {
    return this.usageHistory[this.usageHistory.length - 1] || null;
  }

  getAverageUsage(
    duration: number = 60000  // Default to last minute
  ): ResourceUsage | null {
    const now = Date.now();
    const relevantUsage = this.usageHistory.filter(
      usage => now - usage.timestamp <= duration
    );

    if (relevantUsage.length === 0) {
      return null;
    }

    const sum = relevantUsage.reduce(
      (acc, usage) => ({
        cpu: acc.cpu + usage.cpu,
        memory: acc.memory + usage.memory,
        disk: {
          read: acc.disk.read + usage.disk.read,
          write: acc.disk.write + usage.disk.write
        },
        network: {
          rx: acc.network.rx + usage.network.rx,
          tx: acc.network.tx + usage.network.tx
        },
        timestamp: now
      }),
      {
        cpu: 0,
        memory: 0,
        disk: { read: 0, write: 0 },
        network: { rx: 0, tx: 0 },
        timestamp: now
      }
    );

    const count = relevantUsage.length;
    return {
      cpu: sum.cpu / count,
      memory: sum.memory / count,
      disk: {
        read: sum.disk.read / count,
        write: sum.disk.write / count
      },
      network: {
        rx: sum.network.rx / count,
        tx: sum.network.tx / count
      },
      timestamp: now
    };
  }
} 