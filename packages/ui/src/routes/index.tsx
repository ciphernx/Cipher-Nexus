import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MainLayout } from '../components/Layout';
import { DashboardPage } from '../pages/Dashboard';
import { ProjectsPage } from '../pages/Projects';
import { ProjectDetailPage } from '../pages/Projects/ProjectDetail';
import { ModelsPage } from '../pages/Models';
import { ModelDetailPage } from '../pages/Models/ModelDetail';
import { TrainModelPage } from '../pages/Models/TrainModel';
import { LoginPage } from '../pages/Auth';
import { useAuth } from '../hooks/useAuth';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <MainLayout user={user!} activeRoute={location.pathname} onLogout={() => {}}>
      {children}
    </MainLayout>
  );
};

export const AppRouter: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        } />
        
        <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/projects" element={<PrivateRoute><ProjectsPage /></PrivateRoute>} />
        <Route path="/projects/:id" element={<PrivateRoute><ProjectDetailPage /></PrivateRoute>} />
        <Route path="/models" element={<PrivateRoute><ModelsPage /></PrivateRoute>} />
        <Route path="/models/new" element={<PrivateRoute><TrainModelPage /></PrivateRoute>} />
        <Route path="/models/:id" element={<PrivateRoute><ModelDetailPage /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
};
