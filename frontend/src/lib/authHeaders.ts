import axios from 'axios';

/**
 * Every wallet-touching backend route now requires the access token. Register
 * it once on the shared axios instance and patch `fetch` so the pages that use
 * either client send it, instead of adding a header to ~50 call sites.
 */
export function installAuthHeaders() {
  axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const token = localStorage.getItem('token');
    if (token && backendUrl && url.startsWith(backendUrl)) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      return originalFetch(input, { ...init, headers });
    }
    return originalFetch(input, init);
  };
}
