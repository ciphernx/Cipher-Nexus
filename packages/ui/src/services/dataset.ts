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
  // 获取数据集详情
  async getDataset(id: string): Promise<Dataset> {
    const response = await axios.get(`${API_BASE_URL}/${id}`);
    return response.data;
  },

  // 获取数据集统计信息
  async getDatasetStats(id: string): Promise<DatasetStats> {
    const response = await axios.get(`${API_BASE_URL}/${id}/stats`);
    return response.data;
  },

  // 获取数据集预览数据
  async getDatasetPreview(id: string, page: number, pageSize: number): Promise<DatasetPreview> {
    const response = await axios.get(`${API_BASE_URL}/${id}/preview`, {
      params: { page, pageSize },
    });
    return response.data;
  },

  // 加密数据集
  async encryptDataset(id: string, options?: { algorithm?: string; keySize?: number }): Promise<void> {
    await axios.post(`${API_BASE_URL}/${id}/encrypt`, options);
  },

  // 删除数据集
  async deleteDataset(id: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/${id}`);
  },

  // 导出数据集
  async exportDataset(id: string, format: 'csv' | 'json' | 'excel'): Promise<Blob> {
    const response = await axios.get(`${API_BASE_URL}/${id}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },

  // 获取数据集分析结果
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