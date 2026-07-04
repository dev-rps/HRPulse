import React from 'react';
import PayrollDetails from './Payroll/PayrollDetails';

export default function Payroll() {
  return (
    <div className="p-6 space-y-8 bg-[var(--color-bg)] min-h-screen">
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Payroll & Compensation</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Access secure pay structures, view salary breakdowns, and manage contract details.
          </p>
        </div>
      </div>
      
      <PayrollDetails />
    </div>
  );
}
