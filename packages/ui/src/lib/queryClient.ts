import { QueryClient } from '@tanstack/react-query';
import { showErrorNotification } from '../utils/errorHandler';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      onError: (error) => {
        showErrorNotification(error);
      },
    },
    mutations: {
      onError: (error) => {
        showErrorNotification(error);
      },
    },
  },
});

export const queryKeys = {
  datasets: {
    all: ['datasets'] as const,
    detail: (id: string) => ['datasets', id] as const,
  },
  models: {
    all: ['models'] as const,
    detail: (id: string) => ['models', id] as const,
    training: (id: string) => ['models', id, 'training'] as const,
    deployment: (id: string) => ['models', id, 'deployment'] as const,
    versions: (id: string) => ['models', id, 'versions'] as const,
  },
  auth: {
    user: ['auth', 'user'] as const,
  },
}; 