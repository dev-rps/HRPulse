import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

export default function LeaveApply() {
  const { accessToken, user } = useAuth();
  const { socket } = useSocket();

  // Core inputs
  const [leaveType, setLeaveType] = useState('paid');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [remarks, setRemarks] = useState('');

  // UI state
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Calendar Picker UI state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState(null);

  const fetchLeaveData = async () => {
    setLoading(true);
    try {
      // 1. Fetch employee's own requests
      const reqRes = await fetch('/api/leave-requests/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (reqRes.ok) {
        const json = await reqRes.json();
        setLeaveRequests(json.data);
      }

      // 2. Fetch employee's own balances
      const balRes = await fetch('/api/leave-balances/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (balRes.ok) {
        const json = await balRes.json();
        setBalances(json.data);
      }
    } catch (err) {
      console.error('Error fetching leave details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial Load and Auto-fetch
  useEffect(() => {
    if (accessToken) {
      fetchLeaveData();
    }
  }, [accessToken]);

  // Socket IO Listener for real-time status updates
  useEffect(() => {
    if (!socket || !user) return;

    const eventName = `leave:status:${user.id}`;
    const handleStatusUpdate = (payload) => {
      console.log('[SOCKET] Live status update received:', payload);
      // Update requests list in place
      setLeaveRequests((prev) =>
        prev.map((req) =>
          req.id === payload.requestId
            ? {
                ...req,
                status: payload.status,
                admin_comment: payload.comment,
                updated_at: payload.updatedAt,
              }
            : req
        )
      );

      // Flash success message
      setSuccessMsg(`Your leave request status was updated to "${payload.status}" in real-time!`);
      setTimeout(() => setSuccessMsg(null), 5000);

      // Re-fetch balances since leave was approved/rejected
      fetchLeaveData();
    };

    socket.on(eventName, handleStatusUpdate);

    return () => {
      socket.off(eventName, handleStatusUpdate);
    };
  }, [socket, user]);

  // Date range logic
  const handleDateClick = (date) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // Disable checking for past dates unless sick leave
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const clickedDate = new Date(date);
    clickedDate.setHours(0, 0, 0, 0);

    if (leaveType !== 'sick' && clickedDate < today) {
      setErrorMsg('You cannot select past dates for Paid or Unpaid leave.');
      return;
    }

    // Check overlap
    if (isDateOverlapping(clickedDate)) {
      setErrorMsg('This date overlaps with an existing leave request.');
      return;
    }

    if (!startDate || (startDate && endDate)) {
      // First click or resetting range
      setStartDate(clickedDate);
      setEndDate(null);
    } else if (startDate && !endDate) {
      if (clickedDate < startDate) {
        // Clicked date is before start date, treat it as new start date
        setStartDate(clickedDate);
      } else {
        // Verify no overlapping date exists inside the selection range
        let hasRangeOverlap = false;
        let checkDate = new Date(startDate);
        while (checkDate <= clickedDate) {
          if (isDateOverlapping(checkDate)) {
            hasRangeOverlap = true;
            break;
          }
          checkDate.setDate(checkDate.getDate() + 1);
        }

        if (hasRangeOverlap) {
          setErrorMsg('The selected range contains dates overlapping with existing requests.');
          return;
        }

        setEndDate(clickedDate);
      }
    }
  };

  const isDateOverlapping = (date) => {
    return leaveRequests.some((req) => {
      if (req.status !== 'pending' && req.status !== 'approved') return false;
      const start = new Date(req.start_date);
      const end = new Date(req.end_date);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const check = new Date(date);
      check.setHours(0, 0, 0, 0);
      return check >= start && check <= end;
    });
  };

  const countSelectedDays = () => {
    if (!startDate) return 0;
    if (!endDate) return 1;
    const diffMs = endDate.getTime() - startDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  };

  // Submit Application
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!startDate) {
      setErrorMsg('Please select a date range on the calendar.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    const actualEnd = endDate || startDate; // If single day selected

    try {
      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: startDate.toISOString(),
          end_date: actualEnd.toISOString(),
          remarks: remarks,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Failed to submit leave request');
      }

      setSuccessMsg('Leave request submitted successfully.');
      setStartDate(null);
      setEndDate(null);
      setRemarks('');
      fetchLeaveData(); // refresh lists & balances
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Render Calendar logic
  const renderCalendarPicker = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];
    // Padding
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`pad-${i}`} className="p-2"></div>);
    }

    // Days grid
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(year, month, i);
      date.setHours(0, 0, 0, 0);

      const isPast = date < today;
      const isSick = leaveType === 'sick';
      const disabled = (isPast && !isSick) || isDateOverlapping(date);
      const isStart = startDate && date.getTime() === startDate.getTime();
      const isEnd = endDate && date.getTime() === endDate.getTime();
      const inRange = startDate && endDate && date > startDate && date < endDate;
      
      // Hover range highlight
      const wouldBeInRange = 
        startDate && 
        !endDate && 
        hoveredDate && 
        date > startDate && 
        date <= hoveredDate;

      let cellClass = "p-2 text-center rounded-lg text-sm font-medium transition-all duration-150 relative cursor-pointer ";
      if (disabled) {
        cellClass += "text-slate-300 bg-slate-50 cursor-not-allowed ";
        if (isDateOverlapping(date)) {
          cellClass += "line-through decoration-red-400/50 ";
        }
      } else if (isStart || isEnd) {
        cellClass += "bg-[var(--color-primary)] text-white shadow-md scale-105 z-10 ";
      } else if (inRange) {
        cellClass += "bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-none ";
      } else if (wouldBeInRange) {
        cellClass += "bg-blue-50 text-blue-600 rounded-none border-y border-dashed border-blue-300 ";
      } else {
        cellClass += "text-slate-600 hover:bg-slate-100 ";
      }

      days.push(
        <div
          key={`day-${i}`}
          onClick={() => !disabled && handleDateClick(date)}
          onMouseEnter={() => !disabled && setHoveredDate(date)}
          onMouseLeave={() => setHoveredDate(null)}
          className={cellClass}
          title={isDateOverlapping(date) ? 'Overlapping leave request' : ''}
        >
          {i}
          {isDateOverlapping(date) && (
            <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-[var(--color-accent)] rounded-full"></span>
          )}
        </div>
      );
    }

    return (
      <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <button
            type="button"
            onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
            className="p-1 px-2.5 rounded hover:bg-slate-100 border text-slate-600 font-bold"
          >
            &lt;
          </button>
          <span className="text-sm font-bold text-slate-700">
            {monthNames[month]} {year}
          </span>
          <button
            type="button"
            onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
            className="p-1 px-2.5 rounded hover:bg-slate-100 border text-slate-600 font-bold"
          >
            &gt;
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 tracking-wider mb-2">
          <span>SU</span>
          <span>MO</span>
          <span>TU</span>
          <span>WE</span>
          <span>TH</span>
          <span>FR</span>
          <span>SA</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days}
        </div>
        <div className="mt-4 flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[var(--color-primary)] rounded"></span>
            <span className="text-slate-500">Selected</span>
            <span className="w-2.5 h-2.5 bg-[var(--color-accent)] rounded-full ml-2"></span>
            <span className="text-slate-500">Overlapping</span>
          </div>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
              }}
              className="text-red-500 font-bold hover:underline"
            >
              Clear Range
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Real-time Balance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {balances.map((bal) => (
          <div
            key={bal.leave_type}
            className="bg-white rounded-2xl p-6 shadow-md border border-[var(--color-border)] relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full translate-x-8 -translate-y-8 z-0"></div>
            <div className="relative z-10">
              <span className="text-xs uppercase font-extrabold text-[var(--color-text-muted)] tracking-wider">
                {bal.leave_type} Leave Balance
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-black text-slate-800">
                  {bal.remaining_days === Infinity ? '∞' : bal.total_days - bal.used_days}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">days remaining</span>
              </div>
              <div className="mt-4 flex justify-between text-xs text-slate-500 font-medium">
                <span>Allocated: {bal.total_days === 999 ? 'Unlimited' : bal.total_days}</span>
                <span>Used: {bal.used_days}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Leave Form */}
        <div className="bg-white rounded-2xl shadow-lg border border-[var(--color-border)] p-6 transition-shadow duration-300 hover:shadow-xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800">Apply for Leave</h2>
            <p className="text-xs text-slate-400 mt-1">Submit your request; decisions are synchronized in real-time</p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-[var(--color-error-light)] text-[var(--color-error)] text-xs font-semibold flex items-center gap-2 border border-red-200">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 rounded-xl bg-[var(--color-success-light)] text-[var(--color-success)] text-xs font-semibold flex items-center gap-2 border border-emerald-200 animate-pulse">
              <span>✅</span>
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Leave Type</label>
              <div className="grid grid-cols-3 gap-3">
                {['paid', 'sick', 'unpaid'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setLeaveType(type);
                      setStartDate(null);
                      setEndDate(null);
                    }}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold capitalize transition-all duration-200 ${
                      leaveType === type
                        ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] border-2 border-[var(--color-primary)]'
                        : 'bg-slate-50 text-slate-600 border-2 border-transparent hover:bg-slate-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Select Calendar Range
              </label>
              {renderCalendarPicker()}
              {startDate && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 border border-slate-100 flex justify-between">
                  <span>Selected: {startDate.toLocaleDateString()} to {endDate ? endDate.toLocaleDateString() : startDate.toLocaleDateString()}</span>
                  <span className="text-[var(--color-primary)]">({countSelectedDays()} days)</span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="remarks" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remarks</label>
              <textarea
                id="remarks"
                rows="3"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Brief reason for your leave request..."
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                maxLength="500"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-lg text-sm"
            >
              {submitting ? 'Submitting request...' : 'Submit Application'}
            </button>
          </form>
        </div>

        {/* Leave Requests History */}
        <div className="bg-white rounded-2xl shadow-lg border border-[var(--color-border)] p-6 flex flex-col justify-between transition-shadow duration-300 hover:shadow-xl">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Leave History</h2>
                <p className="text-xs text-slate-400 mt-1">Live updates show up automatically without refreshes</p>
              </div>
              {socket?.connected && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-success)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-success)]"></span>
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-4 animate-pulse">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="h-16 bg-slate-50 rounded-xl"></div>
                ))}
              </div>
            ) : leaveRequests.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <span className="text-4xl mb-2">📄</span>
                <span className="text-xs font-semibold">No leave applications found.</span>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[420px] space-y-4 pr-1">
                {leaveRequests.map((req) => {
                  const statusColors = {
                    pending: 'bg-[var(--color-warning-light)] text-[var(--color-warning)]',
                    approved: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
                    rejected: 'bg-[var(--color-error-light)] text-[var(--color-error)]',
                  };

                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all duration-200 flex justify-between items-start"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-700 capitalize">{req.leave_type} Leave</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${statusColors[req.status]}`}>
                            {req.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          {new Date(req.start_date).toLocaleDateString()} &rarr; {new Date(req.end_date).toLocaleDateString()}
                        </p>
                        {req.remarks && (
                          <p className="text-[11px] text-slate-400 italic">"{req.remarks}"</p>
                        )}
                        {req.admin_comment && (
                          <p className="text-[11px] text-slate-500 font-semibold mt-1 p-2 bg-white rounded-lg border border-slate-100">
                            ✍️ Admin: "{req.admin_comment}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="text-center mt-6 pt-4 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              HRPulse • Team Lead Real-time Sync Enabled
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
