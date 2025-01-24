import { apiClient } from './client';
import { Dataset, TrainingTask, ApiResponse } from '../types';

// Dataset services
export const datasetService = {
  getAll: () => apiClient.get<Dataset[]>('/datasets'),
  
  getById: (id: string) => apiClient.get<Dataset>(`/datasets/${id}`),
  
  create: (data: Omit<Dataset, 'id' | 'created' | 'updated'>) => 
    apiClient.post<Dataset>('/datasets', data),
  
  update: (id: string, data: Partial<Dataset>) => 
    apiClient.put<Dataset>(`/datasets/${id}`, data),
  
  delete: (id: string) => apiClient.delete<void>(`/datasets/${id}`),
  
  upload: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<void>(`/datasets/${id}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Training task services
export const trainingService = {
  getAll: () => apiClient.get<TrainingTask[]>('/training'),
  
  getById: (id: string) => apiClient.get<TrainingTask>(`/training/${id}`),
  
  create: (data: Omit<TrainingTask, 'id' | 'created' | 'updated' | 'status' | 'progress'>) => 
    apiClient.post<TrainingTask>('/training', data),
  
  update: (id: string, data: Partial<TrainingTask>) => 
    apiClient.put<TrainingTask>(`/training/${id}`, data),
  
  delete: (id: string) => apiClient.delete<void>(`/training/${id}`),
  
  start: (id: string) => apiClient.post<void>(`/training/${id}/start`),
  
  stop: (id: string) => apiClient.post<void>(`/training/${id}/stop`),
  
  getProgress: (id: string) => apiClient.get<{progress: number}>(`/training/${id}/progress`),
  
  getResults: (id: string) => apiClient.get<Record<string, any>>(`/training/${id}/results`),
}; 