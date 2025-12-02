"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { 
  PrinterIcon, 
  EyeIcon, 
  MagnifyingGlassIcon,
  DocumentTextIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import Swal from 'sweetalert2';

const describePosItem = (item) => {
  if (!item) return "Item";
  if (item.type === "event" && item.name) {
    return `Event: ${item.name}`;
  }
  return item.name || item.title || item.description || "Item";
};

export default function BillsHistory() {
  const { user, token, isInitialized } = useAuth();
  const router = useRouter();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const itemsPerPage = 10;

  // Redirect if not authenticated
  useEffect(() => {
    if (isInitialized && !user) {
      router.push("/");
    }
  }, [isInitialized, user, router]);

  // Fetch bills from receipts API
  useEffect(() => {
    const fetchBills = async () => {
      if (!token) return;
      
      try {
        const response = await fetch("/api/receipts", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch bills");
        }

        const data = await response.json();
        
        // Normalize the data
        const normalizedBills = (data.receipts || data || []).map((bill) => ({
          ...bill,
          items: (() => {
            try {
              return Array.isArray(bill.items) 
                ? bill.items 
                : JSON.parse(bill.items || '[]');
            } catch {
              return [];
            }
          })(),
        }));

        setBills(normalizedBills);
      } catch (error) {
        console.error("Error fetching bills:", error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to load bills history',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBills();
  }, [token]);

  // Filter bills based on search term
  const filteredBills = bills.filter((bill) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      bill.receiptId?.toLowerCase().includes(searchLower) ||
      bill.customer?.toLowerCase().includes(searchLower) ||
      bill.cashier?.toLowerCase().includes(searchLower) ||
      bill.paymentMethod?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredBills.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBills = filteredBills.slice(startIndex, startIndex + itemsPerPage);

  // Print itemized bill
  const printBill = (bill) => {
    const invoiceId = bill.receiptId || bill.invoice_id || "N/A";
    const billDate = new Date(bill.date || bill.created_at);
    const formattedDate = billDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const formattedTime = billDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const subtotal = bill.subtotal || 0;
    const discount = bill.discount || 0;
    const total = bill.total || 0;

    const billWindow = window.open("", "_blank");
    if (billWindow) {
      billWindow.document.write(`
        <html>
          <head>
            <title>Bill - ${invoiceId}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: Arial, sans-serif;
                padding: 40px;
                max-width: 900px;
                margin: 0 auto;
                line-height: 1.6;
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
                margin-bottom: 5px;
              }
              .subtitle {
                color: #666;
                font-size: 14px;
              }
              .bill-info {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 30px;
                padding: 20px;
                background: #f9fafb;
                border-radius: 8px;
              }
              .info-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
              }
              .info-label {
                font-weight: bold;
                color: #374151;
                font-size: 12px;
                text-transform: uppercase;
              }
              .info-value {
                color: #1f2937;
                font-size: 14px;
              }
              .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
              }
              .items-table thead {
                background: #10b981;
                color: white;
              }
              .items-table th,
              .items-table td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #e5e7eb;
              }
              .items-table th {
                font-weight: 600;
                font-size: 13px;
                text-transform: uppercase;
              }
              .items-table td {
                font-size: 14px;
                color: #374151;
              }
              .items-table tr:hover {
                background: #f9fafb;
              }
              .text-right {
                text-align: right;
              }
              .text-center {
                text-align: center;
              }
              .summary {
                margin-left: auto;
                width: 350px;
                padding: 20px;
                background: #f9fafb;
                border-radius: 8px;
              }
              .summary-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #e5e7eb;
              }
              .summary-row.total {
                border-top: 2px solid #10b981;
                border-bottom: 2px solid #10b981;
                font-weight: bold;
                font-size: 18px;
                color: #10b981;
                margin-top: 10px;
                padding-top: 12px;
              }
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 2px solid #e5e7eb;
                text-align: center;
                color: #6b7280;
                font-size: 12px;
              }
              @page { size: A4; margin: 15mm; }
              @media print {
                body { 
                  padding: 20px;
                  width: 210mm;
                  min-height: 297mm;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="logo">🏨 Joanna's Hotel</div>
              <div class="subtitle">Madroño St., Brgy 4, Balingasag, Misamis Oriental</div>
              <div style="margin-top: 10px; font-size: 20px; font-weight: bold; color: #10b981;">ITEMIZED BILL</div>
            </div>

            <div class="bill-info">
              <div class="info-group">
                <div class="info-label">Invoice Number</div>
                <div class="info-value">${invoiceId}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Date & Time</div>
                <div class="info-value">${formattedDate} at ${formattedTime}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Customer Name</div>
                <div class="info-value">${bill.customer || "Guest"}</div>
              </div>
              <div class="info-group">
                <div class="info-label">Cashier</div>
                <div class="info-value">${bill.cashier || "Unknown"}</div>
              </div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 50px;" class="text-center">#</th>
                  <th>Item Description</th>
                  <th class="text-center" style="width: 100px;">Quantity</th>
                  <th class="text-right" style="width: 120px;">Unit Price</th>
                  <th class="text-right" style="width: 120px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${bill.items.map((item, index) => {
                  const itemName = describePosItem(item);
                  const itemTotal = (item.price || 0) * (item.quantity || 1);
                  return `
                    <tr>
                      <td class="text-center">${index + 1}</td>
                      <td>${itemName}</td>
                      <td class="text-center">${item.quantity || 1}</td>
                      <td class="text-right">₱${(item.price || 0).toFixed(2)}</td>
                      <td class="text-right">₱${itemTotal.toFixed(2)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="summary">
              <div class="summary-row">
                <span>Subtotal:</span>
                <span>₱${subtotal.toFixed(2)}</span>
              </div>
              ${discount > 0 ? `
              <div class="summary-row">
                <span>Discount ${bill.discountType ? `(${bill.discountType})` : ''}:</span>
                <span>- ₱${discount.toFixed(2)}</span>
              </div>
              ` : ''}
              <div class="summary-row total">
                <span>TOTAL AMOUNT DUE:</span>
                <span>₱${total.toFixed(2)}</span>
              </div>
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                  <span style="color: #6b7280; font-size: 13px;">Payment Method:</span>
                  <span style="font-weight: 600;">${bill.paymentMethod || "N/A"}</span>
                </div>
              </div>
            </div>

            <div class="footer">
              <p><strong>Thank you for your business!</strong></p>
              <p style="margin-top: 10px;">This is a computer-generated document. No signature is required.</p>
              <p style="margin-top: 5px;">For inquiries, please contact our front desk.</p>
            </div>

            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      billWindow.document.close();
    }
  };

  // Preview bill
  const previewBill = (bill) => {
    setSelectedBill(bill);
    setShowPreviewModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bills...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <DocumentTextIcon className="w-8 h-8 text-emerald-600" />
            Bills & Invoices History
          </h1>
          <p className="text-gray-600 mt-2">View and print past bills and invoices</p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center gap-3">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Invoice ID, Customer, Cashier, or Payment Method..."
              className="flex-1 p-2 text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-gray-600 text-sm font-medium">Total Bills</h3>
            <p className="text-3xl font-bold text-emerald-600">{bills.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-gray-600 text-sm font-medium">Total Revenue</h3>
            <p className="text-3xl font-bold text-emerald-600">
              ₱{bills.reduce((sum, bill) => sum + (bill.total || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-gray-600 text-sm font-medium">Search Results</h3>
            <p className="text-3xl font-bold text-emerald-600">{filteredBills.length}</p>
          </div>
        </div>

        {/* Bills Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-emerald-600 text-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Invoice ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Cashier</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase">Items</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Total</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase">Payment</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedBills.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                      No bills found
                    </td>
                  </tr>
                ) : (
                  paginatedBills.map((bill, index) => (
                    <tr key={bill.receiptId || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">
                          {bill.receiptId || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {new Date(bill.date || bill.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(bill.date || bill.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {bill.customer || "Guest"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {bill.cashier || "Unknown"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {bill.items?.length || 0} items
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-semibold text-emerald-600">
                          ₱{(bill.total || 0).toFixed(2)}
                        </div>
                        {bill.discount > 0 && (
                          <div className="text-xs text-gray-500">
                            -₱{bill.discount.toFixed(2)} disc.
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          bill.paymentMethod === 'Cash' 
                            ? 'bg-green-100 text-green-800'
                            : bill.paymentMethod === 'Gcash'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {bill.paymentMethod || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => previewBill(bill)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Preview"
                          >
                            <EyeIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => printBill(bill)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Print"
                          >
                            <PrinterIcon className="w-5 h-5" />
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-6">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
            >
              Previous
            </button>
            <span className="text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreviewModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Bill Preview</h2>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8">
              {/* Preview Content */}
              <div className="text-center border-b-2 border-emerald-600 pb-6 mb-6">
                <div className="text-3xl font-bold text-emerald-600 mb-2">🏨 Joanna&apos;s Hotel</div>
                <div className="text-gray-600">Madroño St., Brgy 4, Balingasag, Misamis Oriental</div>
                <div className="mt-3 text-xl font-bold text-emerald-600">ITEMIZED BILL</div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6 p-6 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-xs font-bold text-gray-600 uppercase">Invoice Number</div>
                  <div className="text-sm text-gray-900">{selectedBill.receiptId || "N/A"}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-600 uppercase">Date & Time</div>
                  <div className="text-sm text-gray-900">
                    {new Date(selectedBill.date || selectedBill.created_at).toLocaleDateString()} at{' '}
                    {new Date(selectedBill.date || selectedBill.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-600 uppercase">Customer Name</div>
                  <div className="text-sm text-gray-900">{selectedBill.customer || "Guest"}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-600 uppercase">Cashier</div>
                  <div className="text-sm text-gray-900">{selectedBill.cashier || "Unknown"}</div>
                </div>
              </div>

              <table className="w-full mb-6 border-collapse">
                <thead className="bg-emerald-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Description</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedBill.items.map((item, index) => {
                    const itemName = describePosItem(item);
                    const itemTotal = (item.price || 0) * (item.quantity || 1);
                    return (
                      <tr key={index}>
                        <td className="px-4 py-3 text-center">{index + 1}</td>
                        <td className="px-4 py-3">{itemName}</td>
                        <td className="px-4 py-3 text-center">{item.quantity || 1}</td>
                        <td className="px-4 py-3 text-right">₱{(item.price || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-semibold">₱{itemTotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-80 bg-gray-50 p-6 rounded-lg">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span>Subtotal:</span>
                    <span>₱{(selectedBill.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {selectedBill.discount > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span>Discount {selectedBill.discountType ? `(${selectedBill.discountType})` : ''}:</span>
                      <span>- ₱{selectedBill.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 border-t-2 border-emerald-600 mt-2 font-bold text-lg text-emerald-600">
                    <span>TOTAL:</span>
                    <span>₱{(selectedBill.total || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-3 mt-3 border-t border-gray-200">
                    <span className="text-gray-600 text-sm">Payment Method:</span>
                    <span className="font-semibold">{selectedBill.paymentMethod || "N/A"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t-2 border-gray-200 text-center text-gray-600 text-sm">
                <p className="font-bold">Thank you for your business!</p>
                <p className="mt-2">This is a computer-generated document. No signature is required.</p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-end gap-3">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  printBill(selectedBill);
                  setShowPreviewModal(false);
                }}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <PrinterIcon className="w-5 h-5" />
                Print Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
