import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { useSocket } from '../../contexts/SocketContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const socket = useSocket();
  const { user } = useAuth();

  // Load initial local notifications (mocked or localStorage-saved for persistence)
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`notifications:${user.id}`);
      if (saved) {
        setNotifications(JSON.parse(saved));
      }
    }
  }, [user?.id]);

  // Persist notifications when they change
  useEffect(() => {
    if (user) {
      localStorage.setItem(`notifications:${user.id}`, JSON.stringify(notifications));
    }
  }, [notifications, user?.id]);

  // Subscribe to real-time Socket.io events
  useEffect(() => {
    if (!socket || !user) return;

    const notificationEvent = `notification:new:${user.id}`;
    const leaveStatusEvent = `leave:status:${user.id}`;

    const handleNewNotification = (payload) => {
      // payload shape: { id, type, message, read, createdAt }
      setNotifications((prev) => {
        // Prevent duplicate IDs from socket emits
        if (prev.some((n) => n.id === payload.id)) return prev;
        return [
          {
            id: payload.id,
            type: payload.type || 'info',
            message: payload.message,
            read: payload.read || false,
            createdAt: payload.createdAt || new Date().toISOString(),
          },
          ...prev,
        ];
      });
    };

    const handleLeaveStatus = (payload) => {
      // payload shape: { requestId, status, comment, updatedAt }
      const statusText = payload.status === 'approved' ? 'APPROVED ✅' : 'REJECTED ❌';
      const commentText = payload.comment ? ` Reason: "${payload.comment}"` : '';
      const message = `Your leave request has been ${statusText}.${commentText}`;

      setNotifications((prev) => [
        {
          id: `leave-status-${payload.requestId}-${Date.now()}`,
          type: 'leave_status',
          message,
          read: false,
          createdAt: payload.updatedAt || new Date().toISOString(),
        },
        ...prev,
      ]);
    };

    socket.on(notificationEvent, handleNewNotification);
    socket.on(leaveStatusEvent, handleLeaveStatus);

    return () => {
      socket.off(notificationEvent, handleNewNotification);
      socket.off(leaveStatusEvent, handleLeaveStatus);
    };
  }, [socket, user?.id]);

  return (
    <div className="min-h-screen bg-bg text-text font-sans">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Layout Container */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Topbar header */}
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          notifications={notifications}
          setNotifications={setNotifications}
        />

        {/* Content Section */}
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">
          {/* We pass down notifications state to active page routes via React Router's Outlet Context */}
          <Outlet context={{ notifications, setNotifications }} />
        </main>
      </div>
    </div>
  );
}
