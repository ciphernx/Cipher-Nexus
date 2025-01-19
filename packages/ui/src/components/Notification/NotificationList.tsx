import React from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useNotification, NotificationType } from './NotificationContext';
import { Transition } from '@headlessui/react';

const icons = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  info: InformationCircleIcon,
  warning: ExclamationTriangleIcon,
};

const colors: Record<NotificationType, { bg: string; text: string; icon: string }> = {
  success: {
    bg: 'bg-green-50',
    text: 'text-green-800',
    icon: 'text-green-400',
  },
  error: {
    bg: 'bg-red-50',
    text: 'text-red-800',
    icon: 'text-red-400',
  },
  warning: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    icon: 'text-yellow-400',
  },
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    icon: 'text-blue-400',
  },
};

export const NotificationList = () => {
  const { state, removeNotification } = useNotification();

  return (
    <div
      aria-live="assertive"
      className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-50"
    >
      <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
        {state.notifications.map((notification) => {
          const Icon = icons[notification.type];
          const color = colors[notification.type];

          return (
            <Transition
              key={notification.id}
              show={true}
              enter="transform ease-out duration-300 transition"
              enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
              enterTo="translate-y-0 opacity-100 sm:translate-x-0"
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div
                className={`max-w-sm w-full ${color.bg} shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden`}
              >
                <div className="p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <Icon className={`h-6 w-6 ${color.icon}`} aria-hidden="true" />
                    </div>
                    <div className="ml-3 w-0 flex-1 pt-0.5">
                      <p className={`text-sm font-medium ${color.text}`}>
                        {notification.message}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0 flex">
                      <button
                        className={`bg-transparent rounded-md inline-flex ${color.text} hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                        onClick={() => removeNotification(notification.id)}
                      >
                        <span className="sr-only">Close</span>
                        <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          );
        })}
      </div>
    </div>
  );
}; 