import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../../../components/DataDisplay';
import { Container } from '../../../components/Layout';
import { Project } from '../../../types/project';

interface ProjectStats {
  totalModels: number;
  activeModels: number;
  dataProcessed: string;
  lastActivity: string;
}

interface ProjectActivity {
  id: string;
  type: 'model_training' | 'data_upload' | 'config_change';
  description: string;
  timestamp: string;
}

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats>({
    totalModels: 3,
    activeModels: 2,
    dataProcessed: '500GB',
    lastActivity: new Date().toISOString()
  });
  const [activities, setActivities] = useState<ProjectActivity[]>([
    {
      id: '1',
      type: 'model_training',
      description: 'Started training new model: Enhanced Privacy NLP v2',
      timestamp: new Date().toISOString()
    },
    {
      id: '2',
      type: 'data_upload',
      description: 'Uploaded new dataset: Encrypted Training Data',
      timestamp: new Date(Date.now() - 86400000).toISOString()
    }
  ]);

  useEffect(() => {
    // TODO: Fetch project details from API
    setProject({
      id: '1',
      name: 'Privacy-Enhanced NLP',
      description: 'Natural Language Processing with privacy guarantees',
      privacyLevel: 'high',
      status: 'active',
      createdAt: '2024-01-19T00:00:00Z',
      updatedAt: '2024-01-19T00:00:00Z',
      modelCount: 3,
      dataSize: '500GB'
    });
  }, [id]);

  if (!project) {
    return <div>Loading...</div>;
  }

  return (
    <Container>
      <div className="py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-500 mt-1">{project.description}</p>
          </div>
          <div className="flex space-x-4">
            <button className="btn btn-outline">Edit Project</button>
            <button className="btn btn-primary">Add Model</button>
          </div>
        </div>

        {/* Project Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="bg-white">
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Models</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.totalModels}</p>
            </div>
          </Card>
          <Card className="bg-white">
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-500">Active Models</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.activeModels}</p>
            </div>
          </Card>
          <Card className="bg-white">
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-500">Data Processed</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.dataProcessed}</p>
            </div>
          </Card>
          <Card className="bg-white">
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-500">Privacy Level</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{project.privacyLevel}</p>
            </div>
          </Card>
        </div>

        {/* Recent Activities */}
        <Card className="bg-white">
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activities</h2>
            <div className="space-y-4">
              {activities.map(activity => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </Container>
  );
};
