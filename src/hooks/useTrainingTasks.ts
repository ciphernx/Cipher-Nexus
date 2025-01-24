import { useState, useEffect, useCallback } from 'react';
import { TrainingTask } from '../types';
import { trainingService } from '../api/services';

export function useTrainingTasks() {
  const [tasks, setTasks] = useState<TrainingTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await trainingService.getAll();
      if (response.success && response.data) {
        setTasks(response.data);
      } else {
        setError(response.error || 'Failed to fetch training tasks');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTask = useCallback(async (data: Omit<TrainingTask, 'id' | 'created' | 'updated' | 'status' | 'progress'>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await trainingService.create(data);
      if (response.success && response.data) {
        setTasks(prev => [...prev, response.data]);
        return response.data;
      } else {
        setError(response.error || 'Failed to create training task');
        return null;
      }
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTask = useCallback(async (id: string, data: Partial<TrainingTask>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await trainingService.update(id, data);
      if (response.success && response.data) {
        setTasks(prev => prev.map(task => 
          task.id === id ? response.data : task
        ));
        return response.data;
      } else {
        setError(response.error || 'Failed to update training task');
        return null;
      }
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await trainingService.delete(id);
      if (response.success) {
        setTasks(prev => prev.filter(task => task.id !== id));
        return true;
      } else {
        setError(response.error || 'Failed to delete training task');
        return false;
      }
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const startTask = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await trainingService.start(id);
      if (response.success) {
        await fetchTasks(); // Refresh the list
        return true;
      } else {
        setError(response.error || 'Failed to start training task');
        return false;
      }
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchTasks]);

  const stopTask = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await trainingService.stop(id);
      if (response.success) {
        await fetchTasks(); // Refresh the list
        return true;
      } else {
        setError(response.error || 'Failed to stop training task');
        return false;
      }
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchTasks]);

  const getTaskProgress = useCallback(async (id: string) => {
    try {
      const response = await trainingService.getProgress(id);
      if (response.success && response.data) {
        setTasks(prev => prev.map(task => 
          task.id === id ? { ...task, progress: response.data.progress } : task
        ));
        return response.data.progress;
      }
      return null;
    } catch (err: any) {
      console.error('Failed to get task progress:', err);
      return null;
    }
  }, []);

  const getTaskResults = useCallback(async (id: string) => {
    try {
      const response = await trainingService.getResults(id);
      if (response.success && response.data) {
        setTasks(prev => prev.map(task => 
          task.id === id ? { ...task, results: response.data } : task
        ));
        return response.data;
      }
      return null;
    } catch (err: any) {
      console.error('Failed to get task results:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    startTask,
    stopTask,
    getTaskProgress,
    getTaskResults,
  };
} 