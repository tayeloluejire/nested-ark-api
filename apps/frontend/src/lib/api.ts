import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nested-ark-api-v3.onrender.com';

console.log('--- NESTED ARK OS: API INITIALIZED ---');
console.log('Targeting Backend:', BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // Reduced to 30s so the retry kicks in faster before Vercel kills the connection
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, code, response } = error;
    
    // Check for Cold Start signatures: Timeout (ECONNABORTED) or Service Unavailable (503/504)
    const isColdStart = code === 'ECONNABORTED' || response?.status === 503 || response?.status === 504;

    if (config && !config._retried && isColdStart) {
      config._retried = true;
      console.warn('Backend cold start detected. Waking up server and retrying...');
      
      // Short delay to let Render process the "wake up" signal from the first failed request
      await new Promise(r => setTimeout(r, 5000));
      
      // Set a longer timeout for the second attempt
      config.timeout = 60000; 
      
      return api(config);
    }

    if (code === 'ECONNABORTED') {
      console.error('API CRITICAL TIMEOUT: Backend failed to respond.');
    }

    if (response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }

    return Promise.reject(error);
  }
);

// Immediate Wake-up Ping on load
if (typeof window !== 'undefined') {
  api.get('/api/health').catch(() => {});
}

export default api;