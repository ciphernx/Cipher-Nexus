export enum NodeStatus {
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',
  RUNNING = 'RUNNING',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR'
}

export enum TaskPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3
}

export enum TaskStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PAUSED = 'PAUSED'
}

export interface ResourceReservation {
  taskId: string;
  resources: {
    cpu: number;      // 0-1
    memory: number;   // bytes
    gpu?: number;     // 0-1
  };
  startTime: Date;
  endTime: Date;
  priority: TaskPriority;
}

export interface TaskHistory {
  taskId: string;
  type: string;
  status: TaskStatus;
  priority: TaskPriority;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  resourceUsage: {
    cpu: number;      // Average CPU usage
    memory: number;   // Peak memory usage
    gpu?: number;     // Average GPU usage
  };
  error?: string;
}

export interface ComputeResources {
  cpu: {
    cores: number;
    speed: number;  // MHz
  };
  memory: {
    total: number;  // bytes
  };
  gpu?: {
    count: number;
    memory: number; // bytes per GPU
  };
  network: {
    bandwidth: number; // in Mbps
    publicIp?: string;
  };
}

export interface NodeMetrics {
  cpuUsage: number;      // 0-1
  memoryUsage: number;   // 0-1
  networkIO: {
    in: number;         // bytes/s
    out: number;        // bytes/s
  };
  lastUpdated: Date;
}

export interface Task {
  id: string;
  type: string;
  priority: TaskPriority;
  requirements: {
    minCpu: number;     // 0-1
    minMemory: number;  // bytes
    minGpu?: number;    // 0-1
    expectedDuration: number; // milliseconds
  };
  data: any;
  createdAt: Date;
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