import { rest } from 'msw';

const API_URL = 'http://localhost:8080/api';

export const handlers = [
  // Auth handlers
  rest.post(`${API_URL}/auth/login`, async (req, res, ctx) => {
    const { email, password } = await req.json();
    if (email === 'test@example.com' && password === 'password') {
      return res(
        ctx.status(200),
        ctx.json({
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test User',
            role: 'admin',
          },
          token: 'mock-jwt-token',
        })
      );
    }
    return res(ctx.status(401), ctx.json({ message: 'Invalid credentials' }));
  }),

  // Dataset handlers
  rest.get(`${API_URL}/datasets`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: '1',
          name: 'Test Dataset',
          description: 'A test dataset',
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
  }),

  // Model handlers
  rest.get(`${API_URL}/models`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: '1',
          name: 'Test Model',
          description: 'A test model',
          type: 'classification',
          status: 'deployed',
          accuracy: 0.85,
          privacyScore: 0.9,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          version: '1.0.0',
          datasetId: '1',
        },
      ])
    );
  }),

  rest.post(`${API_URL}/models/:id/train`, async (req, res, ctx) => {
    const config = await req.json();
    return res(
      ctx.status(200),
      ctx.json({
        id: req.params.id,
        status: 'training',
        config,
      })
    );
  }),

  rest.get(`${API_URL}/models/:id/deployment`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: req.params.id,
        status: 'running',
        metrics: {
          replicas: 1,
          cpu: 45,
          memory: 60,
          requestsPerMinute: 100,
        },
      })
    );
  }),
]; 