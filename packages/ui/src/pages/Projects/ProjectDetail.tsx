import React from 'react';
import { useParams } from 'react-router-dom';
import { FolderIcon, LockClosedIcon, ServerIcon, DocumentIcon } from '@heroicons/react/24/outline';

interface Project {
  id: string;
  name: string;
  description: string;
  privacyLevel: 'high' | 'medium' | 'low';
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
  modelCount: number;
  dataSize: string;
}

const MOCK_PROJECTS: Record<string, Project> = {
  '1': {
    id: '1',
    name: 'Privacy-Enhanced NLP',
    description: 'Natural Language Processing with privacy guarantees',
    privacyLevel: 'high',
    status: 'active',
    createdAt: '2024-01-19T00:00:00Z',
    updatedAt: '2024-01-19T00:00:00Z',
    modelCount: 3,
    dataSize: '500GB'
  },
  '2': {
    id: '2',
    name: 'Secure Data Analysis',
    description: 'Data analysis with homomorphic encryption',
    privacyLevel: 'high',
    status: 'active',
    createdAt: '2024-01-19T00:00:00Z',
    updatedAt: '2024-01-19T00:00:00Z',
    modelCount: 2,
    dataSize: '200GB'
  }
};

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const project = id ? MOCK_PROJECTS[id] : null;

  if (!project) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-gray-900">Project Not Found</h1>
          <p className="mt-2 text-gray-600">The project you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex items-center">
          <FolderIcon className="h-8 w-8 text-gray-400 mr-4" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
            <p className="mt-1 text-gray-500">{project.description}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Project Overview */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Project Overview</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className={`
                    inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                    ${
                      project.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }
                  `}>
                    {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Privacy Level</dt>
                <dd className="mt-1 flex items-center">
                  <LockClosedIcon className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-gray-900">
                    {project.privacyLevel.charAt(0).toUpperCase() + project.privacyLevel.slice(1)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-gray-900">
                  {new Date(project.createdAt).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="mt-1 text-gray-900">
                  {new Date(project.updatedAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Project Stats */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Project Stats</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="flex items-center text-sm font-medium text-gray-500">
                  <ServerIcon className="h-5 w-5 text-gray-400 mr-2" />
                  Models
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {project.modelCount}
                </dd>
              </div>
              <div>
                <dt className="flex items-center text-sm font-medium text-gray-500">
                  <DocumentIcon className="h-5 w-5 text-gray-400 mr-2" />
                  Data Size
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {project.dataSize}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail; 