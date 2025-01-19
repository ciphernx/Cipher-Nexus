import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  });

  it('should initialize with default values', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set user and update authentication status', () => {
    const testUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user' as const,
    };

    useAuthStore.getState().setUser(testUser);
    const state = useAuthStore.getState();

    expect(state.user).toEqual(testUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('should set token and update authentication status', () => {
    const testToken = 'test-token';

    useAuthStore.getState().setToken(testToken);
    const state = useAuthStore.getState();

    expect(state.token).toBe(testToken);
    expect(state.isAuthenticated).toBe(true);
  });

  it('should clear state on logout', () => {
    // Set initial authenticated state
    useAuthStore.setState({
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      },
      token: 'test-token',
      isAuthenticated: true,
    });

    useAuthStore.getState().logout();
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
}); 