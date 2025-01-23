import axios from 'axios';

const API_BASE_URL = '/api/datasets';

export interface Dataset {
  id: string;
  name: string;
  description: string;
  size: string;
  status: 'raw' | 'preprocessing' | 'encrypted' | 'ready';
  type: string;
  updatedAt: string;
}

export interface DatasetStats {
  rowCount: number;
  columnCount: number;
  fileSize: string;
  lastModified: string;
  dataTypes: { [key: string]: string };
  missingValues: number;
  outliers: number;
  invalidValues: number;
}

export interface DatasetPreview {
  columns: string[];
  rows: any[];
  totalRows: number;
}

export const datasetService = {
  // Get dataset details
  async getDataset(id: string): Promise<Dataset> {
    const response = await axios.get(`${API_BASE_URL}/${id}`);
    return response.data;
  },

  // Get dataset statistics
  async getDatasetStats(id: string): Promise<DatasetStats> {
    const response = await axios.get(`${API_BASE_URL}/${id}/stats`);
    return response.data;
  },

  // Get dataset preview data
  async getDatasetPreview(id: string, page: number, pageSize: number): Promise<DatasetPreview> {
    const response = await axios.get(`${API_BASE_URL}/${id}/preview`, {
      params: { page, pageSize },
    });
    return response.data;
  },

  // Delete dataset
  async deleteDataset(id: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/${id}`);
  },

  // Export dataset
  async exportDataset(id: string, format: 'csv' | 'json' | 'excel'): Promise<Blob> {
    const response = await axios.get(`${API_BASE_URL}/${id}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },

  // Get dataset analysis results
  async getDatasetAnalysis(id: string): Promise<{
    correlations: Array<{ field1: string; field2: string; score: number }>;
    distributions: Array<{ field: string; distribution: Array<{ value: string; count: number }> }>;
    summary: Array<{
      field: string;
      min?: number;
      max?: number;
      mean?: number;
      median?: number;
      uniqueValues?: number;
    }>;
  }> {
    const response = await axios.get(`${API_BASE_URL}/${id}/analysis`);
    return response.data;
  },
}; 