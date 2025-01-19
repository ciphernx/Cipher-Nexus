import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/utils';
import { Datasets } from '../index';
import { server } from '../../../test/setup';
import { rest } from 'msw';

describe('Datasets Integration', () => {
  it('should render datasets list', async () => {
    render(<Datasets />);

    await waitFor(() => {
      expect(screen.getByText('Test Dataset')).toBeInTheDocument();
      expect(screen.getByText('A test dataset')).toBeInTheDocument();
    });
  });

  it('should handle dataset upload', async () => {
    server.use(
      rest.post('http://localhost:8080/api/datasets', async (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            id: '2',
            name: 'New Dataset',
            description: 'A newly uploaded dataset',
            size: 2000,
            recordCount: 200,
            createdAt: '2024-01-02T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
            status: 'processing',
            type: 'tabular',
            privacyScore: 0.9,
          })
        );
      })
    );

    render(<Datasets />);

    // Open upload modal
    fireEvent.click(screen.getByRole('button', { name: /upload dataset/i }));

    // Upload a file
    const file = new File(['test content'], 'new-dataset.csv', {
      type: 'text/csv',
    });
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [file] } });

    // Click upload button
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText('New Dataset')).toBeInTheDocument();
    });
  });

  it('should handle dataset deletion', async () => {
    server.use(
      rest.delete(
        'http://localhost:8080/api/datasets/:id',
        async (req, res, ctx) => {
          return res(ctx.status(200));
        }
      )
    );

    render(<Datasets />);

    await waitFor(() => {
      expect(screen.getByText('Test Dataset')).toBeInTheDocument();
    });

    // Open delete confirmation
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    // Confirm deletion
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.queryByText('Test Dataset')).not.toBeInTheDocument();
    });
  });

  it('should handle dataset filtering', async () => {
    server.use(
      rest.get('http://localhost:8080/api/datasets', (req, res, ctx) => {
        const type = req.url.searchParams.get('type');
        const status = req.url.searchParams.get('status');

        if (type === 'tabular' && status === 'ready') {
          return res(
            ctx.status(200),
            ctx.json([
              {
                id: '1',
                name: 'Filtered Dataset',
                description: 'A filtered dataset',
                size: 1000,
                recordCount: 100,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
                status: 'ready',
                type: 'tabular',
                privacyScore: 0.95,
              },
            ])
          );
        }
        return res(ctx.status(200), ctx.json([]));
      })
    );

    render(<Datasets />);

    // Apply filters
    fireEvent.change(screen.getByLabelText(/type/i), {
      target: { value: 'tabular' },
    });
    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: 'ready' },
    });

    await waitFor(() => {
      expect(screen.getByText('Filtered Dataset')).toBeInTheDocument();
    });
  });

  it('should handle error states', async () => {
    server.use(
      rest.get('http://localhost:8080/api/datasets', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ message: 'Server error' }));
      })
    );

    render(<Datasets />);

    await waitFor(() => {
      expect(screen.getByText(/error loading datasets/i)).toBeInTheDocument();
    });
  });

  it('should navigate to dataset detail page', async () => {
    const mockNavigate = vi.fn();
    vi.mock('react-router-dom', () => ({
      ...vi.importActual('react-router-dom'),
      useNavigate: () => mockNavigate,
    }));

    render(<Datasets />);

    await waitFor(() => {
      expect(screen.getByText('Test Dataset')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Test Dataset'));

    expect(mockNavigate).toHaveBeenCalledWith('/datasets/1');
  });
}); 