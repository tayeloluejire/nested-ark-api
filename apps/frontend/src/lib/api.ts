/**
 * src/lib/api.ts
 *
 * Single Axios instance for all Nested Ark API calls.
 * - baseURL is empty → all calls are relative /api/* paths
 * - next.config.js rewrites /api/* → Render backend URL
 * - This eliminates all CORS issues (no cross-origin requests)
 * - Auth: reads JWT from localStorage (both 'ark_token' and legacy 'token')
 * - Cold-start retry: if Render returns 502/503, retries once after 4s
 * - 401: clears auth state and redirects to /login
 */
import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL:         '',     // MUST be empty — next.config.js rewrite handles routing
  timeout:         30000,
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── Request interceptor: attach JWT ─────────────────────────────────────────
api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ark_token') || localStorage.getItem('token');
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Response interceptor: cold-start retry + auth redirect ──────────────────
api.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    const config = error.config as AxiosRequestConfig & { _retried?: boolean };

    // Render cold-start: retry once after 4s on 502/503
    if (!config._retried && error.response && [502, 503].includes(error.response.status)) {
      config._retried = true;
      await new Promise(r => setTimeout(r, 4000));
      return api(config);
    }

    // 401 — token expired/invalid: clear and redirect (except on login/register)
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const isAuthRoute = config.url?.includes('/api/auth/login') ||
                          config.url?.includes('/api/auth/register') ||
                          config.url?.includes('/api/auth/google') ||
                          config.url?.includes('/api/auth/forgot-password');
      if (!isAuthRoute) {
        localStorage.removeItem('ark_token');
        localStorage.removeItem('token');
        document.cookie = 'ark_role=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        window.location.href = '/login?reason=session_expired';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
