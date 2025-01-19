import React from 'react';
import { Card } from '../../components/DataDisplay';
import { Container } from '../../components/Layout';

export const DashboardPage: React.FC = () => {
  return (
    <Container>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card className="bg-white">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900">Privacy Score</h3>
            <div className="mt-2">
              <span className="text-4xl font-bold text-primary">98%</span>
            </div>
          </div>
        </Card>

        <Card className="bg-white">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900">Protected Models</h3>
            <div className="mt-2">
              <span className="text-4xl font-bold text-primary">12</span>
            </div>
          </div>
        </Card>

        <Card className="bg-white">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900">Active Projects</h3>
            <div className="mt-2">
              <span className="text-4xl font-bold text-primary">5</span>
            </div>
          </div>
        </Card>

        <Card className="bg-white">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900">Data Processed</h3>
            <div className="mt-2">
              <span className="text-4xl font-bold text-primary">1.2TB</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="bg-white">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activities</h3>
          <div className="space-y-4">
            {[
              {
                id: '1',
                description: 'Started training model: Privacy-Enhanced NLP',
                timestamp: new Date().toISOString()
              },
              {
                id: '2',
                description: 'New project created: Secure Data Analysis',
                timestamp: new Date().toISOString()
              }
            ].map(activity => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg">
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
    </Container>
  );
};
