'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { can, Permissions, Roles } from '../../lib/rbac';
import Swal from 'sweetalert2';

export default function HousekeepingPage() {
  const { user, token, isInitialized } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending'); // 'all', 'pending', 'in_progress', 'completed'
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'room_number', direction: 'asc' });
  const [editingRoom, setEditingRoom] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const isMounted = useRef(true);

  const role = user?.role || '';
  const canManageHousekeeping = can(role, Permissions.Housekeeping, 'manage');
  const isFrontDesk = role && String(role).toLowerCase() === String(Roles.FrontDesk).toLowerCase();

  // Print function for room cleaning list
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      Swal.fire({
        title: 'Error',
        text: 'Unable to open print window. Please check your browser settings.',
        icon: 'error',
        toast: true,
        position: 'top-end',
        timer: 3000,
        showConfirmButton: false
      });
      return;
    }

    const currentDate = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Filter rooms that need cleaning (pending or in_progress)
    const roomsNeedingCleaning = rooms.filter(r => 
      r.housekeeping_status === 'pending' || r.housekeeping_status === 'in_progress'
    );

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Room Cleaning List - ${currentDate}</title>
          <style>
            @media print {
              @page {
                margin: 1cm;
                size: portrait;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              color: #000;
            }
            
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 3px solid #2563eb;
              padding-bottom: 15px;
            }
            
            .header h1 {
              margin: 0;
              font-size: 28px;
              color: #2563eb;
            }
            
            .header .subtitle {
              margin: 5px 0 0 0;
              font-size: 14px;
              color: #666;
            }
            
            .header .date {
              margin: 10px 0 0 0;
              font-size: 12px;
              color: #888;
            }
            
            .summary {
              margin-bottom: 20px;
              padding: 15px;
              background-color: #f3f4f6;
              border-radius: 8px;
              display: flex;
              justify-content: space-around;
            }
            
            .summary-item {
              text-align: center;
            }
            
            .summary-item .label {
              font-size: 12px;
              color: #666;
              margin-bottom: 5px;
            }
            
            .summary-item .value {
              font-size: 24px;
              font-weight: bold;
              color: #2563eb;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            
            th {
              background-color: #2563eb;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: 600;
              font-size: 13px;
              border: 1px solid #1e40af;
            }
            
            td {
              padding: 10px 12px;
              border: 1px solid #d1d5db;
              font-size: 12px;
            }
            
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            
            tr:hover {
              background-color: #f3f4f6;
            }
            
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
            }
            
            .status-pending {
              background-color: #fef3c7;
              color: #92400e;
            }
            
            .status-in-progress {
              background-color: #dbeafe;
              color: #1e40af;
            }
            
            .status-completed {
              background-color: #d1fae5;
              color: #1e3a8a;
            }
            
            .room-status {
              font-size: 11px;
              padding: 3px 8px;
              border-radius: 8px;
              background-color: #e5e7eb;
              color: #374151;
            }
            
            .room-status.occupied {
              background-color: #fee2e2;
              color: #991b1b;
            }
            
            .room-status.available {
              background-color: #d1fae5;
              color: #1e3a8a;
            }
            
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #d1d5db;
              text-align: center;
              font-size: 11px;
              color: #6b7280;
            }
            
            .no-data {
              text-align: center;
              padding: 40px;
              color: #6b7280;
              font-style: italic;
            }
            
            .notes {
              max-width: 200px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🧹 ROOM CLEANING LIST</h1>
            <div class="subtitle">Housekeeping Department</div>
            <div class="date">Generated: ${currentDate}</div>
          </div>
          
          <div class="summary">
            <div class="summary-item">
              <div class="label">Total Rooms</div>
              <div class="value">${roomsNeedingCleaning.length}</div>
            </div>
            <div class="summary-item">
              <div class="label">Pending</div>
              <div class="value" style="color: #d97706;">${roomsNeedingCleaning.filter(r => r.housekeeping_status === 'pending').length}</div>
            </div>
            <div class="summary-item">
              <div class="label">In Progress</div>
              <div class="value" style="color: #2563eb;">${roomsNeedingCleaning.filter(r => r.housekeeping_status === 'in_progress').length}</div>
            </div>
          </div>
          
          ${roomsNeedingCleaning.length === 0 ? `
            <div class="no-data">
              <p>✨ All rooms are clean! No rooms need cleaning at this time.</p>
            </div>
          ` : `
            <table>
              <thead>
                <tr>
                  <th style="width: 10%;">Room #</th>
                  <th style="width: 15%;">Room Type</th>
                  <th style="width: 12%;">Room Status</th>
                  <th style="width: 15%;">Cleaning Status</th>
                  <th style="width: 18%;">Guest Name</th>
                  <th style="width: 15%;">Check-out Time</th>
                  <th style="width: 15%;">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${roomsNeedingCleaning.map(room => {
                  const reservation = room.reservation;
                  const guestName = reservation?.guest_name || 'N/A';
                  const checkoutDate = reservation?.check_out_date 
                    ? new Date(reservation.check_out_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : 'N/A';
                  
                  const statusClass = room.housekeeping_status === 'pending' 
                    ? 'status-pending' 
                    : room.housekeeping_status === 'in_progress'
                    ? 'status-in-progress'
                    : 'status-completed';
                  
                  const statusText = room.housekeeping_status === 'pending'
                    ? '🔔 Pending'
                    : room.housekeeping_status === 'in_progress'
                    ? '🧹 In Progress'
                    : '✅ Completed';
                  
                  const roomStatusClass = room.room_status === 'Occupied' 
                    ? 'occupied' 
                    : room.room_status === 'Available'
                    ? 'available'
                    : '';
                  
                  return `
                    <tr>
                      <td><strong>${room.room_number}</strong></td>
                      <td>${room.type}</td>
                      <td><span class="room-status ${roomStatusClass}">${room.room_status}</span></td>
                      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                      <td>${guestName}</td>
                      <td>${checkoutDate}</td>
                      <td class="notes">${room.notes || '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `}
          
          <div class="footer">
            <p><strong>Hotel Management System</strong></p>
            <p>This is a computer-generated document. No signature required.</p>
            <p>Print Date: ${currentDate}</p>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  // Fetch all rooms with housekeeping status
  const fetchRooms = useCallback(async () => {
    if (!isInitialized) return;
    
    setIsLoading(true);
    try {
      // Fetch all rooms
      const roomsResponse = await fetch('/api/room', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      
      if (!roomsResponse.ok) {
        throw new Error('Failed to fetch rooms');
      }
      
      const roomsData = await roomsResponse.json();
      
      // Fetch housekeeping data for all statuses
      const statuses = ['pending', 'in_progress', 'completed', 'inspected'];
      const housekeepingResponses = await Promise.all(
        statuses.map(status =>
          fetch(`/api/housekeeping/by-status?status=${status}`)
            .then(res => res.ok ? res.json() : [])
            .catch(() => [])
        )
      );
      
      const allHousekeepingData = housekeepingResponses.flat();
      
      // Create a map of room_id to housekeeping data
      const housekeepingMap = {};
      allHousekeepingData.forEach(h => {
        housekeepingMap[h.room_id] = {
          status: h.status,
          notes: h.notes || ''
        };
      });
      
      // Merge room data with housekeeping data
      const mergedRooms = roomsData.map(room => {
        const housekeeping = housekeepingMap[room.id] || {};
        
        // Determine housekeeping status based on room status
        let housekeepingStatus = housekeeping.status || 'pending';
        
        // If room is occupied or was just checked out, it needs cleaning
        if (room.status === 'Occupied' && !housekeeping.status) {
          housekeepingStatus = 'pending';
        }
        
        return {
          id: room.id,
          room_number: room.room_number,
          type: room.type,
          room_status: room.status,
          housekeeping_status: housekeepingStatus,
          notes: housekeeping.notes || '',
          package_name: room.package?.name || 'N/A',
          reservation: room.reservation
        };
      });
      
      if (isMounted.current) {
        setAllRooms(mergedRooms);
        setRooms(mergedRooms);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to load rooms. Please try again.',
        icon: 'error',
        toast: true,
        position: 'top-end',
        timer: 3000,
        showConfirmButton: false
      });
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [token, isInitialized]);

  useEffect(() => {
    isMounted.current = true;
    fetchRooms();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchRooms, 30000);
    
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchRooms]);

  // Filter and sort rooms
  useEffect(() => {
    let filtered = [...allRooms];
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(room => room.housekeeping_status === statusFilter);
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(room =>
        room.room_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.housekeeping_status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    setRooms(filtered);
  }, [allRooms, statusFilter, searchTerm, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleEditRoom = (room) => {
    setEditingRoom(room);
    setEditStatus(room.housekeeping_status);
    setEditNotes(room.notes || '');
  };

  const handleUpdateStatus = async () => {
    if (!editingRoom) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/housekeeping/${editingRoom.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          status: editStatus,
          notes: editNotes
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update housekeeping status');
      }
      
      Swal.fire({
        title: 'Success',
        text: `Room ${editingRoom.room_number} status updated successfully!`,
        icon: 'success',
        toast: true,
        position: 'top-end',
        timer: 3000,
        showConfirmButton: false
      });
      
      setEditingRoom(null);
      setEditStatus('');
      setEditNotes('');
      
      // Refresh rooms
      await fetchRooms();
    } catch (error) {
      console.error('Error updating status:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to update status. Please try again.',
        icon: 'error',
        toast: true,
        position: 'top-end',
        timer: 3000,
        showConfirmButton: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickUpdate = async (room, newStatus) => {
    if (!canManageHousekeeping) {
      Swal.fire({
        title: 'Access Denied',
        text: 'You do not have permission to update housekeeping status',
        icon: 'error',
        toast: true,
        position: 'top-end',
        timer: 3000,
        showConfirmButton: false
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/housekeeping/${room.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          status: newStatus,
          notes: room.notes || `Status changed to ${newStatus}`
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update housekeeping status');
      }
      
      const statusText = newStatus === 'completed' ? 'marked as clean and available' : `status changed to ${newStatus}`;
      
      Swal.fire({
        title: 'Success',
        text: `Room ${room.room_number} ${statusText}!`,
        icon: 'success',
        toast: true,
        position: 'top-end',
        timer: 3000,
        showConfirmButton: false
      });
      
      // Refresh rooms
      await fetchRooms();
    } catch (error) {
      console.error('Error updating status:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to update status. Please try again.',
        icon: 'error',
        toast: true,
        position: 'top-end',
        timer: 3000,
        showConfirmButton: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      inspected: 'bg-purple-100 text-purple-800 border-purple-300'
    };
    
    return badges[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: '🔔',
      in_progress: '🧹',
      completed: '✅',
      inspected: '🔍'
    };
    
    return icons[status] || '❓';
  };

  const stats = {
    pending: allRooms.filter(r => r.housekeeping_status === 'pending').length,
    in_progress: allRooms.filter(r => r.housekeeping_status === 'in_progress').length,
    completed: allRooms.filter(r => r.housekeeping_status === 'completed').length,
    total: allRooms.length
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          🧹 Housekeeping Management
        </h1>
        <p className="text-gray-600 mt-1">Manage room cleaning and maintenance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Needs Cleaning</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="text-4xl">🔔</div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-3xl font-bold text-blue-600">{stats.in_progress}</p>
            </div>
            <div className="text-4xl">🧹</div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-blue-600">{stats.completed}</p>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-gray-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Rooms</p>
              <p className="text-3xl font-bold text-gray-600">{stats.total}</p>
            </div>
            <div className="text-4xl">🏨</div>
          </div>
        </div>
      </div>

      {/* Print Button - Only visible to Front Desk */}
      {isFrontDesk && (
        <div className="mb-6">
          <button
            onClick={handlePrint}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Room Cleaning List
          </button>
          <p className="text-xs text-gray-500 mt-2">
            {rooms.filter(r => r.housekeeping_status === 'pending' || r.housekeeping_status === 'in_progress').length} room(s) need cleaning
          </p>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All Rooms
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  statusFilter === 'pending'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🔔 Pending ({stats.pending})
              </button>
              <button
                onClick={() => setStatusFilter('in_progress')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  statusFilter === 'in_progress'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🧹 In Progress ({stats.in_progress})
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  statusFilter === 'completed'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ✅ Completed ({stats.completed})
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Rooms</label>
            <input
              type="text"
              placeholder="Search by room number, type, or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
            />
          </div>
        </div>
      </div>

      {/* Rooms Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading rooms...</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-xl font-semibold text-gray-700">No rooms found</p>
            <p className="text-gray-500 mt-2">
              {statusFilter !== 'all' 
                ? `No rooms with status "${statusFilter}"`
                : searchTerm
                ? `No rooms match "${searchTerm}"`
                : 'All rooms are up to date!'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort('room_number')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Room Number
                    {sortConfig.key === 'room_number' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th
                    onClick={() => handleSort('type')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Type
                    {sortConfig.key === 'type' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Room Status
                  </th>
                  {/* Cleaning Status column removed as requested */}
                  {/* Notes column removed */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{room.room_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{room.type}</div>
                      <div className="text-xs text-gray-500">{room.package_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        room.room_status === 'Available'
                          ? 'bg-blue-100 text-blue-800'
                          : room.room_status === 'Occupied'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {room.room_status}
                      </span>
                    </td>
                    {/* Notes cell removed */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        {room.housekeeping_status === 'pending' && (
                          <button
                            onClick={() => handleQuickUpdate(room, 'in_progress')}
                            disabled={!canManageHousekeeping || isLoading}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Start Cleaning"
                          >
                            🧹 Start
                          </button>
                        )}
                        {room.housekeeping_status === 'in_progress' && (
                          <button
                            onClick={() => handleQuickUpdate(room, 'completed')}
                            disabled={!canManageHousekeeping || isLoading}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Mark as Complete"
                          >
                            ✅ Complete
                          </button>
                        )}
                        {(room.housekeeping_status === 'completed' || room.housekeeping_status === 'inspected') && (
                          <button
                            onClick={() => handleQuickUpdate(room, 'pending')}
                            disabled={!canManageHousekeeping || isLoading}
                            className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Needs Re-cleaning"
                          >
                            🔄 Reset
                          </button>
                        )}
                        <button
                          onClick={() => handleEditRoom(room)}
                          disabled={!canManageHousekeeping || isLoading}
                          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Edit Details"
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => {
                setEditingRoom(null);
                setEditStatus('');
                setEditNotes('');
              }}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
              disabled={isLoading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Update Room {editingRoom.room_number}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cleaning Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="pending">🔔 Pending - Needs Cleaning</option>
                    <option value="in_progress">🧹 In Progress - Currently Cleaning</option>
                    <option value="completed">✅ Completed - Clean and Ready</option>
                    <option value="inspected">🔍 Inspected - Quality Checked</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows="4"
                    placeholder="Add notes about cleaning status, issues found, etc."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setEditingRoom(null);
                    setEditStatus('');
                    setEditNotes('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStatus}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-sm font-semibold text-black mb-3">Status Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔔</span>
            <div>
              <div className="font-medium text-black">Pending</div>
              <div className="text-xs text-black">Needs cleaning</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧹</span>
            <div>
              <div className="font-medium text-black">In Progress</div>
              <div className="text-xs text-black">Currently being cleaned</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <div>
              <div className="font-medium text-black">Completed</div>
              <div className="text-xs text-black">Clean and available</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔍</span>
            <div>
              <div className="font-medium text-black">Inspected</div>
              <div className="text-xs text-black">Quality checked</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
