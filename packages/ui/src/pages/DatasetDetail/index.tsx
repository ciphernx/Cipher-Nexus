import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/DataDisplay';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/Modal/ConfirmDialog';
import { DatasetStats } from '../../components/Charts/DatasetStats';
import { DatasetAnalysis } from '../../components/Charts/DatasetAnalysis';
import { datasetService } from '../../services/dataset';
import {
  DocumentIcon,
  LockClosedIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  TableCellsIcon,
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';

const ROWS_PER_PAGE = 10;

const mockDataset = {
  id: 1,
  name: 'Medical Records 2024',
  description: 'Anonymized medical records dataset for training healthcare models',
  size: '2.5GB',
  type: 'CSV',
  status: 'Ready',
  lastModified: '2024-01-15',
  privacyScore: 98,
  recordCount: 150000,
  fields: [
    { name: 'patient_id', type: 'string', encrypted: true },
    { name: 'age', type: 'number', encrypted: false },
    { name: 'diagnosis', type: 'string', encrypted: true },
    { name: 'treatment', type: 'string', encrypted: true },
    { name: 'medication', type: 'string', encrypted: true },
  ],
  privacyMeasures: [
    { name: 'Differential Privacy', status: 'Enabled', level: 'High' },
    { name: 'Encryption', status: 'Enabled', level: 'AES-256' },
    { name: 'Data Masking', status: 'Enabled', level: 'Partial' },
  ],
};

const stats = [
  { name: 'Total Records', value: '150,000', icon: DocumentIcon },
  { name: 'Privacy Score', value: '98%', icon: LockClosedIcon },
  { name: 'Processing Status', value: 'Ready', icon: ChartBarIcon },
  { name: 'Last Updated', value: '2024-01-15', icon: CloudArrowUpIcon },
];

export const DatasetDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // State
  const [dataset, setDataset] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEncryptDialog, setShowEncryptDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        const [datasetData, statsData, analysisData] = await Promise.all([
          datasetService.getDataset(id),
          datasetService.getDatasetStats(id),
          datasetService.getDatasetAnalysis(id),
        ]);
        
        setDataset(datasetData);
        setStats(statsData);
        setAnalysis(analysisData);
      } catch (error) {
        console.error('Failed to load dataset:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id]);

  // 加载预览数据
  useEffect(() => {
    const loadPreview = async () => {
      if (!id || !showPreview) return;
      
      try {
        const previewData = await datasetService.getDatasetPreview(
          id,
          currentPage,
          ROWS_PER_PAGE
        );
        setPreview(previewData);
      } catch (error) {
        console.error('Failed to load preview:', error);
      }
    };

    loadPreview();
  }, [id, showPreview, currentPage]);

  const handleEncrypt = async () => {
    if (!id) return;
    
    try {
      setIsEncrypting(true);
      await datasetService.encryptDataset(id, {
        algorithm: 'AES-256',
        keySize: 256,
      });
      setShowEncryptDialog(false);
      // 重新加载数据集信息
      const datasetData = await datasetService.getDataset(id);
      setDataset(datasetData);
    } catch (error) {
      console.error('Encryption failed:', error);
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    
    try {
      setIsDeleting(true);
      await datasetService.deleteDataset(id);
      navigate('/datasets');
    } catch (error) {
      console.error('Deletion failed:', error);
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json' | 'excel') => {
    if (!id) return;
    
    try {
      const blob = await datasetService.exportDataset(id, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dataset-${id}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setShowExportDialog(false);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (isLoading || !dataset || !stats) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{dataset.name}</h1>
          <p className="mt-2 text-sm text-gray-700">{dataset.description}</p>
        </div>
        <div className="flex space-x-4">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            icon={<TableCellsIcon className="h-5 w-5" />}
          >
            Preview Data
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowExportDialog(true)}
            icon={<ArrowDownTrayIcon className="h-5 w-5" />}
          >
            Export
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowEncryptDialog(true)}
            icon={<LockClosedIcon className="h-5 w-5" />}
          >
            Encrypt Dataset
          </Button>
          <Button
            variant="outline"
            color="danger"
            onClick={() => setShowDeleteDialog(true)}
            icon={<TrashIcon className="h-5 w-5" />}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Dataset Information and Data Types */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Dataset Information</h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Total Rows</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats.rowCount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Total Columns</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats.columnCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">File Size</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats.fileSize}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Last Modified</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats.lastModified}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Missing Values</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats.missingValues}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Column Data Types</h2>
            <div className="space-y-4">
              {Object.entries(stats.dataTypes).map(([column, type]) => (
                <div key={column} className="flex justify-between">
                  <span className="text-sm text-gray-500">{column}</span>
                  <span className="text-sm font-medium text-gray-900">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Dataset Statistics */}
      <DatasetStats
        dataTypes={stats.dataTypes}
        missingValues={stats.missingValues}
        totalRows={stats.rowCount}
        distributionData={[
          { name: 'Complete', value: stats.rowCount - stats.missingValues },
          { name: 'Missing', value: stats.missingValues },
          { name: 'Outliers', value: stats.outliers },
          { name: 'Invalid', value: stats.invalidValues },
        ]}
      />

      {/* Dataset Analysis */}
      {analysis && <DatasetAnalysis {...analysis} />}

      {/* Data Preview */}
      {showPreview && preview && (
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Data Preview</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {preview.columns.map((column: string) => (
                      <th
                        key={column}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.rows.map((row: any, index: number) => (
                    <tr key={index}>
                      {Object.values(row).map((value: any, cellIndex: number) => (
                        <td
                          key={cellIndex}
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center">
                <span className="text-sm text-gray-700">
                  Showing page {currentPage} of{' '}
                  {Math.ceil(preview.totalRows / ROWS_PER_PAGE)}
                </span>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  icon={<ChevronLeftIcon className="h-5 w-5" />}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setCurrentPage((prev) =>
                      Math.min(Math.ceil(preview.totalRows / ROWS_PER_PAGE), prev + 1)
                    )
                  }
                  disabled={
                    currentPage === Math.ceil(preview.totalRows / ROWS_PER_PAGE)
                  }
                  icon={<ChevronRightIcon className="h-5 w-5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Dataset"
        message="Are you sure you want to delete this dataset? This action cannot be undone."
        confirmLabel="Delete"
        type="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />

      <ConfirmDialog
        isOpen={showEncryptDialog}
        title="Encrypt Dataset"
        message="Are you sure you want to encrypt this dataset? This will protect the data but may take some time."
        confirmLabel="Encrypt"
        type="warning"
        isLoading={isEncrypting}
        onConfirm={handleEncrypt}
        onCancel={() => setShowEncryptDialog(false)}
      />

      <ConfirmDialog
        isOpen={showExportDialog}
        title="Export Dataset"
        message="Choose the export format:"
        confirmLabel="Export"
        type="info"
        onConfirm={() => handleExport('csv')}
        onCancel={() => setShowExportDialog(false)}
      >
        <div className="mt-4 space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleExport('csv')}
          >
            Export as CSV
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleExport('json')}
          >
            Export as JSON
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleExport('excel')}
          >
            Export as Excel
          </Button>
        </div>
      </ConfirmDialog>
    </div>
  );
};

export default DatasetDetail; 