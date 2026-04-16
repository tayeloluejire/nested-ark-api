import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nested-ark-api-v3.onrender.com';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: false,
});

// ── Request interceptor: attach auth token ────────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // Support both token keys used across the app for backward compat
    const token = localStorage.getItem('token') || localStorage.getItem('ark_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Response interceptor: handle cold starts + 401 ───────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, code, response } = error;

    // Cold start: Render free tier sleeps after inactivity (503/504/ECONNABORTED)
    const isColdStart =
      code === 'ECONNABORTED' ||
      response?.status === 503 ||
      response?.status === 504;

    if (config && !config._retried && isColdStart) {
      config._retried = true;
      console.warn('[Nested Ark API] Backend waking up — retrying in 5s…');
      await new Promise(r => setTimeout(r, 5000));
      config.timeout = 60000;
      return api(config);
    }

    // Clear stale tokens on 401
    if (response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('ark_token');
    }

    return Promise.reject(error);
  }
);

// ── Immediate wake-up ping on page load (prevents cold-start delay for user) ──
if (typeof window !== 'undefined') {
  api.get('/api/health').catch(() => {
    // Silent — just waking Render's free tier
  });
}

export default api;
