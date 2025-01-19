const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }

  return response.json();
}

export const api = {
  auth: {
    login: async (username: string, password: string) => {
      // TODO: Implement actual API call
      // Mock login for now
      if (username === 'demo' && password === 'demo') {
        const token = 'mock_jwt_token';
        const user = { id: '1', username, role: 'user' as const };
        localStorage.setItem('auth_token', token);
        return { user, token };
      }
      throw new ApiError(401, 'Invalid credentials');
    },
    logout: async () => {
      localStorage.removeItem('auth_token');
    },
  },
  
  projects: {
    list: () => fetchWithAuth('/projects'),
    create: (data: any) => fetchWithAuth('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },
  
  models: {
    list: () => fetchWithAuth('/models'),
    create: (data: any) => fetchWithAuth('/models', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },
};
