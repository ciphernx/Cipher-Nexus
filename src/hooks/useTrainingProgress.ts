import { useState, useEffect, useCallback } from 'react';
import wsService from '../services/websocket';

interface Metrics {
  loss: number;
  accuracy: number;
  epoch: number;
  step: number;
  totalSteps: number;
  learningRate: number;
}

interface TrainingEvent {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: string;
}

interface TrainingUpdate {
  taskId: string;
  status: string;
  metrics: Metrics;
  event?: TrainingEvent;
}

interface TrainingProgress {
  status: 'running' | 'paused' | 'completed' | 'failed';
  metrics: Metrics;
  events: TrainingEvent[];
}

const initialMetrics: Metrics = {
  loss: 0,
  accuracy: 0,
  epoch: 0,
  step: 0,
  totalSteps: 0,
  learningRate: 0,
};

export function useTrainingProgress(taskId: string) {
  const [progress, setProgress] = useState<TrainingProgress>({
    status: 'paused',
    metrics: initialMetrics,
    events: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket when the hook is first used
    wsService.connect();

    // Handle WebSocket connection errors
    const handleError = (error: Error) => {
      setError('WebSocket connection error');
      setIsConnected(false);
    };

    // Handle max reconnection attempts reached
    const handleMaxReconnect = () => {
      setError('Unable to connect to server. Please refresh the page.');
      setIsConnected(false);
    };

    wsService.on('error', handleError);
    wsService.on('max_reconnect_attempts', handleMaxReconnect);

    return () => {
      wsService.off('error', handleError);
      wsService.off('max_reconnect_attempts', handleMaxReconnect);
    };
  }, []);

  useEffect(() => {
    // Subscribe to training updates for the specific task
    const handleUpdate = (update: TrainingUpdate) => {
      setProgress((prev) => {
        const newEvents = update.event
          ? [...prev.events, update.event]
          : prev.events;

        return {
          status: update.status as TrainingProgress['status'],
          metrics: update.metrics,
          events: newEvents,
        };
      });
      setIsConnected(true);
      setError(null);
    };

    const updateEventName = `training_update:${taskId}`;
    wsService.on(updateEventName, handleUpdate);
    wsService.subscribeToTrainingUpdates(taskId);

    return () => {
      wsService.off(updateEventName, handleUpdate);
      wsService.unsubscribeFromTrainingUpdates(taskId);
    };
  }, [taskId]);

  const startTraining = useCallback(async () => {
    try {
      await fetch(`/api/training/${taskId}/start`, {
        method: 'POST',
      });
    } catch (err) {
      setError('Failed to start training');
    }
  }, [taskId]);

  const stopTraining = useCallback(async () => {
    try {
      await fetch(`/api/training/${taskId}/stop`, {
        method: 'POST',
      });
    } catch (err) {
      setError('Failed to stop training');
    }
  }, [taskId]);

  const refreshProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/training/${taskId}/progress`);
      const data: TrainingUpdate = await response.json();
      
      setProgress((prev) => ({
        status: data.status as TrainingProgress['status'],
        metrics: data.metrics,
        events: data.event ? [...prev.events, data.event] : prev.events,
      }));
    } catch (err) {
      setError('Failed to refresh training progress');
    }
  }, [taskId]);

  return {
    ...progress,
    error,
    isConnected,
    startTraining,
    stopTraining,
    refreshProgress,
  };
} 