export const EM_DASH = '—';

const toDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDate = (value, options) => {
  const d = toDate(value);
  if (!d) return 'N/A';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(options || {}),
  });
};

export const formatTime = (timeString) => {
  if (!timeString) return 'N/A';
  const raw = String(timeString).trim();
  const hhmm = raw.includes('T') ? raw : raw; // allow both time-only and ISO
  const m = hhmm.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 'N/A';
  const hour = Number(m[1]);
  const minute = m[2];
  if (!Number.isFinite(hour)) return 'N/A';
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${period}`;
};

export const formatDateTime = (dateValue, timeValue) => {
  if (!dateValue) return 'N/A';
  const d = toDate(`${String(dateValue).slice(0, 10)}T${String(timeValue || '00:00').slice(0, 5)}`);
  if (!d) return 'N/A';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatMoneyNT = (value) => {
  if (value == null || value === '') return EM_DASH;
  const n = typeof value === 'number' ? value : Number(String(value).replaceAll(',', '').trim());
  if (!Number.isFinite(n)) return EM_DASH;
  return `NT$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

