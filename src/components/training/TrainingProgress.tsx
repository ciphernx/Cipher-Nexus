import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Grid,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';

interface Metrics {
  loss: number;
  accuracy: number;
  epoch: number;
  step: number;
  totalSteps: number;
  learningRate: number;
}

interface TrainingEvent {
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

interface TrainingProgressProps {
  taskId: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  metrics: Metrics;
  events: TrainingEvent[];
  onStart?: () => void;
  onStop?: () => void;
  onRefresh?: () => void;
}

export function TrainingProgress({
  taskId,
  status,
  metrics,
  events,
  onStart,
  onStop,
  onRefresh,
}: TrainingProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (metrics.totalSteps > 0) {
      setProgress((metrics.step / metrics.totalSteps) * 100);
    }
  }, [metrics.step, metrics.totalSteps]);

  const formatNumber = (num: number) => {
    return num.toFixed(4);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'primary';
      case 'paused':
        return 'warning';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <ErrorIcon color="error" />;
      case 'success':
        return <SuccessIcon color="success" />;
      case 'warning':
        return <ErrorIcon color="warning" />;
      default:
        return <TimelineDot />;
    }
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Training Progress</Typography>
          <Box>
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {status === 'paused' ? (
              <Tooltip title="Resume Training">
                <IconButton onClick={onStart} size="small" color="primary">
                  <PlayIcon />
                </IconButton>
              </Tooltip>
            ) : status === 'running' ? (
              <Tooltip title="Pause Training">
                <IconButton onClick={onStop} size="small" color="warning">
                  <StopIcon />
                </IconButton>
              </Tooltip>
            ) : null}
          </Box>
        </Box>

        <Box mb={3}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2" color="textSecondary">
              Overall Progress
            </Typography>
            <Chip
              label={status.toUpperCase()}
              size="small"
              color={getStatusColor()}
              variant="outlined"
            />
          </Box>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="body2" color="textSecondary" align="right" sx={{ mt: 0.5 }}>
            {`${Math.round(progress)}%`}
          </Typography>
        </Box>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="textSecondary">
              Loss
            </Typography>
            <Typography variant="h6">{formatNumber(metrics.loss)}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="textSecondary">
              Accuracy
            </Typography>
            <Typography variant="h6">{formatNumber(metrics.accuracy)}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="textSecondary">
              Epoch
            </Typography>
            <Typography variant="h6">{metrics.epoch}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="textSecondary">
              Learning Rate
            </Typography>
            <Typography variant="h6">{formatNumber(metrics.learningRate)}</Typography>
          </Grid>
        </Grid>

        <Typography variant="subtitle2" gutterBottom>
          Training Events
        </Typography>
        <Timeline>
          {events.map((event, index) => (
            <TimelineItem key={index}>
              <TimelineSeparator>
                {getEventIcon(event.type)}
                {index < events.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent>
                <Typography variant="body2" component="span">
                  {event.message}
                </Typography>
                <Typography variant="caption" color="textSecondary" display="block">
                  {new Date(event.timestamp).toLocaleString()}
                </Typography>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </CardContent>
    </Card>
  );
} 