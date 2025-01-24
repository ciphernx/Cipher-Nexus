import { useState, useEffect, useCallback } from 'react';
import { Dataset, ApiResponse } from '../types';
import { datasetService } from '../api/services';

export function useDatasets() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDatasets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await datasetService.getAll();
      if (response.success && response.data) {
        setDatasets(response.data);
      } else {
        setError(response.error || 'Failed to fetch datasets');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createDataset = useCallback(async (data: Omit<Dataset, 'id' | 'created' | 'updated'>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await datasetService.create(data);
      if (response.success && response.data) {
        setDatasets(prev => [...prev, response.data]);
        return response.data;
      } else {
        setError(response.error || 'Failed to create dataset');
        return null;
      }
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateDataset = useCallback(async (id: string, data: Partial<Dataset>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await datasetService.update(id, data);
      if (response.success && response.data) {
        setDatasets(prev => prev.map(dataset => 
          dataset.id === id ? response.data : dataset
        ));
        return response.data;
      } else {
        setError(response.error || 'Failed to update dataset');
        return null;
      }
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteDataset = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await datasetService.delete(id);
      if (response.success) {
        setDatasets(prev => prev.filter(dataset => dataset.id !== id));
        return true;
      } else {
        setError(response.error || 'Failed to delete dataset');
        return false;
      }
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadDataset = useCallback(async (id: string, file: File) => {
    setLoading(true);
    setError(null);
    try {
      const response = await datasetService.upload(id, file);
      if (response.success) {
        await fetchDatasets(); // Refresh the list
        return true;
      } else {
        setError(response.error || 'Failed to upload dataset');
        return false;
      }
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchDatasets]);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  return {
    datasets,
    loading,
    error,
    fetchDatasets,
    createDataset,
    updateDataset,
    deleteDataset,
    uploadDataset,
  };
} 