import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Descriptions, Spin, Tabs, message } from 'antd';
import { DatasetService } from '../services/dataset.service';
import DatasetPreprocessing from '../components/DatasetPreprocessing';
import DatasetEncryption from '../components/DatasetEncryption';
import { formatBytes } from '../utils/format';

interface DatasetDetail {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  size: number;
  status: string;
  format: string;
  encryptionStatus: string;
}

const DatasetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDatasetDetail = async () => {
    try {
      setLoading(true);
      const response = await DatasetService.getDatasetById(id as string);
      setDataset(response);
    } catch (error) {
      message.error('Failed to fetch dataset details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDatasetDetail();
    }
  }, [id]);

  if (loading) {
    return <Spin size="large" className="flex justify-center items-center min-h-screen" />;
  }

  if (!dataset) {
    return <div>Dataset not found</div>;
  }

  return (
    <div className="p-6">
      <Card title="Dataset Details" className="mb-6">
        <Descriptions bordered>
          <Descriptions.Item label="Name">{dataset.name}</Descriptions.Item>
          <Descriptions.Item label="Created At">{dataset.createdAt}</Descriptions.Item>
          <Descriptions.Item label="Size">{formatBytes(dataset.size)}</Descriptions.Item>
          <Descriptions.Item label="Format">{dataset.format}</Descriptions.Item>
          <Descriptions.Item label="Status">{dataset.status}</Descriptions.Item>
          <Descriptions.Item label="Encryption Status">{dataset.encryptionStatus}</Descriptions.Item>
          {dataset.description && (
            <Descriptions.Item label="Description" span={3}>
              {dataset.description}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Tabs
        items={[
          {
            key: 'preview',
            label: 'Data Preview',
            children: <div>Data preview component will be implemented here</div>,
          },
          {
            key: 'preprocessing',
            label: 'Preprocessing',
            children: (
              <DatasetPreprocessing
                datasetId={dataset.id}
                onPreprocessingComplete={fetchDatasetDetail}
              />
            ),
          },
          {
            key: 'encryption',
            label: 'Encryption',
            children: (
              <DatasetEncryption
                datasetId={dataset.id}
                encryptionStatus={dataset.encryptionStatus}
                onEncryptionComplete={fetchDatasetDetail}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

export default DatasetDetailPage; 