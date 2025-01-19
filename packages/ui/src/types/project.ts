export interface Project {
  id: string;
  name: string;
  description: string;
  privacyLevel: 'basic' | 'medium' | 'high';
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
  modelCount: number;
  dataSize: string;
}
