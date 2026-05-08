import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import Appointment from './pages/superadmin/Appointment';
import Users from './pages/superadmin/Users';
import Teachers from './pages/superadmin/Teachers';
import Package from './pages/superadmin/Package';
import Materials from './pages/superadmin/Materials';
import Credits from './pages/superadmin/Credits';
import Invoices from './pages/superadmin/Invoices';
import InstallmentInvoice from './pages/superadmin/InstallmentInvoice';
import PaymentLogs from './pages/superadmin/PaymentLogs';
import SuperadminTeacherAvailability from './pages/superadmin/TeacherAvailability';
import TeacherDashboard from './pages/teacher/teacherDashboard';
import TeacherAppointments from './pages/teacher/teacherAppointments';
import TeacherAvailability from './pages/teacher/teacherAvailability';
import TeacherMaterials from './pages/teacher/teacherMaterials';
import TeacherProfile from './pages/teacher/teacherProfile';
import SchoolDashboard from './pages/school/schoolDashboard';
import SchoolStudents from './pages/school/schoolStudents';
import SchoolBookings from './pages/school/schoolBookings';
import SchoolMaterials from './pages/school/schoolMaterials';
import SchoolPackages from './pages/school/schoolPackages';
import SchoolCredits from './pages/school/schoolCredits';
import SchoolReports from './pages/school/schoolReports';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import NotFound from './pages/NotFound.jsx';
import './App.css';

const MODAL_OVERLAY_SELECTOR = [
  '[class*="fixed"][class*="bg-black"][class*="backdrop-blur"]',
  '[class*="fixed"][class*="inset-0"][class*="bg-black"]',
  '[class*="fixed"][class*="inset-0"][class*="backdrop-blur"]',
].join(', ');

const GlobalModalScrollLock = () => {
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    let isLocked = false;
    let lockedScrollY = 0;

    const setScrollLock = (shouldLock) => {
      if (shouldLock === isLocked) return;
      isLocked = shouldLock;

      if (shouldLock) {
        lockedScrollY = window.scrollY || window.pageYOffset || 0;
        body.style.position = 'fixed';
        body.style.top = `-${lockedScrollY}px`;
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';
        body.style.overflow = 'hidden';
        html.style.overflow = 'hidden';
        return;
      }

      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      body.style.overflow = '';
      html.style.overflow = '';
      window.scrollTo(0, lockedScrollY);
    };

    const syncLockState = () => {
      const hasModalOverlay = document.querySelector(MODAL_OVERLAY_SELECTOR) !== null;
      setScrollLock(hasModalOverlay);
    };

    syncLockState();

    const observer = new MutationObserver(syncLockState);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
      setScrollLock(false);
    };
  }, []);

  return null;
};

function App() {
  return (
    <Router>
      <GlobalModalScrollLock />
      <ErrorBoundary>
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Super Admin Routes */}
          <Route
            path="/superadmin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/users"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/teachers"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <Teachers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/appointment"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <Appointment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/package"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <Package />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/materials"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <Materials />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/credits"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <Credits />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/invoices"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <Invoices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/installment-invoice"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <InstallmentInvoice />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/payment-logs"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <PaymentLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/teacher-availability"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperadminTeacherAvailability />
              </ProtectedRoute>
            }
          />
          
          {/* Teacher Routes */}
          <Route
            path="/teacher/dashboard"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/appointments"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <TeacherAppointments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/availability"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <TeacherAvailability />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/materials"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <TeacherMaterials />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/profile"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <TeacherProfile />
              </ProtectedRoute>
            }
          />
          
          {/* School Routes */}
          <Route
            path="/school/dashboard"
            element={
              <ProtectedRoute allowedRoles={['school']}>
                <SchoolDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/school/students"
            element={
              <ProtectedRoute allowedRoles={['school']}>
                <SchoolStudents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/school/bookings"
            element={
              <ProtectedRoute allowedRoles={['school']}>
                <SchoolBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/school/materials"
            element={
              <ProtectedRoute allowedRoles={['school']}>
                <SchoolMaterials />
              </ProtectedRoute>
            }
          />
          <Route
            path="/school/packages"
            element={
              <ProtectedRoute allowedRoles={['school']}>
                <SchoolPackages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/school/credits"
            element={
              <ProtectedRoute allowedRoles={['school']}>
                <SchoolCredits />
              </ProtectedRoute>
            }
          />
          <Route
            path="/school/reports"
            element={
              <ProtectedRoute allowedRoles={['school']}>
                <SchoolReports />
              </ProtectedRoute>
            }
          />
          
          {/* Default redirect to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* 404 - Catch all unmatched routes */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
