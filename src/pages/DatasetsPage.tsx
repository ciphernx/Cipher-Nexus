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
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { DatasetList } from '../components/DatasetList';
import { useDatasets } from '../hooks/useDatasets';
import { Dataset } from '../types';

export function DatasetsPage() {
  const {
    datasets,
    loading,
    error,
    createDataset,
    updateDataset,
    deleteDataset,
    uploadDataset,
  } = useDatasets();

  const [openDialog, setOpenDialog] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<'create' | 'edit'>('create');
  const [selectedDataset, setSelectedDataset] = React.useState<Dataset | null>(null);
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    type: 'private' as const,
  });
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);

  const handleOpenDialog = (mode: 'create' | 'edit', dataset?: Dataset) => {
    setDialogMode(mode);
    if (mode === 'edit' && dataset) {
      setSelectedDataset(dataset);
      setFormData({
        name: dataset.name,
        description: dataset.description,
        type: dataset.type,
      });
    } else {
      setSelectedDataset(null);
      setFormData({
        name: '',
        description: '',
        type: 'private',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedDataset(null);
    setFormData({
      name: '',
      description: '',
      type: 'private',
    });
    setUploadFile(null);
  };

  const handleSubmit = async () => {
    try {
      if (dialogMode === 'create') {
        const newDataset = await createDataset(formData);
        if (newDataset && uploadFile) {
          await uploadDataset(newDataset.id, uploadFile);
        }
      } else if (dialogMode === 'edit' && selectedDataset) {
        await updateDataset(selectedDataset.id, formData);
        if (uploadFile) {
          await uploadDataset(selectedDataset.id, uploadFile);
        }
      }
      handleCloseDialog();
    } catch (err) {
      console.error('Failed to save dataset:', err);
    }
  };

  const handleDelete = async (dataset: Dataset) => {
    if (window.confirm('Are you sure you want to delete this dataset?')) {
      await deleteDataset(dataset.id);
    }
  };

  const handleUpload = async (dataset: Dataset) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json,.txt';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await uploadDataset(dataset.id, file);
      }
    };
    input.click();
  };

  if (loading && datasets.length === 0) {
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
          Datasets
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog('create')}
        >
          Add Dataset
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <DatasetList
        datasets={datasets}
        onEdit={(dataset) => handleOpenDialog('edit', dataset)}
        onDelete={handleDelete}
        onUpload={handleUpload}
      />

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === 'create' ? 'Create New Dataset' : 'Edit Dataset'}
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
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'public' | 'private' })}
                label="Type"
              >
                <MenuItem value="private">Private</MenuItem>
                <MenuItem value="public">Public</MenuItem>
              </Select>
            </FormControl>
            {dialogMode === 'create' && (
              <Button
                variant="outlined"
                component="label"
                fullWidth
              >
                {uploadFile ? uploadFile.name : 'Upload Data File'}
                <input
                  type="file"
                  hidden
                  accept=".csv,.json,.txt"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </Button>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={!formData.name}
          >
            {dialogMode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 