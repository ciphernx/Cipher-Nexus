import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderIcon, LockClosedIcon } from '@heroicons/react/24/outline';

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

const MOCK_PROJECTS: Project[] = [
  {
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
  {
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
];

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="py-4">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow duration-200"
              >
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <FolderIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        {project.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {project.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <LockClosedIcon className="h-4 w-4 text-green-500 mr-1" />
                        <span className="text-gray-600">
                          {project.privacyLevel.charAt(0).toUpperCase() + project.privacyLevel.slice(1)} Privacy
                        </span>
                      </div>
                      <span className="text-gray-500">
                        Updated {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-4 flex justify-between">
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
                      <button
                        type="button"
                        className="text-sm font-medium text-blue-600 hover:text-blue-500"
                        onClick={() => navigate(`/app/projects/${project.id}`)}
                      >
                        View details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add New Project Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg border-2 border-dashed border-gray-300">
              <button
                type="button"
                className="relative block w-full h-full rounded-lg p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onClick={() => {/* TODO: Implement project creation */}}
              >
                <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
                <span className="mt-2 block text-sm font-medium text-gray-900">
                  Create a new project
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Projects;
