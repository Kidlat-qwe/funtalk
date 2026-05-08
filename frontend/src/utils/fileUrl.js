import { API_BASE_URL } from '@/config/api.js';

/**
 * Resolve an API-stored file URL to an absolute URL usable by the browser.
 * - Keeps full http(s) URLs as-is
 * - Converts `/uploads/...` and other absolute paths to same backend origin
 */
export const toAbsoluteFileUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = API_BASE_URL.replace(/\/?api\/?$/i, '');
  if (raw.startsWith('/')) return `${base}${raw}`;
  return `${base}/${raw}`;
};

