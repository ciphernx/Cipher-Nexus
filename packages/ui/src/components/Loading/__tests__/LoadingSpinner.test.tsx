import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/utils';
import { LoadingSpinner, LoadingButton, LoadingOverlay } from '../LoadingSpinner';
import { LoadingProvider } from '../LoadingContext';

describe('LoadingSpinner', () => {
  it('should not render when loading is false', () => {
    render(<LoadingSpinner />);
    const spinner = screen.queryByRole('status');
    expect(spinner).not.toBeInTheDocument();
  });

  it('should render with loading message when provided', () => {
    render(
      <LoadingProvider>
        <LoadingSpinner />
      </LoadingProvider>
    );
    const message = screen.queryByText('Test loading message');
    expect(message).not.toBeInTheDocument();
  });
});

describe('LoadingButton', () => {
  it('should render children when not loading', () => {
    render(<LoadingButton>Click me</LoadingButton>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should be disabled when loading', () => {
    render(<LoadingButton loading>Click me</LoadingButton>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('relative');
  });

  it('should show spinner when loading', () => {
    render(<LoadingButton loading>Click me</LoadingButton>);
    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toBeInTheDocument();
  });
});

describe('LoadingOverlay', () => {
  it('should render children when not loading', () => {
    render(
      <LoadingOverlay loading={false}>
        <div>Content</div>
      </LoadingOverlay>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should show overlay when loading', () => {
    render(
      <LoadingOverlay loading={true}>
        <div>Content</div>
      </LoadingOverlay>
    );
    const overlay = screen.getByTestId('loading-overlay');
    expect(overlay).toBeInTheDocument();
    expect(screen.getByText('Content')).toHaveClass('opacity-50');
  });
}); 