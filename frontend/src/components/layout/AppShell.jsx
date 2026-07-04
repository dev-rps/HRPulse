import React from 'react';
import { Outlet } from 'react-router-dom';

export default function AppShell() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="p-4">
        <Outlet />
      </div>
    </div>
  );
}
