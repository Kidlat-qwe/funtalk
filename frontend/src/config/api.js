/**
 * API base URL.
 * - Dev: local backend
 * - Prod: same-origin `/api` (Nginx → Node) unless VITE_API_BASE_URL is set
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');
