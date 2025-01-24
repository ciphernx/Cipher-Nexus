import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  IconButton,
  Chip,
  Box,
  LinearProgress,
  Menu,
  MenuItem,
  Button,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assessment as ResultsIcon,
} from '@mui/icons-material';
import { TrainingTask } from '../types';

interface TrainingTaskListProps {
  tasks: TrainingTask[];
  onEdit: (task: TrainingTask) => void;
  onDelete: (task: TrainingTask) => void;
  onStart: (task: TrainingTask) => void;
  onStop: (task: TrainingTask) => void;
  onViewResults: (task: TrainingTask) => void;
}

export function TrainingTaskList({
  tasks,
  onEdit,
  onDelete,
  onStart,
  onStop,
  onViewResults,
}: TrainingTaskListProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedTask, setSelectedTask] = React.useState<TrainingTask | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, task: TrainingTask) => {
    setAnchorEl(event.currentTarget);
    setSelectedTask(task);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTask(null);
  };

  const handleAction = (action: 'edit' | 'delete' | 'start' | 'stop' | 'results') => {
    if (selectedTask) {
      switch (action) {
        case 'edit':
          onEdit(selectedTask);
          break;
        case 'delete':
          onDelete(selectedTask);
          break;
        case 'start':
          onStart(selectedTask);
          break;
        case 'stop':
          onStop(selectedTask);
          break;
        case 'results':
          onViewResults(selectedTask);
          break;
      }
    }
    handleMenuClose();
  };

  const getStatusColor = (status: TrainingTask['status']) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'pending':
        return 'warning';
      case 'completed':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Grid container spacing={3}>
      {tasks.map((task) => (
        <Grid item xs={12} sm={6} md={4} key={task.id}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Typography variant="h6" component="h2" gutterBottom>
                  {task.name}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => handleMenuOpen(e, task)}
                >
                  <MoreVertIcon />
                </IconButton>
              </Box>

              <Typography color="textSecondary" gutterBottom>
                {task.description}
              </Typography>

              <Box display="flex" gap={1} mb={1}>
                <Chip
                  label={task.status}
                  size="small"
                  color={getStatusColor(task.status)}
                />
                <Chip
                  label={task.model}
                  size="small"
                  variant="outlined"
                />
              </Box>

              <Typography variant="body2" color="textSecondary" gutterBottom>
                Dataset: {task.dataset}
              </Typography>

              {(task.status === 'running' || task.status === 'pending') && (
                <Box mt={2}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="textSecondary">
                      Progress
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {task.progress}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={task.progress}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
              )}

              {task.status === 'completed' && (
                <Box mt={2}>
                  <Button
                    variant="outlined"
                    startIcon={<ResultsIcon />}
                    size="small"
                    onClick={() => handleAction('results')}
                    fullWidth
                  >
                    View Results
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedTask?.status !== 'running' && (
          <MenuItem onClick={() => handleAction('start')}>
            <StartIcon fontSize="small" sx={{ mr: 1 }} />
            Start Training
          </MenuItem>
        )}
        {selectedTask?.status === 'running' && (
          <MenuItem onClick={() => handleAction('stop')}>
            <StopIcon fontSize="small" sx={{ mr: 1 }} />
            Stop Training
          </MenuItem>
        )}
        <MenuItem onClick={() => handleAction('edit')}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        {selectedTask?.status === 'completed' && (
          <MenuItem onClick={() => handleAction('results')}>
            <ResultsIcon fontSize="small" sx={{ mr: 1 }} />
            View Results
          </MenuItem>
        )}
        <MenuItem onClick={() => handleAction('delete')} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Grid>
  );
} 