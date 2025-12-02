"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ManagerApprovalModal from '../../../../components/ManagerApprovalModal';
import { useAuth } from '../../../../context/AuthContext';
import { EyeIcon } from "@heroicons/react/24/outline";
import Swal from "sweetalert2";

export default function ArchivedEvents() {
  const [archivedEvents, setArchivedEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const notifTimeoutsRef = useRef(new Map());
  const lastNotifRef = useRef({ message: null, type: null, time: 0 });
  const [viewItem, setViewItem] = useState(null);

  // Get user role and determine if it's Security
  const { user } = useAuth();
  const role = user?.role || '';
  const isSecurity = (role || '').toLowerCase() === 'security';

  // Define the endpoint for all operations
  const endpoint = "/api/archive/restore-event";

  // Add notification to queue (deduplicates rapid identical notifications)
  const addNotification = useCallback((type, message, duration = 3000) => {
    const now = Date.now();
    // skip if identical notification was added very recently (1s)
    if (
      lastNotifRef.current.message === message &&
      lastNotifRef.current.type === type &&
      now - lastNotifRef.current.time < 1000
    ) {
      return;
    }
    lastNotifRef.current = { message, type, time: now };

    const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    setNotifications((prev) => [...prev, { id, type, message }]);

    const t = setTimeout(() => {
      setNotifications((prev) => prev.filter((notif) => notif.id !== id));
      notifTimeoutsRef.current.delete(id);
    }, duration);

    notifTimeoutsRef.current.set(id, t);
  }, []);

  // Clear specific notification (also clears its timeout)
  const clearNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    const t = notifTimeoutsRef.current.get(id);
    if (t) {
      clearTimeout(t);
      notifTimeoutsRef.current.delete(id);
    }
  }, []);

  // Clear pending timeouts on unmount
  useEffect(() => {
    return () => {
      for (const t of notifTimeoutsRef.current.values()) {
        clearTimeout(t);
      }
      notifTimeoutsRef.current.clear();
    };
  }, []);

  // Handle API errors
  const handleApiError = useCallback((error, context) => {
    console.error(`Error in ${context}:`, error);
    let message = 'An unexpected error occurred. Please try again.';
    
    if (error.message.includes('Unauthorized')) {
      message = 'Please log in to access this feature.';
    } else if (error.message.includes('NetworkError')) {
      message = 'Network error. Please check your internet connection.';
    } else if (error.message) {
      message = error.message;
    }
    
    setErrorState({ context, message });
    addNotification('error', message);
    return message;
  }, [addNotification]);

  // Fetch archived events
  const fetchArchivedEvents = useCallback(async () => {
    setLoading(true);
    setErrorState(null);
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          response.status === 401 ? 'Unauthorized: Please log in to access archived events.' :
          response.status === 400 ? (errorData.error || 'Invalid request parameters.') :
          errorData.error || `HTTP ${response.status}: Failed to fetch archived events.`
        );
      }

      const data = await response.json();
      setArchivedEvents(Array.isArray(data) ? data : []);
      if (data.length === 0) {
        addNotification('info', 'No archived events found.');
      } else {
        addNotification('success', 'Archived events loaded successfully!');
      }
    } catch (error) {
      handleApiError(error, 'fetching archived events');
      setArchivedEvents([]);
    } finally {
      setLoading(false);
    }
  }, [addNotification, handleApiError]);

  useEffect(() => {
    fetchArchivedEvents();
  }, [fetchArchivedEvents]);

  // Handle restore event
  const handleRestore = useCallback(async (eventId) => {
    const event = archivedEvents.find((event) => event.id === eventId);
    const eventName = event?.name || "this event";

    const result = await Swal.fire({
      title: "Restore Event?",
      text: `This will restore the archived ${eventName}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Restore",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      customClass: {
        confirmButton:
          "bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg ml-2 transition-colors",
        cancelButton:
          "bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg mr-2 transition-colors",
      },
      buttonsStyling: false,
    });

    if (result.isConfirmed) {
      // open approval modal and set pending action
      setPendingAction({ id: eventId, endpoint, method: 'POST', type: 'event_restore' });
      setApprovalOpen(true);
    } else if (result.dismiss === Swal.DismissReason.cancel) {
      addNotification('info', 'Restore operation cancelled.');
    }
  }, [archivedEvents, addNotification, handleApiError]);

  // Handle delete event
  const handleDelete = useCallback(async (eventId) => {
    const event = archivedEvents.find((event) => event.id === eventId);
    const eventName = event?.name || "this event";

    const result = await Swal.fire({
      title: "Delete Event?",
      text: `This will permanently delete the archived ${eventName}. This action cannot be undone!`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      customClass: {
        confirmButton:
          "bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg ml-2 transition-colors",
        cancelButton:
          "bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg mr-2 transition-colors",
      },
      buttonsStyling: false,
    });

    if (result.isConfirmed) {
        // open approval modal for delete
        setPendingAction({ id: eventId, endpoint, method: 'DELETE', type: 'event_delete' });
        setApprovalOpen(true);
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        addNotification('info', 'Delete operation cancelled.');
      }
  }, [archivedEvents, addNotification, handleApiError]);

  // Handle view item
  const handleViewItem = useCallback((item) => {
    try {
      setViewItem(item);
      addNotification('info', `Viewing details for ${item.name || 'event'}.`);
    } catch (error) {
      handleApiError(error, 'viewing event details');
    }
  }, [addNotification, handleApiError]);

  // Retry fetch
  const retryFetch = useCallback(() => {
    setErrorState(null);
    setNotifications([]);
    fetchArchivedEvents();
  }, [fetchArchivedEvents]);

  // Manager approval modal state and handler
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const onApprove = async (approvalPayload) => {
    setApprovalOpen(false);
    if (!pendingAction) return;
    setLoading(true);
    try {
      const { id, endpoint, method, type } = pendingAction;
      const body = { itemId: id, ...approvalPayload };
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Operation failed.`);
      }

      if (type === 'event_restore' || type === 'event_delete') {
        setArchivedEvents((prev) => prev.filter((ev) => ev.id !== id));
        addNotification('success', 'Operation completed successfully.');
      }
      const respJson = await response.json().catch(() => ({}));
      return { success: true, approverEmail: respJson?.approverEmail || null };
    } catch (err) {
      handleApiError(err, 'approved action');
      return { success: false, message: err?.message || 'Server error' };
    } finally {
      setPendingAction(null);
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="mb-6 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-center justify-between gap-3 p-4 rounded-lg shadow-sm border transition-opacity duration-300 ${
                notification.type === 'success' ? 'bg-green-100 border-green-300' :
                notification.type === 'error' ? 'bg-red-100 border-red-300' :
                'bg-blue-100 border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {notification.type === 'success' ? (
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : notification.type === 'error' ? (
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <p className={`font-medium ${
                  notification.type === 'success' ? 'text-green-800' :
                  notification.type === 'error' ? 'text-red-800' :
                  'text-blue-800'
                }`}>
                  {notification.message}
                </p>
              </div>
              <button
                onClick={() => clearNotification(notification.id)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close notification"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error State with Retry */}
      {errorState && (
        <div className="mb-6 flex flex-col items-center gap-4">
          <p className="text-red-600 font-medium">{errorState.message}</p>
          <button
            onClick={retryFetch}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="mt-6">
          {loading ? (
            <div className="text-center py-4 text-gray-600">Loading archived events...</div>
          ) : archivedEvents.length === 0 && !errorState ? (
            <div className="text-center py-4 text-gray-500">No archived events available.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Archived Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {archivedEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {event.id || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {event.name || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {event.archived_at || event.archived_date
                        ? new Date(event.archived_at || event.archived_date).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {event.type || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewItem(event)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                        title="View Details"
                        disabled={loading}
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>
                      {!isSecurity && (
                        <>
                          <button
                            onClick={() => handleRestore(event.id)}
                            className="text-green-600 hover:text-green-900 mr-4"
                            title="Restore Event"
                            disabled={loading}
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => handleDelete(event.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Permanently"
                            disabled={loading}
                          >
                            Delete Permanently
                          </button>
                        </>
                      )}
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
            <h2 className="text-xl font-bold mb-3 text-green-700">
              Event Details: {viewItem.name || "N/A"}
            </h2>
            <p>
              <strong>ID:</strong> {viewItem.id || 'N/A'}
            </p>
            <p>
              <strong>Name:</strong> {viewItem.name || "N/A"}
            </p>
            <p>
              <strong>Type:</strong> {viewItem.type || "N/A"}
            </p>
            <p>
              <strong>Archived Date:</strong>{" "}
              {viewItem.archived_at || viewItem.archived_date
                ? new Date(viewItem.archived_at || viewItem.archived_date).toLocaleDateString()
                : 'N/A'}
            </p>
            {viewItem.description && (
              <p>
                <strong>Description:</strong> {viewItem.description}
              </p>
            )}
            {viewItem.date && (
              <p>
                <strong>Event Date:</strong>{" "}
                {new Date(viewItem.date).toLocaleDateString()}
              </p>
            )}
            {viewItem.guests && (
              <p>
                <strong>Guests:</strong> {viewItem.guests}
              </p>
            )}
            {viewItem.booked_by && (
              <p>
                <strong>Booked By:</strong> {viewItem.booked_by}
              </p>
            )}
            {viewItem.supervisor && (
              <p>
                <strong>Supervisor:</strong> {viewItem.supervisor}
              </p>
            )}
            {viewItem.total_cost && (
              <p>
                <strong>Total Cost:</strong> ₱{parseFloat(viewItem.total_cost).toFixed(2)}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setViewItem(null)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
                disabled={loading}
              >
                Close
              </button>
              {!isSecurity && (
                <button
                  onClick={() => handleRestore(viewItem.id)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                  disabled={loading}
                >
                  Restore
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <ManagerApprovalModal open={approvalOpen} onClose={() => setApprovalOpen(false)} onApprove={onApprove} />
    </div>
  );
}

