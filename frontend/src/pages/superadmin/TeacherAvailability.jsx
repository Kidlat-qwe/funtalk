import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const TeacherAvailability = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [isFetchingTeachers, setIsFetchingTeachers] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityByTeacherId, setAvailabilityByTeacherId] = useState({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.userType !== 'superadmin') {
        navigate('/login');
        return;
      }
      setUser(parsedUser);
    } catch (error) {
      console.error('Error parsing user data:', error);
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchTeachers();
    }
  }, [user]);

  useEffect(() => {
    if (selectedDate && teachers.length > 0) {
      fetchAllTeachersAvailability(selectedDate);
    } else {
      setAvailabilityByTeacherId({});
    }
  }, [selectedDate, teachers]);

  const fetchTeachers = async () => {
    setIsFetchingTeachers(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/teachers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success && data.data?.teachers) {
        setTeachers(data.data.teachers);
      } else {
        setTeachers([]);
      }
    } catch (error) {
      console.error('Error fetching teachers:', error);
      setTeachers([]);
    } finally {
      setIsFetchingTeachers(false);
    }
  };

  const fetchAllTeachersAvailability = useCallback(async (date) => {
    setIsCheckingAvailability(true);
    try {
      const token = localStorage.getItem('token');
      const checks = teachers.map(async (teacher) => {
        try {
          const response = await fetch(
            `${API_BASE_URL}/availability/teacher/${teacher.teacher_id}/available-slots?date=${date}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            }
          );
          const data = await response.json();
          return [
            teacher.teacher_id,
            data.success && data.data ? data.data.slots || [] : [],
          ];
        } catch (error) {
          console.error('Error checking teacher availability:', error);
          return [teacher.teacher_id, []];
        }
      });

      const results = await Promise.all(checks);
      const next = {};
      results.forEach(([teacherId, slots]) => {
        next[teacherId] = slots;
      });
      setAvailabilityByTeacherId(next);
    } finally {
      setIsCheckingAvailability(false);
    }
  }, [teachers]);

  const filteredTeachers = teachers.filter((teacher) =>
    !nameSearch ||
    teacher.fullname?.toLowerCase().includes(nameSearch.toLowerCase()) ||
    teacher.email?.toLowerCase().includes(nameSearch.toLowerCase())
  );

  const availableCount = filteredTeachers.filter((teacher) => {
    const slots = availabilityByTeacherId[teacher.teacher_id] || [];
    return slots.length > 0;
  }).length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      <div className="flex">
        <Sidebar
          userType={user.userType}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 lg:ml-64 p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Teacher Availability</h1>
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">
                  Check which teachers are available on a selected date
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Search Teacher</label>
                  <input
                    type="text"
                    value={nameSearch}
                    onChange={(e) => setNameSearch(e.target.value)}
                    placeholder="Search by name or email"
                    className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>

            {selectedDate && (
              <div className="text-xs sm:text-sm text-gray-600">
                Available teachers on <span className="font-medium">{selectedDate}</span>: {availableCount} / {filteredTeachers.length}
              </div>
            )}

            <div className="bg-white rounded-lg shadow">
              {isFetchingTeachers || isCheckingAvailability ? (
                <div className="p-8 sm:p-10 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-3 text-sm text-gray-600">Loading teacher availability...</p>
                </div>
              ) : filteredTeachers.length === 0 ? (
                <div className="p-8 sm:p-10 text-center text-sm text-gray-600">No teachers found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200" style={{ minWidth: '760px' }}>
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available Slots</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredTeachers.map((teacher) => {
                        const slots = availabilityByTeacherId[teacher.teacher_id] || [];
                        const isAvailable = selectedDate ? slots.length > 0 : false;
                        return (
                          <tr key={teacher.teacher_id} className="hover:bg-gray-50">
                            <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">{teacher.fullname || 'N/A'}</td>
                            <td className="px-4 sm:px-6 py-4 text-sm text-gray-700">{teacher.email || 'N/A'}</td>
                            <td className="px-4 sm:px-6 py-4">
                              {!selectedDate ? (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">Pick a date</span>
                              ) : isAvailable ? (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Available</span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Unavailable</span>
                              )}
                            </td>
                            <td className="px-4 sm:px-6 py-4">
                              {!selectedDate ? (
                                <span className="text-xs text-gray-500">Select a date to check slots</span>
                              ) : slots.length === 0 ? (
                                <span className="text-xs text-gray-500">No slots</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {slots.map((slot) => (
                                    <span
                                      key={`${teacher.teacher_id}-${slot}`}
                                      className="px-2 py-1 text-xs rounded bg-primary-50 text-primary-700 border border-primary-100"
                                    >
                                      {slot}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 right-6 lg:hidden z-50 bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
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

export default TeacherAvailability;
