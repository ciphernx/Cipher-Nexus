import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/utils';
import { Models } from '../index';
import { server } from '../../../test/setup';
import { rest } from 'msw';

describe('Models Integration', () => {
  it('should render models list', async () => {
    render(<Models />);

    await waitFor(() => {
      expect(screen.getByText('Test Model')).toBeInTheDocument();
      expect(screen.getByText('A test model')).toBeInTheDocument();
    });
  });

  it('should handle model training', async () => {
    server.use(
      rest.post('http://localhost:8080/api/models/:id/train', async (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            id: '1',
            status: 'training',
            config: {
              epochs: 100,
              batchSize: 32,
              learningRate: 0.001,
              privacyBudget: 1.0,
            },
          })
        );
      })
    );

    render(<Models />);

    // Open training modal
    fireEvent.click(screen.getByRole('button', { name: /train model/i }));

    // Configure training parameters
    fireEvent.change(screen.getByLabelText(/epochs/i), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText(/batch size/i), {
      target: { value: '32' },
    });

    // Start training
    fireEvent.click(screen.getByRole('button', { name: /start training/i }));

    await waitFor(() => {
      expect(screen.getByText(/training in progress/i)).toBeInTheDocument();
    });
  });

  it('should handle model deployment', async () => {
    server.use(
      rest.post('http://localhost:8080/api/models/:id/deploy', async (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            id: '1',
            status: 'deploying',
            config: {
              replicas: 2,
              cpuLimit: '1',
              memoryLimit: '2Gi',
            },
          })
        );
      })
    );

    render(<Models />);

    // Open deployment modal
    fireEvent.click(screen.getByRole('button', { name: /deploy/i }));

    // Configure deployment
    fireEvent.change(screen.getByLabelText(/replicas/i), {
      target: { value: '2' },
    });

    // Start deployment
    fireEvent.click(screen.getByRole('button', { name: /confirm deployment/i }));

    await waitFor(() => {
      expect(screen.getByText(/deployment in progress/i)).toBeInTheDocument();
    });
  });

  it('should handle model deletion', async () => {
    server.use(
      rest.delete('http://localhost:8080/api/models/:id', async (req, res, ctx) => {
        return res(ctx.status(200));
      })
    );

    render(<Models />);

    await waitFor(() => {
      expect(screen.getByText('Test Model')).toBeInTheDocument();
    });

    // Open delete confirmation
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    // Confirm deletion
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.queryByText('Test Model')).not.toBeInTheDocument();
    });
  });

  it('should handle error states', async () => {
    server.use(
      rest.get('http://localhost:8080/api/models', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ message: 'Server error' }));
      })
    );

    render(<Models />);

    await waitFor(() => {
      expect(screen.getByText(/error loading models/i)).toBeInTheDocument();
    });
  });

  it('should navigate to model detail page', async () => {
    const mockNavigate = vi.fn();
    vi.mock('react-router-dom', () => ({
      ...vi.importActual('react-router-dom'),
      useNavigate: () => mockNavigate,
    }));

    render(<Models />);

    await waitFor(() => {
      expect(screen.getByText('Test Model')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Test Model'));

    expect(mockNavigate).toHaveBeenCalledWith('/models/1');
  });
}); 