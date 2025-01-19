import React from 'react';
import { Navbar, Sidebar } from '../Navigation';
import { User } from '../../types';

interface MainLayoutProps {
  user: User;
  children: React.ReactNode;
  activeRoute: string;
  onLogout?: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  user,
  children,
  activeRoute,
  onLogout
}) => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar user={user} onLogout={onLogout} />
      <div className="flex h-[calc(100vh-64px)]">
        <Sidebar user={user} activeRoute={activeRoute} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
