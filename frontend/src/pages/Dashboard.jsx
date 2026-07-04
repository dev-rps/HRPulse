import React from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import EmployeeDashboard from './Dashboard/EmployeeDashboard.jsx';

// Stub for AdminDashboard until Phase 4 is implemented
function AdminDashboardStub() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-primary">Admin Dashboard Stub</h1>
      <p className="text-text-muted mt-2">Will be implemented in Phase 4.</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'admin') {
    return <AdminDashboardStub />;
  }

  return <EmployeeDashboard />;
}
