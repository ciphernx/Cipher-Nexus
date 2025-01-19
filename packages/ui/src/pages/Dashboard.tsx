import React from 'react';
import { Container, Grid, Typography, Box } from '@mui/material';
import { ModelCard } from '../components/ModelCard';
import { TrainingForm } from '../components/TrainingForm';
import { ModelMetrics } from '../components/ModelMetrics';
import { ModelType, TaskType } from '@ciphernx/ai';

const mockModels = [
  {
    name: 'Image Classifier',
    type: ModelType.TENSORFLOW,
    task: TaskType.CLASSIFICATION,
    accuracy: 0.95,
    status: 'ready' as const,
  },
  {
    name: 'Text Generator',
    type: ModelType.PYTORCH,
    task: TaskType.NLP,
    accuracy: 0.88,
    status: 'training' as const,
  },
];

const mockMetrics = Array.from({ length: 10 }, (_, i) => ({
  epoch: i + 1,
  loss: Math.random() * 0.5,
  accuracy: 0.7 + Math.random() * 0.3,
  valLoss: Math.random() * 0.6,
  valAccuracy: 0.65 + Math.random() * 0.3,
}));

export const Dashboard: React.FC = () => {
  const handleTrainingSubmit = (config: any) => {
    console.log('Training config:', config);
  };

  const handleModelTrain = (modelName: string) => {
    console.log('Training model:', modelName);
  };

  const handleModelDelete = (modelName: string) => {
    console.log('Deleting model:', modelName);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Model Management Dashboard
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} lg={8}>
          <Box mb={4}>
            <Typography variant="h5" gutterBottom>
              Your Models
            </Typography>
            <Grid container spacing={3}>
              {mockModels.map((model) => (
                <Grid item xs={12} sm={6} key={model.name}>
                  <ModelCard
                    {...model}
                    onTrain={() => handleModelTrain(model.name)}
                    onDelete={() => handleModelDelete(model.name)}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box>
            <ModelMetrics metrics={mockMetrics} />
          </Box>
        </Grid>

        <Grid item xs={12} lg={4}>
          <TrainingForm onSubmit={handleTrainingSubmit} />
        </Grid>
      </Grid>
    </Container>
  );
}; 