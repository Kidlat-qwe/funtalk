import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { API_BASE_URL } from '@/config/api.js';

const TeacherProfile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    introText: '',
    profilePhoto: null,
    curriculumVitae: null,
    introAudio: null,
    introVideo: null,
  });
  const [message, setMessage] = useState('');
  const [previewModal, setPreviewModal] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) {
      navigate('/login');
      return;
    }
    try {
      const parsed = JSON.parse(userData);
      if (parsed.userType !== 'teacher') {
        navigate('/login');
        return;
      }
      setUser(parsed);
    } catch {
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const toAbsoluteUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL.replace('/api', '')}${url}`;
  };

  const openPreviewModal = ({ type, title, url, text }) => {
    setPreviewModal({ type, title, url: url || '', text: text || '' });
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/teachers/me/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setProfile(data.data.profile);
        setFormData((prev) => ({
          ...prev,
          introText: data.data.profile?.description || '',
        }));
      } else {
        setMessage(data.message || 'Unable to load profile');
      }
    } catch {
      setMessage('Network error while loading profile');
    }
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files?.[0] || null,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const payload = new FormData();
      payload.append('introText', formData.introText || '');
      if (formData.profilePhoto) payload.append('profilePhoto', formData.profilePhoto);
      if (formData.curriculumVitae) payload.append('curriculumVitae', formData.curriculumVitae);
      if (formData.introAudio) payload.append('introAudio', formData.introAudio);
      if (formData.introVideo) payload.append('introVideo', formData.introVideo);

      const response = await fetch(`${API_BASE_URL}/teachers/me/profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setMessage(data.message || 'Failed to update profile');
        return;
      }
      setMessage('Profile updated successfully');
      setProfile(data.data.profile);
      setFormData((prev) => ({
        ...prev,
        profilePhoto: null,
        curriculumVitae: null,
        introAudio: null,
        introVideo: null,
      }));
    } catch {
      setMessage('Network error while updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      <div className="flex">
        <Sidebar userType={user.userType} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 lg:ml-64 p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-4 sm:p-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Profile</h1>
            <p className="mt-1 text-sm text-gray-600">Manage profile photo, CV, intro audio/video, and intro text.</p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intro Text</label>
                <textarea
                  rows="4"
                  value={formData.introText}
                  onChange={(e) => setFormData((prev) => ({ ...prev, introText: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Write your teacher introduction..."
                />
                {formData.introText?.trim() && (
                  <button
                    type="button"
                    onClick={() =>
                      openPreviewModal({
                        type: 'text',
                        title: 'Intro Text',
                        text: formData.introText,
                      })
                    }
                    className="mt-1 text-xs text-primary-600 hover:text-primary-800"
                  >
                    View intro text
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profile Photo</label>
                  <input type="file" name="profilePhoto" accept="image/*" onChange={handleFileChange} className="w-full text-sm" />
                  {profile?.profile_picture && (
                    <button
                      type="button"
                      onClick={() =>
                        openPreviewModal({
                          type: 'image',
                          title: 'Profile Photo',
                          url: toAbsoluteUrl(profile.profile_picture),
                        })
                      }
                      className="text-xs text-primary-600 hover:text-primary-800"
                    >
                      View current photo
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Curriculum Vitae</label>
                  <input type="file" name="curriculumVitae" accept=".pdf,.doc,.docx" onChange={handleFileChange} className="w-full text-sm" />
                  {profile?.docs && (
                    <button
                      type="button"
                      onClick={() =>
                        openPreviewModal({
                          type: 'document',
                          title: 'Curriculum Vitae',
                          url: toAbsoluteUrl(profile.docs),
                        })
                      }
                      className="text-xs text-primary-600 hover:text-primary-800"
                    >
                      View current CV
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Intro Audio</label>
                  <input type="file" name="introAudio" accept="audio/*" onChange={handleFileChange} className="w-full text-sm" />
                  {profile?.audio_intro && (
                    <button
                      type="button"
                      onClick={() =>
                        openPreviewModal({
                          type: 'audio',
                          title: 'Intro Audio',
                          url: toAbsoluteUrl(profile.audio_intro),
                        })
                      }
                      className="text-xs text-primary-600 hover:text-primary-800"
                    >
                      Listen current intro audio
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Intro Video</label>
                  <input type="file" name="introVideo" accept="video/*" onChange={handleFileChange} className="w-full text-sm" />
                  {profile?.video_intro && (
                    <button
                      type="button"
                      onClick={() =>
                        openPreviewModal({
                          type: 'video',
                          title: 'Intro Video',
                          url: toAbsoluteUrl(profile.video_intro),
                        })
                      }
                      className="text-xs text-primary-600 hover:text-primary-800"
                    >
                      Watch current intro video
                    </button>
                  )}
                </div>
              </div>

              {message && <p className="text-sm text-gray-700">{message}</p>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
      {previewModal && createPortal(
        <div
          className="fixed bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewModal(null);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">{previewModal.title}</h2>
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {previewModal.type === 'image' && (
                <img src={previewModal.url} alt={previewModal.title} className="w-full max-h-[65vh] object-contain rounded border" />
              )}
              {previewModal.type === 'audio' && <audio src={previewModal.url} controls className="w-full" />}
              {previewModal.type === 'video' && <video src={previewModal.url} controls className="w-full rounded border max-h-[65vh]" />}
              {previewModal.type === 'document' && (
                <div className="space-y-3">
                  <iframe src={previewModal.url} title={previewModal.title} className="w-full h-[65vh] rounded border" />
                  <a
                    href={previewModal.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Open in new tab
                  </a>
                </div>
              )}
              {previewModal.type === 'text' && (
                <div className="border border-gray-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                  {previewModal.text || '-'}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 right-6 lg:hidden z-50 bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isSidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
    </div>
  );
};

export default TeacherProfile;

