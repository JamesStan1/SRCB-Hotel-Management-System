"use client";

import { useState, useCallback } from "react";
import { CalendarIcon, ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";

// Function to generate a random 4-character alphanumeric string
const generateRandomString = (length) => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Function to generate a text-based invoice ID
const generateInvoiceId = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const randomStr = generateRandomString(4);
  return `INV-${year}${month}${day}-${hours}${minutes}${seconds}-${randomStr}`;
};

function jsonToHtml(json, title, dishesMap = null) {
  if (!json || json.length === 0) return `<p>No data available</p>`;

  const headers = [
    "Invoice ID",
    "Cashier",
    "Customer",
    "Cart Name",
    "Items",
    "Subtotal",
    "Discount",
    "Total",
    "Payment Method",
    "Date",
  ].map(header => `<th>${header}</th>`).join("");

  const rows = json.map(row => {
    let itemsContent = "No items";
    if (row.items) {
      let itemsArray = row.items;
      if (typeof row.items === "string") {
        try {
          itemsArray = JSON.parse(row.items);
        } catch (e) {
          console.error(`Error parsing items for invoice ${row.invoiceId || row.id}:`, e);
          itemsContent = "Error parsing items";
        }
      }
      if (Array.isArray(itemsArray)) {
        itemsContent = itemsArray
          .map(item => {
            const dishName = dishesMap && dishesMap[item.id] ? dishesMap[item.id].name : item.name || `Unknown Item ID ${item.id}`;
            return `${dishName} (Qty: ${item.quantity || 1})`;
          })
          .join("<br>");
      } else {
        itemsContent = "Invalid items data";
      }
    }

    // Convert subtotal, discount, and total to numbers
    const subtotal = parseFloat(row.subtotal) || 0;
    const discount = parseFloat(row.discount) || 0;
    const total = parseFloat(row.total) || 0;

    // Validate paymentMethod
    const paymentMethod = typeof row.payment_method === "string" && row.payment_method.trim() !== ""
      ? row.payment_method
      : "N/A";

    // Validate and format created_at
    let dateContent = "N/A";
    if (row.created_at) {
      try {
        const date = new Date(row.created_at);
        if (!isNaN(date.getTime())) {
          dateContent = date.toLocaleString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        } else {
          console.error(`Invalid date format for invoice ${row.invoiceId || row.id}:`, row.created_at);
        }
      } catch (e) {
        console.error(`Error parsing date for invoice ${row.invoiceId || row.id}:`, e);
      }
    }

    const cells = [
      row.invoiceId || "N/A",
      row.cashier || "Unknown",
      row.customer || "Guest",
      row.cartName || "N/A",
      itemsContent,
      `₱${subtotal.toFixed(2)}`,
      `₱${discount.toFixed(2)} (${row.discountType || "None"})`,
      `₱${total.toFixed(2)}`,
      paymentMethod,
      dateContent,
    ].map(cell => `<td>${cell}</td>`).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  return `
    <table>
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export default function Export() {
  const [selectedMonth, setSelectedMonth] = useState("");
  const [printing, setPrinting] = useState({ events: false, rooms: false, receipts: false });
  const [notification, setNotification] = useState({
    isVisible: false,
    type: "", // 'success' or 'error'
    message: "",
  });

  const fetchWithRetry = async (url, retries = 2, options = {}) => {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          throw new Error(`Failed to fetch data: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
        }
        return response;
      } catch (err) {
        if (i === retries) throw err;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  };

  const fetchDishes = async () => {
    try {
      const response = await fetchWithRetry("/api/cafe_dishes");
      const dishes = await response.json();
      return dishes.reduce((map, dish) => {
        map[dish.id] = dish;
        return map;
      }, {});
    } catch (error) {
      console.error("Error fetching dishes:", error);
      setNotification({
        isVisible: true,
        type: "error",
        message: "Failed to fetch dish data. Please try again.",
      });
      return null;
    }
  };

  const printContent = (htmlContent, title, newWin) => {
    if (!newWin) {
      setNotification({
        isVisible: true,
        type: "error",
        message: "Failed to open print window. Please disable your popup blocker and try again.",
      });
      return;
    }
    newWin.document.write(`
      <html>
        <head>
          <title>Print ${title}</title>
          <style>
            @page { 
              size: A4; 
              margin: 20mm; 
            }
            body { 
              font-family: Arial, sans-serif; 
              font-size: 12pt; 
              color: #333; 
              line-height: 1.4; 
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #2e7d32;
              padding-bottom: 10px;
            }
            .header img {
              max-width: 150px;
              height: auto;
            }
            h1 { 
              font-size: 24pt; 
              color: #2e7d32; 
              margin: 0 0 20px; 
              text-align: center; 
            }
            h2 { 
              font-size: 18pt; 
              color: #388e3c; 
              margin: 20px 0 10px; 
              text-align: center;
            }
            h3 { 
              font-size: 16pt; 
              color: #4caf50; 
              margin: 10px 0; 
              text-align: center;
            }
            table { 
              border-collapse: collapse; 
              width: 100%; 
              margin-bottom: 20px; 
              background-color: #fff; 
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            th, td { 
              border: 1px solid #ccc; 
              padding: 12px; 
              text-align: left; 
              vertical-align: top; 
            }
            th { 
              background-color: #e8f5e9; 
              font-weight: bold; 
              color: #2e7d32; 
              text-transform: uppercase;
              font-size: 11pt;
            }
            td { 
              font-size: 10pt; 
              color: #333; 
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            ul { 
              margin: 0; 
              padding-left: 20px; 
              list-style-type: disc; 
            }
            li { 
              margin-bottom: 5px; 
            }
            .footer {
              position: fixed;
              bottom: 0;
              width: 100%;
              text-align: center;
              font-size: 10pt;
              color: #666;
              border-top: 1px solid #ccc;
              padding-top: 5px;
            }
            @media print {
              .footer {
                position: fixed;
                bottom: 0;
              }
              table { 
                page-break-inside: auto; 
              }
              tr { 
                page-break-inside: avoid; 
                page-break-after: auto; 
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="/Joannaslogo.png" alt="Joanna's Nook Logo" />
            <h1>Joanna's Nook</h1>
            <p>123 Main Street, Springfield, USA</p>
          </div>
          ${htmlContent}
          <div class="footer">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span> | Generated on ${new Date().toLocaleDateString()}
          </div>
        </body>
      </html>
    `);
    newWin.document.close();
    newWin.print();
    setNotification({
      isVisible: true,
      type: "success",
      message: `${title} printed successfully!`,
    });
    // Auto-dismiss success notification after 3 seconds
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, isVisible: false }));
    }, 3000);
  };

  const handlePrint = useCallback(async (type) => {
    if (type !== "receipts" && !selectedMonth) {
      setNotification({
        isVisible: true,
        type: "error",
        message: "Please select a month for Events or Rooms data.",
      });
      return;
    }

    setPrinting(prev => ({ ...prev, [type]: true }));
    setNotification({ isVisible: false, type: "", message: "" });

    // Open the window immediately to avoid popup blocker
    const newWin = window.open("", "_blank");

    try {
      let response;
      let data;
      let title;

      if (type === "receipts") {
        const dishesMap = await fetchDishes();
        if (!dishesMap) {
          if (newWin) newWin.close();
          return;
        }
        const authHeader = typeof window !== 'undefined' && window.localStorage ? (localStorage.getItem('activeSessionId') ? null : null) : null;
        // Try to read token from sessions (AuthContext is client-only here), fallback to no header
        let token = null;
        try {
          const raw = localStorage.getItem('sessions');
          if (raw) {
            const sessions = JSON.parse(raw);
            const activeId = localStorage.getItem('activeSessionId');
            const active = sessions.find(s => s.id === activeId);
            if (active) token = active.token;
          }
        } catch (_) {}
        response = await fetchWithRetry("/api/receipts", 2, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
        data = await response.json();
        title = "Receipts Data";
        if (data.length === 0) {
          setNotification({
            isVisible: true,
            type: "error",
            message: "No receipts data found.",
          });
          if (newWin) newWin.close();
          return;
        }
        const tableContent = jsonToHtml(data, title, dishesMap);
        const htmlContent = `<h2>${title}</h2>${tableContent}`;
        printContent(htmlContent, title, newWin);
      } else {
        const apiEndpoint = type === "events" ? "/api/events" : "/api/rooms";
        response = await fetchWithRetry(apiEndpoint);
        data = await response.json();
        title = type === "events" ? "Events Data" : "Rooms Data";
        if (data.length === 0) {
          setNotification({
            isVisible: true,
            type: "error",
            message: `No ${type} data found.`,
          });
          if (newWin) newWin.close();
          return;
        }

        // Filter by selected month
        if (selectedMonth) {
          const [year, month] = selectedMonth.split("-").map(Number);
          data = data.filter(item => {
            const date = new Date(type === "events" ? item.date : (item.reservation?.checkInDate || item.created_at || item.updated_at));
            return date.getFullYear() === year && (date.getMonth() + 1) === month;
          });
        }

        if (data.length === 0) {
          setNotification({
            isVisible: true,
            type: "error",
            message: `No ${type} data found for the selected month.`,
          });
          if (newWin) newWin.close();
          return;
        }

        const tableContent = jsonToHtml(data, title);
        const periodText = selectedMonth ? `Data for ${new Date(selectedMonth).toLocaleString("en-US", { month: "long", year: "numeric" })}` : "All Data";
        const htmlContent = `<h2>${periodText}</h2><h3>${title}</h3>${tableContent}`;
        printContent(htmlContent, title, newWin);
      }
    } catch (error) {
      console.error(`Error printing ${type} data:`, error);
      setNotification({
        isVisible: true,
        type: "error",
        message: error.message || "An unexpected error occurred while printing. Please try again.",
      });
      if (newWin) newWin.close();
    } finally {
      setPrinting(prev => ({ ...prev, [type]: false }));
    }
  }, [selectedMonth]);

  const dismissNotification = () => {
    setNotification((prev) => ({ ...prev, isVisible: false }));
  };

  return (
    <div className="relative">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <CalendarIcon className="h-6 w-6 text-green-500 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Data Print</h2>
            </div>
            <div className="space-y-4">
              {notification.isVisible && (
                <div
                  className={`p-4 border-l-4 flex items-center justify-between ${
                    notification.type === "success"
                      ? "bg-green-50 border-green-500"
                      : "bg-red-50 border-red-500"
                  }`}
                >
                  <div className="flex items-center">
                    {notification.type === "success" ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                    ) : (
                      <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                    )}
                    <p
                      className={
                        notification.type === "success" ? "text-green-700" : "text-red-700"
                      }
                    >
                      {notification.message}
                    </p>
                  </div>
                  <button
                    onClick={dismissNotification}
                    className="text-gray-500 hover:text-gray-700"
                    aria-label="Dismiss notification"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Month (for Events & Rooms)
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setNotification({ isVisible: false, type: "", message: "" });
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500 text-gray-700"
                />
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => handlePrint("events")}
                  disabled={printing.events || !selectedMonth}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-md transition-colors ${
                    printing.events || !selectedMonth
                      ? "bg-green-400 cursor-not-allowed opacity-50"
                      : "bg-green-600 hover:bg-green-700"
                  } text-white`}
                >
                  {printing.events ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                      Printing...
                    </>
                  ) : (
                    "Print Events Data"
                  )}
                </button>
                <button
                  onClick={() => handlePrint("rooms")}
                  disabled={printing.rooms || !selectedMonth}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-md transition-colors ${
                    printing.rooms || !selectedMonth
                      ? "bg-green-400 cursor-not-allowed opacity-50"
                      : "bg-green-600 hover:bg-green-700"
                  } text-white`}
                >
                  {printing.rooms ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                      Printing...
                    </>
                  ) : (
                    "Print Rooms Data"
                  )}
                </button>
                <button
                  onClick={() => handlePrint("receipts")}
                  disabled={printing.receipts}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-md transition-colors ${
                    printing.receipts
                      ? "bg-green-400 cursor-not-allowed opacity-50"
                      : "bg-green-600 hover:bg-green-700"
                  } text-white`}
                >
                  {printing.receipts ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                      Printing...
                    </>
                  ) : (
                    "Print Receipts Data"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
