"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Swal from "sweetalert2";
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  PrinterIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  UserIcon,
  HomeIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

const parseAmount = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatCurrency = (value) => parseAmount(value).toFixed(2);

export default function BillsPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("room"); // 'room' or 'event'
  const [roomBills, setRoomBills] = useState([]);
  const [eventBills, setEventBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // 'all', 'today', 'week', 'month'

  // Fetch room bills
  const fetchRoomBills = async () => {
    try {
      const response = await fetch("/api/room?scope=billing", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch room bills");
      const data = await response.json();
      setRoomBills(data.roomReservations || []);
    } catch (error) {
      console.error("Error fetching room bills:", error);
      setRoomBills([]);
    }
  };

  // Fetch event bills
  const fetchEventBills = async () => {
    try {
      const response = await fetch("/api/event?scope=billing", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch event bills");
      const data = await response.json();
      setEventBills(data.eventReservations || []);
    } catch (error) {
      console.error("Error fetching event bills:", error);
      setEventBills([]);
    }
  };

  useEffect(() => {
    if (token) {
      setLoading(true);
      Promise.all([fetchRoomBills(), fetchEventBills()]).finally(() => {
        setLoading(false);
      });
    }
  }, [token]);

  // Filter bills by date
  const filterByDate = (bills, dateField) => {
    if (dateFilter === "all") return bills;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return bills.filter((bill) => {
      const billDate = new Date(bill[dateField]);
      const billDay = new Date(
        billDate.getFullYear(),
        billDate.getMonth(),
        billDate.getDate()
      );

      if (dateFilter === "today") {
        return billDay.getTime() === today.getTime();
      } else if (dateFilter === "week") {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return billDay >= weekAgo;
      } else if (dateFilter === "month") {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return billDay >= monthAgo;
      }
      return true;
    });
  };

  // Filter bills by search term
  const filterBySearch = (bills) => {
    if (!searchTerm) return bills;
    const term = searchTerm.toLowerCase();
    return bills.filter(
      (bill) =>
        bill.customer_name?.toLowerCase().includes(term) ||
        bill.id?.toString().includes(term) ||
        bill.room_number?.toLowerCase().includes(term) ||
        bill.event_name?.toLowerCase().includes(term)
    );
  };

  // Apply all filters
  const getFilteredRoomBills = () => {
    let filtered = roomBills;
    filtered = filterByDate(filtered, "check_in_date");
    filtered = filterBySearch(filtered);
    return filtered;
  };

  const getFilteredEventBills = () => {
    let filtered = eventBills;
    filtered = filterByDate(filtered, "event_date");
    filtered = filterBySearch(filtered);
    return filtered;
  };

  // Print bill
  const handlePrintBill = (bill, type) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the bill.");
      return;
    }

    const isRoom = type === "room";
    const totalAmount = parseAmount(
      bill.total_price ??
        bill.total ??
        bill.price ??
        bill.receipt_total ??
        bill.billed_total ??
        0
    );
    const downpaymentRequired = parseAmount(
      bill.downpayment_required ?? bill.downpayment_amount ?? 0
    );
    const downpaymentPaid = parseAmount(
      bill.downpayment_paid_amount ?? bill.downpayment ?? bill.down_payment ?? 0
    );
    let otherPayments = parseAmount(bill.payments_applied ?? 0);
    if (bill.payments_applied == null && bill.total_paid_amount != null) {
      otherPayments = Math.max(
        parseAmount(bill.total_paid_amount) - downpaymentPaid,
        0
      );
    }
    const totalPaid = downpaymentPaid + otherPayments;
    const remainingBalance = Math.max(totalAmount - totalPaid, 0);
    const hasRemaining = remainingBalance > 0.009;

    const billContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill - SRCB</title>
          <style>
            @page { size: A4; margin: 15mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              padding: 30px;
              width: 210mm;
              min-height: 297mm;
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #10b981;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              color: #10b981;
              margin-bottom: 10px;
            }
            .bill-number {
              background: #f0fdf4;
              border: 2px solid #10b981;
              padding: 15px;
              text-align: center;
              margin: 20px 0;
              border-radius: 8px;
              font-size: 18px;
              font-weight: bold;
            }
            .info-section {
              margin: 20px 0;
            }
            .info-row {
              display: flex;
              padding: 10px;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-label {
              font-weight: bold;
              width: 200px;
              color: #374151;
            }
            .info-value {
              flex: 1;
              color: #111827;
            }
            .total-section {
              background: #f9fafb;
              border: 2px solid #10b981;
              padding: 20px;
              margin: 30px 0;
              border-radius: 8px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              font-size: 20px;
              font-weight: bold;
              color: #10b981;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              padding: 6px 0;
              font-size: 16px;
              color: #374151;
            }
            .summary-row span:last-child {
              font-weight: 600;
            }
            .summary-row.positive span:last-child {
              color: #059669;
            }
            .summary-row.negative span:last-child {
              color: #dc2626;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">🏨 SRCB</div>
            <div style="color: #666; font-size: 14px;">${
              isRoom ? "Room Reservation Bill" : "Event Reservation Bill"
            }</div>
          </div>

          <div class="bill-number">
            Bill #${bill.id}
          </div>

          <div class="info-section">
            <div class="info-row">
              <div class="info-label">Customer Name:</div>
              <div class="info-value">${bill.customer_name || "N/A"}</div>
            </div>
            ${
              isRoom
                ? `
            <div class="info-row">
              <div class="info-label">Room Number:</div>
              <div class="info-value">${bill.room_number || "N/A"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Package:</div>
              <div class="info-value">${bill.package_name || "N/A"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Check-in Date:</div>
              <div class="info-value">${
                bill.check_in_date
                  ? new Date(bill.check_in_date).toLocaleDateString()
                  : "N/A"
              }</div>
            </div>
            <div class="info-row">
              <div class="info-label">Check-out Date:</div>
              <div class="info-value">${
                bill.check_out_date
                  ? new Date(bill.check_out_date).toLocaleDateString()
                  : "N/A"
              }</div>
            </div>
            `
                : `
            <div class="info-row">
              <div class="info-label">Event Name:</div>
              <div class="info-value">${bill.event_name || "N/A"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Event Date:</div>
              <div class="info-value">${
                bill.event_date
                  ? new Date(bill.event_date).toLocaleDateString()
                  : "N/A"
              }</div>
            </div>
            <div class="info-row">
              <div class="info-label">Guests:</div>
              <div class="info-value">${bill.guests || "N/A"}</div>
            </div>
            `
            }
            <div class="info-row">
              <div class="info-label">Cashier:</div>
              <div class="info-value">${
                bill.receipt_cashier || bill.display_name || "N/A"
              }</div>
            </div>
          </div>

          <div class="total-section">
            <div class="total-row">
              <span>Total Amount:</span>
              <span>₱${formatCurrency(totalAmount)}</span>
            </div>
            ${downpaymentRequired > 0 ? `
            <div class="summary-row">
              <span>Required Downpayment</span>
              <span>₱${formatCurrency(downpaymentRequired)}</span>
            </div>
            ` : ''}
            ${downpaymentPaid > 0 ? `
            <div class="summary-row positive">
              <span>Downpayment Received</span>
              <span>₱${formatCurrency(downpaymentPaid)}</span>
            </div>
            ` : ''}
            ${otherPayments > 0 ? `
            <div class="summary-row positive">
              <span>Additional Payments</span>
              <span>₱${formatCurrency(otherPayments)}</span>
            </div>
            ` : ''}
            <div class="summary-row ${totalPaid > 0 ? 'positive' : ''}">
              <span>Total Paid</span>
              <span>₱${formatCurrency(totalPaid)}</span>
            </div>
            <div class="summary-row ${hasRemaining ? 'negative' : 'positive'}">
              <span>Remaining Balance</span>
              <span>₱${formatCurrency(remainingBalance)}</span>
            </div>
          </div>

          <div class="footer">
            <div>Thank you for choosing SRCB!</div>
            <div style="margin-top: 10px;">For inquiries, please contact us at info@srcb.com</div>
          </div>

          <div class="no-print" style="text-align: center; margin-top: 30px;">
            <button onclick="window.print()" style="background: #10b981; color: white; border: none; padding: 12px 30px; font-size: 16px; border-radius: 6px; cursor: pointer;">
              Print Bill
            </button>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(billContent);
    printWindow.document.close();
  };

  // View bill details
  const handleViewBill = (bill, type) => {
    const isRoom = type === "room";
    const totalAmountValue = parseAmount(
      bill.total_price ??
        bill.total ??
        bill.price ??
        bill.receipt_total ??
        bill.billed_total ??
        0
    );
    const downpaymentRequiredValue = parseAmount(
      bill.downpayment_required ?? bill.downpayment_amount ?? 0
    );
    const downpaymentPaidValue = parseAmount(
      bill.downpayment_paid_amount ?? bill.downpayment ?? bill.down_payment ?? 0
    );
    let otherPaymentsValue = parseAmount(bill.payments_applied ?? 0);
    if (bill.payments_applied == null && bill.total_paid_amount != null) {
      otherPaymentsValue = Math.max(
        parseAmount(bill.total_paid_amount) - downpaymentPaidValue,
        0
      );
    }
    const totalPaidValue = downpaymentPaidValue + otherPaymentsValue;
    const remainingBalanceValue = Math.max(totalAmountValue - totalPaidValue, 0);
    const hasDownpaymentRequired = downpaymentRequiredValue > 0;
    const hasDownpaymentPaid = downpaymentPaidValue > 0;
    const hasOtherPayments = otherPaymentsValue > 0;
    const hasAnyPayment = totalPaidValue > 0;

    let htmlContent = `
      <div style="text-align: left; padding: 20px;">
        <div style="border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-bottom: 20px;">
          <h3 style="color: #10b981; margin: 0; font-size: 20px;">Bill Details</h3>
        </div>
        
        <div style="margin-bottom: 15px;">
          <p style="margin: 8px 0;"><strong>Bill #:</strong> ${bill.id}</p>
          <p style="margin: 8px 0;"><strong>Customer:</strong> ${bill.customer_name || "N/A"}</p>
    `;
    
    if (isRoom) {
      htmlContent += `
          <p style="margin: 8px 0;"><strong>Room:</strong> ${bill.room_number || "N/A"}</p>
          <p style="margin: 8px 0;"><strong>Package:</strong> ${bill.package_name || "N/A"}</p>
          <p style="margin: 8px 0;"><strong>Check-in:</strong> ${
            bill.check_in_date
              ? new Date(bill.check_in_date).toLocaleDateString()
              : "N/A"
          }</p>
          <p style="margin: 8px 0;"><strong>Check-out:</strong> ${
            bill.check_out_date
              ? new Date(bill.check_out_date).toLocaleDateString()
              : "N/A"
          }</p>
      `;
    } else {
      htmlContent += `
          <p style="margin: 8px 0;"><strong>Event:</strong> ${bill.event_name || "N/A"}</p>
          <p style="margin: 8px 0;"><strong>Date:</strong> ${
            bill.event_date
              ? new Date(bill.event_date).toLocaleDateString()
              : "N/A"
          }</p>
          <p style="margin: 8px 0;"><strong>Guests:</strong> ${bill.guests || "N/A"}</p>
      `;
    }
    
    htmlContent += `
        </div>
        
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0 0 10px 0; font-size: 18px;"><strong>Total Amount:</strong> <span style="color: #10b981; font-size: 24px;">₱${formatCurrency(totalAmountValue)}</span></p>
    `;

    if (hasDownpaymentRequired) {
      htmlContent += `
          <p style="margin: 6px 0; color: #374151;"><strong>Required Downpayment:</strong> ₱${formatCurrency(downpaymentRequiredValue)}</p>
      `;
    }

    if (hasDownpaymentPaid) {
      htmlContent += `
          <p style="margin: 6px 0; color: #059669;"><strong>Downpayment Received:</strong> ₱${formatCurrency(downpaymentPaidValue)}</p>
      `;
    }

    if (hasOtherPayments) {
      htmlContent += `
          <p style="margin: 6px 0; color: #059669;"><strong>Additional Payments:</strong> ₱${formatCurrency(otherPaymentsValue)}</p>
      `;
    }

    if (!hasAnyPayment) {
      htmlContent += `
          <p style="margin: 8px 0; color: #6b7280; font-size: 14px;">No payments recorded yet</p>
      `;
    }

    htmlContent += `
          <p style="margin: 8px 0; color: #111827;"><strong>Total Paid:</strong> ₱${formatCurrency(totalPaidValue)}</p>
          <p style="margin: 5px 0; font-size: 16px;"><strong>Remaining Balance:</strong> <span style="color: ${remainingBalanceValue > 0.009 ? '#dc2626' : '#059669'}; font-size: 20px;">₱${formatCurrency(remainingBalanceValue)}</span></p>
        </div>
      </div>
    `;

    Swal.fire({
      html: htmlContent,
      icon: "info",
      confirmButtonText: "Close",
      confirmButtonColor: "#10b981",
      width: "500px",
      customClass: {
        popup: "bill-details-popup"
      }
    });
  };

  const filteredRoomBills = getFilteredRoomBills();
  const filteredEventBills = getFilteredEventBills();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <DocumentTextIcon className="h-8 w-8 text-emerald-600" />
          Bills & Invoices
        </h1>
        <p className="text-gray-600 mt-2">
          View and manage all room and event bills
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("room")}
          className={`px-6 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "room"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          <HomeIcon className="h-5 w-5" />
          Room Bills ({filteredRoomBills.length})
        </button>
        <button
          onClick={() => setActiveTab("event")}
          className={`px-6 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "event"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          <SparklesIcon className="h-5 w-5" />
          Event Bills ({filteredEventBills.length})
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[300px]">
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer name, bill #, room, or event..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-black"
            />
          </div>
        </div>

        {/* Date Filter */}
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-black"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          <p className="mt-4 text-gray-600">Loading bills...</p>
        </div>
      )}

      {/* Room Bills */}
      {!loading && activeTab === "room" && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bill #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Room
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Package
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-in
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-out
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRoomBills.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                      <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                      <p>No room bills found</p>
                    </td>
                  </tr>
                ) : (
                  filteredRoomBills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{bill.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bill.customer_name || bill.display_name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bill.room_number || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {bill.package_name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {bill.check_in_date
                          ? new Date(bill.check_in_date).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {bill.check_out_date
                          ? new Date(bill.check_out_date).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600">
                        ₱
                        {formatCurrency(
                          bill.total_price ??
                            bill.total ??
                            bill.price ??
                            bill.receipt_total ??
                            bill.billed_total ??
                            0
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewBill(bill, "room")}
                            className="text-blue-600 hover:text-blue-800"
                            title="View Details"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handlePrintBill(bill, "room")}
                            className="text-emerald-600 hover:text-emerald-800"
                            title="Print Bill"
                          >
                            <PrinterIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Event Bills */}
      {!loading && activeTab === "event" && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bill #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEventBills.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                      <p>No event bills found</p>
                    </td>
                  </tr>
                ) : (
                  filteredEventBills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{bill.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bill.customer_name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bill.event_name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {bill.event_date
                          ? new Date(bill.event_date).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {bill.guests || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600">
                        ₱
                        {formatCurrency(
                          bill.total_cost ??
                            bill.total ??
                            bill.price ??
                            bill.receipt_total ??
                            bill.billed_total ??
                            0
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewBill(bill, "event")}
                            className="text-blue-600 hover:text-blue-800"
                            title="View Details"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handlePrintBill(bill, "event")}
                            className="text-emerald-600 hover:text-emerald-800"
                            title="Print Bill"
                          >
                            <PrinterIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {!loading && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Room Bills</p>
                <p className="text-2xl font-bold text-blue-900">
                  {filteredRoomBills.length}
                </p>
              </div>
              <HomeIcon className="h-10 w-10 text-blue-400" />
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Event Bills</p>
                <p className="text-2xl font-bold text-purple-900">
                  {filteredEventBills.length}
                </p>
              </div>
              <SparklesIcon className="h-10 w-10 text-purple-400" />
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">Total Bills</p>
                <p className="text-2xl font-bold text-emerald-900">
                  {filteredRoomBills.length + filteredEventBills.length}
                </p>
              </div>
              <DocumentTextIcon className="h-10 w-10 text-emerald-400" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
