import React from 'react';
import { Card } from '../../components/DataDisplay';
import { ChartBarIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const models = [
  {
    id: '1',
    name: 'Privacy-Enhanced BERT',
    type: 'NLP',
    accuracy: '94.5%',
    privacyScore: '98%',
    status: 'Deployed',
    lastTrained: '2024-01-18',
  },
  {
    id: '2',
    name: 'Secure ResNet',
    type: 'Computer Vision',
    accuracy: '92.8%',
    privacyScore: '99%',
    status: 'Training',
    lastTrained: '2024-01-17',
  },
  // Add more models as needed
];

export const Models: React.FC = () => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Models</h1>
        <p className="mt-2 text-sm text-gray-700">
          Manage your privacy-preserving AI models
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {models.map((model) => (
          <Card key={model.id} className="hover:shadow-lg transition-shadow duration-200">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {model.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {model.type}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Accuracy</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {model.accuracy}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Privacy Score</p>
                  <div className="flex items-center mt-1">
                    <ShieldCheckIcon className="h-5 w-5 text-green-500 mr-1" />
                    <p className="text-lg font-semibold text-gray-900">
                      {model.privacyScore}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className={`
                    inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                    ${
                      model.status === 'Deployed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }
                  `}>
                    {model.status}
                  </span>
                  <span className="text-gray-500">
                    Last trained {model.lastTrained}
                  </span>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    View details
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {/* Train New Model Card */}
        <Card className="hover:shadow-lg transition-shadow duration-200 border-2 border-dashed border-gray-300 p-6">
          <button
            type="button"
            className="relative block w-full h-full rounded-lg p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <span className="mt-2 block text-sm font-medium text-gray-900">
              Train a new model
            </span>
          </button>
        </Card>
      </div>
    </div>
  );
};
