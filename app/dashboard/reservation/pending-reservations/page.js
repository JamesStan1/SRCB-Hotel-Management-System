"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import ManagerApprovalModal from '../../../components/ManagerApprovalModal';
import { CheckCircleIcon, XCircleIcon, EyeIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function PendingReservations() {
  const { token } = useAuth();
  const [pendingReservations, setPendingReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [viewItem, setViewItem] = useState(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // Fetch pending reservations
  const fetchPendingReservations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/pending-reservations?status=pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch pending reservations');
      
      const data = await response.json();
      setPendingReservations(data.reservations || []);
      showNotification('Pending reservations loaded', 'success');
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPendingReservations();
    }
  }, [token]);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Filter reservations by type
  const filteredReservations = activeTab === 'all' 
    ? pendingReservations 
    : pendingReservations.filter(r => r.type === activeTab);

  // Handle approve action
  const handleApprove = (reservation) => {
    setPendingAction({ reservation, action: 'approve' });
    setApprovalOpen(true);
  };

  // Handle reject action
  const handleReject = (reservation) => {
    const reason = prompt('Please provide a reason for rejection (optional):');
    setPendingAction({ reservation, action: 'reject', reason });
    setApprovalOpen(true);
  };

  // Manager approval callback
  const onApprove = async (approvalPayload) => {
    setApprovalOpen(false);
    if (!pendingAction) return;

    setLoading(true);
    try {
      const { reservation, action, reason } = pendingAction;
      
      const response = await fetch('/api/pending-reservations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: reservation.id,
          action,
          rejection_reason: reason,
          ...approvalPayload
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process reservation');
      }

      showNotification(
        `Reservation ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
        'success'
      );
      
      // Refresh list
      fetchPendingReservations();
      
      return { success: true, approverEmail: data.approverEmail };
    } catch (err) {
      console.error(err);
      showNotification(`Error: ${err.message}`, 'error');
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Pending Reservations</h1>
        <p className="text-gray-600">Review and approve or reject reservations from the public website</p>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mb-4 p-4 rounded-lg ${
          notification.type === 'success' ? 'bg-green-100 text-green-800' :
          notification.type === 'error' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          {['all', 'room', 'event'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} 
              {tab === 'all' && ` (${pendingReservations.length})`}
              {tab === 'room' && ` (${pendingReservations.filter(r => r.type === 'room').length})`}
              {tab === 'event' && ` (${pendingReservations.filter(r => r.type === 'event').length})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Reservations List */}
      {!loading && !error && (
        <div className="grid gap-4">
          {filteredReservations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ClockIcon className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg">No pending reservations</p>
              <p className="text-sm">New reservations from the public website will appear here</p>
            </div>
          ) : (
            filteredReservations.map((reservation) => (
              <div key={reservation.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      reservation.type === 'room' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {reservation.type.toUpperCase()}
                    </span>
                    <h3 className="text-lg font-bold text-gray-800 mt-2">
                      {reservation.type === 'room' ? reservation.package_name : reservation.event_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Submitted: {new Date(reservation.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setViewItem(reservation)}
                    className="text-blue-600 hover:text-blue-800"
                    title="View Details"
                  >
                    <EyeIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <span className="font-semibold text-gray-700">Customer:</span>
                    <p className="text-gray-600">{reservation.customer_name}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Contact:</span>
                    <p className="text-gray-600">{reservation.contact_number || 'N/A'}</p>
                  </div>
                  {reservation.type === 'room' && (
                    <>
                      <div>
                        <span className="font-semibold text-gray-700">Check-in:</span>
                        <p className="text-gray-600">{new Date(reservation.check_in_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Check-out:</span>
                        <p className="text-gray-600">{new Date(reservation.check_out_date).toLocaleDateString()}</p>
                      </div>
                    </>
                  )}
                  {reservation.type === 'event' && (
                    <>
                      <div>
                        <span className="font-semibold text-gray-700">Event Date:</span>
                        <p className="text-gray-600">{new Date(reservation.event_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Attendees:</span>
                        <p className="text-gray-600">{reservation.attendees}</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleReject(reservation)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  >
                    <XCircleIcon className="h-5 w-5" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(reservation)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                  >
                    <CheckCircleIcon className="h-5 w-5" />
                    Approve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* View Details Modal */}
      {viewItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-8 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-emerald-700">Reservation Details</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-gray-700">Type:</label>
                  <p className="text-gray-600">{viewItem.type.toUpperCase()}</p>
                </div>
                <div>
                  <label className="font-semibold text-gray-700">Status:</label>
                  <p className="text-gray-600">{viewItem.status}</p>
                </div>
                <div>
                  <label className="font-semibold text-gray-700">Customer Name:</label>
                  <p className="text-gray-600">{viewItem.customer_name}</p>
                </div>
                <div>
                  <label className="font-semibold text-gray-700">Email:</label>
                  <p className="text-gray-600">{viewItem.customer_email || 'N/A'}</p>
                </div>
                <div>
                  <label className="font-semibold text-gray-700">Contact Number:</label>
                  <p className="text-gray-600">{viewItem.contact_number || 'N/A'}</p>
                </div>
                <div>
                  <label className="font-semibold text-gray-700">Total:</label>
                  <p className="text-gray-600">₱{viewItem.total || viewItem.price || 'N/A'}</p>
                </div>
              </div>

              {viewItem.type === 'room' && (
                <>
                  <div>
                    <label className="font-semibold text-gray-700">Package:</label>
                    <p className="text-gray-600">{viewItem.package_name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-semibold text-gray-700">Check-in Date:</label>
                      <p className="text-gray-600">{new Date(viewItem.check_in_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="font-semibold text-gray-700">Check-out Date:</label>
                      <p className="text-gray-600">{new Date(viewItem.check_out_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700">Address:</label>
                    <p className="text-gray-600">{viewItem.address || 'N/A'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-semibold text-gray-700">Nationality:</label>
                      <p className="text-gray-600">{viewItem.nationality || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="font-semibold text-gray-700">Additional Guests:</label>
                      <p className="text-gray-600">{viewItem.additional_guests || 0}</p>
                    </div>
                  </div>
                </>
              )}

              {viewItem.type === 'event' && (
                <>
                  <div>
                    <label className="font-semibold text-gray-700">Event Name:</label>
                    <p className="text-gray-600">{viewItem.event_name}</p>
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700">Package:</label>
                    <p className="text-gray-600">{viewItem.event_package_name || 'N/A'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-semibold text-gray-700">Event Date:</label>
                      <p className="text-gray-600">{new Date(viewItem.event_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="font-semibold text-gray-700">Event Time:</label>
                      <p className="text-gray-600">{viewItem.event_time || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-semibold text-gray-700">Attendees:</label>
                      <p className="text-gray-600">{viewItem.attendees}</p>
                    </div>
                    <div>
                      <label className="font-semibold text-gray-700">Set:</label>
                      <p className="text-gray-600">{viewItem.set_name || 'N/A'}</p>
                    </div>
                  </div>
                  {viewItem.selected_dishes && (
                    <div>
                      <label className="font-semibold text-gray-700">Selected Dishes:</label>
                      <p className="text-gray-600">{JSON.parse(viewItem.selected_dishes || '[]').join(', ') || 'None'}</p>
                    </div>
                  )}
                </>
              )}

              {viewItem.additional_requests && (
                <div>
                  <label className="font-semibold text-gray-700">Additional Requests:</label>
                  <p className="text-gray-600">{viewItem.additional_requests}</p>
                </div>
              )}

              <div className="text-sm text-gray-500 pt-4 border-t">
                Submitted: {new Date(viewItem.created_at).toLocaleString()}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setViewItem(null)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Approval Modal */}
      <ManagerApprovalModal
        open={approvalOpen}
        onClose={() => {
          setApprovalOpen(false);
          setPendingAction(null);
        }}
        onApprove={onApprove}
      />
    </div>
  );
}
