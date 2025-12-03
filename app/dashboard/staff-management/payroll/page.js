"use client";

import { useEffect, useState } from "react";
import { ArrowDownTrayIcon, PlusIcon } from "@heroicons/react/24/outline";
import { toastSuccess, modalAlert } from '../../../../lib/swal';
import PayrollSummary from "../../../components/PayrollSummary";
import jsPDF from "jspdf";

export default function PayrollPage() {
  const [users, setUsers] = useState([]);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [periodStart, setPeriodStart] = useState(getFirstDayOfWeek());
  const [periodEnd, setPeriodEnd] = useState(getLastDayOfWeek());
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentWeek());
  // Compute an initial human-friendly label like "October - 1st Week"
  const [periodLabel, setPeriodLabel] = useState(() => {
    try {
      const p = getCurrentWeek();
      const match = p.match(/^(\d{4})-(\d{2})-week-(\d+)$/);
      if (!match) return '';
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const week = parseInt(match[3], 10);
      const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
      return `${monthName} - ${ordinal(week)} Week`;
    } catch (e) {
      return '';
    }
  });
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState("admin"); // Mock role (replace with auth)
  const [isLoading, setIsLoading] = useState(false);

  function getWeekNumber(date) {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    const dayOfWeek = firstDayOfMonth.getDay();
    const firstMondayOffset = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const weekNumber = Math.ceil((dayOfMonth - firstMondayOffset + 7) / 7);
    return Math.max(1, Math.min(weekNumber, 5));
  }

  function getFirstDayOfWeek(weekNumber = getWeekNumber(new Date()), year = new Date().getFullYear(), month = new Date().getMonth()) {
    const parsedWeek = parseInt(weekNumber, 10);
    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);

    if (isNaN(parsedWeek) || isNaN(parsedYear) || isNaN(parsedMonth) || parsedWeek < 1 || parsedWeek > 5) {
      console.warn(`Invalid inputs: weekNumber=${weekNumber}, year=${year}, month=${month}. Using default date.`);
      return new Date(parsedYear, parsedMonth, 1).toISOString().split("T")[0];
    }

    const firstDayOfMonth = new Date(parsedYear, parsedMonth, 1);
    const dayOfWeek = firstDayOfMonth.getDay();
    const firstMondayOffset = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const startDay = firstMondayOffset + (parsedWeek - 1) * 7;

    const startDate = new Date(parsedYear, parsedMonth, startDay);
    if (isNaN(startDate.getTime()) || startDate.getMonth() !== parsedMonth) {
      console.warn(`Invalid start date for week ${weekNumber}, year ${year}, month ${month}. Using first day of month.`);
      return new Date(parsedYear, parsedMonth, 1).toISOString().split("T")[0];
    }

    return startDate.toISOString().split("T")[0];
  }

  function getLastDayOfWeek(weekNumber = getWeekNumber(new Date()), year = new Date().getFullYear(), month = new Date().getMonth()) {
    const parsedWeek = parseInt(weekNumber, 10);
    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);

    if (isNaN(parsedWeek) || isNaN(parsedYear) || isNaN(parsedMonth) || parsedWeek < 1 || parsedWeek > 5) {
      console.warn(`Invalid inputs: weekNumber=${weekNumber}, year=${year}, month=${month}. Using default date.`);
      return new Date(parsedYear, parsedMonth + 1, 0).toISOString().split("T")[0];
    }

    const startDate = new Date(getFirstDayOfWeek(parsedWeek, parsedYear, parsedMonth));
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    if (isNaN(endDate.getTime()) || endDate.getMonth() !== parsedMonth) {
      console.warn(`Invalid end date for week ${weekNumber}, year ${year}, month ${month}. Using last day of month.`);
      return new Date(parsedYear, parsedMonth + 1, 0).toISOString().split("T")[0];
    }

    return endDate.toISOString().split("T")[0];
  }

  function getCurrentWeek() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const week = getWeekNumber(date);
    return `${year}-${month}-week-${week}`;
  }

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/users");
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(body.error || body.details || "Failed to fetch users");
        }
        const data = await res.json();
        console.log("Fetched users:", data);
        if (data.length === 0) {
          setError("No users found. Please add users to process payroll.");
        }
        setUsers(data);
      } catch (error) {
        console.error("Failed to fetch users:", {
          message: error.message,
          stack: error.stack,
        });
        setError(error.message || "Failed to fetch users. Check server logs or contact support.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const refreshPayroll = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!periodStart || !periodEnd || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
        throw new Error("Invalid periodStart or periodEnd format. Expected YYYY-MM-DD");
      }
      const res = await fetch(
        `/api/payroll/records?periodStart=${encodeURIComponent(periodStart)}&periodEnd=${encodeURIComponent(periodEnd)}`
      );
      const data = await res.json();
      console.log("Payroll API response:", data);
      if (!res.ok) {
        throw new Error(data.error || data.details || `HTTP ${res.status}`);
      }
      setPayrollRecords(data);
    } catch (error) {
      console.error("Failed to fetch payroll records:", error);
      setError(error.message || "Failed to fetch payroll records. Please try again or contact support.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (periodStart && periodEnd) {
      refreshPayroll();
    }
  }, [periodStart, periodEnd]);

  const handlePayrollProcessing = async () => {
    if (!["admin", "manager"].includes(userRole)) {
      setError("Unauthorized: Only admins or managers can process payroll");
      return;
    }

    if (users.length === 0) {
      setError("No users available to process payroll. Please add users first.");
      return;
    }

    setError(null);
    setIsLoading(true);
    let errors = [];
    let successes = 0;

    for (const user of users) {
      try {
        const res = await fetch("/api/payroll/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            periodStart,
            periodEnd,
            requesterRole: userRole,
          }),
        });

        const data = await res.json();
        console.log(`Payroll for ${user.name}:`, { status: res.status, data });
        if (res.ok) {
          successes++;
        } else {
          errors.push(`⚠️ Failed for ${user.name}: ${data.error || data.details || 'Unknown error'}`);
        }
      } catch (err) {
        errors.push(`❌ Error processing payroll for ${user.name}: ${err.message}`);
      }
    }

    await refreshPayroll();

    if (errors.length > 0) {
      setError(
        `Payroll processing completed with ${successes} successes and ${errors.length} errors:\n${errors.join("\n")}`
      );
    } else {
      // Success notification intentionally suppressed because payroll completion
      // is an operational summary rather than a CRUD add/update/delete action.
      // If you prefer an explicit notification for payroll, change this to:
      // toastSuccess('Added', `Payroll processing completed for ${successes} users`);
    }
    setIsLoading(false);
  };

  const handleDownloadPayslip = (record) => {
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const employee = record.user_name || 'Unknown';
      const startRaw = record.period_start || periodStart;
      const endRaw = record.period_end || periodEnd;
      const formatDDMMYYYY = (s) => {
        const d = new Date(s);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      };
      const start = formatDDMMYYYY(startRaw);
      const end = formatDDMMYYYY(endRaw);
      const hours = parseFloat(record.total_hours || record.hours || 0) || 0;
      const rate = parseFloat(record.hourly_rate || record.rate || 0) || 0;
      const totalPay = parseFloat(record.total_pay || record.amount || hours * rate) || 0;
      const sssEmployee = Math.abs(parseFloat(record.sss_employee || 0) || 0);
      const sssEmployer = Math.abs(parseFloat(record.sss_employer || 0) || 0);
      const lateDeduction = Math.abs(parseFloat(record.late_deduction || 0) || 0);
      const netPay = Math.max(0, totalPay - sssEmployee - lateDeduction);

      // Use 'PHP' instead of the peso symbol to avoid PDF font glyph issues
      const currency = (n) => `PHP ${(Number(n) || 0).toFixed(2)}`;

      // Colors
      const blue = [5, 150, 105]; // Tailwind blue-600 equivalent
      const dark = [31, 41, 55];

      // Header band
      doc.setFillColor(blue[0], blue[1], blue[2]);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 90, 'F');

      // Brand title
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text("SRCB - Payslip", 40, 55);

      // Card container
      const cardX = 40;
      const cardY = 120;
      const cardW = doc.internal.pageSize.getWidth() - 80;
      const cardH = 560;
      doc.setDrawColor(229, 231, 235); // gray-200
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cardX, cardY, cardW, cardH, 8, 8, 'FD');

      // Section: Employee & Period
      doc.setTextColor(dark[0], dark[1], dark[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Employee Information', cardX + 20, cardY + 30);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.text(`Name: ${employee}`, cardX + 20, cardY + 55);
      doc.text(`Role: ${record.user_role || 'N/A'}`, cardX + 20, cardY + 75);
      doc.text(`Period: ${start} to ${end}`, cardX + 20, cardY + 95);

      // Divider
      doc.setDrawColor(229, 231, 235);
      doc.line(cardX + 20, cardY + 110, cardX + cardW - 20, cardY + 110);

      // Section: Earnings
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Earnings', cardX + 20, cardY + 140);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.text(`Hours Worked: ${hours.toFixed(2)} hrs`, cardX + 20, cardY + 165);
      doc.text(`Hourly Rate: ${currency(rate)}`, cardX + 20, cardY + 185);
      doc.text(`Gross Pay: ${currency(totalPay)}`, cardX + 20, cardY + 205);

      // Section: Deductions
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Deductions', cardX + 20, cardY + 245);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.text(`SSS (Employee): ${currency(sssEmployee)}`, cardX + 20, cardY + 270);
      doc.text(`Late Deduction: ${currency(lateDeduction)}`, cardX + 20, cardY + 290);
      doc.setTextColor(107, 114, 128); // gray-500 note
      doc.text(`SSS (Employer): ${currency(sssEmployer)} (employer share, not deducted)`, cardX + 20, cardY + 310);
      doc.setTextColor(dark[0], dark[1], dark[2]);

      // Divider
      doc.setDrawColor(229, 231, 235);
      doc.line(cardX + 20, cardY + 330, cardX + cardW - 20, cardY + 330);

      // Section: Net Pay Highlight
      doc.setFillColor(236, 253, 245); // green-50 background band
      doc.roundedRect(cardX + 20, cardY + 350, cardW - 40, 80, 6, 6, 'F');
      doc.setTextColor(blue[0], blue[1], blue[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Net Pay', cardX + 40, cardY + 400);
      doc.text(currency(netPay), cardX + cardW - 160, cardY + 400, { align: 'left' });

      // Footer note
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text('This is a system-generated payslip. For questions, contact HR.', cardX + 20, cardY + cardH - 20);

      doc.save(`payslip_${employee}_${startRaw}.pdf`);
    } catch (e) {
      console.error('Payslip generation error:', e);
    }
  };

  const parsePeriod = (period) => {
    const match = period.match(/^(\d{4})-(\d{2})-week-(\d+)$/);
    if (!match) {
      console.error("Invalid period format:", period);
      throw new Error("Invalid period format");
    }
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // JS months are 0-based
    const week = parseInt(match[3], 10);
    console.log("Parsed period:", { year, month, week });
    return { year, month, week };
  };

  const handlePeriodChange = (e) => {
    setError(null);
    setIsLoading(true);
    try {
      const period = e.target.value;
      console.log("Selected period:", period);
      if (!period) {
        setSelectedPeriod("");
        setPayrollRecords([]);
        setIsLoading(false);
        return;
      }

      const { year, month, week } = parsePeriod(period);
      const start = getFirstDayOfWeek(week, year, month);
      const end = getLastDayOfWeek(week, year, month);
      console.log("Calculated dates:", { start, end });

      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        throw new Error("Calculated dates are not in YYYY-MM-DD format");
      }

      setSelectedPeriod(period);
      setPeriodStart(start);
      setPeriodEnd(end);
      // update human-friendly label
      try {
        const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
        setPeriodLabel(`${monthName} - ${ordinal(week)} Week`);
      } catch (e) {
        // ignore label errors
      }
    } catch (error) {
      console.error("Error handling period change:", error);
      setError("Invalid period selected. Please try another option.");
      setPeriodStart(getFirstDayOfWeek());
      setPeriodEnd(getLastDayOfWeek());
      setSelectedPeriod(getCurrentWeek());
      setIsLoading(false);
    }
  };

  const generateWeekOptions = () => {
    // Build a map of months -> array of week option objects so we can render <optgroup>s
    const groups = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth();
      const monthName = date.toLocaleString("default", { month: "long" });

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const firstDayOfWeek = firstDay.getDay();
      const firstMondayOffset = firstDayOfWeek === 0 ? 1 : 8 - firstDayOfWeek;
      const weeksInMonth = Math.ceil((daysInMonth - firstMondayOffset + 7) / 7);

      const optionsForMonth = [];
      for (let week = 1; week <= weeksInMonth; week++) {
        const value = `${year}-${String(month + 1).padStart(2, "0")}-week-${week}`;
        // Compute start and end dates for the week to include in label
        const start = getFirstDayOfWeek(week, year, month);
        const end = getLastDayOfWeek(week, year, month);
        // Format as 'Mon DD' (e.g., Oct 06)
        const fmt = (iso) => {
          try {
            const d = new Date(iso);
            return d.toLocaleString('default', { month: 'short' }) + ' ' + String(d.getDate()).padStart(2, '0');
          } catch (e) { return iso; }
        };
        const label = `${monthName} - ${ordinal(week)} Week (${fmt(start)} - ${fmt(end)})`;
        optionsForMonth.push({ value, label, start, end });
      }

      groups.push({ key: `${year}-${String(month + 1).padStart(2, '0')}`, monthName, year, month, options: optionsForMonth });
    }

    // Render groups: most recent month first (groups already built in that order)
    return groups.map((g) => (
      <optgroup key={g.key} label={`${g.monthName} ${g.year}`}>
        {g.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </optgroup>
    ));
  };

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
          <pre>{error}</pre>
        </div>
      )}
      {isLoading && (
        <div className="mb-4 p-4 bg-blue-100 text-blue-700 rounded-md">
          Loading...
        </div>
      )}
      {/* Process payroll button moved into Pay Period container below for a unified control area */}

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex-1 min-w-0">
            <label
              htmlFor="pay-period"
              className="block text-lg font-bold text-gray-800 mb-1"
            >
              Pay Period
            </label>
            <select
              id="pay-period"
              value={selectedPeriod}
              onChange={handlePeriodChange}
              disabled={isLoading}
              className="text-gray-700 block w-full pl-3 pr-10 py-2 text-base border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">Select a period</option>
              {generateWeekOptions()}
            </select>
          </div>

          <div className="ml-4 flex-shrink-0">
            <button
              onClick={handlePayrollProcessing}
              disabled={!["admin", "manager"].includes(userRole) || isLoading || users.length === 0}
              className={`flex items-center px-4 py-2 rounded-md transition-colors ${
                ["admin", "manager"].includes(userRole) && !isLoading && users.length > 0
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-400 text-gray-200 cursor-not-allowed"
              }`}
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Process Payroll
            </button>
          </div>
        </div>
      </div>

      <div className="text-gray-700 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <PayrollSummary
          users={users}
          payrollRecords={payrollRecords}
          userRole={userRole}
          onRefresh={refreshPayroll}
          onDownloadPayslip={handleDownloadPayslip}
        />
      </div>
    </div>
  );
}