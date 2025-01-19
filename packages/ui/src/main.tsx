import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import router from './routes';
import { queryClient } from './lib/queryClient';
import { NotificationProvider } from './components/Notification/NotificationContext';
import { NotificationList } from './components/Notification/NotificationList';
import { LoadingProvider } from './components/Loading/LoadingContext';
import { LoadingSpinner } from './components/Loading/LoadingSpinner';
import { authService } from './services/auth';
import './styles/index.css';

// Initialize auth service
console.log('Initializing auth service');
authService.setupAxiosInterceptors();

// Add detailed error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise
  });
});

// Create root element if it doesn't exist
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.log('Root element not found, creating one');
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
}

// Add debug logs
console.log('Starting application initialization');
console.log('Router configuration:', router);
console.log('Query client:', queryClient);

// Render app with error handling
try {
  console.log('Creating root and rendering application');
  const root = ReactDOM.createRoot(rootElement!);
  
  console.log('Setting up React component tree');
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          <LoadingProvider>
            <RouterProvider 
              router={router} 
              fallbackElement={
                <div className="flex items-center justify-center h-screen">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-gray-600">Loading application...</p>
                  </div>
                </div>
              } 
            />
            <NotificationList />
            <LoadingSpinner />
          </LoadingProvider>
        </NotificationProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </React.StrictMode>
  );
  console.log('Application rendered successfully');
} catch (error) {
  console.error('Error rendering application:', {
    error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #f9fafb;
      ">
        <div style="
          max-width: 500px;
          padding: 2rem;
          text-align: center;
          background-color: white;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        ">
          <h2 style="
            font-size: 1.5rem;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 1rem;
          ">Application Error</h2>
          <p style="
            color: #6b7280;
            margin-bottom: 1rem;
          ">An error occurred while loading the application.</p>
          <pre style="
            background-color: #f3f4f6;
            padding: 1rem;
            border-radius: 0.375rem;
            text-align: left;
            margin-bottom: 1rem;
            overflow-x: auto;
          ">${error instanceof Error ? error.message : String(error)}</pre>
          <button onclick="window.location.reload()" style="
            background-color: #2563eb;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 0.375rem;
            font-weight: 500;
          ">Refresh Page</button>
        </div>
      </div>
    `;
  }
}
