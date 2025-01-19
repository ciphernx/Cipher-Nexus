import React from 'react';
import { Link } from 'react-router-dom';
import { User } from '../../types';

interface SidebarProps {
  user: User;
  activeRoute: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, activeRoute }) => {
  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/projects', label: 'Projects', icon: '📁' },
    { path: '/models', label: 'Models', icon: '🤖' },
    { path: '/settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <aside className="w-64 bg-white shadow-sm">
      <div className="h-full flex flex-col">
        <div className="p-4 border-b">
          <div className="text-sm font-medium text-gray-700">{user.role}</div>
          <div className="text-sm text-gray-500">{user.username}</div>
        </div>
        <nav className="flex-1 p-4">
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-2 my-1 text-sm rounded-md ${
                activeRoute === item.path
                  ? 'bg-primary-100 text-primary-900'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="mr-3">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
};
