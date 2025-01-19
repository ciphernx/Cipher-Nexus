import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  loadingMessage?: string;
  setLoadingMessage: (message?: string) => void;
}

const LoadingContext = createContext<LoadingContextType | null>(null);

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>();

  return (
    <LoadingContext.Provider
      value={{ isLoading, setLoading, loadingMessage, setLoadingMessage }}
    >
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

export const withLoading = async <T,>(
  promise: Promise<T>,
  message?: string
): Promise<T> => {
  const { setLoading, setLoadingMessage } = useLoading();
  try {
    setLoading(true);
    if (message) {
      setLoadingMessage(message);
    }
    return await promise;
  } finally {
    setLoading(false);
    setLoadingMessage(undefined);
  }
}; 