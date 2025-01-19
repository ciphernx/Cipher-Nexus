import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table } from '../../components/DataDisplay';
import { Container } from '../../components/Layout';
import { Project } from '../../types/project';
import { CreateProjectModal } from './components/CreateProjectModal';
import { EditProjectModal } from './components/EditProjectModal';

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

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateProject = async (data: any) => {
    setIsLoading(true);
    try {
      const newProject: Project = {
        id: String(projects.length + 1),
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        modelCount: 0,
        dataSize: '0 GB'
      };
      setProjects([...projects, newProject]);
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditProject = async (data: Partial<Project>) => {
    if (!selectedProject) return;
    
    setIsLoading(true);
    try {
      const updatedProject = {
        ...selectedProject,
        ...data,
        updatedAt: new Date().toISOString()
      };
      
      setProjects(projects.map(p => 
        p.id === selectedProject.id ? updatedProject : p
      ));
      setIsEditModalOpen(false);
      setSelectedProject(null);
    } catch (error) {
      console.error('Failed to update project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const handleEditClick = (project: Project) => {
    setSelectedProject(project);
    setIsEditModalOpen(true);
  };

  const columns = [
    { 
      key: 'name',
      title: 'Project Name',
      render: (value: string, project: Project) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{project.description}</div>
        </div>
      )
    },
    {
      key: 'privacyLevel',
      title: 'Privacy Level',
      render: (value: Project['privacyLevel']) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'high' ? 'bg-green-100 text-green-800' :
          value === 'medium' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      )
    },
    {
      key: 'status',
      title: 'Status',
      render: (value: Project['status']) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'active' ? 'bg-green-100 text-green-800' :
          value === 'paused' ? 'bg-yellow-100 text-yellow-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      )
    },
    {
      key: 'modelCount',
      title: 'Models',
      render: (value: number) => value
    },
    {
      key: 'dataSize',
      title: 'Data Size',
      render: (value: string) => value
    },
    {
      key: 'actions',
      title: '',
      render: (_: any, project: Project) => (
        <div className="flex justify-end space-x-2">
          <button 
            className="text-sm text-primary hover:text-primary-dark"
            onClick={(e) => {
              e.stopPropagation();
              handleViewProject(project.id);
            }}
          >
            View
          </button>
          <button 
            className="text-sm text-gray-600 hover:text-gray-900"
            onClick={(e) => {
              e.stopPropagation();
              handleEditClick(project);
            }}
          >
            Edit
          </button>
        </div>
      )
    }
  ];

  return (
    <Container>
      <div className="py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <button
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            New Project
          </button>
        </div>

        <Card className="bg-white overflow-hidden">
          <div className="p-6">
            <Table
              data={projects}
              columns={columns}
              onRowClick={(project) => handleViewProject(project.id)}
            />
          </div>
        </Card>

        <CreateProjectModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateProject}
          isLoading={isLoading}
        />

        {selectedProject && (
          <EditProjectModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedProject(null);
            }}
            onSubmit={handleEditProject}
            project={selectedProject}
            isLoading={isLoading}
          />
        )}
      </div>
    </Container>
  );
};
