import React, { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import {
  HomeIcon,
  DocumentDuplicateIcon,
  CpuChipIcon,
  ServerIcon,
  ShieldCheckIcon,
  Cog6ToothIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ComponentType<any>;
  children?: { name: string; href: string }[];
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Datasets', href: '/datasets', icon: DocumentDuplicateIcon },
  {
    name: 'Models',
    icon: CpuChipIcon,
    children: [
      { name: 'Training', href: '/models/training' },
      { name: 'Deployment', href: '/models/deployment' },
    ],
  },
  { name: 'Privacy', href: '/privacy', icon: ShieldCheckIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

export const Sidebar = () => {
  console.log('Sidebar rendered');
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();

  const isActive = (href: string) => location.pathname === href;
  const isParentActive = (children: { href: string }[]) =>
    children.some((child) => location.pathname === child.href);

  const renderNavigationItem = (item: NavigationItem) => {
    if (!item.children && item.href) {
      return (
        <Link
          key={item.name}
          to={item.href}
          className={`${
            isActive(item.href)
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
        >
          <item.icon
            className={`${
              isActive(item.href) ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500'
            } mr-3 flex-shrink-0 h-6 w-6`}
            aria-hidden="true"
          />
          {item.name}
        </Link>
      );
    }

    return (
      <div key={item.name}>
        <div
          className={`${
            item.children && isParentActive(item.children)
              ? 'text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          } flex items-center px-2 py-2 text-sm font-medium`}
        >
          <item.icon
            className={`${
              item.children && isParentActive(item.children)
                ? 'text-gray-500'
                : 'text-gray-400 group-hover:text-gray-500'
            } mr-3 flex-shrink-0 h-6 w-6`}
            aria-hidden="true"
          />
          {item.name}
        </div>
        {item.children && (
          <div className="ml-8 space-y-1">
            {item.children.map((child) => (
              <Link
                key={child.name}
                to={child.href}
                className={`${
                  isActive(child.href)
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
              >
                {child.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col border-r border-gray-200 bg-white">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            <div className="flex flex-shrink-0 items-center px-4">
              <img
                className="h-8 w-auto"
                src="/logo.svg"
                alt="Cipher Nexus"
              />
            </div>
            <nav className="mt-5 flex-1 space-y-1 bg-white px-2">
              {navigation.map(renderNavigationItem)}
            </nav>
          </div>
        </div>
      </div>

      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-40 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
          </Transition.Child>

          <div className="fixed inset-0 z-40 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative flex w-full max-w-xs flex-1 flex-col bg-white">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute top-0 right-0 -mr-12 pt-2">
                    <button
                      type="button"
                      className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                <div className="h-0 flex-1 overflow-y-auto pt-5 pb-4">
                  <div className="flex flex-shrink-0 items-center px-4">
                    <img
                      className="h-8 w-auto"
                      src="/logo.svg"
                      alt="Cipher Nexus"
                    />
                  </div>
                  <nav className="mt-5 space-y-1 px-2">
                    {navigation.map(renderNavigationItem)}
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
            <div className="w-14 flex-shrink-0" />
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
}; 