import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { notifications } = useOutletContext();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const cards = [
    {
      title: 'My Profile',
      description: 'View and update your personal and job details.',
      path: '/profile',
      icon: '👤',
      bgClass: 'bg-primary-light/30 border-primary/20',
      iconBg: 'bg-primary text-text-inverse',
    },
    {
      title: 'Attendance Tracker',
      description: 'Log check-in/out and view daily logs.',
      path: '/attendance',
      icon: '📅',
      bgClass: 'bg-success-light/30 border-success/20',
      iconBg: 'bg-success text-text-inverse',
    },
    {
      title: 'Leave Requests',
      description: 'Apply for leaves and track approval status.',
      path: '/leave',
      icon: '✉️',
      bgClass: 'bg-warning-light/30 border-warning/20',
      iconBg: 'bg-warning text-text-inverse',
    },
    {
      title: 'Logout Session',
      description: 'Safely close your current session.',
      action: handleLogout,
      icon: '🚪',
      bgClass: 'bg-error-light/30 border-error/20',
      iconBg: 'bg-error text-text-inverse',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-sans text-text">
          Welcome back, {user?.name}! 👋
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Here is a quick overview of your employee workspace.
        </p>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <div
            key={i}
            onClick={() => (card.path ? navigate(card.path) : card.action())}
            className={`card-lift border p-5 rounded-lg bg-surface shadow-sm cursor-pointer flex flex-col justify-between ${card.bgClass}`}
          >
            <div>
              <div className={`w-10 h-10 rounded-md flex items-center justify-center text-lg font-bold mb-4 ${card.iconBg}`}>
                {card.icon}
              </div>
              <h3 className="font-sans text-base font-semibold text-text">{card.title}</h3>
              <p className="text-xs text-text-muted mt-1.5 leading-relaxed">{card.description}</p>
            </div>
            <div className="flex items-center text-xs font-semibold text-primary mt-4 group">
              <span>Go to {card.title.replace('My ', '')}</span>
              <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Feed Section */}
      <div className="bg-surface border border-border rounded-lg shadow-sm">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-text font-sans">Recent Activity & Alerts</h2>
          <span className="px-2 py-0.5 text-xs font-bold bg-primary-light text-primary rounded-full">
            Live Feed
          </span>
        </div>

        <div className="divide-y divide-border max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted">
              No recent alerts or activity. New notifications will appear here live.
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="p-4 flex items-start gap-3 hover:bg-bg/40 transition-colors">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm flex-shrink-0">
                  {n.type === 'leave' || n.type === 'leave_status' ? '✉️' : 'ℹ️'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text break-words leading-relaxed">{n.message}</p>
                  <span className="text-[10px] text-text-muted block mt-1">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-2" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
