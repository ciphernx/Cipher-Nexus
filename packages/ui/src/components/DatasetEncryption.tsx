import React, { useState } from 'react';
import { Form, Input, Button, Card, Alert, message } from 'antd';
import { DatasetService } from '../services/dataset.service';
import { LockOutlined } from '@ant-design/icons';

interface Props {
  datasetId: string;
  encryptionStatus: string;
  onEncryptionComplete?: () => void;
}

const DatasetEncryption: React.FC<Props> = ({
  datasetId,
  encryptionStatus,
  onEncryptionComplete,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleEncrypt = async (values: { publicKey: string }) => {
    try {
      setLoading(true);
      await DatasetService.encryptDataset(datasetId, values.publicKey);
      message.success('Dataset encrypted successfully');
      onEncryptionComplete?.();
    } catch (error) {
      message.error('Failed to encrypt dataset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={
        <span>
          <LockOutlined className="mr-2" />
          Dataset Encryption
        </span>
      }
    >
      {encryptionStatus === 'encrypted' ? (
        <Alert
          message="Dataset is encrypted"
          description="This dataset has been encrypted and is ready for secure processing."
          type="success"
          showIcon
        />
      ) : (
        <>
          <Alert
            message="Dataset encryption required"
            description="To ensure data privacy and security, please encrypt your dataset using your public key."
            type="warning"
            showIcon
            className="mb-4"
          />

          <Form form={form} onFinish={handleEncrypt} layout="vertical">
            <Form.Item
              name="publicKey"
              label="Public Key"
              rules={[
                { required: true, message: 'Please input your public key' },
                { min: 32, message: 'Public key must be at least 32 characters long' },
              ]}
            >
              <Input.TextArea
                placeholder="Enter your public key"
                rows={4}
                className="font-mono"
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                Encrypt Dataset
              </Button>
            </Form.Item>
          </Form>
        </>
      )}
    </Card>
  );
};

export default DatasetEncryption; 