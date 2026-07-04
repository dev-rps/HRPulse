import React from 'react';
import LeaveApply from './LeaveApply/LeaveApply';
import AttendanceCalendar from './LeaveApply/AttendanceCalendar';

export default function LeaveApplication() {
  return (
    <div className="p-6 space-y-8 bg-[var(--color-bg)] min-h-screen">
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Time Off & Attendance</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Manage your leave applications, track balances, and monitor attendance records.
          </p>
        </div>
      </div>
      
      <LeaveApply />
      
      <div className="mt-8">
        <AttendanceCalendar />
      </div>
    </div>
  );
}
