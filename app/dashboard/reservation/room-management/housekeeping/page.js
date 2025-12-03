'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../context/AuthContext';
import Swal from 'sweetalert2';

const HousekeepingTable = ({
  rooms = [],
  initialHousekeepingStatus = {},
  initialHousekeepingNotes = {},
  onSave,
  userRole = '',
}) => {
  const [notifications, setNotifications] = useState([]);
  const [readyRooms, setReadyRooms] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isBellRinging, setIsBellRinging] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  // keep global loading for user actions; use separate lightweight refresh flags for polling to avoid UI blocking
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);
  const audioCtxRef = useRef(null);
  const prevCountRef = useRef(0);
  const notificationsRef = useRef([]);
  const readyRoomsRef = useRef([]);
  const pollingAbort = useRef(null);
  const isPollingRef = useRef(false);
  const userInteractedRef = useRef(false);
  const { token, isInitialized } = useAuth();
  const router = useRouter();

  // Local state for controlled inputs
  const [tempStatus, setTempStatus] = useState({});
  const [tempNotes, setTempNotes] = useState({});

  // Clear error after timeout
  useEffect(() => {
    let errorTimeout;
    if (error) {
      errorTimeout = setTimeout(() => setError(null), 5000);
    }
    return () => clearTimeout(errorTimeout);
      <div className="flex items-center gap-2">
        {!alertsEnabled ? (
          <button onClick={enableAlerts} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Enable Alerts</button>
        ) : (
          <button onClick={disableAlerts} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Disable Alerts</button>
        )}
      </div>
  }, [error]);

  // Define fetch functions
  const fetchNotifications = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return; // avoid work when tab is hidden
    if (isPollingRef.current) return; // avoid overlapping
    isPollingRef.current = true;
    setIsRefreshing(true);
    if (pollingAbort.current) pollingAbort.current.abort();
    pollingAbort.current = new AbortController();
    try {
      const role = 'Housekeeping';
      const response = await fetch(`/api/notifications?role=${role}`, { cache: 'no-store', signal: pollingAbort.current.signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: HTTP ${response.status}`);
      }
      const text = await response.text();
      let data = [];
      try {
        data = text ? JSON.parse(text) : [];
      } catch (parseErr) {
        console.warn('Notifications endpoint returned non-JSON or empty body', parseErr);
        data = [];
      }
      const validNotifications = (Array.isArray(data) ? data : []).filter(note => note && note.id != null);
      const notificationIds = validNotifications.map(note => note.id);
      const duplicateNotificationIds = notificationIds.filter(
        (id, index) => notificationIds.indexOf(id) !== index
      );
      if (duplicateNotificationIds.length > 0) {
        console.warn('Duplicate notification IDs found:', duplicateNotificationIds);
      }
      if (isMounted.current) {
        // shallow diff: only set state when ids have changed to prevent rerenders
        const prevIds = (notificationsRef.current || []).map(n => n.id).join(',');
        const newIds = notificationIds.join(',');
        if (prevIds !== newIds) {
          notificationsRef.current = validNotifications;
          setNotifications(validNotifications);
          if (validNotifications.length > 0) setIsBellRinging(true);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      if (isMounted.current) {
        setError(error.message || 'An unexpected error occurred while fetching notifications');
      }
    } finally {
      setIsRefreshing(false);
      isPollingRef.current = false;
    }
  }, []);

  const fetchReadyRooms = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return; // don't poll in background
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    setIsRefreshing(true);
    if (pollingAbort.current) pollingAbort.current.abort();
    pollingAbort.current = new AbortController();
    try {
      const response = await fetch('/api/housekeeping/by-status?status=pending', {
        cache: 'no-store',
        signal: pollingAbort.current.signal,
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch ready rooms: HTTP ${response.status}`);
      }
      const text = await response.text();
      let data = [];
      try {
        data = text ? JSON.parse(text) : [];
      } catch (parseErr) {
        console.warn('Housekeeping by-status endpoint returned non-JSON or empty body', parseErr);
        data = [];
      }
      const validReadyRooms = (Array.isArray(data) ? data : []).filter(room => room && room.room_id != null);
      const roomIds = validReadyRooms.map(room => room.room_id);
      const duplicateRoomIds = roomIds.filter(
        (id, index) => roomIds.indexOf(id) !== index
      );
      if (duplicateRoomIds.length > 0) {
        console.warn('Duplicate room_id values found in readyRooms:', duplicateRoomIds);
      }
      if (isMounted.current) {
        // only update when ids change
        const prevIds = (readyRoomsRef.current || []).map(r => r.room_id).join(',');
        const newIds = validReadyRooms.map(r => r.room_id).join(',');
        if (prevIds !== newIds) {
          readyRoomsRef.current = validReadyRooms;
          setReadyRooms(validReadyRooms);
          if (validReadyRooms.length > 0) setIsBellRinging(true);
        }
      }
    } catch (error) {
      console.error('Error fetching ready rooms:', error);
      if (isMounted.current) {
        setError(error.message || 'An unexpected error occurred while fetching ready rooms');
      }
    } finally {
      setIsRefreshing(false);
      isPollingRef.current = false;
    }
  }, []);

  // Initialize audio context on first user interaction (mobile autoplay policy)
  useEffect(() => {
    const onFirstInteract = () => {
      userInteractedRef.current = true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC && !audioCtxRef.current) {
          audioCtxRef.current = new AC();
        }
      } catch (err) {
        console.warn('AudioContext init failed', err);
      }
    };
    window.addEventListener('touchstart', onFirstInteract, { once: true });
    window.addEventListener('click', onFirstInteract, { once: true });
    return () => {
      window.removeEventListener('touchstart', onFirstInteract);
      window.removeEventListener('click', onFirstInteract);
    };
  }, []);

  // Play notification sound (short beep) using Web Audio API
  const playNotificationSound = () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AC();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 900; // Hz
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      // ramp up quickly
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      o.start();
      setTimeout(() => {
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.02);
        try { o.stop(ctx.currentTime + 0.03); } catch (e) {}
      }, 220);
    } catch (err) {
      console.warn('playNotificationSound failed', err);
    }
  };

  // Watch notifications and readyRooms for new items and trigger vibration/sound
  useEffect(() => {
    const total = (notifications?.length || 0) + (readyRooms?.length || 0);
    const prev = prevCountRef.current || 0;
    if (total > 0 && total > prev) {
      // new notifications arrived
      // try vibrate immediately (no gesture required on most phones)
      try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
      // play sound only if user has interacted (autoplay policy)
      if (userInteractedRef.current) {
        playNotificationSound();
        // show system notification if permission granted and service worker registered
        try {
          if (window.Notification && Notification.permission === 'granted' && navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.getRegistration().then(reg => {
              if (reg) {
                reg.showNotification('SRCB', { body: `You have ${total} housekeeping alert(s)`, vibrate: [200,100,200], tag: 'housekeeping' });
              }
            }).catch(() => {});
          }
        } catch (e) {}
      }
    }
    prevCountRef.current = total;
  }, [notifications, readyRooms]);

  // Detect saved alerts preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('housekeeping_alerts_enabled');
      setAlertsEnabled(saved === 'true');
    } catch (e) {}
  }, []);

  // Register service worker and request permission
  const enableAlerts = async () => {
    try {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js');
      }
    } catch (e) {
      console.warn('Service worker registration failed', e);
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setAlertsEnabled(true);
        try { localStorage.setItem('housekeeping_alerts_enabled', 'true'); } catch (e) {}
        // Trigger a brief vibration/sound to confirm
        try { if (navigator.vibrate) navigator.vibrate([100,50,100]); } catch (e) {}
        if (userInteractedRef.current) playNotificationSound();
      } else {
        setAlertsEnabled(false);
        try { localStorage.setItem('housekeeping_alerts_enabled', 'false'); } catch (e) {}
      }
    } catch (e) {
      console.warn('Notification permission request failed', e);
    }
  };

  const disableAlerts = () => {
    setAlertsEnabled(false);
    try { localStorage.setItem('housekeeping_alerts_enabled', 'false'); } catch (e) {}
  };

  // Initialize temp state
  useEffect(() => {
    setTempStatus(initialHousekeepingStatus);
    setTempNotes(initialHousekeepingNotes);
  }, [initialHousekeepingStatus, initialHousekeepingNotes]);

  // Fetch notifications and rooms, and handle bell animation
  useEffect(() => {
    isMounted.current = true;

    // initial fetch only when visible
    if (!document.hidden) {
      fetchNotifications();
      fetchReadyRooms();
    }

    const interval = setInterval(() => {
      if (!isMounted.current) return;
      if (typeof document !== 'undefined' && document.hidden) return; // pause polling when tab hidden
      fetchNotifications();
      fetchReadyRooms();
    }, 30000);

    const ringTimeout = setTimeout(() => {
      if (isMounted.current) {
        setIsBellRinging(false);
      }
    }, 5000);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
      clearTimeout(ringTimeout);
    };
  }, [fetchNotifications, fetchReadyRooms]);

  // Handle clicking the notification bell to toggle dropdown
  const handleBellClick = () => {
    setIsDropdownOpen(!isDropdownOpen);
    setIsBellRinging(false);
  };

  // Handle marking all notifications as read
  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0) return;

    setIsRefreshing(true);
    setError(null);

    try {
      if (!isInitialized) return;
      if (!token) {
        setError('Authentication token not found. Please log in.');
        router.push('/components/sign-in');
        setIsLoading(false);
        return;
      }

      const responses = await Promise.all(
        notifications.map(note =>
          fetch(`/api/notifications`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ id: note.id, status: 'read' }),
          })
        )
      );

      const failed = responses.some(res => !res.ok);
      if (failed) {
        throw new Error('Failed to mark some notifications as read');
      }

      if (isMounted.current) {
        setNotifications([]);
        setIsDropdownOpen(false);
        setIsBellRinging(false);
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'All notifications marked as read',
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      if (isMounted.current) {
        setError(error.message || 'An unexpected error occurred while marking notifications as read');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Dismiss a single notification (mark as read)
  const handleDismissNotification = async (id) => {
    if (!id) return;
    setIsRefreshing(true);
    try {
      if (!isInitialized) return;
      if (!token) {
        setError('Authentication token not found. Please log in.');
        router.push('/components/sign-in');
        setIsLoading(false);
        return;
      }
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status: 'read' }),
      });
      if (!res.ok) {
        const err = await safeJson(res).catch(() => ({}));
        throw new Error(err?.error || 'Failed to dismiss notification');
      }
      // remove from local state
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error dismissing notification:', error);
      setError(error.message || 'Failed to dismiss notification');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Validate and handle status change
  const handleStatusChange = (roomId, status) => {
    if (!['pending', 'in_progress', 'completed', 'inspected', 'Available'].includes(status)) {
      setError('Invalid status selected');
      return;
    }
    setTempStatus(prev => ({
      ...prev,
      [roomId]: status,
    }));
    setError(null);
  };

  // Handle notes change
  const handleNotesChange = (roomId, notes) => {
    setTempNotes(prev => ({
      ...prev,
      [roomId]: notes.trim(),
    }));
    setError(null);
  };

  // Handle save action
  const handleSave = async (roomId) => {
    setError(null);
    setIsLoading(true);

    try {
      const status = tempStatus[roomId] || 'pending';
      const notes = tempNotes[roomId] || '';

      if (!status) {
        throw new Error('Housekeeping status is required');
      }

      if (typeof onSave === 'function') {
        await onSave(roomId, status, notes);
        if (isMounted.current && (status === 'Available' || status === 'completed')) {
          setReadyRooms(prev => prev.filter(room => room.room_id !== roomId));
        }
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Room status updated successfully',
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: false,
        });
      } else {
        throw new Error('Save handler not available');
      }
    } catch (error) {
      console.error('Error saving room status:', error);
      if (isMounted.current) {
        setError(error.message || 'An unexpected error occurred while saving room status');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available':
        return 'bg-green-100 text-green-800';
      case 'Occupied':
        return 'bg-red-100 text-red-800';
      case 'Maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'Housekeeping':
        return 'bg-purple-100 text-purple-800';
      case 'pending':
        return 'bg-purple-100 text-purple-800';
      case 'in_progress':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'inspected':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Validate rooms and check for duplicate IDs
  // For housekeeping role, only show rooms that need cleaning (pending, in_progress, or inspected status)
  const isHousekeepingRole = (userRole || '').toLowerCase() === 'housekeeping';
  
  const validRooms = rooms.filter(room => {
    if (room.id == null) return false;
    
    // If user is housekeeping, only show rooms that need cleaning
    if (isHousekeepingRole) {
      const status = (initialHousekeepingStatus[room.id] || '').toLowerCase();
      // Show rooms with pending, in_progress, or inspected status (needs cleaning or in process)
      // Don't show completed rooms or rooms with no status
      return status === 'pending' || status === 'in_progress' || status === 'inspected';
    }
    
    // For other roles (admin, manager), show all rooms
    return true;
  });
  
  const roomIds = validRooms.map(room => room.id);
  const duplicateRoomIds = roomIds.filter((id, index) => roomIds.indexOf(id) !== index);
  if (duplicateRoomIds.length > 0) {
    console.warn('Duplicate room IDs found in rooms prop:', duplicateRoomIds);
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden mb-6 dark:bg-white-800">
      {/* Notifications */}
      {error && (
        <div className="mb-4 flex items-center gap-3 p-4 bg-red-100 rounded-lg shadow-sm border border-red-200 animate-in fade-in slide-in-from-top-2 duration-300">
          <svg
            className="h-6 w-6 text-red-600"
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
          <p className="text-red-800 font-medium">{error}</p>
        </div>
      )}
      {isLoading && (
        <div className="mb-4 flex items-center gap-3 p-4 bg-blue-100 rounded-lg shadow-sm border border-blue-200 animate-pulse">
          <svg
            className="h-6 w-6 text-blue-600 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 12a8 8 0 0116 0 8 8 0 01-16 0"
            />
          </svg>
          <p className="text-blue-800 font-medium">Processing...</p>
        </div>
      )}

      {/* Info message for housekeeping staff */}
      {isHousekeepingRole && (
        <div className="mb-4 flex items-center gap-3 p-4 bg-blue-50 rounded-lg shadow-sm border border-blue-200">
          <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-blue-800 font-medium">
            Showing only rooms that need cleaning (Pending, In Progress, or Inspected status)
          </p>
        </div>
      )}

        {/* Notifications moved to header - header will render bell and alerts */}
      {/* Responsive layout: table on md+ screens, stacked cards on small screens */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
          <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
            {/* Desktop / larger screens: keep existing table */}
            <div className="hidden md:block">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-blue-100 text-left text-white dark:bg-blue-700 dark:text-white">>
                  <tr>
                    <th className="p-3 font-semibold">Room Number</th>
                    <th className="p-3 font-semibold">Room Status</th>
                    <th className="p-3 font-semibold">Housekeeping Status</th>
                    <th className="p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {validRooms.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-6 text-center text-gray-500">
                        {isLoading ? 'Loading rooms...' : isHousekeepingRole ? 'No rooms need cleaning at this time' : 'No rooms available'}
                      </td>
                    </tr>
                  ) : (
                    validRooms.map((room, index) => (
                      <tr
                        key={`${room.id}-${index}`}
                        className="border-t border-gray-200 hover:bg-gray-50 dark:border-gray-200 dark:hover:bg-gray-200"
                      >
                        <td className="p-3 text-black dark:text-black">{room.room_number}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              room.status
                            )} dark:bg-opacity-30`}
                          >
                            {room.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <select
                            value={tempStatus[room.id] || 'pending'}
                            onChange={(e) => handleStatusChange(room.id, e.target.value)}
                            className={`p-2 border rounded text-gray-700 focus:ring-2 focus:ring-blue-500 dark:bg-white dark:text-black dark:border-white0 dark:focus:ring-blue-400 ${
                              isLoading ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            disabled={isLoading}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="inspected">Inspected</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleSave(room.id)}
                            className={`bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 ${
                              isLoading ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            disabled={isLoading}
                          >
                            {isLoading ? 'Saving...' : 'Save'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile / small screens: stacked cards */}
            <div className="block md:hidden space-y-3 px-2">
              {validRooms.length === 0 ? (
                <div className="p-3 text-center text-black dark:text-black">
                  {isLoading ? 'Loading rooms...' : isHousekeepingRole ? 'No rooms need cleaning at this time' : 'No rooms available'}
                </div>
              ) : (
                validRooms.map((room, index) => (
                  <div
                    key={`${room.id}-mobile-${index}`}
                    className="border rounded-lg p-3 bg-white shadow-sm dark:bg-white-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-800 dark:text-black">Room {room.room_number}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-600">{room.room_type || ''}</div>
                      </div>
                      <div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>
                          {room.status}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-600">Housekeeping Status</label>
                      <select
                        value={tempStatus[room.id] || 'pending'}
                        onChange={(e) => handleStatusChange(room.id, e.target.value)}
                        className={`w-full p-3 border rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 dark:bg-white dark:text-black ${
                          isLoading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        disabled={isLoading}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="inspected">Inspected</option>
                        <option value="Available">Available</option>
                      </select>

                      <label className="block text-xs font-medium text-gray-600">Notes</label>
                      <input
                        type="text"
                        value={tempNotes[room.id] || ''}
                        onChange={(e) => handleNotesChange(room.id, e.target.value)}
                        className={`w-full p-3 border rounded-lg text-black focus:ring-2 focus:ring-blue-500 dark:bg-gray-300 dark:text-black ${
                          isLoading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        placeholder="Add notes..."
                        disabled={isLoading}
                      />

                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => handleSave(room.id)}
                          className={`mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 ${
                            isLoading ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          disabled={isLoading}
                        >
                          {isLoading ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HousekeepingTable;
