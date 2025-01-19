import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/utils';
import { Privacy } from '../index';
import { server } from '../../../test/setup';
import { rest } from 'msw';

describe('Privacy Integration', () => {
  it('should render privacy settings', async () => {
    render(<Privacy />);

    await waitFor(() => {
      expect(screen.getByText('Differential Privacy')).toBeInTheDocument();
      expect(screen.getByText('Homomorphic Encryption')).toBeInTheDocument();
      expect(screen.getByText('Secure Aggregation')).toBeInTheDocument();
      expect(screen.getByText('Zero-Knowledge Proofs')).toBeInTheDocument();
    });
  });

  it('should toggle privacy settings', async () => {
    server.use(
      rest.put('http://localhost:8080/api/privacy/settings', async (req, res, ctx) => {
        const settings = await req.json();
        return res(ctx.status(200), ctx.json(settings));
      })
    );

    render(<Privacy />);

    // Toggle differential privacy
    const dpToggle = screen.getByRole('switch', { name: /differential privacy/i });
    fireEvent.click(dpToggle);

    await waitFor(() => {
      expect(dpToggle).toBeChecked();
    });

    // Toggle homomorphic encryption
    const heToggle = screen.getByRole('switch', { name: /homomorphic encryption/i });
    fireEvent.click(heToggle);

    await waitFor(() => {
      expect(heToggle).toBeChecked();
    });
  });

  it('should update privacy budget', async () => {
    server.use(
      rest.put('http://localhost:8080/api/privacy/budget', async (req, res, ctx) => {
        const { budget } = await req.json();
        return res(ctx.status(200), ctx.json({ budget }));
      })
    );

    render(<Privacy />);

    const budgetInput = screen.getByLabelText(/privacy budget/i);
    fireEvent.change(budgetInput, { target: { value: '1.5' } });
    fireEvent.blur(budgetInput);

    await waitFor(() => {
      expect(budgetInput).toHaveValue('1.5');
    });
  });

  it('should display privacy metrics', async () => {
    server.use(
      rest.get('http://localhost:8080/api/privacy/metrics', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            privacyScore: 0.95,
            protectedModels: 10,
            dataProtection: 0.98,
            lastAudit: '2024-01-01T00:00:00Z',
          })
        );
      })
    );

    render(<Privacy />);

    await waitFor(() => {
      expect(screen.getByText('95%')).toBeInTheDocument(); // Privacy Score
      expect(screen.getByText('10')).toBeInTheDocument(); // Protected Models
      expect(screen.getByText('98%')).toBeInTheDocument(); // Data Protection
    });
  });

  it('should handle error states', async () => {
    server.use(
      rest.get('http://localhost:8080/api/privacy/settings', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ message: 'Server error' }));
      })
    );

    render(<Privacy />);

    await waitFor(() => {
      expect(screen.getByText(/error loading privacy settings/i)).toBeInTheDocument();
    });
  });

  it('should show confirmation dialog for sensitive changes', async () => {
    render(<Privacy />);

    // Try to disable secure aggregation
    const saToggle = screen.getByRole('switch', { name: /secure aggregation/i });
    fireEvent.click(saToggle);

    // Check if confirmation dialog appears
    await waitFor(() => {
      expect(screen.getByText(/this action may affect data privacy/i)).toBeInTheDocument();
    });

    // Confirm the change
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(saToggle).not.toBeChecked();
    });
  });
}); 