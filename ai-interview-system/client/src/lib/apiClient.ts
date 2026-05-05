/**
 * API Client - Axios wrapper with auth interceptors
 */

import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach auth token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired - clear auth and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: any) => apiClient.post('/auth/register', data),
  login: (data: any) => apiClient.post('/auth/login', data),
  getProfile: () => apiClient.get('/auth/profile'),
  updateProfile: (data: any) => apiClient.put('/auth/profile', data),
};

// Interview API
export const interviewAPI = {
  start: (data: any) => apiClient.post('/interview/start', data),
  submitAnswer: (data: any) => apiClient.post('/interview/answer', data),
  end: (sessionId: string) => apiClient.post(`/interview/end/${sessionId}`),
  getSession: (sessionId: string) => apiClient.get(`/interview/session/${sessionId}`),
  getFeedback: (sessionId: string, questionIndex?: number) =>
    apiClient.get(`/interview/feedback/${sessionId}`, {
      params: questionIndex !== undefined ? { questionIndex } : {},
    }),
};

// Dashboard API
export const dashboardAPI = {
  getData: () => apiClient.get('/dashboard/data'),
  getHistory: (params?: any) => apiClient.get('/dashboard/history', { params }),
  getAnalytics: () => apiClient.get('/dashboard/analytics'),
};

// Upload API
export const uploadAPI = {
  resume: (resumeText: string) => apiClient.post('/upload/resume', { resumeText }),
  tts: (text: string, voice?: string) => apiClient.post('/upload/tts', { text, voice }),
};

export default apiClient;
