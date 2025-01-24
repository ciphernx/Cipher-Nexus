// Dataset types
export interface Dataset {
  id: string;
  name: string;
  description: string;
  size: number;
  created: Date;
  updated: Date;
  status: 'active' | 'processing' | 'error';
  type: 'public' | 'private';
  owner: string;
}

// Training task types
export interface TrainingTask {
  id: string;
  name: string;
  description: string;
  dataset: string;
  model: string;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  created: Date;
  updated: Date;
  owner: string;
  results?: Record<string, any>;
}

// User types
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  created: Date;
  lastLogin: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
} 