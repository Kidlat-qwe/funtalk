import { API_BASE_URL } from '@/config/api.js';

const readToken = () => localStorage.getItem('token') || '';

export async function apiFetch(path, options = {}) {
  const token = readToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body != null && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Keep behavior simple and consistent across pages.
    if (typeof window !== 'undefined') window.location.href = '/login';
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '');

  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      (typeof data === 'string' && data) ||
      `Request failed (${res.status})`;
    const err = new Error(String(msg));
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const apiGet = (path, options) => apiFetch(path, { ...options, method: 'GET' });
export const apiPost = (path, body, options) =>
  apiFetch(path, { ...options, method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) });
export const apiPut = (path, body, options) =>
  apiFetch(path, { ...options, method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) });
export const apiDelete = (path, options) => apiFetch(path, { ...options, method: 'DELETE' });

