import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { DocumentIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import DatasetUpload from '../../components/DatasetUpload';

const mockDatasets = [
  {
    id: 1,
    name: 'Medical Records 2024',
    description: 'Anonymized medical records dataset for training healthcare models',
    size: '2.5GB',
    type: 'CSV',
    status: 'Ready',
    lastModified: '2024-01-15',
  },
  {
    id: 2,
    name: 'Financial Transactions',
    description: 'Historical financial transaction data with privacy protection',
    size: '1.8GB',
    type: 'JSON',
    status: 'Processing',
    lastModified: '2024-01-14',
  },
  {
    id: 3,
    name: 'Customer Behavior',
    description: 'Encrypted customer behavior patterns and preferences',
    size: '3.2GB',
    type: 'JSONL',
    status: 'Ready',
    lastModified: '2024-01-13',
  },
];

const Datasets: React.FC = () => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleUploadComplete = () => {
    // TODO: Implement dataset refresh logic
    console.log('Dataset upload completed');
    setIsUploadModalOpen(false);
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Datasets</h1>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="py-4">
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-gray-600">
              Dataset management interface will be implemented here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Datasets; 