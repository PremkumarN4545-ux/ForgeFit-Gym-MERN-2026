import axios from 'axios';

const TOKEN_KEY = 'forgefit_token';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t) => {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* storage unavailable */
  }
};
export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired/invalid token anywhere (except an authentication attempt) signs the current account out.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || '';
    const isAuthAttempt = /\/auth\/(?:member\/)?(?:login|register)$/.test(url);
    if (error.response?.status === 401 && !isAuthAttempt) {
      clearToken();
      window.dispatchEvent(new Event('forgefit:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(err) {
  if (err.response?.data?.message) return err.response.data.message;
  if (err.request) return 'Cannot reach the server. Make sure the backend is running.';
  return err.message || 'Something went wrong';
}

export const getFieldErrors = (err) => err.response?.data?.errors || {};

export default api;
