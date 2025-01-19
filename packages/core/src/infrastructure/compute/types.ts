export enum NodeStatus {
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',
  RUNNING = 'RUNNING',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR'
}

export interface ComputeResources {
  cpu: {
    cores: number;
    architecture: string;
  };
  memory: {
    total: number; // in bytes
    available: number;
  };
  gpu?: {
    count: number;
    model: string;
    memory: number;
  };
  network: {
    bandwidth: number; // in Mbps
    publicIp?: string;
  };
}

export interface NodeMetrics {
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  networkIO: {
    in: number; // bytes/sec
    out: number; // bytes/sec
  };
  lastUpdated: Date;
}

export interface TaskSpecification {
  id: string;
  type: 'TRAINING' | 'INFERENCE' | 'DATA_PROCESSING';
  requirements: {
    minCpu: number;
    minMemory: number;
    minGpu?: number;
    expectedDuration: number; // in milliseconds
  };
  priority: number;
  timeout: number;
}

export interface NodeConfiguration {
  metricsInterval: number;
  healthCheckInterval: number;
  maxConcurrentTasks: number;
  networkConfig: {
    port: number;
    host: string;
    protocol: 'http' | 'https';
  };
  security: {
    enableEncryption: boolean;
    tlsConfig?: {
      cert: string;
      key: string;
    };
  };
} 