"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { PrinterIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Swal from 'sweetalert2';

// Centralized error handler
const handleError = (error, defaultMessage = "An unexpected error occurred") => {
  console.error(error);
  const message = error.message || defaultMessage;
  Swal.fire({
    icon: 'error',
    title: 'Error',
    text: message,
    confirmButtonText: 'OK',
    timer: 5000,
    timerProgressBar: true,
  });
  return { success: false, message };
};

// Success notification helper
const showSuccess = (title, text) => {
  Swal.fire({
    icon: 'success',
    title,
    text,
    confirmButtonText: 'OK',
    timer: 3000,
    timerProgressBar: true,
  });
};

export default function OrderHistory() {
  const { user, isInitialized, token } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const itemsPerPage = 6;

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isInitialized && !user) {
      router.push("/components/sign-in");
    }
  }, [user, isInitialized, router]);

  // Fetch order history from API
  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      try {
        const response = await fetch("/api/receipts", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch order history: HTTP ${response.status}`);
        }
        const data = await response.json();
        console.log("Raw API response:", data);

        // Normalize data
        const normalizedData = data.map((order, index) => {
          let items;
          try {
            items = typeof order.items === "string" ? JSON.parse(order.items) : Array.isArray(order.items) ? order.items : [];
          } catch (e) {
            console.warn(`Failed to parse items for order ${order.id || index}:`, e);
            items = [];
          }
          return {
            ...order,
            receiptId: String(order.id || `order-${Date.now()}-${index}`),
            date: order.created_at || new Date().toISOString(),
            total: parseFloat(order.total) || 0,
            subtotal: parseFloat(order.subtotal) || 0,
            discount: parseFloat(order.discount) || 0,
            items: items.map((item) => ({
              ...item,
              price: parseFloat(item.price) || 0,
              subtotal: parseFloat(item.subtotal) || 0,
              name: item.name || "Unknown Item",
              quantity: parseInt(item.quantity, 10) || 0,
            })),
            cashier: order.cashier || "Unknown",
            customer: order.customer || "Unknown",
            paymentMethod: order.payment_method || "Unknown",
            cartName: order.cartName || "Unknown",
            discountType: order.discountType || "None",
            // Amount received / cash given - support multiple possible keys
            amountGiven: parseFloat(order.cashGiven ?? order.cash_given ?? order.amountGiven ?? order.amount_given ?? order.amount_given_received ?? 0) || 0,
          };
        });

        // Check for duplicate receiptIds
        const receiptIds = normalizedData.map((order) => order.receiptId);
        const duplicates = receiptIds.filter(
          (id, index) => receiptIds.indexOf(id) !== index
        );
        if (duplicates.length > 0) {
          console.warn("Duplicate receiptIds found:", duplicates);
          handleError(new Error(`Duplicate receipt IDs detected: ${duplicates.join(", ")}`), "Data integrity issue");
        }

        setOrders(normalizedData);
      } catch (err) {
        setError(err.message);
        handleError(err, "Failed to load order history");
      }
    };

    fetchOrders();
  }, [user]);

  // Pagination logic
  const getPaginatedOrders = (orders) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return orders.slice(startIndex, startIndex + itemsPerPage);
  };

  const filteredOrders = orders.filter((order) =>
    (String(order.receiptId || "")).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (String(order.customer || "")).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const handlePageChange = (page) => {
    try {
      setCurrentPage(page);
    } catch (err) {
      handleError(err, "Failed to change page");
    }
  };

  const handlePreviousPage = () => {
    try {
      if (currentPage > 1) setCurrentPage(currentPage - 1);
    } catch (err) {
      handleError(err, "Failed to navigate to previous page");
    }
  };

  const handleNextPage = () => {
    try {
      if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    } catch (err) {
      handleError(err, "Failed to navigate to next page");
    }
  };

  // Generate receipt content
  const generateReceiptContent = (order) => {
    try {
      const formattedDate = new Date(order.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const formattedTime = new Date(order.date).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const items = Array.isArray(order.items) ? order.items : [];
      return {
        header: `
          Joanna's Nook
          123 Main Street, Springfield, USA
          Date: ${formattedDate}
          Time: ${formattedTime}
          Cashier: ${order.cashier || "Unknown"}
          Customer: ${order.customer || "Unknown"}
          Cart: ${order.cartName || "Unknown"}
        `,
        items: items.map((item) => ({
          name: item.name || "Unknown Item",
          quantity: item.quantity || 0,
          price: (item.price || 0).toFixed(2),
          subtotal: (item.subtotal || 0).toFixed(2),
        })),
        footer: `
          Subtotal: ₱${order.subtotal.toFixed(2)}
          Discount (${order.discountType || "None"}): ₱${order.discount.toFixed(2)}
          Total: ₱${order.total.toFixed(2)}
          Payment Method: ${order.paymentMethod || "Unknown"}
        `,
      };
    } catch (err) {
      handleError(err, "Failed to generate receipt content");
      return { header: "", items: [], footer: "" };
    }
  };

  // Print receipt
  const printReceipt = (order) => {
    try {
      const { header, items, footer } = generateReceiptContent(order);
      const receiptContent = `
        ${header}
        
        --------------------------------
        Items Purchased:
        --------------------------------
        ${
          items.length > 0
            ? items
                .map(
                  (item) => `
          ${item.name}
          ${item.quantity} x ₱${item.price} = ₱${item.subtotal}
        `
                )
                .join("\n")
            : "No items available"
        }
        --------------------------------
        ${footer}
      `;
      const printWindow = window.open("", "_blank");
      if (!printWindow) throw new Error("Unable to open print window. Please allow popups for this site.");

      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt</title>
            <style>
              @page { size: A4; margin: 15mm; }
              body { 
                font-family: Arial, sans-serif; 
                padding: 20px;
                width: 210mm;
                min-height: 297mm;
              }
              pre { white-space: pre-wrap; font-family: monospace; }
            </style>
          </head>
          <body>
            <pre>${receiptContent}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
  printWindow.print();
    } catch (err) {
      handleError(err, "Failed to print receipt");
    }
  };

  // Handle order click to show modal
  const handleOrderClick = (order) => {
    try {
      // Open the receipt modal without showing a success notification
      setSelectedOrder(order);
    } catch (err) {
      handleError(err, "Failed to select order");
    }
  };

  // Close modal
  const closeModal = () => {
    try {
      setSelectedOrder(null);
    } catch (err) {
      handleError(err, "Failed to close receipt modal");
    }
  };

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Order History</h1>
          <input
            type="text"
            placeholder="Search by Receipt ID or Customer..."
            className="p-2 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            value={searchTerm}
            onChange={(e) => {
              try {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              } catch (err) {
                handleError(err, "Failed to update search term");
              }
            }}
          />
        </div>

        {/* Table Format for Receipt History */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-emerald-600 text-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Receipt ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Cashier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                    Received
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getPaginatedOrders(filteredOrders).length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  getPaginatedOrders(filteredOrders).map((order, index) => (
                    <tr
                      key={order.receiptId || `order-${index}`}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleOrderClick(order)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {order.receiptId || "Unknown"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(order.date).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(order.date).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {order.customer || "Guest"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {order.cashier || "Unknown"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">
                          {Array.isArray(order.items) && order.items.length > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-gray-400">No items</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-emerald-600">
                          ₱{order.total.toFixed(2)}
                        </div>
                        {order.discount > 0 && (
                          <div className="text-xs text-gray-500">
                            -₱{order.discount.toFixed(2)} disc.
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900">{order.amountGiven && Number(order.amountGiven) > 0 ? `₱${Number(order.amountGiven).toFixed(2)}` : '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          order.paymentMethod === 'Cash' 
                            ? 'bg-green-100 text-green-800'
                            : order.paymentMethod === 'Gcash'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {order.paymentMethod || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOrderClick(order);
                          }}
                          className="text-emerald-600 hover:text-emerald-900 font-medium text-sm"
                        >
                          View Details
                        </button>
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
          <div className="mt-6 flex justify-center items-center space-x-2">
            <button
              onClick={handlePreviousPage}
              className={`px-4 py-2 rounded-lg text-sm ${
                currentPage === 1
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-4 py-2 rounded-lg text-sm ${
                  currentPage === page
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={handleNextPage}
              className={`px-4 py-2 rounded-lg text-sm ${
                currentPage === totalPages
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Modal for Receipt */}
      {selectedOrder && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Receipt</h2>
              <button
                onClick={closeModal}
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="text-sm text-gray-700 space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-bold">Joanna&apos;s Nook</h3>
                <p>123 Main Street, Springfield, USA</p>
                <p>
                  Date:{" "}
                  {new Date(selectedOrder.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p>
                  Time:{" "}
                  {new Date(selectedOrder.date).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
                <p>Cashier: {selectedOrder.cashier || "Unknown"}</p>
                <p>Customer: {selectedOrder.customer || "Unknown"}</p>
                <p>Cart: {selectedOrder.cartName || "Unknown"}</p>
              </div>
              <hr className="border-gray-300" />
              <h4 className="font-semibold text-center">Items Purchased</h4>
              {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="py-2">Item</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Price</th>
                      <th className="py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item, index) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="py-2">{item.name || "Unknown Item"}</td>
                        <td className="py-2 text-right">{item.quantity || 0}</td>
                        <td className="py-2 text-right">₱{(item.price || 0).toFixed(2)}</td>
                        <td className="py-2 text-right">₱{(item.subtotal || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-gray-500">No items available</p>
              )}
              <hr className="border-gray-300" />
              <div className="space-y-1">
                <p className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₱{selectedOrder.subtotal.toFixed(2)}</span>
                </p>
                <p className="flex justify-between">
                  <span>Discount ({selectedOrder.discountType || "None"}):</span>
                  <span>₱{selectedOrder.discount.toFixed(2)}</span>
                </p>
                <p className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>₱{selectedOrder.total.toFixed(2)}</span>
                </p>
                <p className="flex justify-between">
                  <span>Payment Method:</span>
                  <span>{selectedOrder.paymentMethod || "Unknown"}</span>
                </p>
                {selectedOrder.amountGiven && Number(selectedOrder.amountGiven) > 0 && (
                  <>
                    <p className="flex justify-between">
                      <span>Amount Given:</span>
                      <span>₱{Number(selectedOrder.amountGiven).toFixed(2)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Change:</span>
                      <span>₱{(Number(selectedOrder.amountGiven) - Number(selectedOrder.total)).toFixed(2)}</span>
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
              {/* Reprint/Print removed from order modal */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
