import React from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import EmployeeDashboard from './Dashboard/EmployeeDashboard.jsx';
import AdminDashboard from './Dashboard/AdminDashboard.jsx';

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }

  return <EmployeeDashboard />;
}
