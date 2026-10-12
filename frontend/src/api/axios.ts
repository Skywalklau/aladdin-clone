import axios from 'axios';

const BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: BASE_URL,
});

// Automatically attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Automatically handle 401 errors (token expired or invalid)
// BUT skip the redirect if we're already on an auth page — otherwise
// a wrong password triggers a full page refresh instead of showing the error.
const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password']

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const onAuthPage = AUTH_PAGES.some(p => window.location.pathname.startsWith(p))
    if (error.response?.status === 401 && !onAuthPage) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;