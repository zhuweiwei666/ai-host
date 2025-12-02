import axios from "axios";
import { BASE_URL } from "./config";

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
http.interceptors.request.use(
  (config) => {
    // Get token from localStorage (adjust key name as needed)
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('jwt');
    
    // If token exists, add it to Authorization header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // For development/testing: allow mock user ID header if backend supports it
    // Backend should have ENABLE_MOCK_AUTH=true for this to work
    const mockUserId = localStorage.getItem('mockUserId') || 'test_user_001';
    const mockUserRole = localStorage.getItem('mockUserRole') || 'admin'; // Default to admin for edit operations
    if (mockUserId) {
      config.headers['x-mock-user-id'] = mockUserId;
      config.headers['x-mock-user-role'] = mockUserRole;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
http.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 errors - show helpful message
    if (error.response?.status === 401) {
      console.warn('Authentication required. Using mock user ID for development.');
      // Don't throw error for OSS STS endpoint - it will retry with mock user ID
    }
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Suppress browser extension errors in console
// These errors come from browser extensions (contentScript.bundle.js) and don't affect the app
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    // Filter out browser extension storage errors
    const errorMessage = args[0]?.toString() || '';
    if (errorMessage.includes('contentScript.bundle.js') && 
        errorMessage.includes('Access to storage') &&
        errorMessage.includes('is not allowed from this context')) {
      // Silently ignore browser extension errors
      return;
    }
    originalError.apply(console, args);
  };
}

