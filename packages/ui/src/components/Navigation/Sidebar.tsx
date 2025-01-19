import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChartBarIcon,
  Cog6ToothIcon,
  FolderIcon,
  HomeIcon,
  ShieldCheckIcon,
  ServerIcon,
  DocumentIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/app/dashboard', icon: HomeIcon },
  { name: 'Projects', href: '/app/projects', icon: FolderIcon },
  { name: 'Datasets', href: '/app/datasets', icon: DocumentIcon },
  {
    name: 'Models',
    icon: ServerIcon,
    children: [
      { name: 'Training', href: '/app/models/training' },
      { name: 'Deployment', href: '/app/models/deployment' },
    ],
  },
  { name: 'Privacy', href: '/app/privacy', icon: ShieldCheckIcon },
  { name: 'Settings', href: '/app/settings', icon: Cog6ToothIcon },
];

const Sidebar: React.FC = () => {
  const location = useLocation();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  const toggleSubmenu = (name: string) => {
    setOpenSubmenu(openSubmenu === name ? null : name);
  };

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div className="flex flex-grow flex-col overflow-y-auto border-r border-gray-200 bg-white pt-5 pb-4">
        <div className="flex flex-shrink-0 items-center px-4">
          <img
            className="h-8 w-auto"
            src="/logo.svg"
            alt="Cipher Nexus"
          />
          <span className="ml-2 text-xl font-semibold text-gray-900">
            Cipher Nexus
          </span>
        </div>
        <nav className="mt-8 flex-1 space-y-1 bg-white px-2">
          {navigation.map((item) => {
            const isActive = item.href
              ? location.pathname === item.href
              : item.children?.some((child) => location.pathname === child.href);
            const isOpen = openSubmenu === item.name;

            if (item.children) {
              return (
                <div key={item.name}>
                  <button
                    onClick={() => toggleSubmenu(item.name)}
                    className={`group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon
                      className={`mr-3 h-6 w-6 flex-shrink-0 ${
                        isActive
                          ? 'text-gray-500'
                          : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                      aria-hidden="true"
                    />
                    {item.name}
                    <ChevronDownIcon
                      className={`ml-auto h-5 w-5 transform transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.children.map((child) => {
                        const isChildActive = location.pathname === child.href;
                        return (
                          <Link
                            key={child.name}
                            to={child.href}
                            className={`block rounded-md py-2 pl-4 text-sm font-medium ${
                              isChildActive
                                ? 'text-gray-900'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            {child.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon
                  className={`mr-3 h-6 w-6 flex-shrink-0 ${
                    isActive
                      ? 'text-gray-500'
                      : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
