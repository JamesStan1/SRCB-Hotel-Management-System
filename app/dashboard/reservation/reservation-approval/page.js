"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import Swal from 'sweetalert2';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  EyeIcon, 
  ClockIcon, 
  PrinterIcon,
  BanknotesIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

// PHP Currency Formatter Utility
const formatPHP = (amount) => {
  const num = parseFloat(amount || 0);
  return `₱${num.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
};

export default function ReservationApproval({ highlightedReservationId }) {
  const { token, user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [viewItem, setViewItem] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(null);
  const [showDownpaymentModal, setShowDownpaymentModal] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [paymentOption, setPaymentOption] = useState('');
  const [downpaymentAmount, setDownpaymentAmount] = useState('');
  const [managerCredentials, setManagerCredentials] = useState({ email: '', password: '' });
  const [downpaymentCredentials, setDownpaymentCredentials] = useState({ 
    email: '', 
    password: '', 
    paymentMethod: '',
    reference: ''
  });
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch reservations
  const fetchReservations = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = activeTab === 'all' 
        ? '/api/pending-reservations' 
        : `/api/pending-reservations?status=${activeTab}`;
        
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch reservations');
      
      const data = await response.json();
      setReservations(data.reservations || []);
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
      fetchReservations();
      setPage(1);
    }
  }, [token, activeTab]);

  // Handle highlighted reservation from notification
  useEffect(() => {
    if (highlightedReservationId && reservations.length > 0) {
      // Find the reservation
      const reservation = reservations.find(r => r.id === highlightedReservationId);
      
      if (reservation) {
        // Scroll to the reservation
        setTimeout(() => {
          const element = document.getElementById(`reservation-${highlightedReservationId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
        
        // Clear the highlight after 5 seconds
        const timer = setTimeout(() => {
          // Don't clear if we don't have a way to reset it from parent
          // The highlighting will remain until page change
        }, 5000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [highlightedReservationId, reservations]);

  const showNotification = (message, type = 'info') => {
    // Use SweetAlert instead of custom notification
    if (type === 'success') {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: message,
        timer: 3000,
        showConfirmButton: false
      });
    } else if (type === 'error') {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: message,
        confirmButtonColor: '#dc2626'
      });
    } else {
      Swal.fire({
        icon: 'info',
        title: 'Info',
        text: message,
        timer: 3000,
        showConfirmButton: false
      });
    }
  };

  // Handle approve action - open modal
  const handleApprove = (reservation) => {
    const suggestedDownpayment = (parseFloat(reservation.total || reservation.price || reservation.total_price || 0) * 0.3).toFixed(2);
    setShowApprovalModal(reservation);
    setPaymentOption('');
    setDownpaymentAmount(suggestedDownpayment);
  };

  // Submit approval
  const submitApproval = async () => {
    if (!paymentOption) {
      Swal.fire({
        icon: 'warning',
        title: 'Payment Option Required',
        text: 'Please select a payment option',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    if (paymentOption === 'downpayment' && (!downpaymentAmount || parseFloat(downpaymentAmount) <= 0)) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid Amount',
        text: 'Please enter a valid downpayment amount',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    // Only require manager credentials if user is not a manager
    const isManager = user?.role?.toLowerCase() === 'manager';
    if (!isManager && (!managerCredentials.email || !managerCredentials.password)) {
      Swal.fire({
        icon: 'warning',
        title: 'Credentials Required',
        text: 'Manager credentials are required for approval',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    setLoading(true);
    try {
      const requestBody = {
        id: showApprovalModal.id,
        action: 'approve',
        paymentOption: paymentOption,
        downpaymentAmount: paymentOption === 'downpayment' ? parseFloat(downpaymentAmount) : null,
        managerEmail: isManager ? user.email : managerCredentials.email,
        managerPassword: isManager ? null : managerCredentials.password,
        skipPasswordCheck: isManager
      };
      
      console.log('=== APPROVAL REQUEST DEBUG ===');
      console.log('Request body:', requestBody);
      console.log('Token exists:', !!token);
      console.log('Is Manager:', isManager);
      console.log('Manager email length:', (isManager ? user.email : managerCredentials.email)?.length || 0);
      
      const response = await fetch('/api/pending-reservations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        console.error('Approval failed:', data);
        console.error('Full response details:', {
          status: response.status,
          statusText: response.statusText,
          data: data
        });
        
        // Special handling for 409 conflict (duplicate reservation)
        if (response.status === 409) {
          let conflictMessage = data.message || 'A conflicting reservation already exists.';
          let detailsHtml = '';
          
          if (data.duplicateReservation) {
            detailsHtml = `
              <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-left">
                <p class="font-semibold text-yellow-800">Conflicting Room Reservation:</p>
                <ul class="mt-2 text-sm text-gray-700 space-y-1">
                  <li><strong>Room:</strong> ${data.duplicateReservation.roomNumber}</li>
                  <li><strong>Reserved by:</strong> ${data.duplicateReservation.customerName}</li>
                  <li><strong>Reservation ID:</strong> ${data.duplicateReservation.reservationId}</li>
                </ul>
              </div>
            `;
          } else if (data.duplicateEvent) {
            detailsHtml = `
              <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-left">
                <p class="font-semibold text-yellow-800">Conflicting Event Booking:</p>
                <ul class="mt-2 text-sm text-gray-700 space-y-1">
                  <li><strong>Event:</strong> ${data.duplicateEvent.eventName}</li>
                  <li><strong>Booked by:</strong> ${data.duplicateEvent.bookedBy}</li>
                  <li><strong>Date:</strong> ${data.duplicateEvent.date}</li>
                  <li><strong>Time:</strong> ${data.duplicateEvent.time}</li>
                </ul>
              </div>
            `;
          }
          
          Swal.fire({
            icon: 'warning',
            title: data.error || 'Duplicate Reservation Detected',
            html: `
              <div class="text-left">
                <p class="mb-2">${conflictMessage}</p>
                ${detailsHtml}
              </div>
            `,
            confirmButtonColor: '#f59e0b'
          });
          setShowApprovalModal(null);
          setManagerCredentials({ email: '', password: '' });
          return;
        }
        
        // Special handling for 400 - No Available Rooms
        if (response.status === 400 && data.error === 'No Available Room') {
          Swal.fire({
            icon: 'error',
            title: 'No Rooms Available',
            html: `
              <div class="text-left">
                <p class="mb-3">${data.message || 'No available rooms found for this package.'}</p>
                ${data.packageName ? `<p class="text-sm text-gray-600"><strong>Package:</strong> ${data.packageName}</p>` : ''}
                <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p class="text-sm text-blue-800"><strong>💡 Suggestion:</strong> Please check room availability in Room Management or contact housekeeping to prepare rooms before approving this reservation.</p>
                </div>
              </div>
            `,
            confirmButtonColor: '#dc2626'
          });
          setShowApprovalModal(null);
          setManagerCredentials({ email: '', password: '' });
          return;
        }
        
        throw new Error(data.error || data.details || 'Failed to approve reservation');
      }

      showNotification('Reservation approved successfully!', 'success');
      setShowApprovalModal(null);
      setManagerCredentials({ email: '', password: '' });
      fetchReservations();
    } catch (err) {
      console.error('Approval error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Approval Failed',
        html: `<div class="text-left">
          <p class="mb-2"><strong>Error:</strong> ${err.message}</p>
          ${err.details ? `<p class="text-sm text-gray-600">${err.details}</p>` : ''}
        </div>`,
        confirmButtonColor: '#dc2626'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle reject action
  // Handle reject action
  const handleReject = async (reservation) => {
    // Step 1: Ask for rejection reason
    const { value: reason } = await Swal.fire({
      title: 'Reject Reservation',
      text: 'Please provide a reason for rejection:',
      input: 'textarea',
      inputPlaceholder: 'Enter rejection reason...',
      inputAttributes: {
        'aria-label': 'Rejection reason'
      },
      showCancelButton: true,
      confirmButtonText: 'Continue',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      inputValidator: (value) => {
        if (!value) {
          return 'Please provide a reason for rejection';
        }
      }
    });

    if (!reason) return;

    const isManager = user?.role?.toLowerCase() === 'manager';
    let credentials = null;

    // Step 2: Ask for manager credentials only if user is not a manager
    if (!isManager) {
      const { value: creds } = await Swal.fire({
        title: 'Manager Verification',
        html: `
          <div class="space-y-4 text-left">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Manager Email:</label>
              <input id="manager-email" type="email" class="swal2-input" placeholder="manager@example.com" style="width: 100%; margin: 0; color: black;">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Manager Password:</label>
              <input id="manager-password" type="password" class="swal2-input" placeholder="Password" style="width: 100%; margin: 0; color: black;">
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Reject Reservation',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        focusConfirm: false,
        preConfirm: () => {
          const email = document.getElementById('manager-email').value;
          const password = document.getElementById('manager-password').value;
          
          if (!email || !password) {
            Swal.showValidationMessage('Please enter both email and password');
            return false;
          }
          
          return { email, password };
        }
      });

      if (!creds) return;
      credentials = creds;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/pending-reservations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: reservation.id,
          action: 'reject',
          rejection_reason: reason,
          managerEmail: isManager ? user.email : credentials.email,
          managerPassword: isManager ? null : credentials.password,
          skipPasswordCheck: isManager
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject reservation');
      }

      showNotification('Reservation rejected successfully', 'success');
      fetchReservations();
    } catch (err) {
      console.error(err);
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle confirm downpayment
  const handleConfirmDownpayment = async (reservation) => {
    setShowDownpaymentModal(reservation);
    // ensure `reference` key exists so the reference input is always controlled
    setDownpaymentCredentials({ email: '', password: '', paymentMethod: '', reference: '' });
  };

  // Submit downpayment confirmation
  const submitDownpaymentConfirmation = async () => {
    if (!downpaymentCredentials.paymentMethod) {
      Swal.fire({
        icon: 'warning',
        title: 'Payment Method Required',
        text: 'Please select how the downpayment was received (GCash or Cash)',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    const isManager = user?.role?.toLowerCase() === 'manager';
    if (!isManager && (!downpaymentCredentials.email || !downpaymentCredentials.password)) {
      Swal.fire({
        icon: 'warning',
        title: 'Credentials Required',
        text: 'Please enter your manager credentials for verification',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Confirming downpayment for reservation:', showDownpaymentModal);
      console.log('Reservation ID:', showDownpaymentModal.id, 'Type:', typeof showDownpaymentModal.id);
      console.log('Reservation Status:', showDownpaymentModal.status);
      
      // Prepare payload; include reference if payment method is GCash
      const payload = {
        id: showDownpaymentModal.id,
        action: 'confirm_downpayment',
        paymentMethod: downpaymentCredentials.paymentMethod,
        managerEmail: isManager ? user.email : downpaymentCredentials.email,
        managerPassword: isManager ? null : downpaymentCredentials.password,
        skipPasswordCheck: isManager
      };
      if ((downpaymentCredentials.paymentMethod || '').toLowerCase() === 'gcash') {
        payload.downpaymentReference = downpaymentCredentials.reference;
      }

      const response = await fetch('/api/pending-reservations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      console.log('Response status:', response.status);
      console.log('Response data:', data);

      if (!response.ok) {
        // Show specific error message based on status code
        if (response.status === 400 && data.currentStatus) {
          Swal.fire({
            icon: 'info',
            title: 'Already Processed',
            html: `This reservation has already been processed.<br><br><strong>Current Status:</strong> ${data.currentStatus}`,
            confirmButtonColor: '#3b82f6'
          });
          setShowDownpaymentModal(null);
          setDownpaymentCredentials({ email: '', password: '', paymentMethod: '', reference: '' });
          fetchReservations();
          return;
        } else if (response.status === 404) {
          console.log('404 Error details:', data);
          let errorMsg = 'Reservation not found. It may have been deleted or already processed.';
          if (data.requestedId) {
            errorMsg += `<br><br><strong>Requested ID:</strong> ${data.requestedId}`;
          }
          if (data.recentReservations && data.recentReservations.length > 0) {
            errorMsg += '<br><br><strong>Recent Reservations:</strong><br>';
            data.recentReservations.forEach(r => {
              errorMsg += `ID: ${r.id}, Status: ${r.status}<br>`;
            });
          }
          Swal.fire({
            icon: 'error',
            title: 'Reservation Not Found',
            html: errorMsg,
            confirmButtonColor: '#dc2626'
          });
          setShowDownpaymentModal(null);
          // keep `reference` defined to avoid uncontrolled -> controlled warnings
          setDownpaymentCredentials({ email: '', password: '', paymentMethod: '', reference: '' });
          fetchReservations();
          return;
        } else {
          throw new Error(data.error || data.details || 'Failed to confirm downpayment');
        }
      }
      // After confirming downpayment server-side, also create a payments row so the payment is tracked in `payments` table
      try {
        const paymentMethodNormalized = (downpaymentCredentials.paymentMethod || '').toLowerCase();
        const downAmount = Number(showDownpaymentModal.downpayment_amount || showDownpaymentModal.downpaymentAmount || 0);
        if (downAmount && downAmount > 0) {
          const paymentPayload = {
            reservationId: showDownpaymentModal.id,
            amount: downAmount,
            method: paymentMethodNormalized === 'gcash' ? 'gcash' : 'cash',
            type: 'downpayment',
            note: `Downpayment recorded via Reservation Request for reservation ${showDownpaymentModal.id}`
          };
          if (paymentMethodNormalized === 'gcash' && downpaymentCredentials.reference) {
            paymentPayload.reference = downpaymentCredentials.reference;
          }

          const payRes = await fetch('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(paymentPayload)
          });
          if (!payRes.ok) {
            const payBody = await (async () => { try { return JSON.parse(await payRes.text()); } catch(e){ return await payRes.text(); } })();
            console.warn('Failed to create payment record after downpayment confirmation', payRes.status, payBody);
          }
        }
      } catch (e) {
        console.error('Error creating payment record after downpayment confirmation:', e);
      }

      showNotification(`Downpayment confirmed successfully via ${downpaymentCredentials.paymentMethod}!`, 'success');
      setShowDownpaymentModal(null);
      setDownpaymentCredentials({ email: '', password: '', paymentMethod: '', reference: '' });
      fetchReservations();
    } catch (err) {
      console.error('Downpayment confirmation error:', err);
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle final approval (after downpayment received)
  const handleFinalApprove = async (reservation) => {
    const isManager = user?.role?.toLowerCase() === 'manager';
    
    let managerCredentials = null;
    
    // Build the SweetAlert HTML conditionally
    let swalHtml = `
      <div class="text-left">
        <p class="mb-4">Are you sure you want to approve this reservation?</p>
        <div class="bg-gray-50 p-4 rounded-lg mb-4">
          <p class="mb-2"><strong>Customer:</strong> ${reservation.customer_name}</p>
          <p class="mb-2"><strong>${reservation.type === 'room' ? 'Package' : 'Event'}:</strong> ${reservation.type === 'room' ? reservation.package_name : reservation.event_name}</p>
          <p class="mb-2"><strong>Downpayment:</strong> ₱${parseFloat(reservation.downpayment_amount || 0).toFixed(2)}</p>
          <p class="mb-2"><strong>Remaining Balance:</strong> ₱${parseFloat(reservation.remaining_balance || 0).toFixed(2)}</p>
        </div>
        <p class="text-sm text-gray-600">Once approved, this reservation will be moved to ${reservation.type === 'room' ? 'Room Management' : 'Event Management'}.</p>`;
    
    if (!isManager) {
      swalHtml += `
        <div class="mt-4">
          <label class="block text-sm font-semibold mb-2">Manager Email:</label>
          <input type="email" id="final-manager-email" class="w-full border border-gray-300 rounded px-3 py-2 mb-3 text-black" placeholder="manager@example.com">
          <label class="block text-sm font-semibold mb-2">Manager Password:</label>
          <input type="password" id="final-manager-password" class="w-full border border-gray-300 rounded px-3 py-2 text-black" placeholder="Enter your password">
        </div>`;
    }
    
    swalHtml += `</div>`;
    
    const result = await Swal.fire({
      title: 'Final Approval',
      html: swalHtml,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Approve',
      confirmButtonColor: '#3b82f6',
      cancelButtonText: 'Cancel',
      preConfirm: () => {
        if (!isManager) {
          const email = document.getElementById('final-manager-email').value;
          const password = document.getElementById('final-manager-password').value;
          
          if (!email || !password) {
            Swal.showValidationMessage('Please enter both email and password');
            return false;
          }
          
          return { email, password };
        }
        return true;
      }
    });

    if (result.isConfirmed) {
      setLoading(true);
      try {
        const response = await fetch('/api/pending-reservations', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            id: reservation.id,
            action: 'final_approve',
            managerEmail: isManager ? user.email : result.value.email,
            managerPassword: isManager ? null : result.value.password,
            skipPasswordCheck: isManager
          })
        });

        const data = await response.json();

        if (!response.ok) {
          // Special handling for 409 conflict (duplicate reservation)
          if (response.status === 409) {
            let conflictMessage = data.message || 'A conflicting reservation already exists.';
            let detailsHtml = '';
            
            if (data.duplicateReservation) {
              detailsHtml = `
                <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-left">
                  <p class="font-semibold text-yellow-800">Conflicting Room Reservation:</p>
                  <ul class="mt-2 text-sm text-gray-700 space-y-1">
                    <li><strong>Room:</strong> ${data.duplicateReservation.roomNumber}</li>
                    <li><strong>Reserved by:</strong> ${data.duplicateReservation.customerName}</li>
                    <li><strong>Reservation ID:</strong> ${data.duplicateReservation.reservationId}</li>
                  </ul>
                </div>
              `;
            } else if (data.duplicateEvent) {
              detailsHtml = `
                <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-left">
                  <p class="font-semibold text-yellow-800">Conflicting Event Booking:</p>
                  <ul class="mt-2 text-sm text-gray-700 space-y-1">
                    <li><strong>Event:</strong> ${data.duplicateEvent.eventName}</li>
                    <li><strong>Booked by:</strong> ${data.duplicateEvent.bookedBy}</li>
                    <li><strong>Date:</strong> ${data.duplicateEvent.date}</li>
                    <li><strong>Time:</strong> ${data.duplicateEvent.time}</li>
                  </ul>
                </div>
              `;
            }
            
            Swal.fire({
              icon: 'warning',
              title: data.error || 'Duplicate Reservation Detected',
              html: `
                <div class="text-left">
                  <p class="mb-2">${conflictMessage}</p>
                  ${detailsHtml}
                </div>
              `,
              confirmButtonColor: '#f59e0b'
            });
            fetchReservations();
            return;
          }
          
          throw new Error(data.error || data.details || 'Failed to approve reservation');
        }

        Swal.fire({
          icon: 'success',
          title: 'Reservation Approved!',
          text: `The reservation has been moved to ${reservation.type === 'room' ? 'Room Management' : 'Event Management'}`,
          confirmButtonColor: '#3b82f6'
        });

        fetchReservations();
      } catch (err) {
        console.error('Final approval error:', err);
        Swal.fire({
          icon: 'error',
          title: 'Approval Failed',
          text: err.message,
          confirmButtonColor: '#dc2626'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  // Print handlers
  const handlePrint = () => {
    // Keep as a fallback - trigger a print immediately
    try {
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  // Print contract - open modal then trigger print when content has rendered
  const printContract = (reservation) => {
    setViewItem(reservation);
    // Use state-based printing: set flag to true, and an effect will perform the print
    setIsPrinting(true);
  };

  // When isPrinting is true and a viewItem is shown, run print after a animation/frame to ensure content is rendered
  useEffect(() => {
    if (!isPrinting || !viewItem) return;
    // Delay slightly to ensure print modal and contents are visible
    const id = window.setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.error('Print failed:', e);
      } finally {
        // Allow a short delay before unsetting so print styles apply fully
        window.setTimeout(() => setIsPrinting(false), 200);
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [isPrinting, viewItem]);

  // Status badge component
  const StatusBadge = ({ status }) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      awaiting_downpayment: 'bg-teal-100 text-teal-800',
      downpayment_paid: 'bg-blue-100 text-blue-800',
      approved: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-gray-100 text-gray-800'
    };

    const labels = {
      pending: 'Pending Approval',
      awaiting_downpayment: 'Awaiting Downpayment',
      downpayment_paid: 'Downpayment Received',
      approved: 'Approved',
      rejected: 'Rejected',
      completed: 'Completed'
    };
    return (
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Table / pagination helpers (declared here so they're in component scope, not inside StatusBadge)
  const tableTabs = ['pending','awaiting_downpayment','downpayment_paid','rejected','approved','all'];
  const isTableTab = tableTabs.includes(activeTab);
  
  // Sort reservations by ID or created_at in descending order (newest first)
  const sortedReservations = [...reservations].sort((a, b) => {
    // Try to sort by created_at first, fallback to id
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    
    if (dateA !== dateB) {
      return dateB - dateA; // Descending order (newest first)
    }
    
    // Fallback to ID if dates are equal or missing
    return (b.id || 0) - (a.id || 0); // Descending order (higher ID first)
  });
  
  const total = sortedReservations.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  const paged = sortedReservations.slice(start, start + perPage);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Reservation Request & Management</h1>
        <p className="text-gray-600">Review, approve, and manage customer reservations</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8 overflow-x-auto">
          {['pending', 'awaiting_downpayment', 'downpayment_paid', 'approved', 'rejected', 'all'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              {activeTab === 'all' && ` (${reservations.length})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
      {!loading && !error && reservations.length > 0 && (
        <div className="grid gap-4">
          {isTableTab ? (
            // Table View
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Package / Event</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Downpayment</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Remaining</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {paged.map((r) => (
                      <tr 
                        key={r.id} 
                        id={`reservation-${r.id}`}
                        className={`transition-all duration-300 ${
                          highlightedReservationId === r.id 
                            ? 'bg-blue-50 border-l-4 border-blue-500' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-gray-700">{r.id}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{r.type || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{r.customer_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{r.type === 'room' ? (r.package_name || 'Room') : (r.event_name || r.event_package_name || 'Event')}</td>
                        <td className="px-4 py-3 text-sm text-black font-semibold text-right">{formatPHP(r.total || r.price || r.total_price || 0)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatPHP(r.downpayment_amount || 0)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatPHP(r.remaining_balance || 0)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3 text-sm text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setViewItem(r)} className="text-teal-600 hover:text-teal-800"><EyeIcon className="h-5 w-5 inline" /></button>
                            {['awaiting_downpayment','downpayment_paid','approved'].includes(r.status) && (
                              <button onClick={() => printContract(r)} disabled={isPrinting} className={`text-purple-600 hover:text-purple-800 ${isPrinting ? 'opacity-50 cursor-not-allowed' : ''}`} aria-label="Print Contract"><PrinterIcon className="h-5 w-5 inline" /></button>
                            )}
                            {r.status === 'pending' && (
                              <>
                                <button onClick={() => handleReject(r)} className="text-red-600 hover:text-red-800"><XCircleIcon className="h-5 w-5 inline" /></button>
                                <button onClick={() => handleApprove(r)} className="text-blue-600 hover:text-blue-800"><CheckCircleIcon className="h-5 w-5 inline" /></button>
                              </>
                            )}
                            {r.status === 'awaiting_downpayment' && (
                              <button onClick={() => handleConfirmDownpayment(r)} className="text-teal-600 hover:text-teal-800"><BanknotesIcon className="h-5 w-5 inline" /></button>
                            )}
                            {r.status === 'downpayment_paid' && (
                              <button onClick={() => handleFinalApprove(r)} className="text-blue-600 hover:text-blue-800"><CheckCircleIcon className="h-5 w-5 inline" /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Rows per page:</span>
                  <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className="border rounded px-2 py-1 text-sm">
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className={`px-3 py-1 rounded ${page <= 1 ? 'bg-gray-200 text-gray-400' : 'bg-white border'}`}>Prev</button>
                  <span className="text-sm text-gray-700">Page {page} of {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className={`px-3 py-1 rounded ${page >= totalPages ? 'bg-gray-200 text-gray-400' : 'bg-white border'}`}>Next</button>
                </div>
              </div>
            </div>
          ) : (
            // Card View (fallback)
            sortedReservations.map((reservation) => (
              <div 
                key={reservation.id} 
                id={`reservation-${reservation.id}`}
                className={`bg-white rounded-lg shadow-md p-6 border transition-all duration-300 ${
                  highlightedReservationId === reservation.id 
                    ? 'border-blue-500 border-2 ring-4 ring-emerald-200 bg-blue-50' 
                    : 'border-gray-200'
                }`}
              >
                {/* ... your existing card content ... */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        reservation.type === 'room' ? 'bg-teal-100 text-teal-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {reservation.type ? reservation.type.toUpperCase() : 'UNKNOWN'}
                      </span>
                      <StatusBadge status={reservation.status} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">
                      {reservation.type === 'room' ? (reservation.package_name || 'Room Package') : (reservation.event_name || 'Event Reservation')}
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
                  <div>
                    <span className="font-semibold text-gray-700">Total Amount:</span>
                    <p className="text-gray-600 font-bold">{formatPHP(reservation.total || reservation.price || reservation.total_price || 0)}</p>
                  </div>
                  {reservation.downpayment_amount > 0 && (
                    <>
                      <div>
                        <span className="font-semibold text-gray-700">Downpayment:</span>
                        <p className="text-gray-600">{formatPHP(reservation.downpayment_amount)}</p>
                      </div>
                      {reservation.downpayment_method && (
                        <div>
                          <span className="font-semibold text-gray-700">Payment Method:</span>
                          <p className={`text-xs font-semibold inline-block px-2 py-1 rounded-full ${
                            reservation.downpayment_method === 'GCash'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {reservation.downpayment_method}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-gray-700">Remaining Balance:</span>
                        <p className="text-gray-600 font-bold text-orange-600">{formatPHP(reservation.remaining_balance)}</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  {reservation.status === 'pending' && (
                    <>
                      <button onClick={() => handleReject(reservation)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                        <XCircleIcon className="h-5 w-5" /> Reject
                      </button>
                      <button onClick={() => handleApprove(reservation)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                        <CheckCircleIcon className="h-5 w-5" /> Approve
                      </button>
                    </>
                  )}
                  {reservation.status === 'awaiting_downpayment' && (
                    <button onClick={() => handleConfirmDownpayment(reservation)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                      <BanknotesIcon className="h-5 w-5" /> Confirm Downpayment Received
                    </button>
                  )}
                  {reservation.status === 'downpayment_paid' && (
                    <button onClick={() => handleFinalApprove(reservation)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                      <CheckCircleIcon className="h-5 w-5" /> Approve
                    </button>
                  )}
                  {['awaiting_downpayment', 'downpayment_paid', 'approved'].includes(reservation.status) && (
                    <button onClick={() => printContract(reservation)} disabled={isPrinting} className={`flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition ${isPrinting ? 'opacity-50 cursor-not-allowed' : ''}`} aria-label="Print Contract">
                      <PrinterIcon className="h-5 w-5" /> Print Contract
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && reservations.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <ClockIcon className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <p className="text-lg">No reservations found</p>
          <p className="text-sm">Reservations with this status will appear here</p>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-8 rounded-xl w-full max-w-lg shadow-lg relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => {
                setShowApprovalModal(null);
                setPaymentOption('');
                setDownpaymentAmount('');
                setManagerCredentials({ email: '', password: '' });
              }}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold mb-6 text-blue-700">Approve Reservation</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Customer:</strong> {showApprovalModal.customer_name}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Total Amount:</strong> {formatPHP(showApprovalModal.total || showApprovalModal.price || showApprovalModal.total_price || 0)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Option:</label>
                <select
                  value={paymentOption}
                  onChange={(e) => setPaymentOption(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Select Payment Option --</option>
                  <option value="checkout">Pay Upon Checkout</option>
                  <option value="downpayment">Require Downpayment</option>
                </select>
              </div>

              {paymentOption === 'downpayment' && (
                <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Downpayment Amount (₱):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={downpaymentAmount}
                    onChange={(e) => setDownpaymentAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter downpayment amount"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Remaining balance: {formatPHP((parseFloat(showApprovalModal.total || showApprovalModal.price || showApprovalModal.total_price || 0) - parseFloat(downpaymentAmount || 0)))}
                  </p>
                </div>
                </>
              )}

              {/* Only show manager credentials if user is NOT a manager */}
              {user?.role?.toLowerCase() !== 'manager' && (
                <div className="border-t pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Manager Credentials Required:</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Manager Email:</label>
                      <input
                        type="email"
                        value={managerCredentials.email}
                        onChange={(e) => setManagerCredentials(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black"
                        placeholder="manager@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Manager Password:</label>
                      <input
                        type="password"
                        value={managerCredentials.password}
                        onChange={(e) => setManagerCredentials(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black"
                        placeholder="Password"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowApprovalModal(null);
                  setManagerCredentials({ email: '', password: '' });
                }}
                className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
              <button
                onClick={submitApproval}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Downpayment Confirmation Modal */}
      {showDownpaymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-8 rounded-xl w-full max-w-lg shadow-lg relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => {
                setShowDownpaymentModal(null);
                setDownpaymentCredentials({ 
                  email: '', 
                  password: '', 
                  paymentMethod: '', 
                  reference: '' 
                });
              }}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold mb-6 text-blue-700">Confirm Downpayment Receipt</h2>
            
            <div className="space-y-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Customer:</strong> {showDownpaymentModal.customer_name}
                </p>
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Total Amount:</strong> {formatPHP(showDownpaymentModal.total || showDownpaymentModal.price || 0)}
                </p>
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Downpayment Amount:</strong> <span className="text-blue-600 font-bold">{formatPHP(showDownpaymentModal.downpayment_amount)}</span>
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Remaining Balance:</strong> <span className="text-orange-600 font-bold">{formatPHP(showDownpaymentModal.remaining_balance)}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-blue-50 transition">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="GCash"
                      checked={downpaymentCredentials.paymentMethod === 'GCash'}
                      onChange={(e) => setDownpaymentCredentials(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">GCash</span>
                  </label>
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-blue-50 transition">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="Cash"
                      checked={downpaymentCredentials.paymentMethod === 'Cash'}
                      onChange={(e) => setDownpaymentCredentials(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">Cash</span>
                  </label>
                </div>
              </div>

              {downpaymentCredentials.paymentMethod === 'GCash' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">GCash Reference Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={downpaymentCredentials.reference}
                    onChange={(e) => setDownpaymentCredentials(prev => ({ ...prev, reference: e.target.value }))}
                    placeholder="Enter GCash reference number"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Only show manager credentials if user is NOT a manager */}
              {user?.role?.toLowerCase() !== 'manager' && (
                <div className="border-t pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Manager Credentials Required:</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Manager Email:</label>
                      <input
                        type="email"
                        value={downpaymentCredentials.email}
                        onChange={(e) => setDownpaymentCredentials(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-blue-500"
                        placeholder="manager@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Manager Password:</label>
                      <input
                        type="password"
                        value={downpaymentCredentials.password}
                        onChange={(e) => setDownpaymentCredentials(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-blue-500"
                        placeholder="Password"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDownpaymentModal(null);
                  // keep `reference` defined to avoid uncontrolled -> controlled warnings
                  setDownpaymentCredentials({ email: '', password: '', paymentMethod: '', reference: '' });
                }}
                className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
              <button
                onClick={submitDownpaymentConfirmation}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Confirm Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details / Print Modal */}
      {viewItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-lg relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => setViewItem(null)}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="p-8">
              <h2 className="text-2xl font-bold text-blue-700 mb-6">Reservation Details</h2>

              {/* Printable Content */}
              <div id="print-content" className="space-y-6">
                {/* Header */}
                <div className="text-center border-b-2 border-gray-300 pb-4">
                  <h1 className="text-3xl font-bold text-gray-800">Reservation Contract</h1>
                  <p className="text-sm text-gray-600 mt-2">Invoice #: RES-{viewItem.id}</p>
                  <p className="text-sm text-gray-600">Date: {new Date(viewItem.created_at).toLocaleDateString()}</p>
                </div>

                {/* Customer Information */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">Name:</span>
                      <p className="text-gray-600">{viewItem.customer_name}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Email:</span>
                      <p className="text-gray-600">{viewItem.customer_email || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Contact:</span>
                      <p className="text-gray-600">{viewItem.contact_number || 'N/A'}</p>
                    </div>
                    {viewItem.address && (
                      <div className="col-span-2">
                        <span className="font-semibold text-gray-700">Address:</span>
                        <p className="text-gray-600">{viewItem.address}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reservation Details */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3">Reservation Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">Type:</span>
                      <p className="text-gray-600">{viewItem.type ? viewItem.type.toUpperCase() : 'UNKNOWN'}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Status:</span>
                      <div className="mt-1"><StatusBadge status={viewItem.status} /></div>
                    </div>
                    
                    {viewItem.type === 'room' && (
                      <>
                        <div>
                          <span className="font-semibold text-gray-700">Package:</span>
                          <p className="text-gray-600">{viewItem.package_name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Additional Guests:</span>
                          <p className="text-gray-600">{viewItem.additional_guests || 0}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Check-in:</span>
                          <p className="text-gray-600">{viewItem.check_in_date ? new Date(viewItem.check_in_date).toLocaleDateString() : 'N/A'}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Check-out:</span>
                          <p className="text-gray-600">{viewItem.check_out_date ? new Date(viewItem.check_out_date).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      </>
                    )}

                    {viewItem.type === 'event' && (
                      <>
                        <div>
                          <span className="font-semibold text-gray-700">Event:</span>
                          <p className="text-gray-600">{viewItem.event_name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Package:</span>
                          <p className="text-gray-600">{viewItem.event_package_name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Date:</span>
                          <p className="text-gray-600">{viewItem.event_date ? new Date(viewItem.event_date).toLocaleDateString() : 'N/A'}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Attendees:</span>
                          <p className="text-gray-600">{viewItem.attendees || 'N/A'}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Payment Information */}
                <div className="border-t-2 border-gray-300 pt-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">Payment Information</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-gray-700">Total Amount:</span>
                      <span className="text-xl font-bold text-gray-800">{formatPHP(viewItem.total || viewItem.price || viewItem.total_price || 0)}</span>
                    </div>
                    
                    {viewItem.downpayment_amount > 0 && (
                      <>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-gray-700">Downpayment:</span>
                          <span className="text-lg text-blue-600">{formatPHP(viewItem.downpayment_amount)}</span>
                        </div>
                        {viewItem.downpayment_method && (
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-gray-700">Payment Method:</span>
                            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                              viewItem.downpayment_method === 'GCash' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {viewItem.downpayment_method}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700">Remaining Balance:</span>
                          <span className="text-xl font-bold text-orange-600">{formatPHP(viewItem.remaining_balance)}</span>
                        </div>
                        {viewItem.downpayment_paid && viewItem.downpayment_date && (
                          <p className="text-xs text-gray-500 mt-2">
                            Downpayment received on: {new Date(viewItem.downpayment_date).toLocaleString()}
                          </p>
                        )}
                      </>
                    )}
                    
                    {viewItem.payment_option === 'checkout' && (
                      <p className="text-sm text-gray-600 mt-2">Payment will be collected upon checkout</p>
                    )}
                  </div>
                </div>

                {/* Terms & Conditions */}
                <div className="border-t-2 border-gray-300 pt-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">Terms & Conditions</h3>
                  <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                    <li>Customer must present valid ID upon check-in</li>
                    <li>Reservation is non-transferable</li>
                    <li>Cancellation must be made 48 hours in advance for full refund</li>
                    <li>Downpayment is non-refundable if cancelled within 48 hours of reservation date</li>
                    <li>Additional charges may apply for damages or extra services</li>
                    <li>Customer agrees to abide by all hotel policies and regulations</li>
                  </ul>
                </div>

                {/* Signatures */}
                <div className="border-t-2 border-gray-300 pt-6 mt-6">
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-sm text-gray-600 mb-8">Customer Signature:</p>
                      <div className="border-b-2 border-gray-300 pb-2 mb-2"></div>
                      <p className="text-xs text-gray-500">Date: _________________</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-8">Authorized Representative:</p>
                      <div className="border-b-2 border-gray-300 pb-2 mb-2"></div>
                      <p className="text-xs text-gray-500">Date: _________________</p>
                    </div>
                  </div>
                </div>

                <div className="text-center text-xs text-gray-500 mt-8">
                  <p>Thank you for choosing our services!</p>
                  <p>For inquiries, please contact us at info@hotel.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          
          body * {
            visibility: hidden;
          }
          body {
            background: white;
          }
          .print\\:hidden,
          button,
          nav,
          .no-print {
            display: none !important;
          }
          #print-content,
          #print-content * {
            visibility: visible;
          }
          /* Use printable area with padding for margins to avoid scaling
             Set full width using left/right to fit page and rely on @page margins
             to be applied by the browser; avoid forcing 210mm width which
             combined with page margins can cause scale-down in print preview. */
          #print-content {
            position: fixed;
            left: 0;
            top: 0;
            right: 0;
            width: auto;
            padding: 10mm; /* match @page margin so content stays inside printable area */
            margin: 0;
            box-sizing: border-box;
            font-size: 9pt;
            line-height: 1.3;
          }
          #print-content h1 {
            font-size: 16pt !important;
            margin-bottom: 4px !important;
          }
          #print-content h2 {
            font-size: 14pt !important;
            margin-bottom: 6px !important;
          }
          #print-content h3 {
            font-size: 11pt !important;
            margin-bottom: 6px !important;
            margin-top: 8px !important;
          }
          #print-content .text-3xl {
            font-size: 16pt !important;
          }
          #print-content .text-2xl {
            font-size: 14pt !important;
          }
          #print-content .text-xl {
            font-size: 12pt !important;
          }
          #print-content .text-lg {
            font-size: 10pt !important;
          }
          #print-content .text-sm {
            font-size: 8pt !important;
          }
          #print-content .text-xs {
            font-size: 7pt !important;
          }
          #print-content .space-y-6 > * + * {
            margin-top: 8px !important;
          }
          #print-content .space-y-4 > * + * {
            margin-top: 6px !important;
          }
          #print-content .space-y-2 > * + * {
            margin-top: 3px !important;
          }
          #print-content .gap-4 {
            gap: 6px !important;
          }
          #print-content .gap-8 {
            gap: 12px !important;
          }
          #print-content .mb-2 {
            margin-bottom: 3px !important;
          }
          #print-content .mb-3 {
            margin-bottom: 6px !important;
          }
          #print-content .mb-6 {
            margin-bottom: 8px !important;
          }
          #print-content .mb-8 {
            margin-bottom: 10px !important;
          }
          #print-content .mt-2 {
            margin-top: 3px !important;
          }
          #print-content .mt-6 {
            margin-top: 8px !important;
          }
          #print-content .mt-8 {
            margin-top: 10px !important;
          }
          #print-content .p-4 {
            padding: 6px !important;
          }
          #print-content .pb-2 {
            padding-bottom: 3px !important;
          }
          #print-content .pb-4 {
            padding-bottom: 6px !important;
          }
          #print-content .pt-4 {
            padding-top: 6px !important;
          }
          #print-content .pt-6 {
            padding-top: 8px !important;
          }
          #print-content .border-b-2,
          #print-content .border-t-2 {
            border-width: 1px !important;
          }
          .bg-gray-50 {
            background-color: #f9fafb !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .bg-blue-100 {
            background-color: #dbeafe !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .bg-blue-100 {
            background-color: #dcfce7 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
