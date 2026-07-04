import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LeaveApprovalCard from './LeaveApprovalCard.jsx';
import AdminAttendanceView from '../Attendance/AdminAttendanceView.jsx';

export default function AdminDashboard() {
  const { accessToken } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  // URL tab selection
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'dashboard';
  });

  // Watch URL changes for tab
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveTab(params.get('tab') || 'dashboard');
    };
    window.addEventListener('popstate', handleUrlChange);
    // Poll window.location.search periodically to handle NavLink changes
    const interval = setInterval(handleUrlChange, 200);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      clearInterval(interval);
    };
  }, []);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leave-requests', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch leave requests');
      setLeaveRequests(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, [accessToken]);

  // Extract unique employees from leave request users + default mock list for hackathon robustness
  const getUniqueEmployees = () => {
    const employeesMap = new Map();

    // Seed defaults just in case DB is empty
    const defaults = [
      { id: '1', name: 'Riya Sharma', employee_id: 'EMP001', department: 'Engineering', job_title: 'Software Engineer', email: 'riya@hrpulse.dev' },
      { id: '2', name: 'Aarav Mehta', employee_id: 'EMP002', department: 'Marketing', job_title: 'Marketing Specialist', email: 'aarav@hrpulse.dev' },
      { id: '3', name: 'Kabir Dev', employee_id: 'EMP003', department: 'HR', job_title: 'HR Generalist', email: 'kabir@hrpulse.dev' },
      { id: '4', name: 'Aditi Rao', employee_id: 'EMP004', department: 'Finance', job_title: 'Financial Analyst', email: 'aditi@hrpulse.dev' },
    ];

    defaults.forEach(emp => employeesMap.set(emp.employee_id, emp));

    // Override or add from backend data
    leaveRequests.forEach(req => {
      if (req.user) {
        employeesMap.set(req.user.employee_id, {
          id: req.user.id,
          name: req.user.name,
          employee_id: req.user.employee_id,
          department: req.user.department,
          job_title: req.user.job_title,
          profile_picture_url: req.user.profile_picture_url,
          email: req.user.email || `${req.user.name.toLowerCase().replace(/\s+/g, '')}@hrpulse.dev`,
        });
      }
    });

    return Array.from(employeesMap.values());
  };

  const employees = getUniqueEmployees();

  // Search and filter logic
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.job_title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === 'all' || emp.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const departments = ['all', ...new Set(employees.map(emp => emp.department).filter(Boolean))];

  const pendingLeaves = leaveRequests.filter(req => req.status === 'pending');

  const handleDecisionComplete = () => {
    fetchLeaveRequests(); // reload feed
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-sans text-text">Admin Command Center</h1>
        <p className="text-sm text-text-muted mt-1">
          Manage employee accounts, track attendance, and process leave requests.
        </p>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface border border-border p-5 rounded-lg shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-text-muted font-medium uppercase tracking-wider block">Total Employees</span>
                <span className="text-2xl font-bold text-text mt-1 block">{employees.length}</span>
              </div>
              <span className="text-2xl bg-primary-light text-primary p-3 rounded-lg">👥</span>
            </div>

            <div className="bg-surface border border-border p-5 rounded-lg shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-text-muted font-medium uppercase tracking-wider block">Pending Approvals</span>
                <span className="text-2xl font-bold text-text mt-1 block">{pendingLeaves.length}</span>
              </div>
              <span className="text-2xl bg-warning-light text-warning p-3 rounded-lg">✉️</span>
            </div>

            {/* Attendance Summary Widget (Placeholder design tokens usage) */}
            <div className="bg-surface border border-border p-5 rounded-lg shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-text-muted font-medium uppercase tracking-wider block">Today's Attendance</span>
                <span className="text-2xl font-bold text-text mt-1 block">94% Present</span>
                <span className="text-[10px] text-success font-semibold mt-1 block">43 checked in</span>
              </div>
              <span className="text-2xl bg-success-light text-success p-3 rounded-lg">📅</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Pending Leaves Widget */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-surface border border-border rounded-lg shadow-sm">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <h2 className="text-base font-semibold text-text font-sans">Pending Leave Approvals</h2>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-warning-light text-warning rounded-full">
                    {pendingLeaves.length} requests
                  </span>
                </div>
                <div className="p-4 space-y-4 divide-y divide-border max-h-[500px] overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-8 text-sm text-text-muted">Loading leave requests...</div>
                  ) : pendingLeaves.length === 0 ? (
                    <div className="text-center py-8 text-sm text-text-muted">No pending leave requests.</div>
                  ) : (
                    pendingLeaves.map((req, idx) => (
                      <div key={req.id} className={idx > 0 ? 'pt-4' : ''}>
                        <LeaveApprovalCard
                          request={req}
                          allRequests={leaveRequests}
                          onDecisionComplete={handleDecisionComplete}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right: Department distribution list */}
            <div className="space-y-4">
              <div className="bg-surface border border-border rounded-lg shadow-sm p-5">
                <h2 className="text-base font-semibold text-text font-sans border-b border-border pb-3">Department Headcount</h2>
                <div className="mt-4 space-y-3">
                  {departments.filter(d => d !== 'all').map(dept => {
                    const count = employees.filter(e => e.department === dept).length;
                    const percent = Math.round((count / employees.length) * 100);
                    return (
                      <div key={dept} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-text capitalize">{dept}</span>
                          <span className="text-text-muted">{count} ({percent}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee List Tab */}
      {activeTab === 'employees' && (
        <div className="bg-surface border border-border rounded-lg shadow-sm">
          <div className="p-5 border-b border-border space-y-4">
            <h2 className="text-base font-semibold text-text font-sans">Employee Directory</h2>
            
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by name, ID or title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-border rounded-md text-sm bg-bg text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <span className="absolute left-3 top-2.5 text-sm text-text-muted">🔍</span>
              </div>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-md text-sm bg-bg text-text focus:outline-none focus:border-primary capitalize"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept === 'all' ? 'All Departments' : dept}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-bg border-b border-border text-text-muted font-medium text-xs uppercase tracking-wider">
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Department</th>
                  <th className="px-6 py-3">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-text-muted">
                      No employees match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map(emp => (
                    <tr key={emp.employee_id} className="hover:bg-bg/20 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-light text-primary font-bold flex items-center justify-center text-xs overflow-hidden">
                          {emp.profile_picture_url ? (
                            <img src={emp.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            emp.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-text block">{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-text font-mono text-xs">{emp.employee_id}</td>
                      <td className="px-6 py-4 text-text">{emp.job_title || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 text-xs font-medium bg-primary-light text-primary rounded-full capitalize">
                          {emp.department || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-text-muted">{emp.email}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance Records tab */}
      {activeTab === 'attendance' && (
        <AdminAttendanceView />
      )}

      {/* Leave Approvals Tab */}
      {activeTab === 'leaves' && (
        <div className="bg-surface border border-border rounded-lg shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-base font-semibold text-text font-sans font-medium">Pending Approvals Feed</h2>
            <span className="text-xs text-text-muted">{pendingLeaves.length} active applications</span>
          </div>
          <div className="p-5 space-y-4 divide-y divide-border">
            {pendingLeaves.length === 0 ? (
              <div className="text-center py-12 text-sm text-text-muted">No pending leave requests.</div>
            ) : (
              pendingLeaves.map((req, idx) => (
                <div key={req.id} className={idx > 0 ? 'pt-4' : ''}>
                  <LeaveApprovalCard
                    request={req}
                    allRequests={leaveRequests}
                    onDecisionComplete={handleDecisionComplete}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
