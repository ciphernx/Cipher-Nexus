import React from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { TrainingTaskList } from '../components/TrainingTaskList';
import { useTrainingTasks } from '../hooks/useTrainingTasks';
import { useDatasets } from '../hooks/useDatasets';
import { TrainingTask } from '../types';

export function TrainingPage() {
  const {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    startTask,
    stopTask,
  } = useTrainingTasks();

  const { datasets } = useDatasets();

  const [openDialog, setOpenDialog] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<'create' | 'edit'>('create');
  const [selectedTask, setSelectedTask] = React.useState<TrainingTask | null>(null);
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    dataset: '',
    model: '',
    parameters: {},
  });
  const [openResults, setOpenResults] = React.useState(false);
  const [selectedResults, setSelectedResults] = React.useState<Record<string, any> | null>(null);

  const handleOpenDialog = (mode: 'create' | 'edit', task?: TrainingTask) => {
    setDialogMode(mode);
    if (mode === 'edit' && task) {
      setSelectedTask(task);
      setFormData({
        name: task.name,
        description: task.description,
        dataset: task.dataset,
        model: task.model,
        parameters: task.parameters,
      });
    } else {
      setSelectedTask(null);
      setFormData({
        name: '',
        description: '',
        dataset: '',
        model: '',
        parameters: {},
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedTask(null);
    setFormData({
      name: '',
      description: '',
      dataset: '',
      model: '',
      parameters: {},
    });
  };

  const handleSubmit = async () => {
    try {
      if (dialogMode === 'create') {
        await createTask(formData);
      } else if (dialogMode === 'edit' && selectedTask) {
        await updateTask(selectedTask.id, formData);
      }
      handleCloseDialog();
    } catch (err) {
      console.error('Failed to save training task:', err);
    }
  };

  const handleDelete = async (task: TrainingTask) => {
    if (window.confirm('Are you sure you want to delete this training task?')) {
      await deleteTask(task.id);
    }
  };

  const handleViewResults = (task: TrainingTask) => {
    setSelectedResults(task.results || null);
    setOpenResults(true);
  };

  if (loading && tasks.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Training Tasks
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog('create')}
        >
          New Training Task
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TrainingTaskList
        tasks={tasks}
        onEdit={(task) => handleOpenDialog('edit', task)}
        onDelete={handleDelete}
        onStart={startTask}
        onStop={stopTask}
        onViewResults={handleViewResults}
      />

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === 'create' ? 'Create New Training Task' : 'Edit Training Task'}
        </DialogTitle>
        <DialogContent>
          <Box mt={2} display="flex" flexDirection="column" gap={2}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            <FormControl fullWidth>
              <InputLabel>Dataset</InputLabel>
              <Select
                value={formData.dataset}
                onChange={(e) => setFormData({ ...formData, dataset: e.target.value })}
                label="Dataset"
              >
                {datasets.map((dataset) => (
                  <MenuItem key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Model</InputLabel>
              <Select
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                label="Model"
              >
                <MenuItem value="linear">Linear Regression</MenuItem>
                <MenuItem value="logistic">Logistic Regression</MenuItem>
                <MenuItem value="neural">Neural Network</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={!formData.name || !formData.dataset || !formData.model}
          >
            {dialogMode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openResults}
        onClose={() => setOpenResults(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Training Results</DialogTitle>
        <DialogContent>
          {selectedResults ? (
            <Grid container spacing={2} mt={1}>
              {Object.entries(selectedResults).map(([key, value]) => (
                <Grid item xs={12} sm={6} key={key}>
                  <Typography variant="subtitle2" color="textSecondary">
                    {key}
                  </Typography>
                  <Typography variant="body1">
                    {typeof value === 'number' ? value.toFixed(4) : String(value)}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Typography color="textSecondary">No results available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenResults(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 