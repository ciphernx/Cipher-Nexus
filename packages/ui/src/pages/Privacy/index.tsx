import React, { useState } from 'react';
import { Card } from '../../components/DataDisplay';
import { Switch } from '@headlessui/react';
import { ShieldCheckIcon, ChartBarIcon, LockClosedIcon } from '@heroicons/react/24/outline';

interface PrivacySetting {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

const initialSettings: PrivacySetting[] = [
  {
    id: 'differential-privacy',
    name: 'Differential Privacy',
    description: 'Add noise to training data to protect individual privacy',
    enabled: true,
    icon: ShieldCheckIcon,
  },
  {
    id: 'homomorphic-encryption',
    name: 'Homomorphic Encryption',
    description: 'Perform computations on encrypted data',
    enabled: false,
    icon: LockClosedIcon,
  },
  {
    id: 'secure-aggregation',
    name: 'Secure Aggregation',
    description: 'Aggregate model updates without revealing individual contributions',
    enabled: true,
    icon: ChartBarIcon,
  },
];

export const Privacy: React.FC = () => {
  const [settings, setSettings] = useState<PrivacySetting[]>(initialSettings);

  const handleToggle = (settingId: string) => {
    setSettings(settings.map(setting =>
      setting.id === settingId
        ? { ...setting, enabled: !setting.enabled }
        : setting
    ));
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Privacy Settings</h1>
        <p className="mt-2 text-sm text-gray-700">
          Configure privacy protection mechanisms for your AI models
        </p>
      </div>

      <div className="space-y-6">
        {settings.map((setting) => (
          <Card key={setting.id} className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <setting.icon className="h-8 w-8 text-gray-400" />
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">{setting.name}</h3>
                  <p className="text-sm text-gray-500">{setting.description}</p>
                </div>
              </div>
              <Switch
                checked={setting.enabled}
                onChange={() => handleToggle(setting.id)}
                className={`${
                  setting.enabled ? 'bg-blue-600' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
              >
                <span className="sr-only">Enable {setting.name}</span>
                <span
                  className={`${
                    setting.enabled ? 'translate-x-5' : 'translate-x-0'
                  } pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </Switch>
            </div>
          </Card>
        ))}

        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Privacy Metrics</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-gray-500">Privacy Score</p>
              <p className="mt-1 text-3xl font-semibold text-green-600">98.5%</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Protected Models</p>
              <p className="mt-1 text-3xl font-semibold text-blue-600">24/25</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Data Protection</p>
              <p className="mt-1 text-3xl font-semibold text-indigo-600">100%</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Privacy; 