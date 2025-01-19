import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, authService, LoginCredentials } from '../services/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          console.log('Login called with credentials:', credentials);
          // 模拟登录成功
          const user = {
            id: '1',
            email: credentials.email,
            name: 'Test User',
            role: 'admin'
          };
          const token = 'test-token';

          // 保存到 localStorage
          localStorage.setItem('auth_token', token);
          localStorage.setItem('user', JSON.stringify(user));
          
          set({ 
            isAuthenticated: true,
            user,
            token,
            isLoading: false,
            error: null
          });
        } catch (error) {
          console.error('Login error:', error);
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Login failed',
            isAuthenticated: false,
            user: null,
            token: null
          });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null
        });
      },

      clearError: () => {
        set({ error: null });
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const token = authService.getToken();
          const user = authService.getUser();
          
          if (token && user) {
            set({ 
              isAuthenticated: true,
              user,
              token,
              isLoading: false,
              error: null
            });
          } else {
            set({ 
              isAuthenticated: false,
              user: null,
              token: null,
              isLoading: false,
              error: null
            });
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          set({ 
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Auth check failed'
          });
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);
