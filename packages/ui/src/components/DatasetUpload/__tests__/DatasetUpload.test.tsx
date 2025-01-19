import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/utils';
import { DatasetUpload } from '../index';

describe('DatasetUpload', () => {
  const mockOnClose = vi.fn();
  const mockOnUploadComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render upload modal when open', () => {
    render(
      <DatasetUpload
        isOpen={true}
        onClose={mockOnClose}
        onUploadComplete={mockOnUploadComplete}
      />
    );

    expect(screen.getByText(/upload dataset/i)).toBeInTheDocument();
    expect(screen.getByText(/drag and drop your file here/i)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <DatasetUpload
        isOpen={false}
        onClose={mockOnClose}
        onUploadComplete={mockOnUploadComplete}
      />
    );

    expect(screen.queryByText(/upload dataset/i)).not.toBeInTheDocument();
  });

  it('should handle file selection', async () => {
    render(
      <DatasetUpload
        isOpen={true}
        onClose={mockOnClose}
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByTestId('file-input');

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/test\.csv/i)).toBeInTheDocument();
    });
  });

  it('should show upload progress', async () => {
    render(
      <DatasetUpload
        isOpen={true}
        onClose={mockOnClose}
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByTestId('file-input');

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('should call onClose when cancel button is clicked', () => {
    render(
      <DatasetUpload
        isOpen={true}
        onClose={mockOnClose}
        onUploadComplete={mockOnUploadComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle drag and drop', async () => {
    render(
      <DatasetUpload
        isOpen={true}
        onClose={mockOnClose}
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
    const dropzone = screen.getByTestId('dropzone');

    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/test\.csv/i)).toBeInTheDocument();
    });
  });
}); 