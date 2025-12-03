"use client";

import { ArchiveBoxIcon, EyeIcon } from "@heroicons/react/24/outline";
import { XMarkIcon } from "@heroicons/react/24/outline"; // Explicit import for XIcon
import { useState, useEffect, useRef } from "react";
import ManagerApprovalModal from '../../../components/ManagerApprovalModal';

export default function ArchivedStaff() {
  const [archivedStaff, setArchivedStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notifTimeoutsRef = useRef(new Map());
  const lastNotifRef = useRef({ message: null, type: null, time: 0 });
  const [viewItem, setViewItem] = useState(null);

  const endpoint = "/api/archive/restore-staff?action=archived";

  // Add notification with deduplication and timeout tracking
  const addNotification = (message, type = "error", timeout = 5000) => {
    const now = Date.now();
    if (
      lastNotifRef.current.message === message &&
      lastNotifRef.current.type === type &&
      now - lastNotifRef.current.time < 1000
    ) {
      return;
    }
    lastNotifRef.current = { message, type, time: now };

    const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    setNotifications((prev) => [...prev, { id, message, type }]);
    const t = setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      notifTimeoutsRef.current.delete(id);
    }, timeout);
    notifTimeoutsRef.current.set(id, t);
  };

  const clearNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const t = notifTimeoutsRef.current.get(id);
    if (t) {
      clearTimeout(t);
      notifTimeoutsRef.current.delete(id);
    }
  };

  useEffect(() => {
    return () => {
      for (const t of notifTimeoutsRef.current.values()) {
        clearTimeout(t);
      }
      notifTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const fetchArchivedStaff = async () => {
      setLoading(true);
      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error: ${response.statusText}`);
        }
        const data = await response.json();
        // Deduplicate archived staff by original_id (or id) to avoid showing the same staff twice
        try {
          const map = new Map();
          (data || []).forEach((it) => {
            const key = it.original_id || it.id || JSON.stringify(it);
            if (!map.has(key)) map.set(key, it);
          });
          const unique = Array.from(map.values());
          setArchivedStaff(unique);
        } catch (e) {
          // fallback
          setArchivedStaff(data);
        }
        if (data.length === 0) {
          addNotification("No archived staff available", "info", 3000);
        }
      } catch (error) {
        console.error("Error fetching archived staff:", error);
        addNotification(`Failed to fetch archived staff: ${error.message || "Unknown error"}`);
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedStaff();
  }, []);

  const handleRestore = async (itemId) => {
    // Open approval modal instead of performing action directly
    const item = archivedStaff.find((item) => item.id === itemId);
    if (!item) {
      addNotification("Staff member not found");
      return;
    }
    setPendingAction({ id: itemId, endpoint: "/api/archive/restore-staff", method: "POST", type: "staff_restore" });
    setApprovalOpen(true);
  };

  const handleDelete = async (itemId) => {
    const item = archivedStaff.find((item) => item.id === itemId);
    if (!item) {
      addNotification("Staff member not found");
      return;
    }
    // Use the archive restore API's DELETE handler to permanently delete archived staff
    setPendingAction({ id: itemId, endpoint: "/api/archive/restore-staff", method: "DELETE", type: "staff_delete" });
    setApprovalOpen(true);
  };

  // Manager approval modal state and handler
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const onApprove = async (approvalPayload) => {
    setApprovalOpen(false);
    if (!pendingAction) return;
    setLoading(true);
    try {
      const { id, endpoint, method, type } = pendingAction;
      // For restore actions the API expects an explicit action='restore' in the POST body.
      // If we omit this, the route's POST handler falls into the create-user branch which
      // returns "Email and password are required". Include action for restore here.
      let body;
      if (method === 'POST' && type === 'staff_restore') {
        body = { action: 'restore', itemId: id, ...approvalPayload };
      } else {
        body = { itemId: id, ...approvalPayload };
      }
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error: ${response.statusText}`);
      }

      if (type === "staff_restore" || type === "staff_delete") {
        setArchivedStaff((prev) => prev.filter((it) => it.id !== id));
        if (viewItem && viewItem.id === id) setViewItem(null);
      }
      addNotification(`Operation completed successfully.`, "success", 3000);
      const respJson = await response.json().catch(() => ({}));
      return { success: true, approverEmail: respJson?.approverEmail || null };
    } catch (err) {
      console.error(err);
      addNotification(`Approved action failed: ${err.message || 'Unknown error'}`);
      return { success: false, message: err?.message || 'Server error' };
    } finally {
      setPendingAction(null);
      setLoading(false);
    }
  };

  const handleViewItem = (item) => {
    if (!item) {
      addNotification("Invalid staff member selected");
      return;
    }
    setViewItem(item);
  };

  return (
    <div className="p-4 sm:p-6">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`mb-4 p-4 rounded-lg flex justify-between items-center text-sm sm:text-base transition-opacity duration-300 ${
            notification.type === "success"
              ? "bg-blue-100 text-blue-800"
              : notification.type === "info"
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
              notification.type === "success"
                ? "text-blue-800"
                : notification.type === "info"
                ? "text-blue-800"
                : "text-red-800"
            }`}
            aria-label="Close notification"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ))}

      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <div className="mt-4 sm:mt-6">
          {loading ? (
            <div className="text-center py-4 text-sm sm:text-base text-gray-600">Loading...</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-blue-300">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Staff Name
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Archived Date
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-50 divide-y divide-gray-200">
                    {archivedStaff.map((item) => (
                      <tr key={item.id} className="bg-transparent">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.original_id || "N/A"}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.name || "N/A"}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.archived_at
                            ? new Date(item.archived_at).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleViewItem(item)}
                            disabled={loading}
                            className={`text-blue-600 hover:text-blue-900 mr-3 sm:mr-4 ${
                              loading ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                            aria-label="View staff details"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleRestore(item.id)}
                            disabled={loading}
                            className={`text-blue-600 hover:text-blue-900 mr-3 sm:mr-4 ${
                              loading ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                            aria-label="Restore staff"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={loading}
                            className={`text-red-600 hover:text-red-900 ${
                              loading ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                            aria-label="Delete staff permanently"
                          >
                            Delete Permanently
                          </button>
                        </td>
                      </tr>
                    ))}
                    {archivedStaff.length === 0 && (
                      <tr>
                        <td
                          colSpan="4"
                          className="px-4 sm:px-6 py-4 text-center text-sm text-gray-500"
                        >
                          No archived staff available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-200">
                {archivedStaff.map((item) => (
                  <div key={item.id} className="py-3 sm:py-4 bg-gray-50 rounded-md p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {item.name || "N/A"}
                        </div>
                        <div className="text-xs text-gray-500">ID: {item.original_id || "N/A"}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs sm:text-sm text-gray-600">
                      <p>
                        Archived Date:{" "}
                        {item.archived_at
                          ? new Date(item.archived_at).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleViewItem(item)}
                        disabled={loading}
                        className={`text-blue-600 hover:text-blue-900 text-sm ${
                          loading ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        aria-label="View staff details"
                      >
                        <EyeIcon className="h-5 w-5 inline mr-1" /> View
                      </button>
                      <button
                        onClick={() => handleRestore(item.id)}
                        disabled={loading}
                        className={`text-blue-600 hover:text-blue-900 text-sm ${
                          loading ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        aria-label="Restore staff"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={loading}
                        className={`text-red-600 hover:text-red-900 text-sm ${
                          loading ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        aria-label="Delete staff permanently"
                      >
                        Delete Permanently
                      </button>
                    </div>
                  </div>
                ))}
                {archivedStaff.length === 0 && (
                  <div className="py-4 text-center text-sm text-gray-500">
                    No archived staff available.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {viewItem && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white p-4 sm:p-6 rounded-lg w-full max-w-md text-gray-700">
            <h2 className="text-lg sm:text-xl font-bold mb-3 text-blue-700">
              Staff Details: {viewItem.name || "N/A"}
            </h2>
            <p className="text-sm">
              <strong>Original ID:</strong> {viewItem.original_id || "N/A"}
            </p>
            <p className="text-sm">
              <strong>Name:</strong> {viewItem.name || "N/A"}
            </p>
            <p className="text-sm">
              <strong>Archived Date:</strong>{" "}
              {viewItem.archived_at
                ? new Date(viewItem.archived_at).toLocaleDateString()
                : "N/A"}
            </p>
            {viewItem.email && (
              <p className="text-sm">
                <strong>Email:</strong> {viewItem.email}
              </p>
            )}
            {viewItem.role && (
              <p className="text-sm">
                <strong>Role:</strong> {viewItem.role}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setViewItem(null)}
                disabled={loading}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base ${
                  loading
                    ? "bg-red-400 text-white cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                Close
              </button>
              <button
                onClick={() => handleRestore(viewItem.id)}
                disabled={loading}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base ${
                  loading
                    ? "bg-blue-400 text-white cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Manager approval modal for privileged actions */}
      <ManagerApprovalModal open={approvalOpen} onClose={() => setApprovalOpen(false)} onApprove={onApprove} />
    </div>
  );
}
