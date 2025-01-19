import React from 'react';
import { User } from '../../types';

interface NavbarProps {
  user?: User;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  return (
    <nav className="bg-white shadow-sm h-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <img src="/logo.svg" alt="Cipher Nexus" className="h-8 w-8" />
            <span className="ml-2 text-xl font-bold text-gray-900">Cipher Nexus</span>
          </div>
          {user && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{user.username}</span>
              <button
                onClick={onLogout}
                className="text-sm text-gray-700 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
