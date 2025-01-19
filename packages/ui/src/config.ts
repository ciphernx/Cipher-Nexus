export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const APP_CONFIG = {
  apiBaseUrl: API_BASE_URL,
  maxUploadSize: 100 * 1024 * 1024, // 100MB
  supportedFormats: ['csv', 'json', 'xlsx', 'xls'],
}; 