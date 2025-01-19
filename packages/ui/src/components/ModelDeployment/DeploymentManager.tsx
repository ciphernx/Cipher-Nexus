import React, { useState } from 'react';
import { Card } from '../DataDisplay';
import { Button } from '../Form/Button';
import {
  ServerIcon,
  CpuChipIcon,
  ClockIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';

interface DeploymentConfig {
  instanceType: string;
  replicas: number;
  autoScaling: boolean;
  minReplicas?: number;
  maxReplicas?: number;
  cpuThreshold?: number;
  memoryThreshold?: number;
}

interface DeploymentStatus {
  status: 'running' | 'stopped' | 'failed';
  healthStatus: 'healthy' | 'unhealthy' | 'degraded';
  uptime: string;
  lastDeployed: string;
  currentReplicas: number;
  cpuUsage: number;
  memoryUsage: number;
  requestsPerMinute: number;
  averageLatency: number;
  errorRate: number;
}

interface DeploymentManagerProps {
  modelId: string;
  modelName: string;
  version: string;
  config: DeploymentConfig;
  status: DeploymentStatus;
  onConfigUpdate: (config: DeploymentConfig) => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
}

export const DeploymentManager: React.FC<DeploymentManagerProps> = ({
  modelId,
  modelName,
  version,
  config,
  status,
  onConfigUpdate,
  onStart,
  onStop,
  onRestart,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedConfig, setEditedConfig] = useState(config);

  const handleSaveConfig = () => {
    onConfigUpdate(editedConfig);
    setIsEditing(false);
  };

  const statusColors = {
    running: 'text-green-600 bg-green-100',
    stopped: 'text-gray-600 bg-gray-100',
    failed: 'text-red-600 bg-red-100',
  };

  const healthColors = {
    healthy: 'text-green-600 bg-green-100',
    unhealthy: 'text-red-600 bg-red-100',
    degraded: 'text-yellow-600 bg-yellow-100',
  };

  return (
    <div className="space-y-6">
      {/* Deployment Overview */}
      <Card>
        <div className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {modelName} - {version}
              </h2>
              <div className="mt-1 text-sm text-gray-500">
                Last deployed: {new Date(status.lastDeployed).toLocaleString()}
              </div>
            </div>
            <div className="flex space-x-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  statusColors[status.status]
                }`}
              >
                {status.status.toUpperCase()}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  healthColors[status.healthStatus]
                }`}
              >
                {status.healthStatus.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CpuChipIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">CPU Usage</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {status.cpuUsage}%
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ServerIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Memory Usage</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {status.memoryUsage}%
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <SignalIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Requests/min</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {status.requestsPerMinute}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClockIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Avg. Latency</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {status.averageLatency}ms
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-end space-x-4">
              {status.status === 'stopped' ? (
                <Button onClick={onStart} color="primary">
                  Start Service
                </Button>
              ) : (
                <>
                  <Button onClick={onRestart} color="secondary">
                    Restart
                  </Button>
                  <Button onClick={onStop} color="danger">
                    Stop Service
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Deployment Configuration */}
      <Card>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Deployment Configuration</h3>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} variant="outline">
                Edit Configuration
              </Button>
            ) : (
              <div className="flex space-x-2">
                <Button onClick={() => setIsEditing(false)} variant="outline" color="secondary">
                  Cancel
                </Button>
                <Button onClick={handleSaveConfig} color="primary">
                  Save Changes
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Instance Type</label>
              {isEditing ? (
                <select
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  value={editedConfig.instanceType}
                  onChange={(e) =>
                    setEditedConfig({ ...editedConfig, instanceType: e.target.value })
                  }
                >
                  <option value="cpu.small">CPU Small (2 vCPU, 4GB RAM)</option>
                  <option value="cpu.medium">CPU Medium (4 vCPU, 8GB RAM)</option>
                  <option value="cpu.large">CPU Large (8 vCPU, 16GB RAM)</option>
                  <option value="gpu.small">GPU Small (1 GPU, 8GB RAM)</option>
                  <option value="gpu.medium">GPU Medium (2 GPU, 16GB RAM)</option>
                </select>
              ) : (
                <div className="mt-1 text-sm text-gray-900">{config.instanceType}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Replicas</label>
              {isEditing ? (
                <input
                  type="number"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={editedConfig.replicas}
                  onChange={(e) =>
                    setEditedConfig({ ...editedConfig, replicas: parseInt(e.target.value) })
                  }
                  min="1"
                  max="10"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">{config.replicas}</div>
              )}
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Auto Scaling</label>
                {isEditing ? (
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      checked={editedConfig.autoScaling}
                      onChange={(e) =>
                        setEditedConfig({ ...editedConfig, autoScaling: e.target.checked })
                      }
                      className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                    />
                    <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer" />
                  </div>
                ) : (
                  <div className="text-sm text-gray-900">{config.autoScaling ? 'Yes' : 'No'}</div>
                )}
              </div>
            </div>

            {editedConfig.autoScaling && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Min Replicas</label>
                  {isEditing ? (
                    <input
                      type="number"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={editedConfig.minReplicas}
                      onChange={(e) =>
                        setEditedConfig({
                          ...editedConfig,
                          minReplicas: parseInt(e.target.value),
                        })
                      }
                      min="1"
                      max="10"
                    />
                  ) : (
                    <div className="mt-1 text-sm text-gray-900">{config.minReplicas}</div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Replicas</label>
                  {isEditing ? (
                    <input
                      type="number"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={editedConfig.maxReplicas}
                      onChange={(e) =>
                        setEditedConfig({
                          ...editedConfig,
                          maxReplicas: parseInt(e.target.value),
                        })
                      }
                      min="1"
                      max="20"
                    />
                  ) : (
                    <div className="mt-1 text-sm text-gray-900">{config.maxReplicas}</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Monitoring Metrics */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Service Health</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Error Rate</span>
                <span className="text-sm font-medium text-gray-700">{status.errorRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    status.errorRate > 5 ? 'bg-red-600' : 'bg-green-600'
                  }`}
                  style={{ width: `${Math.min(status.errorRate, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">CPU Usage</span>
                <span className="text-sm font-medium text-gray-700">{status.cpuUsage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    status.cpuUsage > 80 ? 'bg-red-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${status.cpuUsage}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Memory Usage</span>
                <span className="text-sm font-medium text-gray-700">{status.memoryUsage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    status.memoryUsage > 80 ? 'bg-red-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${status.memoryUsage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DeploymentManager; 