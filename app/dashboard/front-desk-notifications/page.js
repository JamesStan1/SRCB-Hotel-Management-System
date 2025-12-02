"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  BellAlertIcon, 
  CheckCircleIcon,
  ClockIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function FrontDeskNotifications() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!token) {
      console.warn('No token available for fetching notifications');
      setError('Authentication required. Please sign in.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/front-desk-notifications?status=ready', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: Failed to fetch notifications`);
      }
      
      const data = await response.json();
      const newNotifications = data.notifications || [];
      
      // Play sound if new notifications arrived
      if (audioEnabled && newNotifications.length > notifications.length) {
        playNotificationSound();
      }
      
      setNotifications(newNotifications);
      setError(null);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (token) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [token, audioEnabled]);

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log('Audio play failed:', e));
    } catch (e) {
      console.log('Audio not available:', e);
    }
  };

  // Mark as served
  const handleMarkServed = async (orderId) => {
    if (!orderId) {
      console.warn('handleMarkServed called without orderId');
      alert('Error: No order ID provided');
      return;
    }

    if (!token) {
      alert('Error: Authentication required. Please sign in again.');
      return;
    }

    // Prevent double submissions for the same order
    if (processingId === orderId) return;
    setProcessingId(orderId);

    try {
      console.log('Marking order as served, id=', orderId);
      const response = await fetch('/api/front-desk-notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: orderId })
      });

      // Try to parse JSON safely
      let data = null;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (parseErr) {
          console.error('Failed to parse response JSON', parseErr);
          throw new Error('Server returned invalid JSON response');
        }
      } else {
        const textResponse = await response.text();
        console.error('Non-JSON response:', textResponse);
        throw new Error('Server returned non-JSON response');
      }

      if (!response.ok) {
        const serverMessage = data?.error || data?.message || data?.details || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(serverMessage);
      }

      console.log('Order marked served successfully:', data);

      // Reload notifications after successful update
      await fetchNotifications();
      
    } catch (err) {
      console.error('Failed to update order status:', err);
      // Show a more descriptive message to the user
      alert(`Failed to mark order as served:\n${err.message || 'Unknown error occurred'}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Mark all as read (served)
  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0) return;
    
    if (!token) {
      alert('Error: Authentication required. Please sign in again.');
      return;
    }
    
    const confirmed = window.confirm(
      `Are you sure you want to mark all ${notifications.length} order(s) as served?`
    );
    
    if (!confirmed) return;

    try {
      const response = await fetch('/api/front-desk-notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ markAll: true })
      });

      let data = null;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (parseErr) {
          console.error('Failed to parse response JSON', parseErr);
          throw new Error('Server returned invalid JSON response');
        }
      } else {
        const textResponse = await response.text();
        console.error('Non-JSON response:', textResponse);
        throw new Error('Server returned non-JSON response');
      }

      if (!response.ok) {
        const serverMessage = data?.error || data?.message || data?.details || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(serverMessage);
      }
      
      // Reload notifications after action
      await fetchNotifications();
      
      // Show success message
      alert(`Successfully marked ${data.count || 0} order(s) as served`);
    } catch (err) {
      console.error('Failed to mark all orders as served:', err);
      alert(`Failed to mark all orders as served:\n${err.message || 'Unknown error occurred'}`);
    }
  };

  // Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Get time elapsed
  const getTimeElapsed = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const orderTime = new Date(timestamp);
    const diffMs = now - orderTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const hours = Math.floor(diffMins / 60);
    return `${hours}h ${diffMins % 60}m ago`;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <BellAlertIcon className="h-8 w-8 text-emerald-600" />
            Front Desk Notifications
          </h1>
          <p className="text-gray-600 mt-1">Food orders ready for pickup and serving</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Mark All as Read Button */}
          {notifications.length > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2 font-semibold"
            >
              <CheckCircleIcon className="h-5 w-5" />
              Mark All as Read
            </button>
          )}

          {/* Audio Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={audioEnabled}
              onChange={(e) => setAudioEnabled(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700">Sound Alerts</span>
          </label>

          {/* Manual Refresh */}
          <button
            onClick={fetchNotifications}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            <svg className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Notification Count */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-3 rounded-full">
            <BellAlertIcon className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {notifications.length}
            </div>
            <div className="text-sm text-gray-600">
              {notifications.length === 1 ? 'Order Ready' : 'Orders Ready'}
            </div>
          </div>
        </div>
        
        {notifications.length > 0 && (
          <div className="animate-pulse">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold">
              <ClockIcon className="h-5 w-5" />
              Awaiting Pickup
            </span>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Notifications List */}
      {loading && notifications.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <CheckCircleIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">All Clear!</h3>
          <p className="text-gray-600">
            No orders waiting for pickup. New notifications will appear here when food is ready.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Auto-refreshing every 10 seconds
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notifications.map((notification) => {
            let items = notification.items;
            if (typeof items === 'string') {
              try {
                items = JSON.parse(items);
              } catch (e) {
                console.warn('Failed to parse notification.items JSON for id=', notification.id, e);
                items = [];
              }
            }
            
            return (
              <div
                key={notification.id}
                className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow border-l-4 border-orange-500 animate-fadeIn"
              >
                {/* Notification Header */}
                <div className="p-4 bg-orange-50 border-b border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-orange-700">
                      Invoice: {notification.invoice_id}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-500 text-white flex items-center gap-1 animate-pulse">
                      🔔 READY
                    </span>
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    {notification.customer_name || 'Guest'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                    <ClockIcon className="h-4 w-4" />
                    Ready: {formatTime(notification.completed_time)} 
                    <span className="text-orange-600 font-semibold">
                      ({getTimeElapsed(notification.completed_time)})
                    </span>
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Order Items:</h4>
                  <ul className="space-y-1">
                    {items.map((item, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex justify-between">
                        <span>{item.name}</span>
                        <span className="font-semibold">x{item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <button
                    onClick={() => handleMarkServed(notification.id)}
                    disabled={processingId === notification.id}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition font-semibold ${processingId === notification.id ? 'bg-emerald-400 text-white cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                  >
                    <CheckCircleIcon className="h-5 w-5" />
                    {processingId === notification.id ? 'Processing...' : 'Mark as Served'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <div className="flex items-center justify-center gap-2">
          <div className="animate-pulse w-2 h-2 bg-emerald-500 rounded-full"></div>
          <span>Auto-refreshing every 10 seconds</span>
        </div>
      </div>

      {/* Custom animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
