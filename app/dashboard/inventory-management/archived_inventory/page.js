"use client";

import { useState, useEffect, useCallback } from "react";
import { EyeIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/outline";
import Swal from "sweetalert2";
import ManagerApprovalModal from '../../../components/ManagerApprovalModal';

export default function ArchivedCafe() {
  const [archivedCafe, setArchivedCafe] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // { itemId, actionType, method }
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const Endpoint = "/api/archive/restore-inventory";

  // Notification configuration
  const notificationConfig = {
    toast: true,
    position: "top-end",
    timer: 3000,
    showConfirmButton: false,
    customClass: {
      container: "swal2-toast-custom",
      popup: "swal2-toast-custom-popup",
    },
  };

  // Centralized notification handler
  const showNotification = useCallback((type, title, message) => {
    Swal.fire({
      ...notificationConfig,
      icon: type,
      title,
      text: message,
    });
  }, []);

  // Centralized error handler
  const handleError = useCallback(
    (error, defaultMessage = "An unexpected error occurred.") => {
      const message = error?.response?.data?.error || error?.message || defaultMessage;
      console.error("Error:", { message, error });
      showNotification("error", "Error!", message);
      return message;
    },
    [showNotification]
  );

  // Sort handler
  const handleSort = useCallback(
    (key) => {
      setSortConfig((prev) => {
        const isAsc = prev.key === key && prev.direction === "asc";
        return { key, direction: isAsc ? "desc" : "asc" };
      });
    },
    []
  );

  // Sorted data
  const sortedCafe = useCallback(() => {
    if (!sortConfig.key) return archivedCafe;

    const sorted = [...archivedCafe].sort((a, b) => {
      const aValue = a[sortConfig.key] ?? "";
      const bValue = b[sortConfig.key] ?? "";
      
      if (sortConfig.key === "archived_at") {
        return sortConfig.direction === "asc"
          ? new Date(aValue) - new Date(bValue)
          : new Date(bValue) - new Date(aValue);
      }

      if (typeof aValue === "string") {
        return sortConfig.direction === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortConfig.direction === "asc"
        ? aValue - bValue
        : bValue - aValue;
    });

    return sorted;
  }, [archivedCafe, sortConfig]);

  // Fetch archived items
  useEffect(() => {
    let isMounted = true;

    const fetchArchivedCafe = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(Endpoint);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw Object.assign(new Error(), {
            message: errorData.error || `HTTP error! Status: ${response.status}`,
            response,
          });
        }
        const data = await response.json();
        if (isMounted) {
          setArchivedCafe(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (isMounted) {
          setError(handleError(error, "Failed to fetch archived cafe items."));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchArchivedCafe();

    return () => {
      isMounted = false;
    };
  }, [handleError]);

  // Generic action handler for restore/delete
  const handleAction = useCallback(
    async (itemId, actionType, method) => {
      if (actionLoading) return;
      const item = archivedCafe.find((item) => item.id === itemId);
      const itemName = item?.name || "this item";
      const actionText = actionType === "restore" ? "restore" : "permanently delete";
      const confirmText = actionType === "restore" ? "Yes, restore it!" : "Yes, delete it!";

      const result = await Swal.fire({
        title: "Are you sure?",
        text: `This will ${actionText} ${itemName}.${
          actionType === "delete" ? " This action cannot be undone." : ""
        }`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: "No, cancel!",
        reverseButtons: true,
        customClass: {
          confirmButton:
            actionType === "restore"
              ? "bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ml-2"
              : "bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded ml-2",
          cancelButton:
            "bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded mr-2",
        },
        buttonsStyling: false,
      });

      if (result.isConfirmed) {
        // open approval modal and set pending action
        setPendingAction({ itemId, actionType, method });
        setApprovalOpen(true);
      } else {
        showNotification("info", "Cancelled", `${itemName} remains archived.`);
      }
    },
    [actionLoading, archivedCafe, handleError, showNotification]
  );

  const handleRestore = useCallback(
    (itemId) => handleAction(itemId, "restore", "POST"),
    [handleAction]
  );

  const handlePermanentDelete = useCallback(
    (itemId) => handleAction(itemId, "delete", "DELETE"),
    [handleAction]
  );

  const handleViewItem = (item) => {
    setViewItem(item);
  };

  // Called when ManagerApprovalModal returns approval payload
  const onApprove = async (approvalPayload) => {
    setApprovalOpen(false);
    if (!pendingAction) return;
    const { itemId, actionType, method } = pendingAction;
    setActionLoading(itemId);
    try {
      const body = { itemId, ...approvalPayload };
      const response = await fetch(Endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw Object.assign(new Error(), { message: errorData.error || `HTTP error! Status: ${response.status}`, response });
      }
      setArchivedCafe((prev) => prev.filter((item) => item.id !== itemId));
      Swal.fire({
        ...notificationConfig,
        icon: 'success',
        title: actionType === 'restore' ? 'Updated' : 'Deleted',
        text: `${actionType === 'restore' ? 'Restored' : 'Deleted'} item.`,
      });
      // attempt to extract approver info from response if present
      const respJson = await response.json().catch(() => ({}));
      const approverEmail = respJson?.approverEmail || null;
      return { success: true, approverEmail };
    } catch (err) {
      handleError(err, `Failed to ${actionType === 'restore' ? 'restore' : 'delete'} item. Please try again.`);
      return { success: false, message: err?.message || 'Server error' };
    } finally {
      setActionLoading(null);
      setPendingAction(null);
    }
  };

  return (
    <div>
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mt-6">
          {loading ? (
            <div className="text-center py-4">Loading archived items...</div>
          ) : error ? (
            <div className="text-center py-4 text-red-500">{error}</div>
          ) : archivedCafe.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No archived cafe items found. Check back later!
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-300">
                <tr>
                  {[
                    { key: "id", label: "ID" },
                    { key: "name", label: "Item Name" },
                    { key: "category", label: "Category" },
                    { key: "quantity", label: "Quantity" },
                    { key: "unit", label: "Unit" },
                    { key: "on_delivery", label: "On Delivery" },
                    { key: "archived_at", label: "Archived Date" },
                    { key: null, label: "Actions" },
                  ].map(({ key, label }) => (
                    <th
                      key={key || label}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={key ? () => handleSort(key) : undefined}
                    >
                      <div className="flex items-center">
                        {label}
                        {key && sortConfig.key === key && (
                          <span className="ml-2">
                            {sortConfig.direction === "asc" ? (
                              <ArrowUpIcon className="h-4 w-4" />
                            ) : (
                              <ArrowDownIcon className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedCafe().map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.name || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.category || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.quantity || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.unit || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.on_delivery ? "✅" : "❎"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.archived_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewItem(item)}
                        className="text-blue-600 hover:text-blue-900 mr-4 disabled:opacity-50"
                        disabled={actionLoading === item.id}
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleRestore(item.id)}
                        className="text-blue-600 hover:text-blue-900 mr-4 disabled:opacity-50"
                        disabled={actionLoading === item.id}
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(item.id)}
                        className="text-red-600 hover:text-red-900 mr-4 disabled:opacity-50"
                        disabled={actionLoading === item.id}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {viewItem && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-[500px] text-gray-700">
            <h2 className="text-xl font-bold mb-3 text-blue-700">
              Item Details: {viewItem.name || "N/A"}
            </h2>
            <p><strong>ID:</strong> {viewItem.id}</p>
            <p><strong>Name:</strong> {viewItem.name || "N/A"}</p>
            <p><strong>Category:</strong> {viewItem.category || "N/A"}</p>
            <p><strong>Quantity:</strong> {viewItem.quantity || "N/A"}</p>
            <p><strong>Unit:</strong> {viewItem.unit || "N/A"}</p>
            <p><strong>Threshold:</strong> {viewItem.threshold || "N/A"}</p>
            <p><strong>Status:</strong> {viewItem.status || "N/A"}</p>
            <p><strong>On Delivery:</strong> {viewItem.on_delivery ? "✅" : "❎"}</p>
            <p><strong>Section:</strong> {viewItem.section || "N/A"}</p>
            <p><strong>Archived By:</strong> {viewItem.archived_by || "N/A"}</p>
            <p><strong>Reason for Archiving:</strong> {viewItem.reason_for_archiving || "N/A"}</p>
            <p><strong>Archived Date:</strong> {new Date(viewItem.archived_at).toLocaleDateString()}</p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setViewItem(null)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => handlePermanentDelete(viewItem.id)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                disabled={actionLoading === viewItem.id}
              >
                Delete
              </button>
              <button
                onClick={() => handleRestore(viewItem.id)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                disabled={actionLoading === viewItem.id}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
