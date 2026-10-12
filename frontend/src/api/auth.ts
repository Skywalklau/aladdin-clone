import api from './axios';
import type { TokenResponse, User } from '../types';

export const register = async (fullName: string, email: string, password: string): Promise<User> => {
  const response = await api.post('/auth/register', { full_name: fullName, email, password });
  return response.data;
};

export const login = async (email: string, password: string): Promise<TokenResponse> => {
  // OAuth2 requires form data, not JSON
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const response = await api.post('/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  // Store token in localStorage
  localStorage.setItem('token', response.data.access_token);

  return response.data;
};

export const logout = () => {
  localStorage.removeItem('token');
  window.location.href = '/login';
};

export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('token');
};