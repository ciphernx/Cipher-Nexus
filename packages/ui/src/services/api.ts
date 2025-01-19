import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth endpoints
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password });

// Dataset endpoints
export const getDatasets = () => api.get('/datasets');
export const getDatasetById = (id: string) => api.get(`/datasets/${id}`);
export const uploadDataset = (formData: FormData) =>
  api.post('/datasets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// Model endpoints
export const getModels = () => api.get('/models');
export const getModelById = (id: string) => api.get(`/models/${id}`);
export const startTraining = (modelId: string, config: any) =>
  api.post(`/models/${modelId}/train`, config);
export const stopTraining = (modelId: string) =>
  api.post(`/models/${modelId}/stop`);
export const getTrainingHistory = (modelId: string) =>
  api.get(`/models/${modelId}/history`);
export const getModelEvaluation = (modelId: string) =>
  api.get(`/models/${modelId}/evaluation`);

// Deployment endpoints
export const deployModel = (modelId: string, config: any) =>
  api.post(`/models/${modelId}/deploy`, config);
export const getDeploymentStatus = (modelId: string) =>
  api.get(`/models/${modelId}/deployment`);
export const updateDeployment = (modelId: string, config: any) =>
  api.put(`/models/${modelId}/deployment`, config);
export const stopDeployment = (modelId: string) =>
  api.post(`/models/${modelId}/deployment/stop`);

// Version control endpoints
export const getModelVersions = (modelId: string) =>
  api.get(`/models/${modelId}/versions`);
export const rollbackVersion = (modelId: string, versionId: string) =>
  api.post(`/models/${modelId}/versions/${versionId}/rollback`);

// Error interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
