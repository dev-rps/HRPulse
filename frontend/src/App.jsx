import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { SocketProvider } from './contexts/SocketContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppShell from './components/layout/AppShell.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';

// Pages owned by other members — imported as stubs until they build them.
// Member 2: Attendance  |  Member 3: LeaveApplication, Payroll
// Do NOT edit those files unless flagged in group chat first.
import AttendancePage from './pages/Attendance.jsx';
import LeaveApplicationPage from './pages/LeaveApplication.jsx';
import PayrollPage from './pages/Payroll.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected — all wrapped in AppShell (sidebar + topbar) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />

                {/* Member 2's page */}
                <Route path="/attendance" element={<AttendancePage />} />

                {/* Member 3's pages */}
                <Route path="/leave" element={<LeaveApplicationPage />} />
                <Route path="/payroll" element={<PayrollPage />} />

                {/* Admin-only routes */}
                <Route element={<ProtectedRoute requiredRole="admin" />}>
                  {/* Admin sees same /dashboard but with AdminDashboard component inside */}
                  {/* Additional admin routes can be added here as other members build them */}
                </Route>
              </Route>
            </Route>

            {/* Catch-all → login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
