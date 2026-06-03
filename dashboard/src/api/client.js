import axios from 'axios';

/**
 * Axios instance for API calls.
 * 
 * In production (Azure Static Web Apps), the API is served from the same origin
 * under /api/*. The SWA proxy handles routing to the managed Functions.
 * 
 * In local development with SWA CLI, the proxy also handles this automatically.
 */
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — add any auth headers if needed in the future
apiClient.interceptors.request.use(
  (config) => {
    // Future: Add auth token here if required
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor — standardize error handling
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const message =
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';

    console.error(`API Error [${error.config?.url}]:`, message);

    // Return a consistent error shape
    return Promise.reject({
      message,
      status: error.response?.status || 0,
      url: error.config?.url,
    });
  }
);

// ─── API Functions ────────────────────────────────────────────────────────

export const fetchOverviewMetrics = (days = 7) =>
  apiClient.get(`/GetOverviewMetrics?days=${days}`);

export const fetchErrorDeepDive = (days = 7) =>
  apiClient.get(`/GetErrorDeepDive?days=${days}`);

export const fetchConcurrentLaunches = (hours = 24) =>
  apiClient.get(`/GetConcurrentLaunches?hours=${hours}`);

export const fetchGeoBucketAnalysis = (region = 'all', days = 7) =>
  apiClient.get(`/GetGeoBucketAnalysis?region=${encodeURIComponent(region)}&days=${days}`);

export default apiClient;
