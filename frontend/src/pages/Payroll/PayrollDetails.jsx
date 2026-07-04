import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function PayrollDetails() {
  const { accessToken, user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State for employee view
  const [salaryStructure, setSalaryStructure] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // State for admin view
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedEmployeeSalary, setSelectedEmployeeSalary] = useState(null);
  const [formData, setFormData] = useState({
    basic: '',
    hra: '',
    allowances: '',
    deductions: '',
  });

  // Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  // Fetch data based on role
  useEffect(() => {
    if (!accessToken) return;

    if (isAdmin) {
      // Admin: Fetch employees
      fetchEmployees();
    } else {
      // Employee: Fetch self salary
      fetchMySalary();
    }
  }, [accessToken, isAdmin]);

  const fetchMySalary = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/payroll/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await response.json();
      if (response.ok) {
        setSalaryStructure(json.data);
      } else {
        throw new Error(json.error || 'Failed to fetch salary structure');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/payroll/employees', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await response.json();
      if (response.ok) {
        setEmployees(json.data);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  // Admin selects an employee
  const handleEmployeeChange = async (employeeId) => {
    setSelectedEmployeeId(employeeId);
    setSelectedEmployeeSalary(null);
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!employeeId) {
      setFormData({ basic: '', hra: '', allowances: '', deductions: '' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/payroll/${employeeId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await response.json();
      if (response.ok) {
        setSelectedEmployeeSalary(json.data);
        if (json.data) {
          setFormData({
            basic: parseFloat(json.data.basic).toString(),
            hra: parseFloat(json.data.hra).toString(),
            allowances: parseFloat(json.data.allowances).toString(),
            deductions: parseFloat(json.data.deductions).toString(),
          });
        } else {
          // Reset form if no salary set yet
          setFormData({ basic: '0', hra: '0', allowances: '0', deductions: '0' });
        }
      }
    } catch (err) {
      console.error('Error fetching employee salary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Compute Net salary dynamically
  const calculateNetSalary = () => {
    const basic = parseFloat(formData.basic) || 0;
    const hra = parseFloat(formData.hra) || 0;
    const allowances = parseFloat(formData.allowances) || 0;
    const deductions = parseFloat(formData.deductions) || 0;
    return basic + hra + allowances - deductions;
  };

  const handleUpdateClick = (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Basic numeric validation
    const basic = parseFloat(formData.basic);
    const hra = parseFloat(formData.hra);
    const allowances = parseFloat(formData.allowances);
    const deductions = parseFloat(formData.deductions);

    if (isNaN(basic) || isNaN(hra) || isNaN(allowances) || isNaN(deductions)) {
      setErrorMsg('All salary fields must contain valid numbers.');
      return;
    }

    if (basic < 0 || hra < 0 || allowances < 0 || deductions < 0) {
      setErrorMsg('Salary components cannot be negative.');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const response = await fetch(`/api/payroll/${selectedEmployeeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          basic: formData.basic,
          hra: formData.hra,
          allowances: formData.allowances,
          deductions: formData.deductions,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Failed to update salary structure');
      }

      setSuccessMsg('Salary structure updated successfully. A new historical record has been added.');
      setSelectedEmployeeSalary(json.data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Render Employee read-only card helper
  const renderSalaryCard = (structure, title = 'Your Salary Details') => {
    if (!structure) {
      return (
        <div className="bg-white rounded-2xl shadow-md border border-[var(--color-border)] p-8 text-center text-slate-500">
          <span className="text-4xl">💰</span>
          <h3 className="text-lg font-bold text-slate-700 mt-4">No Salary Structure Configured</h3>
          <p className="text-xs text-slate-400 mt-2">Please contact your HR administrator to set up your salary details.</p>
        </div>
      );
    }

    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    });

    return (
      <div className="bg-white rounded-2xl shadow-lg border border-[var(--color-border)] overflow-hidden transition-all duration-300 hover:shadow-xl">
        <div className="bg-gradient-to-r from-[var(--color-primary)] to-blue-700 p-6 text-white">
          <span className="text-xs uppercase font-extrabold tracking-wider opacity-75">{title}</span>
          <h3 className="text-3xl font-black mt-2">{formatter.format(structure.net_salary)}</h3>
          <p className="text-xs opacity-75 mt-1 font-semibold">Net monthly payout • Effective from: {new Date(structure.effective_from).toLocaleDateString()}</p>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Basic Salary</span>
              <span className="text-base font-bold text-slate-700">{formatter.format(structure.basic)}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">House Rent Allowance (HRA)</span>
              <span className="text-base font-bold text-slate-700">{formatter.format(structure.hra)}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Other Allowances</span>
              <span className="text-base font-bold text-slate-700">{formatter.format(structure.allowances)}</span>
            </div>
            <div className="p-4 bg-red-50/50 rounded-xl border border-red-100/50">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">Total Deductions</span>
              <span className="text-base font-bold text-red-600">-{formatter.format(structure.deductions)}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-semibold text-slate-400">
            <span>Historical salary row: {structure.id}</span>
            <span className="text-[var(--color-primary)] font-bold">Read-Only Secure Payout Card</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Employee View */}
      {!isAdmin && (
        <div className="max-w-2xl mx-auto">
          {loading ? (
            <div className="animate-pulse bg-white rounded-2xl h-80 border shadow-md"></div>
          ) : (
            renderSalaryCard(salaryStructure)
          )}
        </div>
      )}

      {/* Admin View */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Editor Form */}
          <div className="bg-white rounded-2xl shadow-lg border border-[var(--color-border)] p-6 transition-shadow duration-300 hover:shadow-xl">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-800">Configure Salary Structure</h2>
              <p className="text-xs text-slate-400 mt-1">Updates create new historical records automatically</p>
            </div>

            {errorMsg && (
              <div className="mb-6 p-4 rounded-xl bg-[var(--color-error-light)] text-[var(--color-error)] text-xs font-semibold flex items-center gap-2 border border-red-200">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-6 p-4 rounded-xl bg-[var(--color-success-light)] text-[var(--color-success)] text-xs font-semibold flex items-center gap-2 border border-emerald-200">
                <span>✅</span>
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdateClick} className="space-y-5">
              <div>
                <label htmlFor="employeeSelect" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Select Employee
                </label>
                <select
                  id="employeeSelect"
                  value={selectedEmployeeId}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-[var(--color-primary)] outline-none bg-slate-50 font-semibold text-slate-700"
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employee_id}) — {emp.department || 'No Dept'}
                    </option>
                  ))}
                </select>
              </div>

              {selectedEmployeeId && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="basicInput" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Basic (INR)</label>
                      <input
                        id="basicInput"
                        type="number"
                        name="basic"
                        value={formData.basic}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-[var(--color-primary)] outline-none font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="hraInput" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">HRA (INR)</label>
                      <input
                        id="hraInput"
                        type="number"
                        name="hra"
                        value={formData.hra}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-[var(--color-primary)] outline-none font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="allowancesInput" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Allowances (INR)</label>
                      <input
                        id="allowancesInput"
                        type="number"
                        name="allowances"
                        value={formData.allowances}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-[var(--color-primary)] outline-none font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="deductionsInput" className="block text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Deductions (INR)</label>
                      <input
                        id="deductionsInput"
                        type="number"
                        name="deductions"
                        value={formData.deductions}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-red-200 p-3 text-sm focus:border-[var(--color-primary)] outline-none font-bold text-red-600 bg-red-50/20"
                        required
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">Projected Net Salary:</span>
                    <span className="text-xl font-black text-slate-800">
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(calculateNetSalary())}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md text-sm mt-4"
                  >
                    {submitting ? 'Saving salary record...' : 'Update Salary Structure'}
                  </button>
                </>
              )}
            </form>
          </div>

          {/* Current Selection Details (Preview) */}
          <div>
            {loading ? (
              <div className="animate-pulse bg-white border rounded-2xl h-80"></div>
            ) : selectedEmployeeId ? (
              renderSalaryCard(selectedEmployeeSalary, 'Current Active Salary Structure')
            ) : (
              <div className="h-full bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-400 min-h-[300px]">
                <span className="text-4xl mb-3">👤</span>
                <span className="text-sm font-bold text-slate-700">Select an Employee</span>
                <span className="text-xs text-slate-400 mt-1 max-w-[250px]">
                  Choose an employee from the dropdown list to view or update their active compensation profile.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 transform transition-all scale-100">
            <h3 className="text-lg font-bold text-slate-800">Confirm Historical Salary Update</h3>
            <p className="text-xs text-slate-500 mt-2">
              You are inserting a **NEW** salary structure row for this user. The previous record will be preserved for history and audit logging.
            </p>
            
            <div className="my-4 p-4 bg-slate-50 rounded-xl space-y-2 border border-slate-100 text-xs">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-400">Basic:</span>
                <span className="text-slate-700">{formData.basic} INR</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-400">HRA:</span>
                <span className="text-slate-700">{formData.hra} INR</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-400">Allowances:</span>
                <span className="text-slate-700">{formData.allowances} INR</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-red-400">Deductions:</span>
                <span className="text-red-600">-{formData.deductions} INR</span>
              </div>
              <div className="flex justify-between font-black text-sm border-t pt-2 mt-2">
                <span className="text-slate-500">Net Salary:</span>
                <span className="text-slate-800">{calculateNetSalary()} INR</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-500 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold rounded-xl text-xs shadow-md transition-all"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
