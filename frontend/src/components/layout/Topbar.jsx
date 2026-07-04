import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function Topbar({ onMenuClick, notifications, setNotifications }) {
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  return (
    <header className="sticky top-0 z-topbar flex items-center justify-between h-14 px-4 bg-surface border-b border-border shadow-sm lg:px-8">
      {/* Mobile left side: Menu toggle & logo */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-text-muted hover:text-text focus:outline-none"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="lg:hidden font-bold text-lg text-primary flex items-center gap-1 font-sans">
          ✨ HRPulse
        </span>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="p-1.5 text-text-muted hover:text-text rounded-full hover:bg-bg relative transition-colors focus:outline-none"
            aria-label="View notifications"
          >
            <span className="text-xl">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 badge-live translate-x-1/3 -translate-y-1/3">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-md shadow-lg overflow-hidden z-modal animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between px-4 py-2.5 bg-bg border-b border-border">
                <span className="text-sm font-semibold text-text">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-primary hover:text-primary-hover font-medium focus:outline-none"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-border">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-text-muted">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id)}
                      className={`px-4 py-3 hover:bg-bg transition-colors cursor-pointer ${
                        !n.read ? 'bg-primary-light/10 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-base mt-0.5">
                          {n.type === 'leave' || n.type === 'leave_status' ? '✉️' : 'ℹ️'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text break-words">{n.message}</p>
                          <span className="text-[10px] text-text-muted block mt-1">
                            {formatTime(n.createdAt)}
                          </span>
                        </div>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Badge */}
        <div className="flex items-center gap-3 border-l border-border pl-4">
          <div className="hidden md:block text-right">
            <span className="block text-sm font-semibold text-text">{user?.name}</span>
            <span className="block text-[11px] text-text-muted capitalize leading-none mt-0.5">
              {user?.role} • {user?.department}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary-light text-primary font-bold flex items-center justify-center text-sm border border-primary/10 overflow-hidden">
            {user?.profile_picture_url ? (
              <img src={user.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              user?.name?.slice(0, 2).toUpperCase()
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
