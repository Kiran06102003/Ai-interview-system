/**
 * Global Auth Store using Zustand
 */

import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  skills: string[];
  experience: number;
  targetRole: string;
  totalInterviews?: number;
  averageScore?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
    }
    set({ user, token, isLoading: false });
  },

  updateUser: (updates) => {
    set(state => ({
      user: state.user ? { ...state.user, ...updates } : null,
    }));
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }
    set({ user: null, token: null, isLoading: false });
  },

  isAuthenticated: () => {
    const { token } = get();
    return !!token;
  },
}));

// Initialize from localStorage
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('auth_token');
  const userStr = localStorage.getItem('auth_user');

  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      useAuthStore.setState({ user, token, isLoading: false });
    } catch {
      useAuthStore.setState({ isLoading: false });
    }
  } else {
    useAuthStore.setState({ isLoading: false });
  }
}
