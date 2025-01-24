import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
  Grid,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Help as HelpIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

interface ModelParameter {
  name: string;
  type: 'number' | 'boolean' | 'select' | 'range';
  value: any;
  options?: any[];
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

interface ModelConfigProps {
  modelType: string;
  parameters: ModelParameter[];
  onChange: (params: Record<string, any>) => void;
}

const defaultParameters: Record<string, ModelParameter[]> = {
  linear: [
    {
      name: 'learning_rate',
      type: 'range',
      value: 0.01,
      min: 0.0001,
      max: 0.1,
      step: 0.0001,
      description: 'Learning rate for gradient descent',
    },
    {
      name: 'regularization',
      type: 'select',
      value: 'l2',
      options: ['none', 'l1', 'l2', 'elastic'],
      description: 'Type of regularization to prevent overfitting',
    },
    {
      name: 'fit_intercept',
      type: 'boolean',
      value: true,
      description: 'Whether to calculate the intercept for this model',
    },
  ],
  logistic: [
    {
      name: 'learning_rate',
      type: 'range',
      value: 0.01,
      min: 0.0001,
      max: 0.1,
      step: 0.0001,
      description: 'Learning rate for gradient descent',
    },
    {
      name: 'max_iterations',
      type: 'number',
      value: 100,
      min: 10,
      max: 1000,
      description: 'Maximum number of iterations',
    },
    {
      name: 'regularization',
      type: 'select',
      value: 'l2',
      options: ['none', 'l1', 'l2', 'elastic'],
      description: 'Type of regularization to prevent overfitting',
    },
  ],
  neural: [
    {
      name: 'hidden_layers',
      type: 'select',
      value: '[64,32]',
      options: ['[32]', '[64,32]', '[128,64,32]', '[256,128,64,32]'],
      description: 'Architecture of hidden layers',
    },
    {
      name: 'activation',
      type: 'select',
      value: 'relu',
      options: ['relu', 'tanh', 'sigmoid'],
      description: 'Activation function for hidden layers',
    },
    {
      name: 'learning_rate',
      type: 'range',
      value: 0.001,
      min: 0.0001,
      max: 0.01,
      step: 0.0001,
      description: 'Learning rate for gradient descent',
    },
    {
      name: 'dropout_rate',
      type: 'range',
      value: 0.2,
      min: 0,
      max: 0.5,
      step: 0.1,
      description: 'Dropout rate for regularization',
    },
    {
      name: 'batch_size',
      type: 'select',
      value: '32',
      options: ['16', '32', '64', '128'],
      description: 'Mini-batch size for training',
    },
  ],
};

export function ModelConfig({ modelType, parameters, onChange }: ModelConfigProps) {
  const [expanded, setExpanded] = React.useState(true);
  const [currentParams, setCurrentParams] = React.useState<Record<string, any>>(() => {
    const params: Record<string, any> = {};
    parameters.forEach((param) => {
      params[param.name] = param.value;
    });
    return params;
  });

  const handleParamChange = (name: string, value: any) => {
    const newParams = {
      ...currentParams,
      [name]: value,
    };
    setCurrentParams(newParams);
    onChange(newParams);
  };

  const renderParameter = (param: ModelParameter) => {
    switch (param.type) {
      case 'number':
        return (
          <TextField
            type="number"
            value={currentParams[param.name]}
            onChange={(e) => handleParamChange(param.name, Number(e.target.value))}
            inputProps={{
              min: param.min,
              max: param.max,
              step: param.step || 1,
            }}
            fullWidth
          />
        );
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={currentParams[param.name]}
                onChange={(e) => handleParamChange(param.name, e.target.checked)}
              />
            }
            label={param.name}
          />
        );
      case 'select':
        return (
          <FormControl fullWidth>
            <InputLabel>{param.name}</InputLabel>
            <Select
              value={currentParams[param.name]}
              label={param.name}
              onChange={(e) => handleParamChange(param.name, e.target.value)}
            >
              {param.options?.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case 'range':
        return (
          <Box>
            <Typography gutterBottom>
              {param.name}: {currentParams[param.name]}
            </Typography>
            <Slider
              value={currentParams[param.name]}
              onChange={(_, value) => handleParamChange(param.name, value)}
              min={param.min}
              max={param.max}
              step={param.step}
              valueLabelDisplay="auto"
            />
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" component="h3">
            Model Configuration
          </Typography>
          <IconButton onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        <Collapse in={expanded}>
          <Grid container spacing={3}>
            {parameters.map((param) => (
              <Grid item xs={12} sm={6} key={param.name}>
                <Box mb={2}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                      {param.name.replace(/_/g, ' ')}
                    </Typography>
                    {param.description && (
                      <Tooltip title={param.description}>
                        <IconButton size="small">
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                  {renderParameter(param)}
                </Box>
              </Grid>
            ))}
          </Grid>
        </Collapse>
      </CardContent>
    </Card>
  );
}

export { defaultParameters }; 