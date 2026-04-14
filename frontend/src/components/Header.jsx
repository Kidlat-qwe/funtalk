import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { API_BASE_URL } from '@/config/api.js';

const Header = ({ user }) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordState, setPasswordState] = useState({
    isLoading: false,
    error: '',
    success: '',
  });

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const formatRelativeTime = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'Just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const days = Math.floor(h / 24);
    return `${days}d`;
  };

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setUnreadCount(Number(data.data?.unreadCount || 0));
      }
    } catch (e) {
      // silent: bell should not break header
      console.error('Unread count fetch failed:', e);
    }
  };

  const fetchNotifications = async () => {
    setIsNotifLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setNotifications(Array.isArray(data.data?.notifications) ? data.data.notifications : []);
      }
    } catch (e) {
      console.error('Notifications fetch failed:', e);
    } finally {
      setIsNotifLoading(false);
    }
  };

  const markReadAndGo = async (n) => {
    try {
      const token = localStorage.getItem('token');
      if (token && n?.notification_id) {
        await fetch(`${API_BASE_URL}/notifications/${n.notification_id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);
      }
    } finally {
      setIsNotifOpen(false);
      if (n?.href) navigate(n.href);
      fetchUnreadCount();
      fetchNotifications();
    }
  };

  const getUserInitials = (name) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const closeChangePasswordModal = () => {
    if (passwordState.isLoading) return;
    setIsChangePasswordOpen(false);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordState({ isLoading: false, error: '', success: '' });
  };

  const openChangePasswordModal = () => {
    setIsMenuOpen(false);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordState({ isLoading: false, error: '', success: '' });
    setIsChangePasswordOpen(true);
  };

  const handlePasswordFormChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    if (passwordState.error || passwordState.success) {
      setPasswordState((prev) => ({ ...prev, error: '', success: '' }));
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    const currentUser = auth.currentUser;

    if (!currentUser?.email) {
      setPasswordState({
        isLoading: false,
        error: 'Session expired. Please log in again.',
        success: '',
      });
      return;
    }

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordState({
        isLoading: false,
        error: 'All password fields are required.',
        success: '',
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordState({
        isLoading: false,
        error: 'New password must be at least 6 characters.',
        success: '',
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordState({
        isLoading: false,
        error: 'New password and confirm password do not match.',
        success: '',
      });
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordState({
        isLoading: false,
        error: 'New password must be different from current password.',
        success: '',
      });
      return;
    }

    setPasswordState({ isLoading: true, error: '', success: '' });

    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordForm.currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwordForm.newPassword);

      setPasswordState({
        isLoading: false,
        error: '',
        success: 'Password updated successfully.',
      });

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      let errorMessage = 'Failed to update password. Please try again.';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Current password is incorrect.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please sign in again, then retry password change.';
      }

      setPasswordState({ isLoading: false, error: errorMessage, success: '' });
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.user-menu-container')) {
        setIsMenuOpen(false);
      }
      if (!event.target.closest('.notif-menu-container')) {
        setIsNotifOpen(false);
      }
    };

    if (isMenuOpen || isNotifOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isMenuOpen, isNotifOpen]);

  useEffect(() => {
    fetchUnreadCount();
    const id = window.setInterval(fetchUnreadCount, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="bg-gradient-to-r from-[#A7816D] via-[#AF8F7E] to-[#B66681] shadow-soft border-b border-white/20 sticky top-0 z-50">
      {/* UI: consistent header container + spacing */}
      <div className="px-4 sm:px-6 lg:px-8">
        {/* Align header brand with sidebar (sidebar uses p-4 on its nav) */}
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center space-x-3">
            <img 
              src="/funtalk-logo.png" 
              alt="Funtalk Logo" 
              className="h-10 sm:h-12 w-auto object-contain"
            />
            <div className="hidden sm:block">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">Funtalk Appointment System</h1>
            </div>
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notifications */}
            <div className="relative notif-menu-container">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !isNotifOpen;
                  setIsNotifOpen(next);
                  if (next) {
                    fetchNotifications();
                    fetchUnreadCount();
                  }
                }}
                className="relative inline-flex items-center justify-center h-10 w-10 rounded-lg hover:bg-white/15 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
                aria-label="Notifications"
                title="Notifications"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#B66681] text-white text-[10px] font-semibold leading-[18px] text-center ring-2 ring-[#DFC1CB]">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-[min(92vw,360px)] bg-white rounded-lg shadow-xl z-[120] border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">Notifications</p>
                    <p className="text-xs text-gray-500">{unreadCount} unread</p>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto">
                    {isNotifLoading ? (
                      <div className="px-4 py-6 text-sm text-gray-600">Loading…</div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-gray-600">No notifications yet.</div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {notifications.map((n) => (
                          <li key={n.notification_id}>
                            <button
                              type="button"
                              onClick={() => markReadAndGo(n)}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                                n.read_at ? '' : 'bg-gray-50/60'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                                  <p className="mt-0.5 text-xs text-gray-600">{n.message}</p>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                  {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary-600" aria-hidden />}
                                  <span className="text-[11px] text-gray-500">{formatRelativeTime(n.created_at)}</span>
                                </div>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User info with dropdown */}
            <div className="relative user-menu-container">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-3 hover:bg-white/15 rounded-lg px-2.5 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-white">{user?.name || 'User'}</p>
                  <p className="text-xs text-[#f7edf1] capitalize">{user?.userType || 'user'}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white font-semibold">
                  {getUserInitials(user?.name)}
                </div>
                <svg
                  className={`w-4 h-4 text-white transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown menu */}
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl z-[100] border border-gray-200 overflow-hidden">
                  <div className="py-1">
                    <div className="px-4 py-3 border-b border-gray-200 sm:hidden bg-gradient-to-r from-[#A7816D] to-[#B66681]">
                      <p className="text-sm font-medium text-white">{user?.name || 'User'}</p>
                      <p className="text-xs text-[#f7edf1] capitalize">{user?.userType || 'user'}</p>
                    </div>
                    <button
                      onClick={() => {
                        // TODO: Implement change profile picture
                        alert('Change profile picture functionality coming soon');
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 flex items-center gap-2 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span>Change Profile Picture</span>
                    </button>
                    <button
                      onClick={openChangePasswordModal}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 flex items-center gap-2 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm-7 8a7 7 0 1114 0H5zm11-7h2a2 2 0 012 2v4m-7-6h.01"
                        />
                      </svg>
                      <span>Change Password</span>
                    </button>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      <span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close change password modal"
            className="absolute inset-0 bg-black/50"
            onClick={closeChangePasswordModal}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200 p-5 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Change password</h3>
            <p className="mt-1 text-sm text-gray-600">
              This updates your password in Firebase Authentication.
            </p>

            <form onSubmit={handleChangePasswordSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="currentPassword" className="label">Current Password</label>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordFormChange}
                  className="input-field"
                  disabled={passwordState.isLoading}
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="label">New Password</label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordFormChange}
                  className="input-field"
                  disabled={passwordState.isLoading}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordFormChange}
                  className="input-field"
                  disabled={passwordState.isLoading}
                />
              </div>

              {passwordState.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{passwordState.error}</p>
                </div>
              )}

              {passwordState.success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">{passwordState.success}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeChangePasswordModal}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
                  disabled={passwordState.isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 text-sm font-medium disabled:opacity-60"
                  disabled={passwordState.isLoading}
                >
                  {passwordState.isLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;

