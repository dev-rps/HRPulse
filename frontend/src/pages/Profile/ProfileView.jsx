import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function ProfileView({ onEditClick }) {
  const { user, accessToken } = useAuth();
  const [payroll, setPayroll] = useState(null);
  const [payrollLoading, setPayrollLoading] = useState(true);
  const [payrollError, setPayrollError] = useState(null);

  useEffect(() => {
    const fetchPayroll = async () => {
      if (!user?.id) return;
      try {
        setPayrollLoading(true);
        // Call Member 3's planned payroll endpoint
        const res = await fetch(`/api/payroll/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json();
        if (res.ok) {
          setPayroll(json.data);
        } else if (res.status === 404) {
          // If payroll module has not configured this user yet, or endpoint is not built
          setPayrollError('No salary structure found. Configured by Payroll module.');
        } else {
          throw new Error(json.error || 'Failed to load payroll details');
        }
      } catch (err) {
        console.error('Payroll API load failed:', err.message);
        setPayrollError('Payroll records not accessible.');
      } finally {
        setPayrollLoading(false);
      }
    };
    fetchPayroll();
  }, [user?.id, accessToken]);

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="bg-surface border border-border p-6 rounded-lg shadow-sm flex flex-col md:flex-row items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-primary-light text-primary font-bold text-3xl flex items-center justify-center border border-primary/20 overflow-hidden flex-shrink-0">
          {user?.profile_picture_url ? (
            <img src={user.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            user?.name?.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="flex-1 text-center md:text-left space-y-1">
          <h2 className="text-xl md:text-2xl font-bold text-text font-sans">{user?.name}</h2>
          <p className="text-sm font-medium text-primary capitalize">
            {user?.job_title || 'Employee'} • {user?.department || 'Department'}
          </p>
          <p className="text-xs text-text-muted font-mono">ID: {user?.employee_id}</p>
        </div>
        <button
          onClick={onEditClick}
          className="px-4 py-2 bg-primary text-text-inverse hover:bg-primary-hover rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5"
        >
          ✏️ Edit Profile
        </button>
      </div>

      {/* Grid of Profile Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: General Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Details */}
          <div className="bg-surface border border-border rounded-lg shadow-sm">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text uppercase tracking-wider">Personal Information</h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-text-muted block font-medium">Email Address</span>
                <span className="text-text block mt-1 font-semibold">{user?.email}</span>
              </div>
              <div>
                <span className="text-text-muted block font-medium">Phone Number</span>
                <span className="text-text block mt-1 font-semibold">{user?.phone || 'Not provided'}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-text-muted block font-medium">Residential Address</span>
                <span className="text-text block mt-1 font-semibold leading-relaxed">
                  {user?.address || 'Not provided'}
                </span>
              </div>
            </div>
          </div>

          {/* Job Details */}
          <div className="bg-surface border border-border rounded-lg shadow-sm">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text uppercase tracking-wider">Employment Details</h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-text-muted block font-medium">Job Title</span>
                <span className="text-text block mt-1 font-semibold">{user?.job_title || 'N/A'}</span>
              </div>
              <div>
                <span className="text-text-muted block font-medium">Department</span>
                <span className="text-text block mt-1 font-semibold capitalize">{user?.department || 'N/A'}</span>
              </div>
              <div>
                <span className="text-text-muted block font-medium">Date of Joining</span>
                <span className="text-text block mt-1 font-semibold">
                  {formatDate(user?.date_of_joining)}
                </span>
              </div>
              <div>
                <span className="text-text-muted block font-medium">System Role Scope</span>
                <span className="text-text block mt-1 font-semibold capitalize font-mono text-[10px]">
                  {user?.role} Access
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Salary (Payroll) & Documents */}
        <div className="space-y-6">
          {/* Salary Structure Section (Member 3 Payroll consumption) */}
          <div className="bg-surface border border-border rounded-lg shadow-sm">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text uppercase tracking-wider">Compensation Structure</h3>
            </div>
            <div className="p-5 space-y-3 text-xs">
              {payrollLoading ? (
                <div className="space-y-2 py-4 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                  <div className="h-4 bg-slate-100 rounded w-2/3"></div>
                </div>
              ) : payrollError ? (
                <div className="text-center py-4 text-text-muted italic">{payrollError}</div>
              ) : payroll ? (
                <div className="space-y-2 font-mono">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-text-muted">Basic Salary:</span>
                    <span className="text-text font-semibold">${payroll.basic}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-text-muted">HRA:</span>
                    <span className="text-text font-semibold">${payroll.hra}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-text-muted">Allowances:</span>
                    <span className="text-text font-semibold">${payroll.allowances}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-text-muted">Deductions:</span>
                    <span className="text-error font-semibold">-${payroll.deductions}</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-sm font-sans font-bold border-t border-border pt-2">
                    <span className="text-primary">Net Salary:</span>
                    <span className="text-primary">${payroll.net_salary}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-text-muted italic">Salary data empty.</div>
              )}
            </div>
          </div>

          {/* Documents Section */}
          <div className="bg-surface border border-border rounded-lg shadow-sm">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text uppercase tracking-wider">Employee Documents</h3>
            </div>
            <div className="p-5 text-xs space-y-3">
              {/* Fallback mock list for hackathon completeness */}
              <div className="flex items-center justify-between p-2 bg-bg border border-border rounded">
                <div className="min-w-0">
                  <span className="font-semibold text-text block truncate">Employment_Agreement.pdf</span>
                  <span className="text-[10px] text-text-muted">Contract • 150 KB</span>
                </div>
                <span className="text-lg cursor-pointer hover:opacity-80">📥</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-bg border border-border rounded">
                <div className="min-w-0">
                  <span className="font-semibold text-text block truncate">ID_Verification_Passport.pdf</span>
                  <span className="text-[10px] text-text-muted">Identification • 1.2 MB</span>
                </div>
                <span className="text-lg cursor-pointer hover:opacity-80">📥</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
