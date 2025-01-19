import React, { useState } from 'react';
import { Upload, Form, Input, Button, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { DatasetService, DatasetUploadParams } from '../services/dataset.service';
import { useNavigate } from 'react-router-dom';

const { Dragger } = Upload;

const DatasetUpload: React.FC = () => {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  const handleUpload = async (values: { name: string; description?: string }) => {
    if (fileList.length === 0) {
      message.error('Please select a file to upload');
      return;
    }

    const file = fileList[0].originFileObj;
    const params: DatasetUploadParams = {
      file,
      name: values.name,
      description: values.description,
    };

    try {
      setUploading(true);
      const dataset = await DatasetService.uploadDataset(params);
      message.success('Dataset uploaded successfully');
      navigate(`/datasets/${dataset.id}`);
    } catch (error) {
      message.error('Failed to upload dataset');
    } finally {
      setUploading(false);
    }
  };

  const uploadProps = {
    onRemove: () => {
      setFileList([]);
    },
    beforeUpload: (file: File) => {
      setFileList([{ originFileObj: file }]);
      return false;
    },
    fileList,
    maxCount: 1,
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Form form={form} onFinish={handleUpload} layout="vertical">
        <Form.Item
          name="name"
          label="Dataset Name"
          rules={[{ required: true, message: 'Please input dataset name' }]}
        >
          <Input placeholder="Enter dataset name" />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea placeholder="Enter dataset description" />
        </Form.Item>

        <Form.Item label="Dataset File" required>
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag file to this area to upload</p>
            <p className="ant-upload-hint">
              Support for CSV, JSON, and other structured data formats
            </p>
          </Dragger>
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={uploading}
            disabled={fileList.length === 0}
            block
          >
            Upload Dataset
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default DatasetUpload; 