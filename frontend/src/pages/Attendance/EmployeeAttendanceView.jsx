import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useSocket } from '../../contexts/SocketContext.jsx';
import {
  queueAction,
  getQueuedActions,
  deleteQueuedAction,
  checkOnlineStatus,
} from '../../lib/offlineQueue.js';

// ─── Attendance status colour tokens (from tokens.css via Tailwind) ────────────
const STATUS_STYLES = {
  present:  { bg: 'bg-success-light',  text: 'text-success',  label: 'Present' },
  half_day: { bg: 'bg-warning-light',  text: 'text-warning',  label: 'Half Day' },
  absent:   { bg: 'bg-error-light',    text: 'text-error',    label: 'Absent' },
  leave:    { bg: 'bg-primary-light',  text: 'text-primary',  label: 'Leave' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? { bg: 'bg-border', text: 'text-text-muted', label: status };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata',
  });
}

function getTodayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeeAttendanceView() {
  const { user, accessToken } = useAuth();
  const socket = useSocket();

  // Attendance state
  const [todayRecord, setTodayRecord]   = useState(null);
  const [weeklyLog, setWeeklyLog]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]               = useState(null);

  // Offline state
  const [isOnline, setIsOnline]         = useState(true);
  const [syncMessage, setSyncMessage]   = useState(null); // null | { type: 'warn'|'success'|'error', text }
  const [queueCount, setQueueCount]     = useState(0);
  const [isSyncing, setIsSyncing]       = useState(false);

  const syncLockRef = useRef(false); // prevent concurrent syncs

  // ─── Network Status Polling ─────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      const online = await checkOnlineStatus();
      if (mounted) setIsOnline(online);
    };

    poll(); // immediate check
    const interval = setInterval(poll, 10000); // every 10s

    const handleOnline  = () => poll();
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ─── Queue Count Refresh ────────────────────────────────────────────────────
  const refreshQueueCount = useCallback(async () => {
    if (!user?.id) return;
    const actions = await getQueuedActions(user.id);
    setQueueCount(actions.length);
  }, [user?.id]);

  // ─── Fetch Attendance Data ──────────────────────────────────────────────────
  const fetchAttendance = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const [dailyRes, weeklyRes] = await Promise.all([
        fetch('/api/attendance/me?range=daily',  { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/attendance/me?range=weekly', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      const daily  = await dailyRes.json();
      const weekly = await weeklyRes.json();
      setTodayRecord(daily.data ?? null);
      setWeeklyLog(Array.isArray(weekly.data) ? weekly.data : []);
    } catch (err) {
      setError('Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchAttendance();
    refreshQueueCount();
  }, [fetchAttendance, refreshQueueCount]);

  // ─── Real-time Socket Updates ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !user?.id) return;
    const event = `attendance:update:${user.id}`;
    const handler = (payload) => {
      const today = getTodayIST();
      if (payload.date === today) {
        setTodayRecord(payload);
      }
      setWeeklyLog(prev => {
        const idx = prev.findIndex(r => r.date?.startsWith(payload.date));
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = payload;
          return next;
        }
        return [payload, ...prev].sort((a, b) => new Date(a.date) - new Date(b.date));
      });
    };
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [socket, user?.id]);

  // ─── Auto-Sync Queue on Reconnection ───────────────────────────────────────
  useEffect(() => {
    if (!isOnline || !user?.id || !accessToken || syncLockRef.current) return;

    const flushQueue = async () => {
      const actions = await getQueuedActions(user.id);
      if (actions.length === 0) return;

      syncLockRef.current = true;
      setIsSyncing(true);
      setSyncMessage({ type: 'warn', text: `Syncing ${actions.length} offline action(s)…` });

      let anyError = false;

      for (const action of actions) {
        try {
          const res = await fetch(`/api/attendance/${action.type}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              timestamp: action.timestamp,
              synced_offline: true,
            }),
          });

          if (res.ok || res.status === 409) {
            // 409 = already synced from another device; still safe to remove from queue
            await deleteQueuedAction(action.id);
            if (res.status === 409) {
              console.warn('[OfflineSync] Duplicate detected (409) for action:', action);
            }
          } else {
            anyError = true;
          }
        } catch (err) {
          console.error('[OfflineSync] Network error during sync:', err);
          anyError = true;
          break; // stop on network failure; will retry next time online
        }
      }

      await refreshQueueCount();
      await fetchAttendance();

      setSyncMessage(
        anyError
          ? { type: 'error', text: 'Some offline actions failed to sync. Will retry later.' }
          : { type: 'success', text: 'All offline actions synced successfully! ✓' }
      );
      setIsSyncing(false);
      syncLockRef.current = false;

      // Clear success message after 4s
      if (!anyError) setTimeout(() => setSyncMessage(null), 4000);
    };

    flushQueue();
  }, [isOnline, user?.id, accessToken, fetchAttendance, refreshQueueCount]);

  // ─── Check-in / Check-out Handler ──────────────────────────────────────────
  const handlePunch = useCallback(async () => {
    if (actionLoading || isSyncing) return;

    const actionType = todayRecord?.check_in_time && !todayRecord?.check_out_time
      ? 'check-out'
      : 'check-in';

    const timestamp = new Date().toISOString();
    setActionLoading(true);
    setError(null);

    if (!isOnline) {
      // Offline: queue locally
      try {
        await queueAction(user.id, actionType, timestamp);
        await refreshQueueCount();
        // Optimistically update today's display
        if (actionType === 'check-in') {
          setTodayRecord({ status: 'present', check_in_time: timestamp, check_out_time: null, synced_offline: true });
        } else {
          setTodayRecord(prev => ({ ...prev, check_out_time: timestamp, synced_offline: true }));
        }
        setSyncMessage({
          type: 'warn',
          text: `${actionType === 'check-in' ? 'Check-in' : 'Check-out'} saved locally — will sync when back online.`,
        });
      } catch (err) {
        setError('Failed to save offline. Please try again.');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    // Online: send directly to backend
    try {
      const res = await fetch(`/api/attendance/${actionType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ timestamp }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError('Already checked in today from another device.');
      } else if (!res.ok) {
        setError(data.error || 'Something went wrong.');
      }
      // Success: socket event will update state
    } catch (err) {
      setError('Network error. If you are offline, please check your connection.');
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, isSyncing, todayRecord, isOnline, user?.id, accessToken, refreshQueueCount]);

  // ─── Derived States ─────────────────────────────────────────────────────────
  const hasCheckedIn  = !!todayRecord?.check_in_time;
  const hasCheckedOut = !!todayRecord?.check_out_time;
  const punchLabel    = !hasCheckedIn ? 'Check In' : !hasCheckedOut ? 'Check Out' : 'Done for Today';
  const punchDisabled = hasCheckedOut || actionLoading || isSyncing;

  const punchBtnClass = hasCheckedOut
    ? 'bg-border text-text-muted cursor-not-allowed'
    : !hasCheckedIn
    ? 'bg-primary hover:bg-primary-hover active:scale-95 text-white shadow-md hover:shadow-lg'
    : 'bg-warning hover:bg-amber-600 active:scale-95 text-white shadow-md hover:shadow-lg';

  return (
    <div className="space-y-6">

      {/* ── Page Header ─── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-sans text-text">My Attendance</h1>
        <p className="text-sm text-text-muted mt-1">Track your daily check-ins and weekly attendance log.</p>
      </div>

      {/* ── Network Status Banner ─── */}
      {!isOnline && (
        <div className="flex items-center gap-3 bg-warning-light border border-warning text-warning rounded-lg px-4 py-3 text-sm font-medium">
          <span className="text-lg">📡</span>
          <span>You are offline. Actions will be saved locally and synced when you reconnect.</span>
        </div>
      )}

      {/* ── Sync Message Banner ─── */}
      {syncMessage && (
        <div
          className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium border transition-all ${
            syncMessage.type === 'success'
              ? 'bg-success-light border-success text-success'
              : syncMessage.type === 'error'
              ? 'bg-error-light border-error text-error'
              : 'bg-warning-light border-warning text-warning'
          }`}
        >
          <span className="text-lg">
            {syncMessage.type === 'success' ? '✅' : syncMessage.type === 'error' ? '❌' : '🔄'}
          </span>
          <span>{syncMessage.text}</span>
        </div>
      )}

      {/* ── Error Banner ─── */}
      {error && (
        <div className="flex items-center gap-3 bg-error-light border border-error text-error rounded-lg px-4 py-3 text-sm font-medium">
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Today's Card ─── */}
      <div className="bg-surface border border-border rounded-xl shadow-md overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text font-sans">Today's Status</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {queueCount > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-warning-light text-warning rounded-full">
                📦 {queueCount} queued
              </span>
            )}
            {!isOnline && (
              <span className="w-2.5 h-2.5 rounded-full bg-warning animate-pulse block" title="Offline" />
            )}
            {isOnline && (
              <span className="w-2.5 h-2.5 rounded-full bg-success block" title="Online" />
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-8 flex flex-col items-center gap-6">

          {/* Status + Times */}
          {loading ? (
            <div className="text-sm text-text-muted animate-pulse">Loading attendance…</div>
          ) : (
            <>
              {todayRecord ? (
                <div className="w-full max-w-sm space-y-4">
                  <div className="flex justify-center">
                    <StatusBadge status={todayRecord.status} />
                    {todayRecord.synced_offline && (
                      <span className="ml-2 text-xs text-text-muted italic">• synced offline</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-bg rounded-lg p-4">
                      <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Check In</p>
                      <p className="text-xl font-bold text-success mt-1">{formatTime(todayRecord.check_in_time)}</p>
                    </div>
                    <div className="bg-bg rounded-lg p-4">
                      <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Check Out</p>
                      <p className={`text-xl font-bold mt-1 ${todayRecord.check_out_time ? 'text-error' : 'text-text-muted'}`}>
                        {formatTime(todayRecord.check_out_time)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-muted">Not yet checked in today.</p>
              )}
            </>
          )}

          {/* Punch Button */}
          <button
            id="attendance-punch-btn"
            onClick={handlePunch}
            disabled={punchDisabled}
            className={`relative w-40 h-40 rounded-full font-bold text-lg font-sans transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-primary/30 ${punchBtnClass}`}
          >
            {actionLoading || isSyncing ? (
              <span className="animate-spin text-2xl">⟳</span>
            ) : (
              <>
                <span className="block text-3xl mb-1">
                  {!hasCheckedIn ? '🟢' : !hasCheckedOut ? '🔴' : '✅'}
                </span>
                <span>{punchLabel}</span>
              </>
            )}
          </button>

          <p className="text-xs text-text-muted text-center max-w-xs">
            {!hasCheckedIn
              ? 'Tap to record your check-in for today. Late check-ins (after 10:00 AM) are marked as Half Day.'
              : !hasCheckedOut
              ? 'Tap to record your check-out for today.'
              : 'Your attendance for today is complete.'}
          </p>
        </div>
      </div>

      {/* ── Weekly Log ─── */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text font-sans">This Week</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-text-muted animate-pulse">Loading week log…</div>
        ) : weeklyLog.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">No attendance records found for this week.</div>
        ) : (
          <div className="divide-y divide-border">
            {weeklyLog.map((record) => (
              <div
                key={record.id ?? record.date}
                className="flex items-center justify-between px-6 py-4 hover:bg-bg/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-text">{formatDate(record.date)}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    In: {formatTime(record.check_in_time)} &nbsp;·&nbsp; Out: {formatTime(record.check_out_time)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {record.synced_offline && (
                    <span className="text-xs text-text-muted italic">offline</span>
                  )}
                  <StatusBadge status={record.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
