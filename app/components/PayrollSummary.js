"use client";

import { useState } from 'react';
import { saveAs } from "file-saver";
import { notifySuccess, toastError, modalAlert } from '../../lib/swal';
import usePagination from './usePagination';

export default function PayrollSummary({ users = [], payrollRecords = [], userRole, onRefresh, onDownloadPayslip }) {
  const safeUsers = users || [];
  const safeRecords = payrollRecords || [];
  const { page, setPage, pageSize, setPageSize, totalPages, pageRecords, reset } = usePagination(safeRecords, 10);

  // Totals for the current page
  const pageTotalHours = pageRecords.reduce((s, r) => s + (parseFloat(r.total_hours) || 0), 0);
  const pageTotalPay = pageRecords.reduce((s, r) => s + (parseFloat(r.total_pay) || 0), 0);

  const totalHours = safeRecords.reduce((sum, record) => sum + (parseFloat(record.total_hours) || 0), 0);
  const totalPay = safeRecords.reduce((sum, record) => sum + (parseFloat(record.total_pay) || 0), 0);

  const handlePause = async (userId, pause) => {
    if (!["admin", "manager"].includes(userRole)) {
  modalAlert('Unauthorized', 'Only admins or managers can modify status', 'error');
      return;
    }

    try {
      const res = await fetch("/api/users/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, pause, requesterRole: userRole }),
      });
      const data = await res.json();
        if (res.ok) {
  await onRefresh();
  notifySuccess('updated', 'Updated', `User ${pause ? "paused" : "resumed"} successfully`);
      } else {
        modalAlert('Update Failed', `Failed to update: ${data.error}`, 'error');
      }
    } catch (error) {
      modalAlert('Error', `Error: ${error.message}`, 'error');
    }
  };

  const generatePayslip = (record) => {
    try {
      if (typeof onDownloadPayslip === 'function') {
        // Delegate to parent (may generate PDF)
        return onDownloadPayslip(record, { periodStart: record.period_start, periodEnd: record.period_end });
      }

      const totalPay = parseFloat(record.total_pay || 0) || 0;
      const sssEmployee = parseFloat(record.sss_employee || 0) || 0;
      const sssEmployer = parseFloat(record.sss_employer || 0) || 0;
      const lateDeduction = parseFloat(record.late_deduction || 0) || 0;
      const netPay = Math.max(0, totalPay - sssEmployee - lateDeduction);

      const toDDMMYYYY = (s) => {
        const d = new Date(s);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      };
      const netPayNum = Math.max(
        0,
        (parseFloat(record.total_pay || 0) || 0) -
          (Math.abs(parseFloat(record.sss_employee || 0) || 0) +
            Math.abs(parseFloat(record.late_deduction || 0) || 0))
      );
      const lines = [
        `Payslip for ${record.user_name || 'Unknown'}`,
        `Week: ${toDDMMYYYY(record.period_start)} - ${toDDMMYYYY(record.period_end)}`,
        `Role: ${record.user_role || 'N/A'}`,
        `Hours Worked: ${parseFloat(record.total_hours || 0).toFixed(2)}`,
        `Hourly Rate: ₱${parseFloat(record.hourly_rate || 0).toFixed(2)}`,
        ``,
        `Deductions:`,
        `  SSS (Employee): ₱${Math.abs(parseFloat(record.sss_employee || 0) || 0).toFixed(2)}`,
        `  Late Deduction: ₱${Math.abs(parseFloat(record.late_deduction || 0) || 0).toFixed(2)}`,
        `  SSS (Employer): ₱${Math.abs(parseFloat(record.sss_employer || 0) || 0).toFixed(2)} (employer share, not deducted)`,
        ``,
        `Total Pay: ₱${(parseFloat(record.total_pay || 0) || 0).toFixed(2)}`,
        `Net Pay: ₱${netPayNum.toFixed(2)}`,
      ];

      const blob = new Blob([lines.join('\n')], { type: "text/plain;charset=utf-8" });
      saveAs(blob, `payslip_${record.user_name || 'employee'}_${record.period_start}.txt`);
      } catch (error) {
      console.error("Error generating payslip:", error);
      modalAlert('Generate failed', 'Failed to generate payslip. Please try again.', 'error');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Weekly Payroll Summary</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h3 className="text-sm font-medium text-blue-800">Employees</h3>
          <p className="text-2xl font-bold text-blue-900">{safeUsers.length}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h3 className="text-sm font-medium text-blue-800">Total Weekly Hours</h3>
          <p className="text-2xl font-bold text-blue-900">{totalHours.toFixed(2)}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <h3 className="text-sm font-medium text-purple-800">Total Weekly Pay</h3>
          <p className="text-2xl font-bold text-purple-900">₱{totalPay.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className={`px-3 py-1 rounded-md border ${page === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50'}`}
          >
            Prev
          </button>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className={`px-3 py-1 rounded-md border ${page === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50'}`}
          >
            Next
          </button>
          <div className="text-sm text-gray-600">Page {page} of {totalPages}</div>
        </div>

        <div className="text-sm text-gray-600">
          Showing {pageRecords.length} of {safeRecords.length} records · Page totals: {pageTotalHours.toFixed(2)} hrs · ₱{pageTotalPay.toFixed(2)}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Week</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pay</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Control</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pageRecords.map((record) => (
              <tr key={record.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-medium">
                        {record.user_name ? record.user_name.charAt(0).toUpperCase() : "U"}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{record.user_name || "Unknown"}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.user_role || "N/A"}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(record.period_start).toLocaleDateString()} - {new Date(record.period_end).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {parseFloat(record.total_hours || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ₱{parseFloat(record.hourly_rate || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  ₱{parseFloat(record.total_pay || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => generatePayslip(record)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Download Payslip
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.status || "N/A"}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handlePause(record.user_id, record.status !== "Paused")}
                    disabled={!["admin", "manager"].includes(userRole)}
                    className={`text-white px-3 py-1 rounded transition-colors ${
                      ["admin", "manager"].includes(userRole)
                        ? record.status === "Paused"
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-red-600 hover:bg-red-700"
                        : "bg-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {record.status === "Paused" ? "Resume" : "Pause"}
                  </button>
                </td>
              </tr>
            ))}

            {safeRecords.length === 0 && (
              <tr>
                <td colSpan="9" className="px-6 py-4 text-center text-sm text-gray-500">
                  No payroll records found for the selected week.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
