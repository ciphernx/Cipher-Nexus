import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminLayout } from '../components/Layout/AdminLayout';
import { PrivateRoute } from '../components/Auth/PrivateRoute';
import { Login } from '../pages/Auth/Login';
import Dashboard from '../pages/Dashboard';
import Projects from '../pages/Projects';
import ProjectDetail from '../pages/Projects/ProjectDetail';
import ModelTraining from '../pages/ModelTraining';
import ModelDeployment from '../pages/ModelDeployment';
import Datasets from '../pages/Datasets';
import DatasetDetail from '../pages/DatasetDetail';
import Privacy from '../pages/Privacy';
import Settings from '../pages/Settings';

// Debug log for route imports
console.log('Route components loaded:', {
  AdminLayout: !!AdminLayout,
  Login: !!Login,
  Dashboard: !!Dashboard,
  Projects: !!Projects,
  ProjectDetail: !!ProjectDetail,
  ModelTraining: !!ModelTraining,
  ModelDeployment: !!ModelDeployment,
  Datasets: !!Datasets,
  DatasetDetail: !!DatasetDetail,
  Privacy: !!Privacy,
  Settings: !!Settings,
});

// Error boundary component with debugging
const ErrorBoundary = () => {
  console.log('Error boundary rendered');
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Something went wrong
          </h2>
          <p className="text-gray-600 mb-4">
            An error occurred while loading this page. Please try refreshing the page or contact support if the problem persists.
          </p>
          <button
            onClick={() => {
              console.log('Refresh button clicked');
              window.location.reload();
            }}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
};

// Create router with debug logging
console.log('Creating router configuration');

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Navigate to="/app/dashboard" replace />,
      errorElement: <ErrorBoundary />,
    },
    {
      path: '/login',
      element: <Login />,
      errorElement: <ErrorBoundary />,
    },
    {
      path: '/app',
      element: (
        <PrivateRoute>
          <AdminLayout />
        </PrivateRoute>
      ),
      errorElement: <ErrorBoundary />,
      children: [
        {
          path: '',
          element: <Navigate to="/app/dashboard" replace />,
        },
        {
          path: 'dashboard',
          element: <Dashboard />,
          errorElement: <ErrorBoundary />,
        },
        {
          path: 'projects',
          element: <Projects />,
          errorElement: <ErrorBoundary />,
        },
        {
          path: 'projects/:id',
          element: <ProjectDetail />,
          errorElement: <ErrorBoundary />,
        },
        {
          path: 'datasets',
          element: <Datasets />,
          errorElement: <ErrorBoundary />,
        },
        {
          path: 'datasets/:id',
          element: <DatasetDetail />,
          errorElement: <ErrorBoundary />,
        },
        {
          path: 'models/training',
          element: <ModelTraining />,
          errorElement: <ErrorBoundary />,
        },
        {
          path: 'models/deployment',
          element: <ModelDeployment />,
          errorElement: <ErrorBoundary />,
        },
        {
          path: 'privacy',
          element: <Privacy />,
          errorElement: <ErrorBoundary />,
        },
        {
          path: 'settings',
          element: <Settings />,
          errorElement: <ErrorBoundary />,
        },
      ],
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true
    }
  }
);

console.log('Router configuration completed');

export default router;
