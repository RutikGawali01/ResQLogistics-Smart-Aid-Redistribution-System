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
    const responseData = error.response?.data;
    const errorEnvelope = responseData?.error;

    let extractedMessage = 'An unexpected network error occurred.';
    if (typeof errorEnvelope === 'string') {
      extractedMessage = errorEnvelope;
    } else if (errorEnvelope?.message) {
      extractedMessage = errorEnvelope.message;
    } else if (responseData?.message) {
      extractedMessage = responseData.message;
    } else if (error.message) {
      extractedMessage = error.message;
    }

    const status = error.response?.status || 500;
    let code = errorEnvelope?.code;
    if (!code) {
      if (status === 409) code = 'CONFLICT';
      else if (status === 422) code = 'VALIDATION_ERROR';
      else if (status === 401) code = 'UNAUTHORIZED';
      else if (status === 403) code = 'FORBIDDEN';
      else if (status === 404) code = 'NOT_FOUND';
      else code = 'SERVER_ERROR';
    }

    const details =
      errorEnvelope?.details ||
      responseData?.details ||
      responseData?.errors ||
      null;

    const standardizedError = new Error(extractedMessage);
    standardizedError.status = status;
    standardizedError.code = code;
    standardizedError.details = details;
    standardizedError.response = error.response;
    standardizedError.raw = error;

    // If 401 Unauthorized, dispatch event for auth context
    if (status === 401) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aidflow:unauthorized'));
      }
    }

    return Promise.reject(standardizedError);
  }
);

export default apiClient;
