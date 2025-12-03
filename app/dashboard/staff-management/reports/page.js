"use client";

import { DocumentTextIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState, useRef } from "react";

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [periodStart, setPeriodStart] = useState(today);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const printRef = useRef(null);

  // Utility to generate unique IDs for notifications
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Add notification with type (success/error) and timeout
  const addNotification = (message, type = "error", timeout = 5000) => {
    const id = generateId();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, timeout);
  };

  // Validate date inputs
  const validateDates = () => {
    if (!periodStart || !periodEnd) {
      addNotification("Please select both start and end dates");
      return false;
    }
    if (new Date(periodStart) > new Date(periodEnd)) {
      addNotification("Period start date cannot be after end date");
      return false;
    }
    if (new Date(periodEnd) > new Date(today)) {
      addNotification("Period end date cannot be in the future");
      return false;
    }
    return true;
  };

  const loadReport = async () => {
    if (!validateDates()) return;

    setLoading(true);
    setReport(null);
    try {
      const res = await fetch(
        `/api/reports/weekly-wages?periodStart=${encodeURIComponent(
          periodStart
        )}&periodEnd=${encodeURIComponent(periodEnd)}`
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `HTTP error: ${res.statusText}`);
      }
      const data = await res.json();
      setReport(data);
      addNotification("Report loaded successfully", "success");
    } catch (err) {
      console.error("Load report error:", err);
      addNotification(`Failed to load report: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    if (!validateDates()) return;

    try {
      const url = `/api/reports/weekly-wages?periodStart=${encodeURIComponent(
        periodStart
      )}&periodEnd=${encodeURIComponent(periodEnd)}&format=csv`;
      window.open(url, "_blank");
      addNotification("CSV download initiated", "success", 3000);
    } catch (err) {
      console.error("Download CSV error:", err);
      addNotification(`Failed to initiate CSV download: ${err.message || "Unknown error"}`);
    }
  };

  const handlePrint = () => {
    if (!validateDates()) return;
    if (!printRef.current || !report) {
      addNotification("No report available to print");
      return;
    }

    try {
      const printContents = printRef.current.innerHTML;
      const printWindow = window.open("", "", "width=800,height=600");
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Report</title>
            <style>
              @page { size: A4; margin: 15mm; }
              body { 
                font-family: Arial, sans-serif; 
                padding: 20px; 
                width: 210mm;
                min-height: 297mm;
              }
              h1, h2, h3, h4, h5, h6 { color: #16a34a; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; }
              th { background: #f9f9f9; }
            </style>
          </head>
          <body>
            ${printContents}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      addNotification("Report printed successfully", "success", 3000);
    } catch (err) {
      console.error("Print error:", err);
      addNotification(`Failed to print report: ${err.message || "Unknown error"}`);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <DocumentTextIcon className="h-6 w-6 text-blue-600" />
          Weekly Wages Report
        </h1>
        <p className="mt-1 text-sm text-gray-600">Attendance-based weekly wage summary (hours × rate). Use the controls below to generate, download or print the report for a selected period.</p>
      </div>
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`mb-4 p-4 rounded-lg flex justify-between items-center text-sm transition-opacity duration-300 ${
            notification.type === "success"
              ? "bg-blue-100 text-blue-800"
              : "bg-red-100 text-red-800"
          }`}
          role="alert"
        >
          <span>{notification.message}</span>
          <button
            onClick={() =>
              setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
            }
            className={`font-bold ${
              notification.type === "success" ? "text-blue-800" : "text-red-800"
            }`}
            aria-label="Close notification"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ))}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="w-full sm:w-auto">
            <label className="block text-sm text-gray-600 mb-1">Period Start</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="text-black w-full border px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              max={today}
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-sm text-gray-600 mb-1">Period End</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="text-black w-full border px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              max={today}
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={loadReport}
              disabled={loading}
              className={`px-4 py-2 rounded text-sm ${
                loading
                  ? "bg-blue-400 text-white cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {loading ? "Loading..." : "Load Report"}
            </button>
            <button
              onClick={downloadCsv}
              disabled={loading}
              className={`px-4 py-2 rounded text-sm ${
                loading
                  ? "bg-blue-400 text-white cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              Download CSV
            </button>
            <button
              onClick={handlePrint}
              disabled={loading}
              className={`px-4 py-2 rounded text-sm ${
                loading
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-gray-600 text-white hover:bg-gray-700"
              }`}
            >
              Print
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-3">
          Generate weekly wage reports: totals are computed from attendance
          (hours_worked × hourly_rate). SSS deduction is monthly salary divided by 4.
          Night differential is ₱35 per duty day. Late deduction is ₱1 per minute beyond 10 minutes.
        </p>
      </div>

      <div ref={printRef}>
        {!report ? (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">No Weekly Wages report generated yet</h3>
                <p className="mt-1 text-sm text-gray-500">Generate the Weekly Wages report (attendance-based payroll summary) to view it here. Use the period controls above to select a week.</p>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
            <h2 className="text-lg font-semibold mb-4 text-blue-700">
              Weekly Wages: {report.periodStart} → {report.periodEnd}
            </h2>

            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Hourly Rate</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Holiday Rate</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Night Diff</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Pay</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Late Deduction</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">SSS (Employee)</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">SSS (Employer)</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Net Pay</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Signature</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {report.rows.map((r) => {
                  // Use holiday fields provided by the API when available
                  const holidayPay = Number(r.holiday_pay || 0);
                  const holidayRate = Number(r.holiday_rate || 0);
                  const holidayHours = Number(r.holiday_hours || 0);
                  const nightDiff = 35 * (r.duty_days || 0); // ₱35 per duty day
                  const lateDeduction = Math.max(0, (r.minutes_late || 0) - 10) * 1; // ₱1/min beyond 10
                  const grossPay = Number(r.total_pay) + holidayPay + nightDiff;
                  const netPay = grossPay - lateDeduction - (r.sss_employee || 0);

                  return (
                    <tr key={r.user_id}>
                      <td className="px-4 py-2 text-sm text-black">{r.name}</td>
                      <td className="px-4 py-2 text-sm text-black">{r.role}</td>
                      <td className="px-4 py-2 text-sm text-right text-black">
                        {Number(r.total_hours).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-black">
                        ₱{Number(r.hourly_rate).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-black">
                        ₱{holidayRate.toFixed(2)}
                        {holidayHours > 0 && (
                          <div className="text-xs text-gray-500">{holidayHours.toFixed(2)} hrs</div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-black">
                        ₱{nightDiff.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-black">
                        ₱{grossPay.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-red-500">
                        -₱{lateDeduction.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-red-500">
                        -₱{Number(r.sss_employee || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-black">
                        ₱{Number(r.sss_employer || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-medium text-black">
                        ₱{netPay.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm text-center text-gray-400">________</td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                {(() => {
                  const totals = report.rows.reduce(
                    (acc, r) => {
                      const holidayPay = Number(r.holiday_pay || 0);
                      const nightDiff = 35 * (r.duty_days || 0);
                      const lateDeduction = Math.max(0, (r.minutes_late || 0) - 10) * 1;
                      const grossPay = Number(r.total_pay) + holidayPay + nightDiff;
                      const netPay = grossPay - lateDeduction - (r.sss_employee || 0);

                      acc.totalHours += Number(r.total_hours);
                      acc.totalHourlyRate += Number(r.hourly_rate);
                      acc.totalHolidayPay += holidayPay;
                      acc.totalNightDiff += nightDiff;
                      acc.grossPay += grossPay;
                      acc.lateDeduction += lateDeduction;
                      acc.sssEmployee += Number(r.sss_employee || 0);
                      acc.netPay += netPay;
                      acc.employerSSS += Number(r.sss_employer || 0);
                      return acc;
                    },
                    {
                      totalHours: 0,
                      totalHourlyRate: 0,
                      totalHolidayPay: 0,
                      totalNightDiff: 0,
                      grossPay: 0,
                      lateDeduction: 0,
                      sssEmployee: 0,
                      netPay: 0,
                      employerSSS: 0,
                    }
                  );

                  const totalDeductions = totals.lateDeduction + totals.sssEmployee;
                  const finalNetPay = totals.grossPay - totalDeductions;
                  const grandTotal = finalNetPay + totals.employerSSS;

                  return (
                    <>
                      <tr className="bg-gray-100 font-bold">
                        <td colSpan={6} className="px-4 py-2 text-sm text-gray-900 text-right">
                          Net Pay (Before Deductions):
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-blue-700">
                          ₱{totals.grossPay.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-red-500">
                          -₱{totals.lateDeduction.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-red-500">
                          -₱{totals.sssEmployee.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-black">
                          ₱{totals.employerSSS.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-blue-700">
                          ₱{finalNetPay.toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                      <tr className="bg-gray-200 font-bold">
                        <td colSpan={10} className="px-4 py-2 text-sm text-right text-gray-800">
                          Grand Total (Net Pay + Employer SSS):
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-blue-800">
                          ₱{grandTotal.toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </>
                  );
                })()}
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
