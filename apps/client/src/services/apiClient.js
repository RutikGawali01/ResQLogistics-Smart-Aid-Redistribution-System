import axios from 'axios';

/**
 * Centralized Axios client for AidFlow.
 * Configured with baseURL from VITE_API_BASE_URL (defaults to '/api').
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
});

// Request interceptor: attach bearer token if user is logged in
apiClient.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('aidflow_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // localStorage may be unavailable in some test/sandbox environments
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: standardize error responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Standardize error message extraction
    const standardizedError = {
      status: error.response?.status || 500,
      message:
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'An unexpected network error occurred.',
      details: error.response?.data?.details || null,
      raw: error
    };

    // If 401 Unauthorized, dispatch event for auth context
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aidflow:unauthorized'));
      }
    }

    return Promise.reject(standardizedError);
  }
);

export default apiClient;
