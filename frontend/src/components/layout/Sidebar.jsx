import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function Sidebar({ isOpen, setIsOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const employeeLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: '📊' },
    { name: 'Profile', path: '/profile', icon: '👤' },
    { name: 'Attendance', path: '/attendance', icon: '📅' },
    { name: 'Leave Requests', path: '/leave', icon: '✉️' },
    { name: 'Payroll', path: '/payroll', icon: '💵' },
  ];

  const adminLinks = [
    { name: 'Employee List', path: '/dashboard?tab=employees', icon: '👥' },
    { name: 'Attendance Records', path: '/dashboard?tab=attendance', icon: '📋' },
    { name: 'Leave Approvals', path: '/dashboard?tab=leaves', icon: '✅' },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-sidebar bg-slate-900/40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar shell */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-sidebar flex flex-col bg-surface border-r border-border w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo Section */}
        <div className="flex items-center justify-between h-14 px-6 border-b border-border">
          <div className="flex items-center gap-2 font-bold text-lg text-primary font-sans">
            <span className="text-xl">✨</span> HRPulse
          </div>
          <button
            className="lg:hidden text-text-muted hover:text-text"
            onClick={() => setIsOpen(false)}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="text-xs font-semibold text-text-muted px-3 mb-2 uppercase tracking-wider">
            Menu
          </div>
          {employeeLinks.map((link) => (
            <NavLink
              key={link.name}
              to={link.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md font-sans text-sm font-medium transition-colors ${
                  isActive && !window.location.search
                    ? 'bg-primary-light text-primary'
                    : 'text-text-muted hover:bg-bg hover:text-text'
                }`
              }
            >
              <span className="text-base">{link.icon}</span>
              {link.name}
            </NavLink>
          ))}

          {/* Admin section */}
          {user?.role === 'admin' && (
            <div className="pt-6">
              <div className="text-xs font-semibold text-text-muted px-3 mb-2 uppercase tracking-wider">
                Admin Center
              </div>
              {adminLinks.map((link) => (
                <NavLink
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) => {
                    const currentPathWithSearch = window.location.pathname + window.location.search;
                    const matchesSearch = currentPathWithSearch.includes(link.path);
                    return `flex items-center gap-3 px-3 py-2.5 rounded-md font-sans text-sm font-medium transition-colors ${
                      matchesSearch
                        ? 'bg-primary-light text-primary'
                        : 'text-text-muted hover:bg-bg hover:text-text'
                    }`;
                  }}
                >
                  <span className="text-base">{link.icon}</span>
                  {link.name}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        {/* User profile footer info */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-primary-light text-primary font-bold flex items-center justify-center text-sm border border-primary/10 overflow-hidden">
              {user?.profile_picture_url ? (
                <img src={user.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user?.name?.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-text truncate">{user?.name}</div>
              <div className="text-xs text-text-muted truncate capitalize">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-sans text-sm font-medium text-error hover:bg-error-light transition-colors"
          >
            <span className="text-base">🚪</span>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
