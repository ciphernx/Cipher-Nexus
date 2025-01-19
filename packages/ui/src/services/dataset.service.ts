import axios from 'axios';
import { API_BASE_URL } from '../config';

export interface Dataset {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  size: number;
  status: string;
  format: string;
  encryptionStatus: string;
}

export interface DatasetUploadParams {
  file: File;
  name: string;
  description?: string;
}

export interface PreprocessingOptions {
  normalize?: boolean;
  removeOutliers?: boolean;
  fillMissingValues?: boolean;
}

export class DatasetService {
  private static readonly BASE_PATH = `${API_BASE_URL}/datasets`;

  static async getDatasets(): Promise<Dataset[]> {
    const response = await axios.get(this.BASE_PATH);
    return response.data;
  }

  static async getDatasetById(id: string): Promise<Dataset> {
    const response = await axios.get(`${this.BASE_PATH}/${id}`);
    return response.data;
  }

  static async uploadDataset(params: DatasetUploadParams): Promise<Dataset> {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('name', params.name);
    if (params.description) {
      formData.append('description', params.description);
    }

    const response = await axios.post(`${this.BASE_PATH}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  static async preprocessDataset(id: string, options: PreprocessingOptions): Promise<Dataset> {
    const response = await axios.post(`${this.BASE_PATH}/${id}/preprocess`, options);
    return response.data;
  }

  static async encryptDataset(id: string, publicKey: string): Promise<Dataset> {
    const response = await axios.post(`${this.BASE_PATH}/${id}/encrypt`, { publicKey });
    return response.data;
  }

  static async deleteDataset(id: string): Promise<void> {
    await axios.delete(`${this.BASE_PATH}/${id}`);
  }
} 