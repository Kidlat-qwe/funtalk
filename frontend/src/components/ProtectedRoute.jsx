import { Navigate, useLocation } from 'react-router-dom';

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Centralized auth + role gate.
 * - If not logged in: redirect to /login
 * - If logged in but wrong role: redirect to /login (keeps current behavior)
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const user = readStoredUser();
  const role = String(user?.userType || '').toLowerCase();

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const allowed = allowedRoles.map((r) => String(r).toLowerCase());
    if (!allowed.includes(role)) {
      return <Navigate to="/login" replace />;
    }
  }

  return children;
}

