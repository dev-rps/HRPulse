import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useSocket } from '../../contexts/SocketContext.jsx';

// ─── Status colour tokens (from tokens.css via Tailwind) ──────────────────────
const STATUS_STYLES = {
  present:  { bg: 'bg-success-light',  text: 'text-success',  label: 'Present' },
  half_day: { bg: 'bg-warning-light',  text: 'text-warning',  label: 'Half Day' },
  absent:   { bg: 'bg-error-light',    text: 'text-error',    label: 'Absent' },
  leave:    { bg: 'bg-primary-light',  text: 'text-primary',  label: 'Leave' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? { bg: 'bg-border', text: 'text-text-muted', label: status ?? '—' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
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

function formatDateISO(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata',
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminAttendanceView() {
  const { accessToken } = useAuth();
  const socket = useSocket();

  const [records, setRecords]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [highlightIds, setHighlight]  = useState(new Set()); // row IDs recently updated
  const [searchTerm, setSearchTerm]   = useState('');
  const [dateFilter, setDateFilter]   = useState('');
  const [liveCount, setLiveCount]     = useState(0);

  // Track recently flashed rows for cleanup
  const highlightTimers = useRef({});

  // ─── Flash a row ───────────────────────────────────────────────────────────
  const flashRow = useCallback((id) => {
    setHighlight(prev => new Set([...prev, id]));
    // Clear previous timer for same id if exists
    if (highlightTimers.current[id]) clearTimeout(highlightTimers.current[id]);
    highlightTimers.current[id] = setTimeout(() => {
      setHighlight(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2500);
  }, []);

  // ─── Merge incoming socket record into table ────────────────────────────────
  const mergeRecord = useCallback((payload) => {
    setRecords(prev => {
      const idx = prev.findIndex(r => r.id === payload.id || r.user_id === payload.user_id && r.date === payload.date);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...payload };
        return next;
      }
      // New check-in — prepend
      return [payload, ...prev];
    });
    flashRow(payload.id ?? `${payload.user_id}-${payload.date}`);
    setLiveCount(c => c + 1);
  }, [flashRow]);

  // ─── Subscribe to socket events ───────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    socket.on('attendance:update', mergeRecord);
    return () => socket.off('attendance:update', mergeRecord);
  }, [socket, mergeRecord]);

  // ─── Fetch initial data ───────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (dateFilter) {
        params.set('startDate', dateFilter);
        params.set('endDate', dateFilter);
      }
      const res = await fetch(`/api/attendance/all?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch');
      setRecords(json.data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, dateFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Filtered view ────────────────────────────────────────────────────────
  const filtered = records.filter(r => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.user?.name?.toLowerCase().includes(q) ||
      r.user?.employee_id?.toLowerCase().includes(q) ||
      r.user?.department?.toLowerCase().includes(q)
    );
  });

  const presentToday  = filtered.filter(r => r.status === 'present' || r.status === 'half_day').length;
  const absentToday   = filtered.filter(r => r.status === 'absent').length;
  const halfDayToday  = filtered.filter(r => r.status === 'half_day').length;

  return (
    <div className="space-y-6">

      {/* ── Page Header ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-sans text-text">Attendance Records</h1>
          <p className="text-sm text-text-muted mt-1">
            Live-updating attendance log. Updates appear instantly as employees check in or out.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-success bg-success-light px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Live · {liveCount} update{liveCount !== 1 ? 's' : ''} received
        </div>
      </div>

      {/* ── Summary Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Present / Half-Day', value: presentToday, colorBg: 'bg-success-light', colorText: 'text-success', icon: '✅' },
          { label: 'Half Day',           value: halfDayToday, colorBg: 'bg-warning-light', colorText: 'text-warning', icon: '🕐' },
          { label: 'Absent',             value: absentToday,  colorBg: 'bg-error-light',   colorText: 'text-error',   icon: '❌' },
        ].map(card => (
          <div key={card.label} className="bg-surface border border-border rounded-lg p-5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs text-text-muted font-medium uppercase tracking-wider">{card.label}</p>
              <p className="text-2xl font-bold text-text mt-1">{card.value}</p>
            </div>
            <span className={`text-2xl p-3 rounded-lg ${card.colorBg} ${card.colorText}`}>{card.icon}</span>
          </div>
        ))}
      </div>

      {/* ── Filters ─── */}
      <div className="bg-surface border border-border rounded-lg p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            id="attendance-search"
            type="text"
            placeholder="Search by name, ID or department…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-border rounded-md text-sm bg-bg text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <span className="absolute left-3 top-2.5 text-sm text-text-muted">🔍</span>
        </div>
        <input
          id="attendance-date-filter"
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-md text-sm bg-bg text-text focus:outline-none focus:border-primary"
        />
        {dateFilter && (
          <button
            onClick={() => setDateFilter('')}
            className="px-3 py-2 text-sm text-text-muted hover:text-text border border-border rounded-md bg-bg transition-colors"
          >
            Clear date
          </button>
        )}
        <button
          onClick={fetchAll}
          className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary-hover transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* ── Error ─── */}
      {error && (
        <div className="bg-error-light text-error border border-error rounded-lg px-4 py-3 text-sm">⚠️ {error}</div>
      )}

      {/* ── Table ─── */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-bg border-b border-border text-text-muted text-xs uppercase tracking-wider font-medium">
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Check In</th>
                <th className="px-6 py-3">Check Out</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-text-muted animate-pulse">
                    Loading attendance records…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-text-muted">
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                filtered.map(record => {
                  const rowKey = record.id ?? `${record.user_id}-${record.date}`;
                  const isFlashing = highlightIds.has(rowKey);
                  return (
                    <tr
                      key={rowKey}
                      className={`transition-colors duration-700 ${
                        isFlashing
                          ? 'bg-success-light'
                          : 'hover:bg-bg/50'
                      }`}
                    >
                      {/* Employee */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-light text-primary font-bold flex items-center justify-center text-xs">
                            {record.user?.name?.slice(0, 2).toUpperCase() ?? '??'}
                          </div>
                          <div>
                            <p className="font-semibold text-text">{record.user?.name ?? 'Unknown'}</p>
                            <p className="text-xs text-text-muted">{record.user?.employee_id}</p>
                          </div>
                        </div>
                      </td>
                      {/* Date */}
                      <td className="px-6 py-4 text-text whitespace-nowrap">
                        {formatDateISO(record.date)}
                      </td>
                      {/* Check In */}
                      <td className="px-6 py-4">
                        <span className={record.check_in_time ? 'text-success font-medium' : 'text-text-muted'}>
                          {formatTime(record.check_in_time)}
                        </span>
                      </td>
                      {/* Check Out */}
                      <td className="px-6 py-4">
                        <span className={record.check_out_time ? 'text-error font-medium' : 'text-text-muted'}>
                          {formatTime(record.check_out_time)}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-6 py-4">
                        <StatusBadge status={record.status} />
                      </td>
                      {/* Source */}
                      <td className="px-6 py-4">
                        {record.synced_offline ? (
                          <span className="text-xs text-warning font-medium">📦 Offline sync</span>
                        ) : (
                          <span className="text-xs text-text-muted">Online</span>
                        )}
                        {isFlashing && (
                          <span className="ml-2 text-xs font-bold text-success animate-pulse">● LIVE</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-border bg-bg text-xs text-text-muted">
            Showing {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            {records.length !== filtered.length ? ` (filtered from ${records.length})` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
