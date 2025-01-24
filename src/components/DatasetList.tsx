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
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  CloudUpload as UploadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { Dataset } from '../types';

interface DatasetListProps {
  datasets: Dataset[];
  onEdit: (dataset: Dataset) => void;
  onDelete: (dataset: Dataset) => void;
  onUpload: (dataset: Dataset) => void;
}

export function DatasetList({ datasets, onEdit, onDelete, onUpload }: DatasetListProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedDataset, setSelectedDataset] = React.useState<Dataset | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, dataset: Dataset) => {
    setAnchorEl(event.currentTarget);
    setSelectedDataset(dataset);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDataset(null);
  };

  const handleAction = (action: 'edit' | 'delete' | 'upload') => {
    if (selectedDataset) {
      switch (action) {
        case 'edit':
          onEdit(selectedDataset);
          break;
        case 'delete':
          onDelete(selectedDataset);
          break;
        case 'upload':
          onUpload(selectedDataset);
          break;
      }
    }
    handleMenuClose();
  };

  const getStatusColor = (status: Dataset['status']) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'processing':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Grid container spacing={3}>
      {datasets.map((dataset) => (
        <Grid item xs={12} sm={6} md={4} key={dataset.id}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Typography variant="h6" component="h2" gutterBottom>
                  {dataset.name}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => handleMenuOpen(e, dataset)}
                >
                  <MoreVertIcon />
                </IconButton>
              </Box>

              <Typography color="textSecondary" gutterBottom>
                {dataset.description}
              </Typography>

              <Box display="flex" gap={1} mb={1}>
                <Chip
                  label={dataset.status}
                  size="small"
                  color={getStatusColor(dataset.status)}
                />
                <Chip
                  label={dataset.type}
                  size="small"
                  variant="outlined"
                />
              </Box>

              <Typography variant="body2" color="textSecondary">
                Size: {(dataset.size / 1024 / 1024).toFixed(2)} MB
              </Typography>

              {dataset.status === 'processing' && (
                <Box mt={1}>
                  <LinearProgress />
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
        <MenuItem onClick={() => handleAction('edit')}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => handleAction('upload')}>
          <UploadIcon fontSize="small" sx={{ mr: 1 }} />
          Upload Data
        </MenuItem>
        <MenuItem onClick={() => handleAction('delete')} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Grid>
  );
} 