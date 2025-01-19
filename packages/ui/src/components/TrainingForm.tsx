import React from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Stack,
  Typography,
  Switch,
  FormControlLabel,
  SelectChangeEvent,
} from '@mui/material';
import { ModelType, TaskType, CompressionType, DistributedStrategy } from '@ciphernx/ai';

interface TrainingFormProps {
  onSubmit: (config: TrainingConfig) => void;
}

interface TrainingConfig {
  name: string;
  type: ModelType;
  task: TaskType;
  epochs: number;
  batchSize: number;
  learningRate: number;
  compression: {
    enabled: boolean;
    type: CompressionType;
  };
  distributed: {
    enabled: boolean;
    strategy: DistributedStrategy;
    workers: number;
  };
}

export const TrainingForm: React.FC<TrainingFormProps> = ({ onSubmit }) => {
  const [config, setConfig] = React.useState<TrainingConfig>({
    name: '',
    type: ModelType.TENSORFLOW,
    task: TaskType.CLASSIFICATION,
    epochs: 10,
    batchSize: 32,
    learningRate: 0.001,
    compression: {
      enabled: false,
      type: CompressionType.QUANTIZATION,
    },
    distributed: {
      enabled: false,
      strategy: DistributedStrategy.DATA_PARALLEL,
      workers: 2,
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(config);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig({ ...config, [name]: value });
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig({ ...config, [name]: Number(value) });
  };

  const handleSelectChange = (e: SelectChangeEvent<any>, field: keyof TrainingConfig) => {
    setConfig({ ...config, [field]: e.target.value });
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Training Configuration
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              name="name"
              label="Model Name"
              value={config.name}
              onChange={handleTextChange}
              required
            />

            <FormControl fullWidth>
              <InputLabel>Model Type</InputLabel>
              <Select
                value={config.type}
                label="Model Type"
                onChange={(e) => handleSelectChange(e, 'type')}
              >
                {Object.values(ModelType).map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Task Type</InputLabel>
              <Select
                value={config.task}
                label="Task Type"
                onChange={(e) => handleSelectChange(e, 'task')}
              >
                {Object.values(TaskType).map((task) => (
                  <MenuItem key={task} value={task}>
                    {task}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              name="epochs"
              label="Epochs"
              type="number"
              value={config.epochs}
              onChange={handleNumberChange}
              required
            />

            <TextField
              name="batchSize"
              label="Batch Size"
              type="number"
              value={config.batchSize}
              onChange={handleNumberChange}
              required
            />

            <TextField
              name="learningRate"
              label="Learning Rate"
              type="number"
              inputProps={{ step: 0.0001 }}
              value={config.learningRate}
              onChange={handleNumberChange}
              required
            />

            <FormControlLabel
              control={
                <Switch
                  checked={config.compression.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      compression: { ...config.compression, enabled: e.target.checked },
                    })
                  }
                />
              }
              label="Enable Model Compression"
            />

            {config.compression.enabled && (
              <FormControl fullWidth>
                <InputLabel>Compression Type</InputLabel>
                <Select
                  value={config.compression.type}
                  label="Compression Type"
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      compression: {
                        ...config.compression,
                        type: e.target.value as CompressionType,
                      },
                    })
                  }
                >
                  {Object.values(CompressionType).map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={config.distributed.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      distributed: { ...config.distributed, enabled: e.target.checked },
                    })
                  }
                />
              }
              label="Enable Distributed Training"
            />

            {config.distributed.enabled && (
              <>
                <FormControl fullWidth>
                  <InputLabel>Distribution Strategy</InputLabel>
                  <Select
                    value={config.distributed.strategy}
                    label="Distribution Strategy"
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        distributed: {
                          ...config.distributed,
                          strategy: e.target.value as DistributedStrategy,
                        },
                      })
                    }
                  >
                    {Object.values(DistributedStrategy).map((strategy) => (
                      <MenuItem key={strategy} value={strategy}>
                        {strategy}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  name="workers"
                  label="Number of Workers"
                  type="number"
                  value={config.distributed.workers}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      distributed: {
                        ...config.distributed,
                        workers: parseInt(e.target.value),
                      },
                    })
                  }
                  required={config.distributed.enabled}
                />
              </>
            )}

            <Button type="submit" variant="contained" color="primary" size="large">
              Start Training
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}; 