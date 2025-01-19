import React, { useState } from 'react';
import { Form, Switch, Button, Card, message } from 'antd';
import { DatasetService, PreprocessingOptions } from '../services/dataset.service';

interface Props {
  datasetId: string;
  onPreprocessingComplete?: () => void;
}

const DatasetPreprocessing: React.FC<Props> = ({ datasetId, onPreprocessingComplete }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handlePreprocess = async (values: PreprocessingOptions) => {
    try {
      setLoading(true);
      await DatasetService.preprocessDataset(datasetId, values);
      message.success('Dataset preprocessing completed successfully');
      onPreprocessingComplete?.();
    } catch (error) {
      message.error('Failed to preprocess dataset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Preprocessing Options">
      <Form
        form={form}
        onFinish={handlePreprocess}
        layout="vertical"
        initialValues={{
          normalize: false,
          removeOutliers: false,
          fillMissingValues: false,
        }}
      >
        <Form.Item
          name="normalize"
          label="Normalize Data"
          valuePropName="checked"
          extra="Scale numerical features to a standard range"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="removeOutliers"
          label="Remove Outliers"
          valuePropName="checked"
          extra="Detect and remove statistical outliers from the dataset"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="fillMissingValues"
          label="Fill Missing Values"
          valuePropName="checked"
          extra="Automatically fill missing values using appropriate strategies"
        >
          <Switch />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Apply Preprocessing
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default DatasetPreprocessing; 