import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '../../../test/utils';
import { NotificationList } from '../NotificationList';
import { useNotification } from '../NotificationContext';

const renderWithNotification = () => {
  const result = render(<NotificationList />);
  const { addNotification, removeNotification } = useNotification();
  return {
    ...result,
    addNotification,
    removeNotification,
  };
};

describe('NotificationList', () => {
  it('should render success notification', async () => {
    const { addNotification } = renderWithNotification();
    const message = 'Test success message';

    addNotification({
      type: 'success',
      message,
    });

    await waitFor(() => {
      expect(screen.getByText(message)).toBeInTheDocument();
    });
  });

  it('should render error notification', async () => {
    const { addNotification } = renderWithNotification();
    const message = 'Test error message';

    addNotification({
      type: 'error',
      message,
    });

    await waitFor(() => {
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('bg-red-50');
    });
  });

  it('should remove notification when close button is clicked', async () => {
    const { addNotification } = renderWithNotification();
    const message = 'Test message';

    addNotification({
      type: 'info',
      message,
    });

    await waitFor(() => {
      expect(screen.getByText(message)).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close/i });
    closeButton.click();

    await waitFor(() => {
      expect(screen.queryByText(message)).not.toBeInTheDocument();
    });
  });

  it('should auto-remove notification after duration', async () => {
    const { addNotification } = renderWithNotification();
    const message = 'Test auto-remove message';

    addNotification({
      type: 'warning',
      message,
      duration: 100,
    });

    await waitFor(() => {
      expect(screen.getByText(message)).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(screen.queryByText(message)).not.toBeInTheDocument();
      },
      { timeout: 200 }
    );
  });

  it('should stack multiple notifications', async () => {
    const { addNotification } = renderWithNotification();

    addNotification({
      type: 'success',
      message: 'First message',
    });

    addNotification({
      type: 'error',
      message: 'Second message',
    });

    await waitFor(() => {
      expect(screen.getByText('First message')).toBeInTheDocument();
      expect(screen.getByText('Second message')).toBeInTheDocument();
    });
  });
}); 