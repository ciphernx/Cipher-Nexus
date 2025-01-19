import create from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: async (username: string, password: string) => {
    try {
      // TODO: Implement actual login API call
      const user = { id: '1', username, role: 'user' as const };
      set({ user, isAuthenticated: true });
    } catch (error) {
      throw new Error('Login failed');
    }
  },
  logout: () => {
    set({ user: null, isAuthenticated: false });
  },
}));
