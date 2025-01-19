import React from 'react';
import {
  DocumentDuplicateIcon,
  ServerIcon,
  ChartBarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const stats = [
  {
    id: 1,
    name: 'Total Projects',
    stat: '12',
    change: '+20.1%',
    changeType: 'increase',
    icon: DocumentDuplicateIcon,
  },
  {
    id: 2,
    name: 'Active Models',
    stat: '24',
    change: '+15%',
    changeType: 'increase',
    icon: ServerIcon,
  },
  {
    id: 3,
    name: 'Training Jobs',
    stat: '8',
    change: '+12.5%',
    changeType: 'increase',
    icon: ChartBarIcon,
  },
  {
    id: 4,
    name: 'Privacy Score',
    stat: '98.5%',
    change: '+4.75%',
    changeType: 'increase',
    icon: ShieldCheckIcon,
  },
];

const Dashboard: React.FC = () => {
  console.log('Dashboard component rendered');
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="py-4">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((item) => (
              <div
                key={item.id}
                className="relative bg-white pt-5 px-4 pb-12 sm:pt-6 sm:px-6 shadow rounded-lg overflow-hidden"
              >
                <dt>
                  <div className="absolute bg-blue-500 rounded-md p-3">
                    <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  <p className="ml-16 text-sm font-medium text-gray-500 truncate">
                    {item.name}
                  </p>
                </dt>
                <dd className="ml-16 pb-6 flex items-baseline sm:pb-7">
                  <p className="text-2xl font-semibold text-gray-900">
                    {item.stat}
                  </p>
                  <p
                    className={`ml-2 flex items-baseline text-sm font-semibold
                      ${item.changeType === 'increase' ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {item.change}
                  </p>
                </dd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
