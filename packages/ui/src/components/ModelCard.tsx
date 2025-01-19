import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Stack,
  LinearProgress,
} from '@mui/material';
import { ModelType, TaskType } from '@ciphernx/ai';

interface ModelCardProps {
  name: string;
  type: ModelType;
  task: TaskType;
  accuracy: number;
  status: 'training' | 'ready' | 'error';
  onTrain?: () => void;
  onDelete?: () => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  name,
  type,
  task,
  accuracy,
  status,
  onTrain,
  onDelete,
}) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          {name}
        </Typography>
        <Stack direction="row" spacing={1} mb={2}>
          <Chip label={type} color="primary" size="small" />
          <Chip label={task} color="secondary" size="small" />
          <Chip
            label={status}
            color={
              status === 'ready'
                ? 'success'
                : status === 'training'
                ? 'warning'
                : 'error'
            }
            size="small"
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Accuracy
        </Typography>
        <LinearProgress
          variant="determinate"
          value={accuracy * 100}
          sx={{ height: 8, borderRadius: 4 }}
        />
        <Typography variant="body2" color="text.secondary" align="right">
          {(accuracy * 100).toFixed(1)}%
        </Typography>
      </CardContent>
      <CardActions>
        <Button size="small" onClick={onTrain} disabled={status === 'training'}>
          {status === 'training' ? 'Training...' : 'Train'}
        </Button>
        <Button size="small" color="error" onClick={onDelete}>
          Delete
        </Button>
      </CardActions>
    </Card>
  );
}; 