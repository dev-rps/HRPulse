import React from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import EmployeeAttendanceView from './EmployeeAttendanceView.jsx';
import AdminAttendanceView from './AdminAttendanceView.jsx';

/**
 * Attendance page entry point.
 * Routes to the correct view based on authenticated user's role.
 */
export default function AttendancePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        Loading…
      </div>
    );
  }

  return user.role === 'admin'
    ? <AdminAttendanceView />
    : <EmployeeAttendanceView />;
}
