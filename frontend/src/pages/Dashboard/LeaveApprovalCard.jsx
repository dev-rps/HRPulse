import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function LeaveApprovalCard({ request, allRequests, onDecisionComplete }) {
  const { accessToken } = useAuth();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [apiWarning, setApiWarning] = useState(null);

  const requester = request.user || {};
  const startDate = new Date(request.start_date);
  const endDate = new Date(request.end_date);
  
  // Calculate days count
  const countDays = (start, end) => {
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  };

  const daysCount = countDays(startDate, endDate);

  // Local team capacity check (overlap checker) before admin decides
  const getOverlappingApprovedLeaves = () => {
    if (!requester.department) return [];

    return allRequests.filter(req => {
      // Must be approved
      if (req.status !== 'approved') return false;
      // Must be in the same department
      if (req.user?.department !== requester.department) return false;
      // Exclude current request
      if (req.id === request.id) return false;

      // Overlap logic: StartA <= EndB and EndA >= StartB
      const reqStart = new Date(req.start_date);
      const reqEnd = new Date(req.end_date);
      return reqStart <= endDate && reqEnd >= startDate;
    });
  };

  const overlappingLeaves = getOverlappingApprovedLeaves();
  const showWarningBanner = overlappingLeaves.length > 0;

  const handleDecision = async (status) => {
    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/leave-requests/${request.id}/decision`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status, comment }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit decision');
      }

      // If backend returned a warning check, we capture it and show it to the admin.
      if (json.warning) {
        setApiWarning(json.capacityMessage);
        // We do not immediately trigger onDecisionComplete if there is a warning,
        // so the admin has a visual feedback of the warning state.
        // But since the action has completed on the server, we can prompt them to click "Acknowledge"
        return;
      }

      onDecisionComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface p-5 rounded-lg border border-border shadow-sm space-y-4">
      {/* User Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-light text-primary font-bold flex items-center justify-center text-sm overflow-hidden">
            {requester.profile_picture_url ? (
              <img src={requester.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              requester.name?.slice(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text">{requester.name}</h4>
            <span className="text-xs text-text-muted capitalize">
              {requester.job_title} • {requester.department}
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-bg text-text-muted uppercase tracking-wider font-mono">
          {request.leave_type} leave
        </span>
      </div>

      {/* Date detail */}
      <div className="bg-bg p-3.5 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div>
          <span className="text-text-muted block uppercase tracking-wider text-[10px] font-bold">Duration</span>
          <span className="text-text font-medium mt-0.5 block">
            {startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} to{' '}
            {endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <div>
          <span className="text-text-muted block uppercase tracking-wider text-[10px] font-bold text-right sm:block">Total Days</span>
          <span className="text-text font-bold text-sm text-right mt-0.5 block">{daysCount} {daysCount === 1 ? 'day' : 'days'}</span>
        </div>
      </div>

      {/* Remarks */}
      {request.remarks && (
        <div className="text-xs">
          <span className="text-text-muted uppercase tracking-wider text-[10px] font-bold block">Remarks</span>
          <p className="text-text bg-bg/50 p-2.5 rounded border border-border/40 mt-1 italic">
            "{request.remarks}"
          </p>
        </div>
      )}

      {/* ⚠️ Front-end Team Capacity Overlap Warning Banner */}
      {showWarningBanner && !apiWarning && (
        <div className="capacity-banner leading-relaxed font-sans text-xs">
          <span className="text-base">⚠️</span>
          <div>
            <strong className="block text-amber-900">Caution: Overlapping Approved Leave</strong>
            <span className="text-amber-800 font-medium">
              {overlappingLeaves.length} other team member(s) in the {requester.department} department already have approved leave overlapping these dates.
            </span>
          </div>
        </div>
      )}

      {/* ⚠️ Server-side Warning Response Banner (If returned by API after approval) */}
      {apiWarning && (
        <div className="capacity-banner border-error bg-error-light text-error leading-relaxed font-sans text-xs">
          <span className="text-base">🚨</span>
          <div>
            <strong className="block text-red-900">Overcapacity Warning Acknowledged</strong>
            <span className="text-red-800 font-medium">{apiWarning}</span>
            <button
              onClick={onDecisionComplete}
              className="mt-2 block bg-error text-text-inverse px-3 py-1 rounded text-[10px] font-bold hover:bg-red-600 transition-colors uppercase tracking-wider"
            >
              Confirm & Close Request
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-xs text-error font-medium bg-error-light/50 border border-error p-2.5 rounded">
          ⚠️ {error}
        </div>
      )}

      {/* Action form */}
      {!apiWarning && (
        <div className="space-y-3 pt-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add decision comment or feedback (optional)..."
            rows="2"
            disabled={submitting}
            className="w-full p-2.5 border border-border bg-bg text-text rounded-md text-xs focus:outline-none focus:border-primary resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => handleDecision('rejected')}
              disabled={submitting}
              className="px-4 py-2 border border-border text-text hover:bg-bg rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={() => handleDecision('approved')}
              disabled={submitting}
              className="px-4 py-2 bg-primary text-text-inverse hover:bg-primary-hover rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Approve'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
