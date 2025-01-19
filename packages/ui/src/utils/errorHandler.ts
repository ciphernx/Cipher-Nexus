import { AxiosError } from 'axios';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(error: AxiosError) {
    super(error.message);
    this.name = 'ApiError';
    this.status = error.response?.status || 500;
    this.data = error.response?.data;
  }
}

export const handleApiError = (error: unknown) => {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Authentication required. Please log in.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'An internal server error occurred. Please try again later.';
      default:
        return error.message || 'An unexpected error occurred.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
};

export const formatErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError && error.data?.message) {
    return error.data.message;
  }
  return handleApiError(error);
};

export const showErrorNotification = (error: unknown) => {
  const message = formatErrorMessage(error);
  // TODO: Integrate with your notification system
  console.error(message);
}; 