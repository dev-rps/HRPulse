import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function ProtectedRoute({ requiredRole }) {
  const { user } = useAuth();

  if (!user) {
    // Redirect to login if unauthenticated
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    // Redirect to main dashboard if role is unauthorized
    return <Navigate to="/dashboard" replace />;
  }

  // Render children/routes
  return <Outlet />;
}
