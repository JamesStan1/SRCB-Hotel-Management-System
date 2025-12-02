"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { EyeIcon } from "@heroicons/react/24/outline";
import ManagerApprovalModal from '../../../components/ManagerApprovalModal';

export default function ArchivedCafe() {
  const [archivedCafe, setArchivedCafe] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const notifTimeoutsRef = useRef(new Map());
  const lastNotifRef = useRef({ message: null, type: null, time: 0 });
  const [viewItem, setViewItem] = useState(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const Endpoint = "/api/archive/restore-cafe";
  const DeleteEndpoint = "/api/archive/delete-cafe";

  // Add notification to queue (deduplicate identical messages in a short window)
  const addNotification = useCallback((type, message, duration = 3000) => {
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
    setNotifications(prev => [...prev, { id, type, message }]);

    const t = setTimeout(() => {
      setNotifications(prev => prev.filter(notif => notif.id !== id));
      notifTimeoutsRef.current.delete(id);
    }, duration);

    notifTimeoutsRef.current.set(id, t);
  }, []);

  // Clear specific notification and its timeout
  const clearNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
    const t = notifTimeoutsRef.current.get(id);
    if (t) {
      clearTimeout(t);
      notifTimeoutsRef.current.delete(id);
    }
  }, []);

  // Cleanup timeouts on unmount
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

  // Fetch archived cafe items
  const fetchArchivedCafe = useCallback(async () => {
    setLoading(true);
    setErrorState(null);
    try {
      const response = await fetch(Endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          response.status === 401 ? 'Unauthorized: Please log in to access archived cafe items.' :
          response.status === 400 ? (errorData.error || 'Invalid request parameters.') :
          `HTTP ${response.status}: Failed to fetch archived cafe items.`
        );
      }

      const data = await response.json();
      const formattedData = Array.isArray(data) ? data.map(item => ({
        ...item,
        price: parseFloat(item.price) || 0,
        is_available: item.is_available === true || item.is_available === 'true',
        archived_at: item.archived_at || item.archived_date,
      })) : [];
      
      setArchivedCafe(formattedData);
      if (formattedData.length === 0) {
        addNotification('info', 'No archived cafe items found.');
      } else {
        addNotification('success', 'Archived cafe items loaded successfully!');
      }
    } catch (error) {
      handleApiError(error, 'fetching archived cafe items');
      setArchivedCafe([]);
    } finally {
      setLoading(false);
    }
  }, [addNotification, handleApiError]);

  useEffect(() => {
    fetchArchivedCafe();
  }, [fetchArchivedCafe]);

  // Handle restore item
  const handleRestore = useCallback((itemId) => {
    const item = archivedCafe.find((item) => item.id === itemId);
    const itemName = item?.name || "this dish";
    const confirm = window.confirm(`Are you sure you want to restore "${itemName}"?`);
    if (!confirm) {
      addNotification('info', 'Restore operation cancelled.');
      return;
    }
    // Open approval modal; actual request is performed after approval
    setPendingAction({ itemId, type: 'restore', endpoint: Endpoint, method: 'POST' });
    setApprovalOpen(true);
  }, [archivedCafe, addNotification]);

  // Handle delete item
  const handleDelete = useCallback((itemId) => {
    const item = archivedCafe.find((item) => item.id === itemId);
    const itemName = item?.name || "this dish";
    const confirm = window.confirm(`Are you sure you want to permanently delete "${itemName}"? This action cannot be undone.`);
    if (!confirm) {
      addNotification('info', 'Delete operation cancelled.');
      return;
    }
    // Open approval modal; actual request is performed after approval
    setPendingAction({ itemId, type: 'delete', endpoint: DeleteEndpoint, method: 'DELETE' });
    setApprovalOpen(true);
  }, [archivedCafe, addNotification]);

  // called after manager approval modal supplies payload
  const onApprove = async (approvalPayload) => {
    if (!pendingAction) return;
    const { itemId, endpoint, method, type } = pendingAction;
    setApprovalOpen(false);
    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemId, ...approvalPayload }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Operation failed`);
      }
      setArchivedCafe(prev => prev.filter(i => i.id !== itemId));
      if (viewItem?.id === itemId) setViewItem(null);
      addNotification('success', `${type === 'restore' ? 'Restored' : 'Deleted'} successfully.`);
      const respJson = await response.json().catch(() => ({}));
      return { success: true, approverEmail: respJson?.approverEmail || null };
    } catch (e) {
      handleApiError(e, `${type} cafe item`);
      return { success: false, message: e?.message || 'Server error' };
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  // Handle view item
  const handleViewItem = useCallback((item) => {
    try {
      setViewItem(item);
      addNotification('info', `Viewing details for ${item.name || 'dish'}.`);
    } catch (error) {
      handleApiError(error, 'viewing cafe item details');
    }
  }, [addNotification, handleApiError]);

  // Retry fetch
  const retryFetch = useCallback(() => {
    setErrorState(null);
    setNotifications([]);
    fetchArchivedCafe();
  }, [fetchArchivedCafe]);

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
            disabled={loading}
          >
            {loading ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <h2 className="text-xl font-bold text-green-700">Archived Cafe Items</h2>
        </div>
        <div className="mt-6">
          {loading ? (
            <div className="text-center py-4 text-gray-600">Loading archived cafe items...</div>
          ) : archivedCafe.length === 0 && !errorState ? (
            <div className="text-center py-4 text-gray-500">No archived cafe items available.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-green-300">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dish Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Archived Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {archivedCafe.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.id || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.name || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.category || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.archived_at
                        ? new Date(item.archived_at).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewItem(item)}
                        className="text-blue-600 hover:text-blue-900 mr-4 disabled:opacity-50"
                        title="View Details"
                        disabled={loading}
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleRestore(item.id)}
                        className="text-green-600 hover:text-green-900 mr-4 disabled:opacity-50"
                        title="Restore Dish"
                        disabled={loading}
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        title="Delete Permanently"
                        disabled={loading}
                      >
                        Delete
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
            <h2 className="text-xl font-bold mb-3 text-green-700">
              Dish Details: {viewItem.name || "N/A"}
            </h2>
            <p><strong>ID:</strong> {viewItem.id || 'N/A'}</p>
            <p><strong>Name:</strong> {viewItem.name || "N/A"}</p>
            <p><strong>Category:</strong> {viewItem.category || "N/A"}</p>
            <p><strong>Price:</strong> ₱{Number(viewItem.price || 0).toFixed(2)}</p>
            <p><strong>Description:</strong> {viewItem.description || "N/A"}</p>
            <p><strong>Available:</strong> {viewItem.is_available ? "Yes" : "No"}</p>
            <p><strong>Archived Date:</strong> {viewItem.archived_at
              ? new Date(viewItem.archived_at).toLocaleDateString()
              : 'N/A'}</p>
            {viewItem.photo_url && (
              <p><strong>Photo:</strong> <a href={viewItem.photo_url} target="_blank" className="text-blue-600">View Image</a></p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setViewItem(null);
                  addNotification('info', 'Closed dish details.');
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                disabled={loading}
              >
                Close
              </button>
              <button
                onClick={() => handleDelete(viewItem.id)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                disabled={loading}
              >
                Delete
              </button>
              <button
                onClick={() => handleRestore(viewItem.id)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                disabled={loading}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
      <ManagerApprovalModal open={approvalOpen} onClose={() => setApprovalOpen(false)} onApprove={onApprove} />
    </div>
  );
}
