"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import { can, Permissions } from "../../../lib/rbac";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowRightOnRectangleIcon,
  PrinterIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { format, isWithinInterval, isBefore, startOfDay, isAfter, endOfDay, addDays, isEqual } from "date-fns";
import Swal from "sweetalert2";
import HousekeepingTable from '../room-management/housekeeping/page';
import usePagination from "../../../components/usePagination";

// List of countries for nationality dropdown
const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica",
  "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "East Timor", "Ecuador",
  "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau",
  "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar",
  "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia",
  "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal",
  "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan",
  "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
  "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia",
  "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
  "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan",
  "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela",
  "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

// Parse a YYYY-MM-DD string as a local date (avoids timezone shifts)
const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  const [year, month, day] = String(dateString).split("-").map((v) => parseInt(v, 10));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

// Helper function to format dates
const formatDateString = (dateString) => {
  if (!dateString) return "—";
  try {
    const d = parseLocalDate(dateString);
    return d ? format(d, "yyyy-MM-dd") : dateString;
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return currencyFormatter.format(0);
  }
  return currencyFormatter.format(numeric);
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const isFuture = (date) => {
  const today = startOfDay(new Date());
  return isAfter(date, today) || isEqual(date, today); // Allow today for walk-in reservations
};

// Helper function to validate email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to validate phone number
const isValidPhoneNumber = (phone) => {
  const phoneRegex = /^\+?\d{7,15}$/;
  return phoneRegex.test(phone);
};

// Search for returning customers by email, phone, or name
const searchCustomerHistory = async (searchTerm, token) => {
  try {
    const response = await fetch(`/api/reservation-history?customer_name=${encodeURIComponent(searchTerm)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Search failed:', response.status, errorData);
      throw new Error(errorData.error || errorData.details || 'Failed to search customers');
    }
    
    const data = await response.json();
    
    // Combine room and event reservations and extract unique customers
    const allReservations = [
      ...(data.roomReservations || []),
      ...(data.eventReservations || [])
    ];
    
    // Filter by email, phone, or name match (already filtered by API, but double-check)
    const matchingReservations = allReservations.filter(res => {
      const email = (res.customer_email || '').toLowerCase();
      const phone = (res.contact_number || '').replace(/\D/g, '');
      const name = (res.customer_name || '').toLowerCase();
      const searchTermClean = searchTerm.toLowerCase().replace(/\D/g, '');
      const searchTermLower = searchTerm.toLowerCase();
      
      return email.includes(searchTermLower) || 
             phone.includes(searchTermClean) ||
             name.includes(searchTermLower);
    });
    
    // Get unique customers (by email or name)
    const uniqueCustomers = [];
    const seen = new Set();
    
    matchingReservations.forEach(res => {
      const key = `${res.customer_email}-${res.customer_name}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCustomers.push({
          name: res.customer_name,
          email: res.customer_email,
          phone: res.contact_number,
          address: res.address,
          nationality: res.nationality,
          lastVisit: res.check_in_date || res.event_date || res.created_at
        });
      }
    });
    
    return uniqueCustomers;
  } catch (error) {
    console.error('Customer search error:', error);
    return [];
  }
};

import packagesData from "../../reservation/room-management/data/packages";

// expose as `packages` for existing code that expects that identifier
const packages = packagesData;

// Helper function to show notifications
const showNotification = (title, text, icon) => {
  return Swal.fire({
    title,
    text,
    icon,
    timer: 3000,
    showConfirmButton: false,
    toast: true,
    position: 'top-end',
    customClass: {
      popup: 'swal2-toast-custom'
    }
  });
};

  // Safe JSON parser for fetch responses (handles empty bodies)
  const safeJson = async (response) => {
    try {
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (err) {
      console.warn('Failed to parse JSON response:', err);
      return null;
    }
  };

export default function RoomManagement({ activeSubPage, isNarrow }) {
  const router = useRouter();
  const { user, token } = useAuth();
  const role = (user?.role) || '';
  const canManageRooms = can(role, Permissions.RoomManagement, 'manage');
  // Prevent users with the Security role from seeing management controls in the UI
  const isSecurity = (role || '').toLowerCase() === 'security';
  const allowManageRooms = canManageRooms && !isSecurity;
  const [rooms, setRooms] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusSearchTerm, setStatusSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "room_number", direction: "asc" });
  const [statusSortConfig, setStatusSortConfig] = useState({ key: "room_number", direction: "asc" });
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [viewRoom, setViewRoom] = useState(null);
  const [viewRoomPayments, setViewRoomPayments] = useState([]);
  const [housekeepingStatus, setHousekeepingStatus] = useState({});
  const [housekeepingNotes, setHousekeepingNotes] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  // Modal for collecting outstanding payments when checkout is blocked
  const [showCollectPaymentModal, setShowCollectPaymentModal] = useState(false);
  const [collectPaymentAmount, setCollectPaymentAmount] = useState(0);
  const [collectPaymentMethod, setCollectPaymentMethod] = useState('cash');
  const [collectPaymentNote, setCollectPaymentNote] = useState('');
  const [collectPaymentReference, setCollectPaymentReference] = useState('');
  const [pendingCheckoutRoom, setPendingCheckoutRoom] = useState(null);
  // Perform checkout without confirmation prompt (used after collecting outstanding payment)
  const doCheckoutNow = async (room) => {
    if (!room) return;
    if (!token) {
      showNotification('Error', 'Authentication token missing. Please sign in again.', 'error');
      return;
    }
    setCheckoutProcessing(true);
    try {
      const response = await fetch('/api/room/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId: room.id,
          paymentDetails: {
            source: 'room-management',
            cashierName: user?.name || user?.email || 'Room Management',
          },
          housekeepingNote: `Room ${room.room_number} checked out via Room Management. Ready for cleaning.`,
          customerName: room.reservation?.customerName || null,
          reservationId: room.reservation?.id || null,
          roomNumber: room.room_number,
        }),
      });

      if (!response.ok) {
        const errorBody = await safeJson(response);
        if (response.status === 402) {
          const msg = errorBody?.message || errorBody?.error || 'Outstanding payment required before checkout.';
          const outstanding = errorBody?.outstanding;
          const display = outstanding ? `${msg} Outstanding: ₱${Number(outstanding).toFixed(2)}` : msg;
          showNotification('Payment Required', display, 'warning');
          setCheckoutProcessing(false);
          return;
        }
        throw new Error(errorBody?.error || 'Failed to check out room');
      }

      const result = await safeJson(response);
      const successMessage = result?.message || `Room ${room.room_number} is marked as ready for cleaning.`;
      showNotification('Checked Out', successMessage, 'success');
      setShowModal(false);
      setViewRoom(null);
      setPendingCheckoutRoom(null);
      await fetchRooms(false);
      await fetchHousekeeping(false);
      await fetchBillingData();
    } catch (err) {
      console.error('Automatic checkout failed:', err);
      showNotification('Error', err.message || 'Failed to check out room', 'error');
    } finally {
      setCheckoutProcessing(false);
    }
  };

  // Submit the record-payment action from the collect-payment modal and retry checkout
  const submitCollectPayment = async () => {
    if (!pendingCheckoutRoom) {
      showNotification('Error', 'No pending checkout context found.', 'error');
      return;
    }
    const reservationId = pendingCheckoutRoom.reservation?.id;
    if (!reservationId) {
      showNotification('Error', 'Reservation not found for this room. Cannot record payment.', 'error');
      return;
    }

    // Basic validation
    const amount = Number(collectPaymentAmount || 0);
    if (!amount || amount <= 0) {
      showNotification('Error', 'Please enter a valid payment amount', 'error');
      return;
    }

    if ((collectPaymentMethod || '').toLowerCase() === 'gcash' && !collectPaymentReference) {
      showNotification('Error', 'Please enter GCash reference number', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(Object.assign({
          reservationId,
          amount,
          method: collectPaymentMethod || 'cash',
          type: 'payment',
          note: collectPaymentNote || `Payment collected during checkout for reservation ${reservationId}`,
        }, (collectPaymentMethod && collectPaymentMethod.toLowerCase() === 'gcash' && collectPaymentReference)
          ? { reference: collectPaymentReference }
          : {})),
      });

      if (!res.ok) {
        const body = await safeJson(res);
        throw new Error(body?.error || 'Failed to record payment');
      }

      // Notify other tabs about billing update
      try {
        localStorage.setItem('billing_updated_at', String(Date.now()));
      } catch (e) {
        // ignore
      }

      showNotification('Recorded', 'Payment recorded successfully. Retrying checkout...', 'success');
      setShowCollectPaymentModal(false);
      // Retry checkout now without extra confirmation
      await doCheckoutNow(pendingCheckoutRoom);
    } catch (err) {
      console.error('Failed to record payment:', err);
      showNotification('Error', err.message || 'Failed to record payment', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const memoizedStatus = useMemo(() => housekeepingStatus, [housekeepingStatus]);
  const memoizedNotes = useMemo(() => housekeepingNotes, [housekeepingNotes]);
  const [billingRows, setBillingRows] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState(null);
  
  // Returning customer lookup states
  const [customerLookup, setCustomerLookup] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [foundCustomers, setFoundCustomers] = useState([]);
  const [showCustomerLookup, setShowCustomerLookup] = useState(true);
  
  const [newRoom, setNewRoom] = useState({
    roomNumber: "",
    type: "",
    price: "",
    status: "Available",
    packageId: "",
  });
  const [reservation, setReservation] = useState({
    customerName: "",
    customerEmail: "",
    contactNumber: "",
    address: "",
    nationality: "",
    checkInDate: "",
    checkOutDate: "",
    additionalRequests: "",
    additionalGuests: 0,
    remarks: "",
    idUpload: null,
    roomId: "",
    paymentOption: "full", // "downpayment" or "full"
    downpaymentAmount: 0,
  });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDateBookings, setSelectedDateBookings] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [activeTab, setActiveTab] = useState("reservations");
  // Guard to ensure the check-out alert is shown only once per day/per session
  const checkoutAlertShownRef = useRef(false);

  // Dashboard stats
  const stats = useMemo(() => {
    const available = rooms.filter((r) => (r.status || '').toLowerCase() === 'available').length;
    const occupied = rooms.filter((r) => (r.status || '').toLowerCase() === 'occupied').length;
    const totalReservations = rooms.filter((r) => !!r.reservation).length;
    const totalRooms = rooms.length;
    
    // Calculate reservations for today (check-in today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reservationsForToday = rooms.filter(room => {
      if (!room.reservation || !room.reservation.checkInDate) return false;
      const checkInDate = parseLocalDate(room.reservation.checkInDate);
      if (!checkInDate) return false;
      checkInDate.setHours(0, 0, 0, 0);
      return isEqual(checkInDate, today);
    }).length;
    
    // Calculate check-outs due today
    const checkOutsToday = rooms.filter(room => {
      if (!room.reservation || !room.reservation.checkOutDate) return false;
      const checkOutDate = parseLocalDate(room.reservation.checkOutDate);
      if (!checkOutDate) return false;
      checkOutDate.setHours(0, 0, 0, 0);
      const status = (room.status || '').toLowerCase();
      return isEqual(checkOutDate, today) && (status === 'occupied' || status === 'reserved');
    });
    
    // Calculate balance to collect (total remaining balance + cafe payments)
    const balanceToCollect = billingRows.reduce((sum, billing) => {
      return sum + toNumber(billing.totalAmountDue || 0);
    }, 0);
    
    return { 
      available, 
      occupied, 
      totalReservations, 
      totalRooms,
      reservationsForToday,
      checkOutsToday: checkOutsToday.length,
      checkOutsList: checkOutsToday,
      balanceToCollect
    };
  }, [rooms, billingRows]);

  // If the user is housekeeping, default to the housekeeping tab
  useEffect(() => {
    try {
      const r = (user?.role || '').toLowerCase();
      if (r === 'housekeeping') {
        setActiveTab('housekeeping');
      }
    } catch (e) {
      // ignore
    }
  }, [user?.role]);

  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);

  // Fetch rooms and housekeeping data
  // `showLoading` controls whether we toggle the global full-screen loading overlay.
  // Background polls should set showLoading=false so the UI isn't blocked.
  const fetchRooms = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch("/api/room", { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!res.ok) throw new Error(`HTTP error ${res.status}: Failed to fetch rooms`);
      const data = await safeJson(res);
      setRooms((data || []).map(row => ({
        id: row.id,
        room_number: row.room_number,
        type: row.type,
        price: row.price,
        status: row.status,
        packageId: row.packageId,
        package: row.package,
        reservation: row.reservation,
      })));
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
      showNotification("Error", "Failed to load rooms. Please try again.", "error");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  // Fetch housekeeping statuses (extracted so we can poll)
  const fetchHousekeeping = async (showLoading = false) => {
    // Default to not showing the global loader for housekeeping polls
    if (showLoading) setIsLoading(true);
    try {
      const statuses = ['pending', 'in_progress', 'completed', 'inspected', 'Available'];
      const responses = await Promise.all(
        statuses.map(status =>
          fetch(`/api/housekeeping/by-status?status=${status}`)
            .then(res => res.ok ? safeJson(res) : [])
            .catch(err => {
              console.error(`Failed to fetch housekeeping for ${status}:`, err);
              return [];
            })
        )
      );
      const allHousekeeping = responses.flat();
      const statusObj = {};
      const notesObj = {};
      allHousekeeping.forEach(h => {
        statusObj[h.room_id] = h.status;
        notesObj[h.room_id] = h.notes || '';
      });
      setHousekeepingStatus(statusObj);
      setHousekeepingNotes(notesObj);

      // Also refresh rooms' status where housekeeping indicates a change
      // This keeps the rooms table in sync with housekeeping updates
      try {
        const resRooms = await fetch('/api/room', { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        if (resRooms.ok) {
          const data = await safeJson(resRooms);
          setRooms((data || []).map(row => ({
            id: row.id,
            room_number: row.room_number,
            type: row.type,
            price: row.price,
            status: row.status,
            packageId: row.packageId,
            package: row.package,
            reservation: row.reservation,
          })));
        }
      } catch (err) {
        console.warn('Failed to refresh rooms during housekeeping poll', err);
      }
    } catch (err) {
      console.error('Failed to fetch housekeeping:', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const fetchBillingData = useCallback(async () => {
    if (!token) {
      setBillingRows([]);
      setBillingError(null);
      return;
    }
    setBillingLoading(true);
    setBillingError(null);
    try {
      const response = await fetch("/api/room?scope=billing", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await safeJson(response);
        throw new Error(body?.error || `HTTP ${response.status}: Failed to fetch billing summary`);
      }

      const payload = await safeJson(response);
      const rows = Array.isArray(payload?.roomReservations) ? payload.roomReservations : [];
      const normalized = rows.map((row) => {
        const billedTotal = toNumber(row.billed_total ?? row.total ?? row.total_price ?? row.price ?? row.base_total);
        const downpaymentRequired = toNumber(row.downpayment_required ?? row.downpayment_amount);
        const downpaymentPaid = toNumber(row.downpayment_paid_amount ?? row.downpayment);
        const paymentsApplied = toNumber(row.payments_applied);
    // Prefer aggregated cafe payments from the room billing API. Fall back to receipt_total if present.
    const cafePayment = toNumber(row.cafe_payments ?? row.cafePayment ?? row.receipt_total ?? 0);
        const remainingBalance = row.remaining_balance !== undefined && row.remaining_balance !== null
          ? toNumber(row.remaining_balance)
          : toNumber(Math.max(billedTotal - downpaymentPaid - paymentsApplied, 0));
        const totalPaidFromRow = row.total_paid_amount !== undefined && row.total_paid_amount !== null
          ? toNumber(row.total_paid_amount)
          : toNumber(downpaymentPaid + paymentsApplied);
        const downpaymentDisplay = downpaymentPaid > 0 ? downpaymentPaid : downpaymentRequired;
        const totalAmountDue = toNumber(remainingBalance + Math.max(0, cafePayment));

        const reference = row.reference_number ?? row.reference ?? row.payment_reference ?? row.last_payment_reference ?? (row.payments && Array.isArray(row.payments) && row.payments[0] && (row.payments[0].reference_number || row.payments[0].reference)) ?? null;

        return {
          reservationId: row.id,
          roomId: row.room_id,
          roomNumber: row.room_number,
          roomType: row.package_name,
          reference,
          customerName: row.customer_name,
          totalPayment: billedTotal,
          downpaymentRequired,
          downpaymentPaid,
          downpaymentDisplay,
          paymentsApplied,
          remainingBalance,
          cafePayment,
          totalAmountDue,
          totalPaid: totalPaidFromRow,
          paymentOption: row.payment_option,
          status: row.status,
          approvalStatus: row.approval_status,
          checkInDate: row.check_in_date,
          checkOutDate: row.check_out_date,
        };
      });

      setBillingRows(normalized);
    } catch (error) {
      console.error("Failed to fetch billing summary:", error);
      setBillingRows([]);
      setBillingError(error.message || "Failed to fetch billing summary");
    } finally {
      setBillingLoading(false);
    }
  }, [token]);

  const handleCheckoutRoom = async (room) => {
    if (!room) return;
    if (!allowManageRooms) {
      showNotification('Unauthorized', 'You do not have permission to perform check-out.', 'error');
      return;
    }
    if (checkoutProcessing) return;

    const normalizedStatus = (room.status || '').toLowerCase();
    const hasActiveReservation = room.reservation && ['occupied', 'reserved'].includes(normalizedStatus);
    if (!hasActiveReservation) {
      showNotification('Info', 'This room has no active stay to check out.', 'info');
      return;
    }

    const confirmation = await Swal.fire({
      title: `Check out Room ${room.room_number}?`,
      text: 'The room will be freed, marked for cleaning, and housekeeping will be notified.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, check out',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#059669',
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) return;

    if (!token) {
      showNotification('Error', 'Authentication token missing. Please sign in again.', 'error');
      return;
    }

    setCheckoutProcessing(true);
    try {
      const response = await fetch('/api/room/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId: room.id,
          paymentDetails: {
            source: 'room-management',
            cashierName: user?.name || user?.email || 'Room Management',
          },
          housekeepingNote: `Room ${room.room_number} checked out via Room Management. Ready for cleaning.`,
          customerName: room.reservation?.customerName || null,
          reservationId: room.reservation?.id || null,
          roomNumber: room.room_number,
        }),
      });

      if (!response.ok) {
        const errorBody = await safeJson(response);
        // If server indicates outstanding payment (402), show a friendly notice with amount
  if (response.status === 402) {
   const msg = errorBody?.message || errorBody?.error || 'Outstanding payment required before checkout.';
   const outstanding = errorBody?.outstanding;
   const display = outstanding ? `${msg} Outstanding: ₱${Number(outstanding).toFixed(2)}` : msg;
   // Instead of only showing a toast, open an in-place modal so staff can record the missing payment
   showNotification('Payment Required', display, 'warning');
   // Prefill modal with outstanding amount and reservation + room info so staff can collect payment
   setCollectPaymentAmount(Number(outstanding) || 0);
   setCollectPaymentMethod('cash');
   setCollectPaymentNote(`Collected during checkout for Room ${room.room_number}`);
   setPendingCheckoutRoom(room);
   setShowCollectPaymentModal(true);
   setCheckoutProcessing(false);
   return;
  }
        throw new Error(errorBody?.error || 'Failed to check out room');
      }

      const result = await safeJson(response);
      const successMessage = result?.message || `Room ${room.room_number} is marked as ready for cleaning.`;
      showNotification('Checked Out', successMessage, 'success');
      setShowModal(false);
      setViewRoom(null);
      await fetchRooms(false);
      await fetchHousekeeping(false);
      await fetchBillingData();
    } catch (err) {
      console.error('Manual checkout failed:', err);
      showNotification('Error', err.message || 'Failed to check out room', 'error');
    } finally {
      setCheckoutProcessing(false);
    }
  };

  useEffect(() => {
    // initial load (show global loader)
    fetchRooms(true);
    fetchHousekeeping(true);

    // poll for updates every 10 seconds (do not show global loader on background polls)
    const interval = setInterval(() => {
      fetchHousekeeping(false);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!token) {
      setBillingRows([]);
      return;
    }
    fetchBillingData();
  }, [token, fetchBillingData]);

  // Listen for billing updates from other tabs/windows (e.g., POS charged a cafe bill)
  useEffect(() => {
    const handler = (e) => {
      try {
        if (!e) return;
        if (e.key === 'billing_updated_at') {
          // Fetch latest billing data
          fetchBillingData();
        }
      } catch (err) {
        console.warn('Storage event handler error:', err);
      }
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [fetchBillingData]);

  // Filter bookings for selected date (interpreting stored dates as local calendar dates)
  useEffect(() => {
    const selectedDay = startOfDay(selectedDate);
    const bookings = rooms.filter((room) => {
      if (!room.reservation) return false;
      const start = parseLocalDate(room.reservation.checkInDate);
      const endRaw = parseLocalDate(room.reservation.checkOutDate);
      if (!start || !endRaw) return false;
      // Treat dates as full local days; include checkout day in calendar
      const end = endOfDay(endRaw);
      return isWithinInterval(selectedDay, { start, end });
    });
    setSelectedDateBookings(bookings);
  }, [rooms, selectedDate]);

  // Check-out notification system - alerts staff when reservations reach their check-out date
  useEffect(() => {
    if (!rooms || rooms.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all rooms that are due for check-out today
    const roomsDueForCheckout = rooms.filter((room) => {
      if (!room.reservation || !room.reservation.checkOutDate) return false;
      
      const checkOutDate = parseLocalDate(room.reservation.checkOutDate);
      if (!checkOutDate) return false;
      
      checkOutDate.setHours(0, 0, 0, 0);
      
      // Check if checkout date is today and room is still occupied
      const status = (room.status || '').toLowerCase();
      return isEqual(checkOutDate, today) && (status === 'occupied' || status === 'reserved');
    });

    // Show notification if there are rooms due for check-out
    if (roomsDueForCheckout.length > 0) {
      const roomNumbers = roomsDueForCheckout.map(r => r.room_number).join(', ');
      const customerNames = roomsDueForCheckout.map(r => r.reservation?.customerName || 'Guest').join(', ');

      // Build a per-day key so the alert is shown only once per day per browser
      const key = `checkout_alert_shown_${format(today, 'yyyy-MM-dd')}`;
      let alreadyShown = false;
      try {
        if (checkoutAlertShownRef.current) {
          alreadyShown = true;
        } else {
          const v = localStorage.getItem(key);
          if (v) alreadyShown = true;
        }
      } catch (e) {
        // localStorage may be unavailable in some environments; fallback to in-memory ref
        if (checkoutAlertShownRef.current) alreadyShown = true;
      }

      if (alreadyShown) return;

      // Mark as shown (set both ref and localStorage where possible) before displaying
      checkoutAlertShownRef.current = true;
      try {
        localStorage.setItem(key, String(Date.now()));
      } catch (e) {
        // ignore localStorage errors
      }

      // Show a more prominent notification with action button
      Swal.fire({
        title: '🔔 Check-Out Due Today',
        html: `
          <div style="text-align: left;">
            <p style="margin-bottom: 12px;"><strong>${roomsDueForCheckout.length} room(s)</strong> scheduled for check-out today:</p>
            <ul style="list-style: none; padding-left: 0;">
              ${roomsDueForCheckout.map(room => `
                <li style="padding: 8px; margin: 4px 0; background: #f3f4f6; border-radius: 6px;">
                  <strong>Room ${room.room_number}</strong> - ${room.reservation?.customerName || 'Guest'}
                </li>
              `).join('')}
            </ul>
          </div>
        `,
        icon: 'info',
        confirmButtonText: 'View Reservations',
        showCancelButton: true,
        cancelButtonText: 'Dismiss',
        confirmButtonColor: '#059669',
        cancelButtonColor: '#6b7280',
        timer: 15000,
        timerProgressBar: true,
        toast: false,
        position: 'center',
        backdrop: true,
        allowOutsideClick: true,
      }).then((result) => {
        if (result.isConfirmed) {
          // Scroll to reservations table or highlight the rooms
          const reservationsSection = document.getElementById('reservations-section');
          if (reservationsSection) {
            reservationsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    }
  }, [rooms]); // Only run when rooms data changes

  const tileClassName = ({ date, view }) => {
    if (view !== "month") return "";
    const day = startOfDay(date);

    let hasReserved = false;
    let hasOccupied = false;

    rooms.forEach((room) => {
      if (room.reservation?.checkInDate && room.reservation?.checkOutDate) {
        const checkIn = parseLocalDate(room.reservation.checkInDate);
        const checkOut = endOfDay(parseLocalDate(room.reservation.checkOutDate));

        if (checkIn && checkOut && isWithinInterval(day, { start: checkIn, end: checkOut })) {
          const status = room.status.trim().toLowerCase();
          if (status === "reserved") hasReserved = true;
          if (status === "occupied") hasOccupied = true;
        }
      }
    });

    if (hasOccupied) return "occupied-day";
    if (hasReserved) return "reserved-day";
    return "";
  };

  const tileDisabled = ({ date, view }) => {
    if (view !== 'month') return false;
    const today = startOfDay(new Date());
    return isBefore(date, today);
  };

  // Camera handling
  const startCamera = async () => {
    setShowCameraModal(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      showNotification("Error", "Failed to access camera. Please check permissions.", "error");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
    setShowCameraModal(false);
  };

  // Handle customer search
  const handleCustomerSearch = async () => {
    if (!customerLookup.trim()) return;
    
    setLookupLoading(true);
    setFoundCustomers([]);
    
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const customers = await searchCustomerHistory(customerLookup.trim(), token);
      
      setFoundCustomers(customers);
      
      if (customers.length === 0) {
        showNotification("Info", "No previous reservations found for this customer", "info");
      } else if (customers.length === 1) {
        // Auto-load if only one customer found
        loadCustomerData(customers[0]);
        showNotification("Success", "Customer information loaded", "success");
      }
    } catch (error) {
      showNotification("Error", "Failed to search customer history", "error");
    } finally {
      setLookupLoading(false);
    }
  };

  // Load customer data into form
  const loadCustomerData = (customer) => {
    setReservation({
      ...reservation,
      customerName: customer.name || '',
      customerEmail: customer.email || '',
      contactNumber: customer.phone || '',
      address: customer.address || '',
      nationality: customer.nationality || ''
    });
    setShowCustomerLookup(false);
    setFoundCustomers([]);
    setCustomerLookup('');
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/png");
  setReservation({ ...reservation, idUpload: dataUrl });
  // Photo capture is an internal UX action; suppress success toast to comply with
  // the policy of showing success notifications only for Add/Update/Delete.
    } else {
      showNotification("Error", "Failed to capture photo", "error");
    }
    stopCamera();
  };

  // Handle ID upload
  const handleIdUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
        showNotification("Error", "Please upload a valid image file (PNG or JPEG)", "error");
        return;
      }
      const reader = new FileReader();
        reader.onloadend = () => {
        setReservation({ ...reservation, idUpload: reader.result });
        // ID upload acknowledged in-UI (preview). No success toast emitted per notification policy.
      };
      reader.onerror = () => {
        showNotification("Error", "Failed to upload ID", "error");
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle add room
  const handleAddRoom = async () => {
    setIsLoading(true);
    try {
      if (!newRoom.roomNumber || !newRoom.type || !newRoom.price || !newRoom.packageId) {
        throw new Error("Please fill in all required fields");
      }
      const res = await fetch("/api/room/editroom", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          room_number: newRoom.roomNumber,
          type: newRoom.type,
          price: newRoom.price,
          status: newRoom.status,
          packageId: newRoom.packageId,
        }),
      });
      if (!res.ok) {
  const errorData = await safeJson(res);
        throw new Error(errorData.error || "Failed to add room");
      }
      const updatedRooms = await fetch("/api/room").then((r) => {
        if (!r.ok) throw new Error("Failed to fetch updated rooms");
  return safeJson(r);
      });
      setRooms(updatedRooms);
      setShowModal(false);
      setNewRoom({
        roomNumber: "",
        type: "",
        price: "",
        status: "Available",
        packageId: "",
      });
  showNotification("Added", "Room added successfully!", "success");
    } catch (err) {
      console.error("Error adding room:", err);
      showNotification("Error", err.message || "Failed to add room. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle edit room
  const handleEditRoom = (room) => {
    setSelectedRoom(room);
    setModalMode("edit");
    setNewRoom({
      roomNumber: room.room_number,
      type: room.type,
      price: room.price,
      status: room.status,
      packageId: room.packageId,
    });
    setReservation(room.reservation || {
      customerName: "",
      customerEmail: "",
      contactNumber: "",
      address: "",
      nationality: "",
      additionalGuests: 0,
      additionalRequests: "",
      remarks: "",
      checkInDate: "",
      checkOutDate: "",
      idUpload: null,
    });
    setSelectedPackageId(room.packageId || "");
    setShowModal(true);
  };

  // Validate reservation data
  const validateReservation = () => {
    if (!selectedPackageId) return "Please select a package";
    if (!reservation.customerName || !reservation.customerEmail ||
      !reservation.contactNumber || !reservation.checkInDate ||
      !reservation.checkOutDate) {
      return "Please fill in all required fields";
    }
    if (!isValidEmail(reservation.customerEmail)) {
      return "Please enter a valid email address";
    }
    if (!isValidPhoneNumber(reservation.contactNumber)) {
      return "Please enter a valid phone number (7-15 digits, optional '+' prefix)";
    }
    if (!reservation.idUpload) {
      return "Please upload a valid ID";
    }
    const checkIn = parseLocalDate(reservation.checkInDate) || new Date();
    const checkOut = parseLocalDate(reservation.checkOutDate) || new Date();
    if (checkOut <= checkIn) {
      return "Check-out date must be after check-in date";
    }
    if (!isFuture(checkIn) || !isFuture(checkOut)) {
      return "Check-in and check-out dates cannot be in the past";
    }
    return null;
  };

  // Helper function to get maximum guests allowed for selected package
  const getMaxGuestsForPackage = (packageId) => {
    if (!packageId) return 0;
    const selectedPkg = packages.find(p => p.id === parseInt(packageId));
    if (!selectedPkg || !selectedPkg.guests) return 0;
    
    const guestsStr = selectedPkg.guests;
    // Parse guest limits like "1-2", "2", "3", "4", "8"
    const match = guestsStr.match(/(\d+)(?:-(\d+))?/);
    if (match) {
      // If range (e.g., "1-2"), return the max value
      const maxGuests = match[2] ? parseInt(match[2]) : parseInt(match[1]);
      return maxGuests;
    }
    return 0;
  };

  // Print reservation info for client
  const printReservationInfo = (reservationInfo) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the reservation confirmation.');
      return;
    }

    // Calculate payment details
    const selectedPkg = packages.find(p => p.id === parseInt(reservationInfo.packageId || selectedPackageId));
    const packagePrice = selectedPkg?.price ? parseFloat(selectedPkg.price.replace(/[₱,]/g, '')) : 0;
    const nights = reservationInfo.nights || 1;
    const totalPrice = reservationInfo.totalPrice || ((nights * packagePrice) - packagePrice);
    
    let paymentStatus = '';
    let paymentDetails = '';
    let remainingBalance = 0;
    
    if (reservationInfo.paymentOption === 'downpayment') {
      const downpayment = parseFloat(reservationInfo.downpaymentAmount || 0);
      remainingBalance = totalPrice - downpayment;
      paymentStatus = 'Partial Payment (Downpayment)';
      paymentDetails = `
        <div class="payment-section">
          <div class="section-title">Payment Rundown</div>
          <div class="info-row">
            <div class="info-label">Package Rate:</div>
            <div class="info-value">₱${packagePrice.toFixed(2)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Number of Nights:</div>
            <div class="info-value">${nights} night(s)</div>
          </div>
          <div class="info-row">
            <div class="info-label">Subtotal:</div>
            <div class="info-value">₱${(nights * packagePrice).toFixed(2)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Discount (1st night):</div>
            <div class="info-value" style="color: #10b981;">- ₱${packagePrice.toFixed(2)}</div>
          </div>
          <div class="info-row" style="border-top: 2px solid #10b981; margin-top: 8px; padding-top: 8px;">
            <div class="info-label" style="font-size: 14px;">Total Amount:</div>
            <div class="info-value" style="font-size: 14px; font-weight: bold;">₱${totalPrice.toFixed(2)}</div>
          </div>
          <div class="info-row" style="background: #f0fdf4; margin: 10px -10px; padding: 8px 10px;">
            <div class="info-label">Downpayment Paid:</div>
            <div class="info-value" style="color: #10b981; font-weight: bold;">₱${downpayment.toFixed(2)}</div>
          </div>
          <div class="info-row" style="background: #fef2f2; margin: 0 -10px 10px; padding: 8px 10px;">
            <div class="info-label">Remaining Balance:</div>
            <div class="info-value" style="color: #ef4444; font-weight: bold;">₱${remainingBalance.toFixed(2)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Payment Status:</div>
            <div class="info-value"><span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px;">PARTIAL PAYMENT</span></div>
          </div>
        </div>
      `;
    } else {
      paymentStatus = 'Payment Due at Checkout';
      remainingBalance = totalPrice;
      paymentDetails = `
        <div class="payment-section">
          <div class="section-title">Payment Rundown</div>
          <div class="info-row">
            <div class="info-label">Package Rate:</div>
            <div class="info-value">₱${packagePrice.toFixed(2)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Number of Nights:</div>
            <div class="info-value">${nights} night(s)</div>
          </div>
          <div class="info-row">
            <div class="info-label">Subtotal:</div>
            <div class="info-value">₱${(nights * packagePrice).toFixed(2)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Discount (1st night):</div>
            <div class="info-value" style="color: #10b981;">- ₱${packagePrice.toFixed(2)}</div>
          </div>
          <div class="info-row" style="border-top: 2px solid #10b981; margin-top: 8px; padding-top: 8px;">
            <div class="info-label" style="font-size: 14px;">Total Amount Due:</div>
            <div class="info-value" style="font-size: 14px; font-weight: bold; color: #ef4444;">₱${totalPrice.toFixed(2)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Payment Status:</div>
            <div class="info-value"><span style="background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 12px;">DUE AT CHECKOUT</span></div>
          </div>
        </div>
      `;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reservation Contract - SRCB</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              max-width: 1000px;
              margin: 0 auto;
              line-height: 1.6;
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #10b981;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 32px;
              font-weight: bold;
              color: #10b981;
              margin-bottom: 10px;
            }
            .subtitle {
              color: #666;
              font-size: 14px;
            }
            .confirmation-number {
              background: #f0fdf4;
              border: 2px solid #10b981;
              padding: 15px;
              text-align: center;
              margin: 20px 0;
              border-radius: 8px;
            }
            .confirmation-number strong {
              color: #10b981;
              font-size: 18px;
            }
            .two-column-layout {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin: 25px 0;
            }
            .column {
              min-width: 0;
            }
            .section {
              margin-bottom: 25px;
            }
            .payment-section {
              grid-column: 1 / -1;
              background: #f9fafb;
              border: 2px solid #10b981;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .section-title {
              font-size: 16px;
              font-weight: bold;
              color: #10b981;
              margin-bottom: 12px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 6px;
            }
            .info-row {
              display: flex;
              padding: 6px 0;
              border-bottom: 1px solid #f3f4f6;
            }
            .info-label {
              font-weight: 600;
              width: 180px;
              color: #374151;
              font-size: 13px;
            }
            .info-value {
              flex: 1;
              color: #1f2937;
              font-size: 13px;
            }
            .full-width-section {
              grid-column: 1 / -1;
              margin-top: 20px;
            }
            .terms-section {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              font-size: 13px;
            }
            .terms-section h3 {
              color: #92400e;
              margin-bottom: 10px;
              font-size: 14px;
            }
            .terms-section ul {
              margin-left: 20px;
              margin-top: 8px;
            }
            .terms-section li {
              margin-bottom: 5px;
            }
            .signature-section {
              grid-column: 1 / -1;
              margin-top: 40px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
            }
            .signature-box {
              border-top: 2px solid #000;
              padding-top: 10px;
              text-align: center;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
            @page {
              size: A4;
              margin: 15mm;
            }
            @media print {
              body { 
                padding: 20px;
                width: 210mm;
                min-height: 297mm;
              }
              .no-print { display: none; }
            }
            .print-button {
              background: #10b981;
              color: white;
              border: none;
              padding: 12px 30px;
              font-size: 16px;
              border-radius: 6px;
              cursor: pointer;
              margin: 20px auto;
              display: block;
            }
            .print-button:hover {
              background: #059669;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">🏨 SRCB</div>
            <div class="subtitle">Reservation Contract & Agreement</div>
          </div>

          <div class="confirmation-number">
            <strong>Confirmation #: ${reservationInfo.confirmationNumber}</strong>
            <div style="margin-top: 5px; font-size: 12px; color: #666;">
              Created: ${reservationInfo.createdAt}
            </div>
          </div>

          <div class="two-column-layout">
            <div class="column">
              <div class="section">
                <div class="section-title">Guest Information</div>
                <div class="info-row">
                  <div class="info-label">Name:</div>
                  <div class="info-value">${reservationInfo.customerName}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Email:</div>
                  <div class="info-value">${reservationInfo.customerEmail}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Contact Number:</div>
                  <div class="info-value">${reservationInfo.contactNumber}</div>
                </div>
                ${reservationInfo.address ? `
                <div class="info-row">
                  <div class="info-label">Address:</div>
                  <div class="info-value">${reservationInfo.address}</div>
                </div>
                ` : ''}
                ${reservationInfo.nationality ? `
                <div class="info-row">
                  <div class="info-label">Nationality:</div>
                  <div class="info-value">${reservationInfo.nationality}</div>
                </div>
                ` : ''}
              </div>
            </div>

            <div class="column">
              <div class="section">
                <div class="section-title">Reservation Details</div>
                <div class="info-row">
                  <div class="info-label">Room Number:</div>
                  <div class="info-value">${reservationInfo.roomNumber}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Package:</div>
                  <div class="info-value">${reservationInfo.packageName}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Package Price (per night):</div>
                  <div class="info-value">${reservationInfo.packagePrice}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Number of Nights:</div>
                  <div class="info-value">${nights}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Check-in Date:</div>
                  <div class="info-value">${new Date(reservationInfo.checkInDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Check-out Date:</div>
                  <div class="info-value">${new Date(reservationInfo.checkOutDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</div>
                </div>
                ${reservationInfo.additionalGuests > 0 ? `
                <div class="info-row">
                  <div class="info-label">Additional Guests:</div>
                  <div class="info-value">${reservationInfo.additionalGuests}</div>
                </div>
                ` : ''}
                ${reservationInfo.additionalRequests ? `
                <div class="info-row">
                  <div class="info-label">Special Requests:</div>
                  <div class="info-value">${reservationInfo.additionalRequests}</div>
                </div>
                ` : ''}
                ${reservationInfo.remarks ? `
                <div class="info-row">
                  <div class="info-label">Remarks:</div>
                  <div class="info-value">${reservationInfo.remarks}</div>
                </div>
                ` : ''}
              </div>
            </div>

            ${paymentDetails}
          </div>

          <div class="terms-section full-width-section">
            <h3>📋 TERMS & CONDITIONS OF STAY</h3>
            <ul style="list-style-type: disc; margin-left: 20px;">
              <li>A valid identification card must be presented upon check-in.</li>
              
              <li>All guests arriving must register with the Hotel's Front Desk. Check-in time is 2:00 p.m. and check-out time is 12:00 noon.</li>
              
              <li>Should you wish to stay beyond the designated check-out time, please inform the Front Desk. Early check-in and check-out are subject to an additional charge and room availability.</li>
              
              <li>Proper courtesy must be observed at all times. The privacy of other guests must be respected.</li>
              
              <li>Money, valuables, and important documents must be kept in the safety deposit box located inside your room. The hotel will not be held liable for any loss.</li>
              
              <li>Gambling and possession of illegal drugs are not allowed within the hotel premises.</li>
              
              <li>Towels, linens, and appliances should not be brought out or transferred to another room to avoid unnecessary charges.</li>
              
              <li>Amenities are provided for your comfort during your stay. Should you wish to request additional items, please call the Front Desk.</li>
              
              <li>Smoking inside the room and bringing food with a strong odor are not allowed. A fine of ₱5,000.00 for fumigation shall be charged for non-compliance.</li>
              
              <li style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #d97706;"><strong>By affixing your signature (whether personally, through an agent, or a representative), you hereby agree to the terms and conditions set forth herein and consent to the collection and processing of your data by the hotel, in accordance with the Data Privacy Act and the regulations of the National Privacy Commission (NPC).</strong></li>
            </ul>
            
            ${reservationInfo.paymentOption === 'downpayment' ? `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #f59e0b;">
              <h4 style="color: #92400e; margin-bottom: 8px; font-size: 13px;">💰 Payment Terms:</h4>
              <ul style="list-style-type: circle; margin-left: 20px;">
                <li><strong>Balance of ₱${remainingBalance.toFixed(2)} must be paid at checkout</strong></li>
                <li>Downpayment is non-refundable unless cancellation is made 48 hours in advance</li>
              </ul>
            </div>
            ` : `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #f59e0b;">
              <h4 style="color: #92400e; margin-bottom: 8px; font-size: 13px;">💰 Payment Terms:</h4>
              <ul style="list-style-type: circle; margin-left: 20px;">
                <li>Full payment of ₱${totalPrice.toFixed(2)} is due at checkout</li>
                <li>Cancellations must be made 48 hours in advance</li>
              </ul>
            </div>
            `}
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <strong>Guest Signature</strong>
              <div style="margin-top: 5px; font-size: 11px; color: #666;">
                ${reservationInfo.customerName}
              </div>
            </div>
            <div class="signature-box">
              <strong>Hotel Representative</strong>
              <div style="margin-top: 5px; font-size: 11px; color: #666;">
                SRCB Management
              </div>
            </div>
          </div>

          <button class="print-button no-print" onclick="window.print()">🖨️ Print This Contract</button>

          <div class="footer">
            <p><strong>SRCB</strong></p>
            <p>Thank you for choosing us! We look forward to hosting you.</p>
            <p style="margin-top: 10px;">For inquiries or changes, please contact our front desk.</p>
            <p style="margin-top: 5px; font-size: 11px;">This is a binding contract between the guest and SRCB</p>
          </div>

          <script>
            // Auto-print after page loads
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  // Handle save reservation
  const handleSaveReservation = async () => {
    setIsLoading(true);
    try {
      const validationError = validateReservation();
      if (validationError) {
        throw new Error(validationError);
      }

      // Validate downpayment if payment option is downpayment
      if (reservation.paymentOption === 'downpayment') {
        const downAmount = parseFloat(reservation.downpaymentAmount || 0);
        if (downAmount <= 0) {
          throw new Error("Please enter a valid downpayment amount");
        }
        
        // Calculate total to validate downpayment doesn't exceed total
        const selectedPkg = packages.find(p => p.id === parseInt(selectedPackageId));
        if (selectedPkg) {
          const pkgPrice = parseFloat(selectedPkg.price.replace(/[₱,]/g, ''));
          const checkIn = parseLocalDate(reservation.checkInDate) || new Date();
          const checkOut = parseLocalDate(reservation.checkOutDate) || new Date();
          const nights = Math.max(1, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
          const totalPrice = (nights * pkgPrice) - pkgPrice;
          
          if (downAmount > totalPrice) {
            throw new Error("Downpayment amount cannot exceed total price");
          }
        }
      }

      const reservationData = {
        packageId: selectedPackageId,
        customerName: reservation.customerName,
        customerEmail: reservation.customerEmail,
        contactNumber: reservation.contactNumber,
        address: reservation.address,
        nationality: reservation.nationality,
        additionalGuests: reservation.additionalGuests || 0,
        additionalRequests: reservation.additionalRequests || "",
        remarks: reservation.remarks || "",
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        idUpload: reservation.idUpload,
      };

      const response = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(reservationData),
      });

      const result = await safeJson(response);
      if (!response.ok) {
        throw new Error(result.error || "Failed to create reservation");
      }

      const reservationId = result.reservation?.id;
      
      // Process downpayment if selected
      if (reservation.paymentOption === 'downpayment' && reservationId) {
        try {
          const downpaymentResponse = await fetch("/api/payments", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({
              reservationId: reservationId,
              amount: parseFloat(reservation.downpaymentAmount),
              method: 'cash',
              type: 'downpayment',
              note: `Downpayment for reservation ${reservationId}`
            }),
          });

          if (!downpaymentResponse.ok) {
            console.error('Failed to record downpayment');
            showNotification("Warning", "Reservation created but downpayment was not recorded. Please record manually.", "warning");
          }
        } catch (paymentError) {
          console.error('Payment error:', paymentError);
          showNotification("Warning", "Reservation created but downpayment was not recorded. Please record manually.", "warning");
        }
      }

      // Calculate nights for display
      const checkIn = parseLocalDate(reservation.checkInDate) || new Date();
      const checkOut = parseLocalDate(reservation.checkOutDate) || new Date();
      const nights = Math.max(1, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));

      // Store reservation info for printing
      const selectedPkg = packages.find(p => p.id === parseInt(selectedPackageId));
      const packagePrice = selectedPkg?.price ? parseFloat(selectedPkg.price.replace(/[₱,]/g, '')) : 0;
      const totalPrice = (nights * packagePrice) - packagePrice;
      
      const reservationInfo = {
        ...reservationData,
        packageId: selectedPackageId,
        roomNumber: result.reservation?.roomNumber || result.roomId || 'N/A',
        packageName: selectedPkg?.name || 'N/A',
        packagePrice: selectedPkg?.price || 'N/A',
        confirmationNumber: reservationId || Date.now(),
        createdAt: new Date().toLocaleString(),
        nights: nights,
        totalPrice: totalPrice,
        paymentOption: reservation.paymentOption,
        downpaymentAmount: reservation.downpaymentAmount
      };

      setShowModal(false);
      setSelectedPackageId("");
      setReservation({
        customerName: "",
        customerEmail: "",
        contactNumber: "",
        address: "",
        nationality: "",
        checkInDate: "",
        checkOutDate: "",
        additionalRequests: "",
        additionalGuests: 0,
        remarks: "",
        idUpload: null,
        paymentOption: "full",
        downpaymentAmount: 0,
      });

      const roomsResponse = await fetch("/api/room", { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!roomsResponse.ok) throw new Error("Failed to fetch updated rooms");
      const updatedRooms = await safeJson(roomsResponse);
      setRooms(updatedRooms.map(row => ({
        id: row.id,
        room_number: row.room_number,
        type: row.type,
        price: row.price,
        status: row.status,
        packageId: row.packageId,
        package: row.package,
        reservation: row.reservation,
      })));

      showNotification("Added", `Reservation created successfully for Room ${result.roomId}`, "success");
      
      // Ask if user wants to print contract and bill
      const shouldPrint = await Swal.fire({
        title: 'Reservation Created Successfully!',
        html: `
          <p>Room ${result.roomId} has been reserved for ${reservation.customerName}.</p>
          ${reservation.paymentOption === 'downpayment' ? 
            `<p class="text-green-600 font-semibold mt-2">Downpayment of ₱${parseFloat(reservation.downpaymentAmount).toFixed(2)} recorded.</p>` : 
            `<p class="text-blue-600 font-semibold mt-2">Payment due at checkout.</p>`
          }
          <p class="mt-3">Would you like to print the contract and bill?</p>
        `,
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: '🖨️ Print Contract & Bill',
        cancelButtonText: 'Skip',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
      });

      if (shouldPrint.isConfirmed) {
        printReservationInfo(reservationInfo);
      }
    } catch (error) {
      console.error("Reservation error:", error);
      showNotification("Error", error.message || "An error occurred while creating the reservation", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle edit reservation
  const handleEditReservation = async () => {
    setIsLoading(true);
    try {
      if (!selectedRoom) {
        throw new Error("No room selected for editing");
      }

      const validationError = validateReservation();
      if (validationError) {
        throw new Error(validationError);
      }

      const reservationData = {
        status: newRoom.status,
        packageId: selectedPackageId || selectedRoom.packageId,
        reservation: {
          customerName: reservation.customerName,
          customerEmail: reservation.customerEmail,
          contactNumber: reservation.contactNumber,
          address: reservation.address,
          nationality: reservation.nationality,
          additionalGuests: reservation.additionalGuests || 0,
          additionalRequests: reservation.additionalRequests || "",
          remarks: reservation.remarks || "",
          checkInDate: reservation.checkInDate,
          checkOutDate: reservation.checkOutDate,
          idUpload: reservation.idUpload,
        },
      };

      const response = await fetch(`/api/room/${selectedRoom.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(reservationData),
      });

  const result = await safeJson(response);
      if (!response.ok) {
        throw new Error(result.error || "Failed to update reservation");
      }

      setShowModal(false);
      setSelectedRoom(null);
      setSelectedPackageId("");
      setReservation({
        customerName: "",
        customerEmail: "",
        contactNumber: "",
        address: "",
        nationality: "",
        checkInDate: "",
        checkOutDate: "",
        additionalRequests: "",
        additionalGuests: 0,
        remarks: "",
        idUpload: null,
      });

  const roomsResponse = await fetch("/api/room", { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!roomsResponse.ok) throw new Error("Failed to fetch updated rooms");
  const updatedRooms = await safeJson(roomsResponse);
      setRooms(updatedRooms.map(row => ({
        id: row.id,
        room_number: row.room_number,
        type: row.type,
        price: row.price,
        status: row.status,
        packageId: row.packageId,
        package: row.package,
        reservation: row.reservation,
      })));

  showNotification("Updated", `Reservation updated successfully for Room ${selectedRoom.room_number}`, "success");
    } catch (error) {
      console.error("Edit reservation error:", error);
      showNotification("Error", error.message || "An error occurred while updating the reservation", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete reservation
  const handleDeleteReservation = async (reservationId) => {
    const room = rooms.find(r => r.reservation?.id === reservationId);
    const customerName = room?.reservation?.customerName || "this reservation";

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `This will archive ${customerName}'s reservation. It can be restored later from Archived Reservations.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "No, cancel!",
      reverseButtons: true,
      customClass: {
        confirmButton: "bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded ml-2",
        cancelButton: "bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded mr-2",
      },
      buttonsStyling: false,
    });

    if (result.isConfirmed) {
      setIsLoading(true);
      try {
      const response = await fetch(`/api/reservation/${reservationId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });

        if (!response.ok) {
          const errorData = await safeJson(response);
          throw new Error(errorData.error || "Failed to delete reservation");
        }

  const roomsResponse = await fetch("/api/room", { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!roomsResponse.ok) throw new Error("Failed to fetch updated rooms");
  const updatedRooms = await safeJson(roomsResponse);
        setRooms(updatedRooms.map(row => ({
          id: row.id,
          room_number: row.room_number,
          type: row.type,
          price: row.price,
          status: row.status,
          packageId: row.packageId,
          package: row.package,
          reservation: row.reservation,
        })));

  showNotification("Deleted", `Reservation for ${customerName} archived successfully`, "success");
      } catch (error) {
        console.error("Error deleting reservation:", error);
        showNotification("Error", error.message || "Failed to archive reservation", "error");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle save housekeeping
  const handleSaveHousekeeping = async (roomId, status, notes) => {
    setIsLoading(true);
    try {
      console.log("Saving housekeeping for room ID:", roomId, "with status:", status);
      const response = await fetch(`/api/housekeeping/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status, notes }),
      });

      const data = await safeJson(response);
      if (!response.ok) {
        const msg = data?.error ?? data?.message ?? `HTTP ${response.status}: Failed to update housekeeping`;
        throw new Error(msg);
      }

      setHousekeepingStatus((prev) => ({ ...prev, [roomId]: status }));
      setHousekeepingNotes((prev) => ({ ...prev, [roomId]: notes }));


      // Note: housekeeping POST already updates the room status to Available when appropriate
      // (see /api/housekeeping/[id] POST). Avoid calling the room update PUT here because
      // that endpoint requires RoomManagement manage permission and would return 403 for
      // housekeeping users. We'll rely on the housekeeping endpoint to change room status
      // and then refresh rooms below so the UI reflects the update.

      const statuses = ["pending", "in_progress", "completed", "inspected", "Available"];
      const responses = await Promise.all(
        statuses.map((status) =>
          fetch(`/api/housekeeping/by-status?status=${status}`)
            .then((res) => (res.ok ? safeJson(res) : []))
            .catch((err) => {
              console.error(`Failed to fetch housekeeping for ${status}:`, err);
              return [];
            })
        )
      );
      const allHousekeeping = responses.flat();
      const statusObj = {};
      const notesObj = {};
      allHousekeeping.forEach((h) => {
        statusObj[h.room_id] = h.status;
        notesObj[h.room_id] = h.notes || "";
      });
      setHousekeepingStatus(statusObj);
      setHousekeepingNotes(notesObj);

      // Refresh rooms so the room status table immediately reflects changes
      try {
        await fetchRooms();
      } catch (err) {
        console.warn('Failed to refresh rooms after housekeeping save:', err);
      }

  showNotification("Updated", "Housekeeping updated successfully", "success");
    } catch (error) {
      console.error("Error saving housekeeping:", error);
      showNotification("Error", error.message || "Failed to update housekeeping", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle view room details
  const handleViewRoom = async (room) => {
    setViewRoom(room);
    setModalMode("view");
    setShowModal(true);

    // If reservation exists, attempt to fetch attachments (id upload and e-signature)
    try {
      const reservationId = room?.reservation?.id || room?.reservationId || room?.reservation_id;
      if (!reservationId) return;
      // Only attempt when token is available
      if (!token) return;
      const res = await fetch(`/api/reservation/${reservationId}/attachments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      // Merge attachments into viewRoom reservation
      setViewRoom((prev) => {
        if (!prev) return prev;
        const existingRes = prev.reservation || {};
        return {
          ...prev,
          reservation: {
            ...existingRes,
            idUpload: data.idUpload || existingRes.idUpload,
          },
        };
      });
    } catch (e) {
      // Non-fatal: attachments may be missing or auth may fail
      console.warn('Failed to load reservation attachments', e);
    }
    // Attempt to fetch payments for this reservation to surface any GCash/reference numbers
    try {
      const reservationId = room?.reservation?.id || room?.reservationId || room?.reservation_id;
      if (!reservationId || !token) return;
      const pres = await fetch(`/api/payments?reservationId=${encodeURIComponent(reservationId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!pres.ok) return;
      const payload = await pres.json();
      // payload may be { payments: [...] } or an array directly depending on API; normalize to array
      const payments = Array.isArray(payload?.payments) ? payload.payments : Array.isArray(payload) ? payload : [];
      setViewRoomPayments(payments || []);
      if (!payments || payments.length === 0) return;

      // Prefer explicit reference_number property, fall back to numeric token in note
      let ref = null;
      const withRef = payments.find(p => p.reference_number || p.reference || p.ref || p.gcash_ref);
      if (withRef) {
        ref = withRef.reference_number || withRef.reference || withRef.ref || withRef.gcash_ref;
      } else {
        // Try to parse a numeric reference from the most recent payment note
        const recent = payments[0];
        const note = (recent.note || recent.description || '') + '';
        const m = note.match(/\b\d{6,}\b/);
        if (m) ref = m[0];
      }
      if (ref) {
        setViewRoom((prev) => {
          if (!prev) return prev;
          const existingRes = prev.reservation || {};
          return {
            ...prev,
            reservation: {
              ...existingRes,
              referenceNumber: ref,
            },
          };
        });
      }
    } catch (e) {
      // Non-fatal
      console.warn('Failed to fetch reservation payments for reference', e);
      setViewRoomPayments([]);
    }
  };

  const handleCopyToClipboard = async (text, label = 'Value copied') => {
    try {
      if (!text) return;
      await navigator.clipboard.writeText(String(text));
      showNotification('Copied', label, 'success');
    } catch (err) {
      console.error('Copy failed', err);
      showNotification('Error', 'Failed to copy to clipboard', 'error');
    }
  };

  // Handle sort
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleStatusSort = (key) => {
    let direction = "asc";
    if (statusSortConfig.key === key && statusSortConfig.direction === "asc") {
      direction = "desc";
    }
    setStatusSortConfig({ key, direction });
  };

  const findRoomForBilling = useCallback((billingRow) => {
    if (!billingRow) return null;
    if (billingRow.roomId !== undefined && billingRow.roomId !== null) {
      const matchById = rooms.find((room) => String(room.id) === String(billingRow.roomId));
      if (matchById) {
        return matchById;
      }
    }
    if (billingRow.roomNumber) {
      const normalized = String(billingRow.roomNumber).toLowerCase();
      return rooms.find((room) => String(room.room_number).toLowerCase() === normalized) || null;
    }
    return null;
  }, [rooms]);

  const buildBillingHtml = (billingRow) => {
    const safeRoomNumber = escapeHtml(billingRow.roomNumber || "—");
    const safeRoomType = escapeHtml(billingRow.roomType || "—");
    const safeCustomer = escapeHtml(billingRow.customerName || "—");
    const checkIn = billingRow.checkInDate ? formatDateString(billingRow.checkInDate) : "—";
    const checkOut = billingRow.checkOutDate ? formatDateString(billingRow.checkOutDate) : "—";
    const roomCharges = formatCurrency(billingRow.totalPayment);
    const downpaymentValue = billingRow.downpaymentPaid ? formatCurrency(-1 * billingRow.downpaymentPaid) : formatCurrency(0);
    const additionalPaymentsValue = billingRow.paymentsApplied ? formatCurrency(-1 * billingRow.paymentsApplied) : formatCurrency(0);
    const remainingBalance = formatCurrency(billingRow.remainingBalance);
    const cafePayment = formatCurrency(billingRow.cafePayment);
    const totalDue = formatCurrency(billingRow.totalAmountDue);
    const totalPaid = formatCurrency(billingRow.totalPaid);
    const downpaymentRequiredRaw = billingRow.downpaymentRequired || 0;
    const showDownpaymentRequired = downpaymentRequiredRaw > 0 && Math.abs(downpaymentRequiredRaw - (billingRow.downpaymentPaid || 0)) > 0.01;
    const downpaymentRequired = showDownpaymentRequired ? formatCurrency(downpaymentRequiredRaw) : null;
    const paymentOptionLabel = (() => {
      const raw = (billingRow.paymentOption || "").toString().trim().toLowerCase();
      if (!raw) return "N/A";
      if (raw === "downpayment" || raw === "down_payment") return "Downpayment";
      if (raw === "full" || raw === "full_payment") return "Full Payment";
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    })();

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charSet="utf-8" />
    <title>Billing Summary - Room ${safeRoomNumber}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 32px;
        background: #f9fafb;
        color: #1f2937;
      }
      .container {
        max-width: 900px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(15, 118, 110, 0.12);
        overflow: hidden;
      }
      .header {
        background: linear-gradient(135deg, #047857, #059669);
        color: #ffffff;
        padding: 28px 32px;
      }
      .header h1 {
        margin: 0 0 6px;
        font-size: 28px;
        letter-spacing: 0.5px;
      }
      .section {
        padding: 24px 32px;
        border-top: 1px solid #e5e7eb;
      }
      .section h2 {
        margin: 0 0 12px;
        font-size: 18px;
        color: #047857;
      }
      .details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px 24px;
      }
      .details-grid .label {
        font-size: 12px;
        text-transform: uppercase;
        color: #6b7280;
        letter-spacing: 0.08em;
      }
      .details-grid .value {
        font-size: 15px;
        font-weight: 600;
        color: #111827;
      }
      table.summary {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
      }
      table.summary td {
        padding: 10px 0;
        font-size: 15px;
      }
      table.summary td:first-child {
        color: #4b5563;
      }
      table.summary td:last-child {
        text-align: right;
        font-weight: 600;
        color: #111827;
      }
      .total-due {
        margin-top: 18px;
        padding: 16px;
        background: #ecfdf5;
        border: 1px solid #34d399;
        border-radius: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 17px;
        font-weight: 700;
        color: #047857;
      }
      .notes {
        font-size: 14px;
        color: #4b5563;
        line-height: 1.6;
      }
      .notes ul {
        margin: 8px 0 0;
        padding-left: 18px;
      }
      .notes li {
        margin-bottom: 4px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>SRCB & Café</h1>
        <div>Consolidated Billing Summary</div>
      </div>
      <div class="section">
        <h2>Reservation Details</h2>
        <div class="details-grid">
          <div>
            <div class="label">Room</div>
            <div class="value">${safeRoomNumber}</div>
          </div>
          <div>
            <div class="label">Room Type</div>
            <div class="value">${safeRoomType}</div>
          </div>
          <div>
            <div class="label">Guest</div>
            <div class="value">${safeCustomer}</div>
          </div>
          <div>
            <div class="label">Check-In</div>
            <div class="value">${escapeHtml(checkIn)}</div>
          </div>
          <div>
            <div class="label">Check-Out</div>
            <div class="value">${escapeHtml(checkOut)}</div>
          </div>
        </div>
      </div>
      <div class="section">
        <h2>Charges &amp; Payments</h2>
        <table class="summary">
          <tbody>
            <tr>
              <td>Room Package Total</td>
              <td>${roomCharges}</td>
            </tr>
            <tr>
              <td>Downpayment Received</td>
              <td>${downpaymentValue}</td>
            </tr>
            <tr>
              <td>Additional Payments</td>
              <td>${additionalPaymentsValue}</td>
            </tr>
            <tr>
              <td>Remaining Room Balance</td>
              <td>${remainingBalance}</td>
            </tr>
            <tr>
              <td>Café Charges</td>
              <td>${cafePayment}</td>
            </tr>
          </tbody>
        </table>
        <div class="total-due">
          <span>Total Due at Checkout</span>
          <span>${totalDue}</span>
        </div>
      </div>
      <div class="section notes">
        <h2>Notes</h2>
        <ul>
          <li>Total paid to date: ${totalPaid}</li>
          <li>Payment option: ${escapeHtml(paymentOptionLabel)}</li>
          ${showDownpaymentRequired ? `<li>Requested downpayment: ${downpaymentRequired}</li>` : ""}
          <li>Please settle café charges together with the remaining room balance at checkout.</li>
        </ul>
      </div>
    </div>
    <script>
      window.addEventListener('load', function () {
        window.print();
        setTimeout(function () { window.close(); }, 400);
      });
    </script>
  </body>
</html>`;
  };

  // Combined function to print both Contract and Bill
  const printContractAndBill = (reservation) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showNotification('Error', 'Please allow popups to print the documents.', 'error');
      return;
    }

    // Find billing data for this reservation
    const billingData = billingRows.find(b => 
      b.reservationId === reservation.id || 
      b.roomNumber === reservation.room_number
    );

    // Prepare data for contract
    const selectedPkg = packages.find(p => p.name === reservation.package_name);
    const packagePrice = selectedPkg?.price ? parseFloat(selectedPkg.price.replace(/[₱,]/g, '')) : 0;
    
    // Calculate nights
    let nights = 1;
    try {
      if (reservation.checkInDate && reservation.checkOutDate) {
        const checkIn = new Date(reservation.checkInDate);
        const checkOut = new Date(reservation.checkOutDate);
        const diff = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        nights = diff > 0 ? diff : 1;
      }
    } catch (e) {
      nights = 1;
    }

    const totalPrice = billingData?.totalPayment || ((nights * packagePrice) - packagePrice);
    const downpayment = billingData?.downpaymentPaid || billingData?.downpaymentDisplay || 0;
    const remainingBalance = billingData?.remainingBalance || (totalPrice - downpayment);
    const paymentOption = billingData?.paymentOption || reservation.paymentOption || 'full';

    let paymentDetails = '';
    if (paymentOption === 'downpayment') {
      paymentDetails = `
        <div class="payment-section">
          <div class="section-title">Payment Rundown</div>
          <div class="info-row">
            <div class="info-label">Package Rate:</div>
            <div class="info-value">₱${Number(packagePrice).toFixed(2)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Number of Nights:</div>
            <div class="info-value">${nights} night(s)</div>
          </div>
          <div class="info-row">
            <div class="info-label">Subtotal:</div>
            <div class="info-value">₱${(nights * packagePrice).toFixed(2)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Discount (1st night):</div>
            <div class="info-value" style="color: #10b981;">- ₱${Number(packagePrice).toFixed(2)}</div>
          </div>
          <div class="info-row" style="border-top: 2px solid #10b981; margin-top: 8px; padding-top: 8px;">
            <div class="info-label" style="font-size: 14px;">Total Amount:</div>
            <div class="info-value" style="font-size: 14px; font-weight: bold;">₱${Number(totalPrice).toFixed(2)}</div>
          </div>
          <div class="info-row" style="background: #f0fdf4; margin: 10px -10px; padding: 8px 10px;">
            <div class="info-label">Downpayment Paid:</div>
            <div class="info-value" style="color: #10b981; font-weight: bold;">₱${Number(downpayment).toFixed(2)}</div>
          </div>
          <div class="info-row" style="background: #fef2f2; margin: 0 -10px 10px; padding: 8px 10px;">
            <div class="info-label">Remaining Balance:</div>
            <div class="info-value" style="color: #ef4444; font-weight: bold;">₱${Number(remainingBalance).toFixed(2)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Payment Status:</div>
            <div class="info-value"><span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px;">PARTIAL PAYMENT</span></div>
          </div>
        </div>
      `;
    } else {
      paymentDetails = `
        <div class="payment-section">
          <div class="section-title">Payment Rundown</div>
          <div class="info-row">
            <div class="info-label">Package Rate:</div>
            <div class="info-value">₱${Number(packagePrice).toFixed(2)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Number of Nights:</div>
            <div class="info-value">${nights} night(s)</div>
          </div>
          <div class="info-row">
            <div class="info-label">Subtotal:</div>
            <div class="info-value">₱${(nights * packagePrice).toFixed(2)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Discount (1st night):</div>
            <div class="info-value" style="color: #10b981;">- ₱${Number(packagePrice).toFixed(2)}</div>
          </div>
          <div class="info-row" style="border-top: 2px solid #10b981; margin-top: 8px; padding-top: 8px;">
            <div class="info-label" style="font-size: 14px;">Total Amount Due:</div>
            <div class="info-value" style="font-size: 14px; font-weight: bold; color: #ef4444;">₱${Number(totalPrice).toFixed(2)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Payment Status:</div>
            <div class="info-value"><span style="background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 12px;">DUE AT CHECKOUT</span></div>
          </div>
        </div>
      `;
    }

    const printContent = `<!DOCTYPE html>
<html>
  <head>
    <title>Contract & Billing - Room ${reservation.room_number}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: Arial, sans-serif;
        padding: 30px;
        line-height: 1.6;
        color: #1f2937;
      }
      .page-break { page-break-after: always; }
      
      /* Contract Styles */
      .header {
        text-align: center;
        border-bottom: 3px solid #10b981;
        padding-bottom: 20px;
        margin-bottom: 30px;
      }
      .logo {
        font-size: 32px;
        font-weight: bold;
        color: #10b981;
        margin-bottom: 10px;
      }
      .subtitle {
        color: #666;
        font-size: 14px;
      }
      .confirmation-number {
        background: #f0fdf4;
        border: 2px solid #10b981;
        padding: 15px;
        text-align: center;
        margin: 20px 0;
        border-radius: 8px;
      }
      .confirmation-number strong {
        color: #10b981;
        font-size: 18px;
      }
      .two-column-layout {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
        margin: 25px 0;
      }
      .section {
        margin-bottom: 20px;
      }
      .payment-section {
        grid-column: 1 / -1;
        background: #f9fafb;
        border: 2px solid #10b981;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
      }
      .section-title {
        font-size: 16px;
        font-weight: bold;
        color: #10b981;
        margin-bottom: 12px;
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 6px;
      }
      .info-row {
        display: flex;
        padding: 6px 0;
        border-bottom: 1px solid #f3f4f6;
      }
      .info-label {
        font-weight: 600;
        width: 180px;
        color: #374151;
        font-size: 13px;
      }
      .info-value {
        flex: 1;
        color: #1f2937;
        font-size: 13px;
      }
      .terms-section {
        background: #fef3c7;
        border-left: 4px solid #f59e0b;
        padding: 15px;
        margin: 20px 0;
        font-size: 13px;
        grid-column: 1 / -1;
      }
      .terms-section h3 {
        color: #92400e;
        margin-bottom: 10px;
        font-size: 14px;
      }
      .terms-section ul {
        margin-left: 20px;
        margin-top: 8px;
      }
      .terms-section li {
        margin-bottom: 5px;
      }
      .signature-section {
        grid-column: 1 / -1;
        margin-top: 40px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
      }
      .signature-box {
        border-top: 2px solid #000;
        padding-top: 10px;
        text-align: center;
      }
      
      /* Billing Styles */
      .billing-container {
        max-width: 100%;
        background: #ffffff;
        border: 2px solid #10b981;
        border-radius: 12px;
        overflow: hidden;
        margin-top: 40px;
      }
      .billing-header {
        background: linear-gradient(135deg, #047857, #059669);
        color: #ffffff;
        padding: 20px 32px;
      }
      .billing-header h1 {
        margin: 0;
        font-size: 24px;
      }
      .billing-section {
        padding: 20px 32px;
        border-top: 1px solid #e5e7eb;
      }
      .billing-section h2 {
        margin: 0 0 12px;
        font-size: 18px;
        color: #047857;
      }
      .details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px 20px;
      }
      .details-grid .label {
        font-size: 11px;
        text-transform: uppercase;
        color: #6b7280;
        letter-spacing: 0.05em;
      }
      .details-grid .value {
        font-size: 14px;
        font-weight: 600;
        color: #111827;
      }
      table.summary {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
      }
      table.summary td {
        padding: 8px 0;
        font-size: 14px;
      }
      table.summary td:first-child {
        color: #4b5563;
      }
      table.summary td:last-child {
        text-align: right;
        font-weight: 600;
        color: #111827;
      }
      .total-due {
        margin-top: 15px;
        padding: 15px;
        background: #ecfdf5;
        border: 1px solid #34d399;
        border-radius: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 16px;
        font-weight: 700;
        color: #047857;
      }
      @media print {
        body { padding: 15px; }
        .page-break { page-break-after: always; }
      }
    </style>
  </head>
  <body>
    <!-- CONTRACT PAGE -->
    <div class="header">
      <div class="logo">🏨 SRCB</div>
      <div class="subtitle">Reservation Contract & Agreement</div>
    </div>

    <div class="confirmation-number">
      <strong>Confirmation #: ${reservation.id || 'N/A'}</strong>
      <div style="margin-top: 5px; font-size: 12px; color: #666;">
        Room: ${reservation.room_number}
      </div>
    </div>

    <div class="two-column-layout">
      <div>
        <div class="section">
          <div class="section-title">Guest Information</div>
          <div class="info-row">
            <div class="info-label">Name:</div>
            <div class="info-value">${reservation.customerName || 'N/A'}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Email:</div>
            <div class="info-value">${reservation.customerEmail || 'N/A'}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Contact:</div>
            <div class="info-value">${reservation.contactNumber || 'N/A'}</div>
          </div>
          ${reservation.address ? `
          <div class="info-row">
            <div class="info-label">Address:</div>
            <div class="info-value">${reservation.address}</div>
          </div>
          ` : ''}
          ${reservation.nationality ? `
          <div class="info-row">
            <div class="info-label">Nationality:</div>
            <div class="info-value">${reservation.nationality}</div>
          </div>
          ` : ''}
        </div>
      </div>

      <div>
        <div class="section">
          <div class="section-title">Reservation Details</div>
          <div class="info-row">
            <div class="info-label">Room Number:</div>
            <div class="info-value">${reservation.room_number}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Package:</div>
            <div class="info-value">${reservation.package_name || 'N/A'}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Number of Nights:</div>
            <div class="info-value">${nights}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Check-in:</div>
            <div class="info-value">${reservation.checkInDate ? new Date(reservation.checkInDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Check-out:</div>
            <div class="info-value">${reservation.checkOutDate ? new Date(reservation.checkOutDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</div>
          </div>
          ${reservation.additionalGuests > 0 ? `
          <div class="info-row">
            <div class="info-label">Additional Guests:</div>
            <div class="info-value">${reservation.additionalGuests}</div>
          </div>
          ` : ''}
        </div>
      </div>

      ${paymentDetails}
    </div>

    <div class="terms-section">
      <h3>⚠️ Terms and Conditions</h3>
      <ul>
        <li>Check-in time is 2:00 PM and check-out time is 12:00 PM</li>
        <li>Please bring this contract and a valid ID when checking in</li>
        <li>Late check-out may incur additional charges</li>
        ${paymentOption === 'downpayment' ? `
        <li><strong>Balance of ₱${Number(remainingBalance).toFixed(2)} must be paid at checkout</strong></li>
        <li>Downpayment is non-refundable unless cancellation is made 48 hours in advance</li>
        ` : `
        <li>Full payment of ₱${Number(totalPrice).toFixed(2)} is due at checkout</li>
        <li>Cancellations must be made 48 hours in advance</li>
        `}
        <li>Smoking is strictly prohibited in all rooms</li>
        <li>Guests are responsible for any damages to hotel property</li>
        <li>Maximum occupancy must be observed at all times</li>
        <li>Management reserves the right to refuse service for violation of hotel rules</li>
      </ul>
    </div>

    <div class="signature-section">
      <div class="signature-box">
        <strong>Guest Signature</strong>
        <div style="margin-top: 5px; font-size: 11px; color: #666;">
          ${reservation.customerName || 'N/A'}
        </div>
      </div>
      <div class="signature-box">
        <strong>Hotel Representative</strong>
        <div style="margin-top: 5px; font-size: 11px; color: #666;">
          SRCB Management
        </div>
      </div>
    </div>

    ${billingData ? `
    <!-- PAGE BREAK -->
    <div class="page-break"></div>

    <!-- BILLING PAGE -->
    <div class="billing-container">
      <div class="billing-header">
        <h1>SRCB & Café</h1>
        <div>Consolidated Billing Summary</div>
      </div>
      <div class="billing-section">
        <h2>Reservation Details</h2>
        <div class="details-grid">
          <div>
            <div class="label">Room</div>
            <div class="value">${reservation.room_number}</div>
          </div>
          <div>
            <div class="label">Room Type</div>
            <div class="value">${reservation.package_name || 'N/A'}</div>
          </div>
          <div>
            <div class="label">Guest</div>
            <div class="value">${reservation.customerName || 'N/A'}</div>
          </div>
          <div>
            <div class="label">Check-In</div>
            <div class="value">${reservation.checkInDate ? formatDateString(reservation.checkInDate) : '—'}</div>
          </div>
          <div>
            <div class="label">Check-Out</div>
            <div class="value">${reservation.checkOutDate ? formatDateString(reservation.checkOutDate) : '—'}</div>
          </div>
        </div>
      </div>
      <div class="billing-section">
        <h2>Charges & Payments</h2>
        <table class="summary">
          <tbody>
            <tr>
              <td>Room Package Total</td>
              <td>${formatCurrency(billingData.totalPayment)}</td>
            </tr>
            <tr>
              <td>Downpayment Received</td>
              <td>${billingData.downpaymentPaid ? formatCurrency(-1 * billingData.downpaymentPaid) : formatCurrency(0)}</td>
            </tr>
            <tr>
              <td>Additional Payments</td>
              <td>${billingData.paymentsApplied ? formatCurrency(-1 * billingData.paymentsApplied) : formatCurrency(0)}</td>
            </tr>
            <tr>
              <td>Remaining Room Balance</td>
              <td>${formatCurrency(billingData.remainingBalance)}</td>
            </tr>
            <tr>
              <td>Café Charges</td>
              <td>${formatCurrency(billingData.cafePayment)}</td>
            </tr>
          </tbody>
        </table>
        <div class="total-due">
          <span>Total Due at Checkout</span>
          <span>${formatCurrency(billingData.totalAmountDue)}</span>
        </div>
      </div>
      <div class="billing-section">
        <h2>Notes</h2>
        <ul style="margin-left: 20px; font-size: 13px; color: #4b5563;">
          <li>Total paid to date: ${formatCurrency(billingData.totalPaid)}</li>
          <li>Payment option: ${paymentOption === 'downpayment' ? 'Downpayment' : 'Full Payment'}</li>
          <li>Please settle café charges together with the remaining room balance at checkout.</li>
        </ul>
      </div>
    </div>
    ` : ''}

    <script>
      window.addEventListener('load', function() {
        setTimeout(function() {
          window.print();
        }, 500);
      });
    </script>
  </body>
</html>`;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const handlePrintBilling = (billingRow) => {
    if (!billingRow) return;

    // Prefer reservationId; if not present, try to find matching room to get reservation id
    let reservationId = billingRow.reservationId;
    if (!reservationId) {
      const matchingRoom = findRoomForBilling(billingRow);
      reservationId = matchingRoom?.reservation?.id || matchingRoom?.reservationId || null;
    }

    if (!reservationId) {
      showNotification('Unavailable', 'No reservation id found for this billing entry. Cannot print server-hosted bill.', 'info');
      return;
    }

    if (!token) {
      showNotification('Unauthorized', 'You must be signed in to print billing information.', 'error');
      return;
    }

    const url = `${window.location.origin}/print/billing/${encodeURIComponent(reservationId)}?token=${encodeURIComponent(token)}`;
    const w = window.open(url, '_blank', 'noopener');
    if (!w) {
      showNotification('Popup blocked', 'Allow popups to print the consolidated bill.', 'warning');
      return;
    }

    // Let the server-side page auto-print and close itself. We still set a fallback timeout to close if desired.
    setTimeout(() => {
      try {
        w.focus();
      } catch (e) {
        // ignore
      }
    }, 500);
  };

  const handleBillingCheckout = async (billingRow) => {
    if (checkoutProcessing) return;
    const targetRoom = findRoomForBilling(billingRow);
    if (!targetRoom) {
      showNotification('Unavailable', 'We could not locate an active room record for this billing entry.', 'info');
      return;
    }
    await handleCheckoutRoom(targetRoom);
  };

  // Filter and sort rooms - room-linked reservations
  const allReservations = [
    // Reservations linked to rooms (existing functionality)
    ...rooms.filter(room => room.reservation).map(room => ({
      id: room.reservation.id,
      room_number: room.room_number,
      type: room.type,
      price: room.price,
      status: room.status,
      customerName: room.reservation.customerName,
      customerEmail: room.reservation.customerEmail,
      contactNumber: room.reservation.contactNumber,
      checkInDate: room.reservation.checkInDate,
      checkOutDate: room.reservation.checkOutDate,
      additionalGuests: room.reservation.additionalGuests,
      package_name: room.package?.name || 'N/A',
      package_id: room.packageId || null,
      package_type: room.package?.name || 'N/A',
      source: 'room_linked'
    }))
  ];

  const filteredRooms = allReservations.filter(reservation =>
    reservation.customerName && (
      reservation.room_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (reservation.type && reservation.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
      reservation.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Automatically determine status based on check-in date
  const roomsWithUpdatedStatus = filteredRooms.map(reservation => {
    // Parse the check-in date
    const checkInDate = reservation.checkInDate ? new Date(reservation.checkInDate) : null;
    const today = new Date();
    
    // Set time to midnight for accurate date comparison (ignore time portion)
    if (checkInDate) {
      checkInDate.setHours(0, 0, 0, 0);
    }
    today.setHours(0, 0, 0, 0);
    
    // Determine the correct status
    let computedStatus = reservation.status;
    
    if (checkInDate) {
      // If check-in date is in the future, status should be "Reserved"
      if (checkInDate > today) {
        computedStatus = 'Reserved';
      }
      // If check-in date is today or in the past, status should be "Occupied"
      else if (checkInDate <= today && (reservation.status === 'Reserved' || reservation.status === 'reserved')) {
        computedStatus = 'Occupied';
      }
    }
    
    return {
      ...reservation,
      status: computedStatus
    };
  });

  const sortedRooms = [...roomsWithUpdatedStatus].sort((a, b) => {
    if (sortConfig.direction === "asc") {
      return a[sortConfig.key] > b[sortConfig.key] ? 1 : -1;
    }
    return a[sortConfig.key] < b[sortConfig.key] ? 1 : -1;
  });

  // Pagination for reservations table (use Next/Prev instead of scroll)
  const { page, setPage, pageSize, setPageSize, totalPages, pageRecords, reset } = usePagination(sortedRooms, 10);

  // Reset pagination when filters or sort change
  useEffect(() => {
    reset();
  }, [searchTerm, sortConfig, rooms]);

  const filteredStatusRooms = rooms.filter(
    (room) =>
      room.room_number.toLowerCase().includes(statusSearchTerm.toLowerCase()) ||
      room.type.toLowerCase().includes(statusSearchTerm.toLowerCase()) ||
      (housekeepingStatus[room.id] &&
        housekeepingStatus[room.id].toLowerCase().includes(statusSearchTerm.toLowerCase()))
  );

  // Apply automatic status computation for Room Status section as well
  const statusRoomsWithUpdatedStatus = filteredStatusRooms.map(room => {
    // Only update status if room has a reservation
    if (!room.reservation || !room.reservation.checkInDate) {
      return room;
    }

    const checkInDate = new Date(room.reservation.checkInDate);
    const today = new Date();
    
    // Set time to midnight for accurate date comparison
    checkInDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    let computedStatus = room.status;
    
    // If check-in date is in the future, status should be "Reserved"
    if (checkInDate > today) {
      computedStatus = 'Reserved';
    }
    // If check-in date is today or in the past, status should be "Occupied"
    else if (checkInDate <= today && (room.status === 'Reserved' || room.status === 'reserved')) {
      computedStatus = 'Occupied';
    }
    
    return {
      ...room,
      status: computedStatus
    };
  });

  const sortedStatusRooms = [...statusRoomsWithUpdatedStatus].sort((a, b) => {
    const aValue = statusSortConfig.key === "housekeeping_status" ? housekeepingStatus[a.id] || "" : a[statusSortConfig.key];
    const bValue = statusSortConfig.key === "housekeeping_status" ? housekeepingStatus[b.id] || "" : b[statusSortConfig.key];
    if (statusSortConfig.direction === "asc") {
      return aValue > bValue ? 1 : -1;
    }
    return aValue < bValue ? 1 : -1;
  });

  return (
  <div className="p-6 text-gray-700 bg-gray-50 min-h-full">
      {/* Header with Title, Description, and Tabs */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-emerald-700 flex items-center gap-3">
              Room Management Dashboard
              {(() => {
                // Calculate rooms due for checkout today
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dueCount = rooms.filter(room => {
                  if (!room.reservation || !room.reservation.checkOutDate) return false;
                  const checkOutDate = parseLocalDate(room.reservation.checkOutDate);
                  if (!checkOutDate) return false;
                  checkOutDate.setHours(0, 0, 0, 0);
                  const status = (room.status || '').toLowerCase();
                  return isEqual(checkOutDate, today) && (status === 'occupied' || status === 'reserved');
                }).length;
                
                return dueCount > 0 ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-500 text-white animate-pulse">
                    🔔 {dueCount} Check-Out{dueCount > 1 ? 's' : ''} Due Today
                  </span>
                ) : null;
              })()}
            </h1>
            <p className="text-sm text-gray-500 mb-3">Manage your hotel rooms, reservations, and availability</p>
          </div>
        </div>

        {/* Tabs beside title - convert to select on narrow screens */}
        {isNarrow ? (
          <div className="mb-4">
            <label htmlFor="room-tab-select" className="sr-only">Select section</label>
            <select
              id="room-tab-select"
              className="w-full p-3 border rounded-lg text-gray-700"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
            >
              <option value="reservations">Reservations</option>
              <option value="roomStatus">Room Status</option>
              <option value="housekeeping">Housekeeping</option>
            </select>
          </div>
        ) : (
          <div className="flex border-b">
            <button
              className={`px-4 py-2 font-medium ${activeTab === "reservations"
                ? "border-b-2 border-emerald-600 text-emerald-600"
                : "text-gray-500 hover:text-emerald-600"
                }`}
              onClick={() => setActiveTab("reservations")}
            >
              Reservations
            </button>
            <button
              className={`px-4 py-2 font-medium ${activeTab === "roomStatus"
                ? "border-b-2 border-emerald-600 text-emerald-600"
                : "text-gray-500 hover:text-emerald-600"
                }`}
              onClick={() => setActiveTab("roomStatus")}
            >
              Room Status
            </button>
            <button
              className={`px-4 py-2 font-medium ${activeTab === "housekeeping"
                ? "border-b-2 border-emerald-600 text-emerald-600"
                : "text-gray-500 hover:text-emerald-600"
                }`}
              onClick={() => setActiveTab("housekeeping")}
            >
              Housekeeping
            </button>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/30 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg flex items-center">
            <svg
              className="animate-spin h-8 w-8 mr-3 text-emerald-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-gray-700">Loading...</span>
          </div>
        </div>
      )}

      {/* Reservations Tab */}
      {activeTab === "reservations" && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Reservations for Today */}
            <div className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Reservations for Today</div>
                <div className="text-2xl font-semibold text-blue-600">{stats.reservationsForToday}</div>
              </div>
              <div className="text-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>

            {/* Total Reservations */}
            <div className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Total Reservations</div>
                <div className="text-2xl font-semibold text-emerald-600">{stats.totalReservations}</div>
              </div>
              <div className="text-emerald-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6 2a1 1 0 00-1 1v12h10V3a1 1 0 00-1-1H6z" />
                </svg>
              </div>
            </div>

            {/* Check-outs for Today */}
            <div className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Check-outs for Today</div>
                <div className="text-2xl font-semibold text-amber-600 flex items-center gap-2">
                  {stats.checkOutsToday}
                  {stats.checkOutsToday > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full animate-pulse">
                      🔔
                    </span>
                  )}
                </div>
              </div>
              <div className="text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
            </div>

            {/* Balance to Collect */}
            <div className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Balance to Collect</div>
                <div className="text-2xl font-semibold text-purple-600">
                  {formatCurrency(stats.balanceToCollect)}
                </div>
              </div>
              <div className="text-purple-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Check-out Notification List (if any) */}
          {stats.checkOutsToday > 0 && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-lg shadow">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-amber-800">
                    Check-Out Reminder: {stats.checkOutsToday} room{stats.checkOutsToday > 1 ? 's' : ''} due for check-out today
                  </h3>
                  <div className="mt-2 text-sm text-amber-700">
                    <ul className="list-disc list-inside space-y-1">
                      {stats.checkOutsList.map((room) => (
                        <li key={room.id}>
                          Room {room.room_number} - {room.reservation?.customerName || 'N/A'}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search Bar and Walk-in Button */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search reservations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg w-full focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <button
              onClick={() => {
                const now = new Date();
                const currentDate = now.toISOString().split('T')[0];
                const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                
                setModalMode("add");
                setReservation({
                  customerName: "",
                  customerEmail: "",
                  contactNumber: "",
                  address: "",
                  nationality: "",
                  checkInDate: currentDate,
                  checkOutDate: "",
                  additionalRequests: "",
                  additionalGuests: 0,
                  remarks: `Walk-in customer - Check-in time: ${currentTime}`,
                  idUpload: null,
                  paymentOption: "full",
                  downpaymentAmount: 0,
                });
                setSelectedPackageId("");
                setShowModal(true);
              }}
              className={`flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap ${!allowManageRooms ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!allowManageRooms}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
              </svg>
              Walk-in Reservation
            </button>
          </div>

          {/* Reservations Table - Full Width */}
          <div id="reservations-section">
            {/* Desktop table for larger screens */}
            <h2 className="text-xl font-semibold mb-4 text-emerald-700">Room Reservations</h2>
              <div className="hidden md:block bg-white shadow-md rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        { key: "room_number", label: "Room Number", width: "w-24" },
                        { key: "type", label: "Type", width: "w-32" },
                        { key: "customerName", label: "Customer", width: "w-40" },
                        { key: "status", label: "Status", width: "w-28" },
                        { key: "price", label: "Price", width: "w-28" },
                        { key: "checkInDate", label: "Check-In", width: "w-32" },
                        { key: "checkOutDate", label: "Check-Out", width: "w-32" },
                        { key: "totalPayment", label: "Total Payment", width: "w-32" },
                        { key: "downpayment", label: "Downpayment", width: "w-32" },
                        { key: "remaining", label: "Remaining", width: "w-32" },
                        { key: "cafePayment", label: "Café Payment", width: "w-32" },
                        { key: "totalDue", label: "Total Due", width: "w-32" },
                        { key: "reference", label: "Reference", width: "w-40" },
                      ].map((header) => (
                        <th
                          key={header.key}
                          onClick={() => handleSort(header.key)}
                          className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-emerald-600 ${header.width}`}
                        >
                          <div className="flex items-center">
                            {header.label}
                            {sortConfig.key === header.key &&
                              (sortConfig.direction === "asc" ? (
                                <ArrowUpIcon className="h-4 w-4 ml-1" />
                              ) : (
                                <ArrowDownIcon className="h-4 w-4 ml-1" />
                              ))}
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pageRecords.map((reservation) => {
                      // Find matching billing data for this reservation
                      const billingData = billingRows.find(b => 
                        b.reservationId === reservation.id || 
                        b.roomNumber === reservation.room_number
                      );
                      
                      // Check if this reservation is due for checkout today
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const checkOutDate = reservation.checkOutDate ? parseLocalDate(reservation.checkOutDate) : null;
                      if (checkOutDate) checkOutDate.setHours(0, 0, 0, 0);
                      const isDueForCheckout = checkOutDate && isEqual(checkOutDate, today) && 
                        (reservation.status === 'Occupied' || reservation.status === 'occupied');
                      
                      return (
                        <tr 
                          key={`${reservation.source}-${reservation.id}`}
                          className={isDueForCheckout ? 'bg-amber-50 border-l-4 border-amber-500' : ''}
                        >
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-2">
                              {reservation.room_number}
                              {isDueForCheckout && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 animate-pulse">
                                  🔔 Due Today
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            {reservation.package_name || 'N/A'}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            {reservation.customerName || "—"}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                reservation.status === "Occupied" || reservation.status === "occupied"
                                  ? "bg-red-100 text-red-800"
                                  : reservation.status === "Reserved" || reservation.status === "reserved"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : reservation.status === "confirmed"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {reservation.status}
                            </span>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            {reservation.price ? (String(reservation.price).trim().startsWith('₱') ? reservation.price : `₱${Number(reservation.price).toLocaleString()}`) : '—'}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            {reservation.checkInDate ? formatDateString(reservation.checkInDate) : "—"}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            {reservation.checkOutDate ? formatDateString(reservation.checkOutDate) : "—"}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                            {billingData ? `₱${Number(billingData.totalPayment || 0).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            {billingData ? `₱${Number(billingData.downpaymentDisplay || 0).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            {billingData ? `₱${Number(billingData.remainingBalance || 0).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            {billingData ? `₱${Number(billingData.cafePayment || 0).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-emerald-700">
                            {billingData ? `₱${Number(billingData.totalAmountDue || 0).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-xs text-gray-600">
                            {billingData?.reference || reservation.reference || '—'}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center justify-center gap-2">
                              {/* View */}
                              <button
                                onClick={() => {
                                  const roomObj = {
                                    id: reservation.id,
                                    room_number: reservation.room_number,
                                    type: reservation.type,
                                    price: reservation.price,
                                    status: reservation.status,
                                    reservation: {
                                      id: reservation.id,
                                      customerName: reservation.customerName,
                                      customerEmail: reservation.customerEmail,
                                      contactNumber: reservation.contactNumber,
                                      checkInDate: reservation.checkInDate,
                                      checkOutDate: reservation.checkOutDate,
                                      additionalGuests: reservation.additionalGuests
                                    }
                                  };
                                  handleViewRoom(roomObj);
                                }}
                                className="text-blue-600 hover:text-blue-800"
                                title="View Details"
                              >
                                <EyeIcon className="h-5 w-5" />
                              </button>
                              
                              {/* Edit */}
                              <button
                                onClick={() => {
                                  const roomObj = {
                                    id: reservation.id,
                                    room_number: reservation.room_number,
                                    type: reservation.type,
                                    price: reservation.price,
                                    status: reservation.status,
                                    packageId: reservation.package_id,
                                    reservation: {
                                      id: reservation.id,
                                      customerName: reservation.customerName,
                                      customerEmail: reservation.customerEmail,
                                      contactNumber: reservation.contactNumber,
                                      checkInDate: reservation.checkInDate,
                                      checkOutDate: reservation.checkOutDate,
                                      additionalGuests: reservation.additionalGuests
                                    }
                                  };
                                  handleEditRoom(roomObj);
                                }}
                                className={`text-yellow-600 hover:text-yellow-800 ${!allowManageRooms ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={!allowManageRooms}
                                title="Edit"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              
                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteReservation(reservation.id)}
                                className={`text-red-600 hover:text-red-800 ${!allowManageRooms ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={!allowManageRooms}
                                title="Delete"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                              
                              {/* Print - server-side bill only (no contract) */}
                              <button
                                onClick={() => handlePrintBilling({ reservationId: reservation.id })}
                                className="text-purple-600 hover:text-purple-800"
                                title="Print Bill"
                              >
                                <PrinterIcon className="h-5 w-5" />
                              </button>
                              
                              {/* Check-Out */}
                              <button
                                onClick={() => {
                                  const roomObj = {
                                    id: reservation.id,
                                    room_number: reservation.room_number,
                                    type: reservation.type,
                                    price: reservation.price,
                                    status: reservation.status,
                                    reservation: {
                                      id: reservation.id,
                                      customerName: reservation.customerName,
                                    }
                                  };
                                  handleCheckoutRoom(roomObj);
                                }}
                                className={`text-green-600 hover:text-green-800 relative ${!allowManageRooms || (reservation.status !== 'Occupied' && reservation.status !== 'occupied') || checkoutProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={!allowManageRooms || (reservation.status !== 'Occupied' && reservation.status !== 'occupied') || checkoutProcessing}
                                title={checkoutProcessing ? 'Processing checkout...' : 'Check-Out'}
                              >
                                {checkoutProcessing ? (
                                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <CheckCircleIcon className="h-5 w-5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls for desktop reservations table */}
              <div className="hidden md:flex items-center justify-between bg-white rounded-b-lg px-4 py-3 mt-2">
                <div className="text-sm text-gray-600">
                  Showing {sortedRooms.length === 0 ? 0 : (Math.min((page - 1) * pageSize + 1, sortedRooms.length))} to {Math.min(page * pageSize, sortedRooms.length)} of {sortedRooms.length} reservations
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-sm text-gray-700">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* Mobile cards for reservations (visible on small screens) */}
              <div className="block md:hidden space-y-4">
                {pageRecords.map((room) => {
                  // Check if this reservation is due for checkout today (mobile view)
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const checkOutDate = room.checkOutDate ? parseLocalDate(room.checkOutDate) : null;
                  if (checkOutDate) checkOutDate.setHours(0, 0, 0, 0);
                  const isDueForCheckout = checkOutDate && isEqual(checkOutDate, today) && 
                    (room.status === 'Occupied' || room.status === 'occupied');
                  
                  return (
                  <div 
                    key={`mobile-res-${room.source}-${room.id}`} 
                    className={`p-4 rounded-lg shadow-md ${isDueForCheckout ? 'bg-amber-50 border-2 border-amber-500' : 'bg-white'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm text-gray-500">Room</div>
                        <div className="text-lg font-semibold">
                          {room.room_number} — {room.package_name || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600">{room.customerName || '—'}</div>
                        {isDueForCheckout && (
                          <span className="inline-flex items-center px-2 py-1 mt-2 rounded text-xs font-medium bg-amber-100 text-amber-800 animate-pulse">
                            🔔 Check-Out Due Today
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          room.status === "Occupied" || room.status === "occupied"
                            ? 'bg-red-100 text-red-800'
                            : room.status === "Reserved" || room.status === "reserved"
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {room.status}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => handleViewRoom(room)} className="flex items-center text-blue-600 hover:text-blue-800" title="View Details">
                            <EyeIcon className="h-5 w-5" />
                            <span className="sr-only">View</span>
                          </button>
                          <button onClick={() => handleEditRoom(room)} className={`flex items-center text-emerald-600 hover:text-emerald-800 ${!allowManageRooms ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!allowManageRooms} title="Edit">
                            <PencilIcon className="h-5 w-5" />
                            <span className="sr-only">Edit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-500">
                      <div>Check-In: {room.checkInDate ? formatDateString(room.checkInDate) : '—'}</div>
                      <div>Check-Out: {room.checkOutDate ? formatDateString(room.checkOutDate) : '—'}</div>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Mobile pagination controls */}
              <div className="block md:hidden mt-3 flex items-center justify-between bg-white px-3 py-2 rounded">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50"
                >
                  Prev
                </button>
                <div className="text-sm text-gray-700">Page {page} / {totalPages}</div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
          </div>

          {/* Calendar and Information Section - Side by Side Layout */}
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Calendar */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-6 text-emerald-700">Booking Calendar</h3>
              {/* Enlarged calendar styles to improve visibility */}
              <style>{`
                /* Base calendar sizing */
                .react-calendar { width: 100% !important; border: none !important; font-size: 1.05rem; }
                .react-calendar__navigation { margin-bottom: 12px; }
                .react-calendar__month-view__weekdays { text-transform: none; font-weight: 600; color: #065f46; }
                .react-calendar__tile { padding: 14px 6px !important; height: 64px !important; }
                .react-calendar__tile--now { box-shadow: 0 0 0 2px rgba(16,185,129,0.12) inset; }
                .react-calendar__tile--active { background: #10b981 !important; color: white !important; }
                /* Larger tiles on wide screens */
                @media (min-width: 1024px) {
                  .react-calendar { font-size: 1.125rem; }
                  .react-calendar__tile { height: 78px !important; padding: 20px 6px !important; }
                }
              `}</style>

              <div className="flex justify-center">
                <Calendar
                  onChange={setSelectedDate}
                  value={selectedDate}
                  tileClassName={tileClassName}
                  tileDisabled={tileDisabled}
                  className="border-none w-full text-lg"
                />
              </div>
            </div>

            {/* Right: Information of Reserved Days */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-6 text-emerald-700">Information of Reserved Days</h3>
              <h4 className="text-base font-medium text-emerald-600 mb-4">
                Bookings for {format(selectedDate, "MMMM d, yyyy")}
              </h4>
              {selectedDateBookings.length > 0 ? (
                <ul className="space-y-3">
                  {selectedDateBookings.map((room) => (
                    <li key={room.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-emerald-300 transition-colors">
                      <div className="font-medium text-gray-800">
                        Room {room.room_number} - {room.reservation.customerName}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Status: <span className="font-semibold">{room.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No bookings for this date.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Room Status Tab */}
      {activeTab === "roomStatus" && (
        <div>
          {/* Stats Cards for Room Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* Available Rooms */}
            <div className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Available Rooms</div>
                <div className="text-2xl font-semibold text-emerald-700">{stats.available}</div>
              </div>
              <div className="text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 2a2 2 0 00-2 2v2H6a2 2 0 00-2 2v6h12V8a2 2 0 00-2-2h-2V4a2 2 0 00-2-2z" />
                </svg>
              </div>
            </div>

            {/* Occupied Rooms */}
            <div className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Occupied Rooms</div>
                <div className="text-2xl font-semibold text-red-600">{stats.occupied}</div>
              </div>
              <div className="text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6 2a1 1 0 00-1 1v12h10V3a1 1 0 00-1-1H6z" />
                </svg>
              </div>
            </div>

            {/* Total Rooms */}
            <div className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Total Rooms</div>
                <div className="text-2xl font-semibold text-blue-600">{stats.totalRooms}</div>
              </div>
              <div className="text-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </div>

          {/* Desktop table for larger screens */}
          <div className="hidden md:block bg-white shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 table-fixed w-full">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { key: "room_number", label: "Room Number" },
                    { key: "type", label: "Type" },
                    { key: "price", label: "Price" },
                    { key: "status", label: "Status" },
                  ].map((header) => (
                    <th
                      key={header.key}
                      onClick={() => handleStatusSort(header.key)}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-emerald-600"
                    >
                      <div className="flex items-center">
                        {header.label}
                        {statusSortConfig.key === header.key &&
                          (statusSortConfig.direction === "asc" ? (
                            <ArrowUpIcon className="h-4 w-4 ml-1" />
                          ) : (
                            <ArrowDownIcon className="h-4 w-4 ml-1" />
                          ))}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedStatusRooms.map((room) => (
                  <tr key={room.id}>
                    <td className="px-6 py-4 whitespace-normal">{room.room_number}</td>
                    <td className="px-6 py-4 whitespace-normal">{room.type}</td>
                    <td className="px-6 py-4 whitespace-normal">{room.price ? (String(room.price).trim().startsWith('₱') ? room.price : `₱${room.price}`) : '—'}</td>
                    <td className="px-6 py-4 whitespace-normal">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${room.status === "Available"
                          ? "bg-green-100 text-green-800"
                          : room.status === "Occupied"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                          }`}
                      >
                        {room.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-normal text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {room.reservation && ['occupied', 'reserved'].includes((room.status || '').toLowerCase()) && (
                          <button
                            onClick={() => handleCheckoutRoom(room)}
                            className={`flex items-center text-orange-600 hover:text-orange-800 ${(!allowManageRooms || checkoutProcessing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!allowManageRooms || checkoutProcessing}
                            title={checkoutProcessing ? 'Processing checkout...' : 'Check Out'}
                          >
                            {checkoutProcessing ? (
                              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <ArrowRightOnRectangleIcon className="h-5 w-5" />
                            )}
                            <span className="sr-only">Check Out</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleViewRoom(room)}
                          className="flex items-center text-blue-600 hover:text-blue-800"
                          title="View Details"
                        >
                          <EyeIcon className="h-5 w-5" />
                          <span className="sr-only">View</span>
                        </button>
                        <button
                          onClick={() => handleEditRoom(room)}
                          className={`flex items-center text-emerald-600 hover:text-emerald-800 ${!canManageRooms ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={!canManageRooms}
                          title="Edit"
                        >
                          <PencilIcon className="h-5 w-5" />
                          <span className="sr-only">Edit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards for room status (visible on small screens) */}
          <div className="block md:hidden space-y-4">
            {sortedStatusRooms.map((room) => (
              <div key={`mobile-status-${room.id}`} className="bg-white p-4 rounded-lg shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">Room</div>
                    <div className="text-lg font-semibold">{room.room_number} — {room.type}</div>
                    <div className="text-sm text-gray-600">Price: {room.price ? (String(room.price).trim().startsWith('₱') ? room.price : `₱${room.price}`) : '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className={`px-2 py-1 rounded-full text-xs font-semibold ${room.status === "Available" ? 'bg-green-100 text-green-800' : room.status === 'Occupied' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {room.status}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {room.reservation && ['occupied', 'reserved'].includes((room.status || '').toLowerCase()) && (
                    <button
                      onClick={() => handleCheckoutRoom(room)}
                      className={`flex items-center text-orange-600 hover:text-orange-800 ${(!allowManageRooms || checkoutProcessing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!allowManageRooms || checkoutProcessing}
                      title={checkoutProcessing ? 'Processing checkout...' : 'Check Out'}
                    >
                      {checkoutProcessing ? (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <ArrowRightOnRectangleIcon className="h-5 w-5" />
                      )}
                      <span className="sr-only">Check Out</span>
                    </button>
                  )}
                  <button onClick={() => handleViewRoom(room)} className="flex items-center text-blue-600 hover:text-blue-800" title="View Details">
                    <EyeIcon className="h-5 w-5" />
                    <span className="sr-only">View</span>
                  </button>
                  <button onClick={() => handleEditRoom(room)} className={`flex items-center text-emerald-600 hover:text-emerald-800 ${!canManageRooms ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!canManageRooms} title="Edit">
                    <PencilIcon className="h-5 w-5" />
                    <span className="sr-only">Edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Housekeeping Tab */}
      {activeTab === "housekeeping" && (
        <HousekeepingTable
          rooms={rooms}
          initialHousekeepingStatus={housekeepingStatus}
          initialHousekeepingNotes={housekeepingNotes}
          onSave={handleSaveHousekeeping}
          userRole={user?.role || ''}
        />
      )}

      {/* Modal for Add/Edit/View Room or Reservation */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-8 rounded-xl w-full max-w-4xl text-gray-700 shadow-lg relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => {
                setShowModal(false);
                setReservation({
                  customerName: "",
                  customerEmail: "",
                  contactNumber: "",
                  address: "",
                  nationality: "",
                  checkInDate: "",
                  checkOutDate: "",
                  additionalRequests: "",
                  additionalGuests: 0,
                  remarks: "",
                  idUpload: null,
                  roomId: "",
                  paymentOption: "full",
                  downpaymentAmount: 0,
                });
                setSelectedPackageId("");
                setShowCustomerLookup(true);
                setCustomerLookup('');
                setFoundCustomers([]);
              }}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold mb-6 text-emerald-700">
              {modalMode === "add" ? "Add Reservation" : modalMode === "edit" ? "Edit Reservation" : modalMode === "view" ? "Reservation Details" : "Add Room"}
            </h2>
            {modalMode === "add" || modalMode === "edit" ? (
              <div className="max-h-[70vh] overflow-y-auto pr-4">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Select Package *</label>
                  <select
                    value={selectedPackageId}
                    onChange={(e) => {
                      setSelectedPackageId(e.target.value);
                      
                      // Reset additional guests when package changes
                      setReservation({ ...reservation, additionalGuests: 0 });
                      
                      // If Single Room package selected and check-in date exists, auto-set check-out to next day
                      const pkgId = parseInt(e.target.value);
                      const selectedPkg = packages.find(p => p.id === pkgId);
                      if (selectedPkg && selectedPkg.name.toLowerCase().includes('single room') && reservation.checkInDate) {
                        const checkInDate = new Date(reservation.checkInDate);
                        const nextDay = new Date(checkInDate);
                        nextDay.setDate(nextDay.getDate() + 1);
                        const checkOutDate = format(nextDay, "yyyy-MM-dd");
                        setReservation({ ...reservation, checkOutDate, additionalGuests: 0 });
                      }
                    }}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    <option value="">Select Package</option>
                    {packages.map((pkg) => {
                      // Check if there are available rooms for this package
                      const availableRoomsForPackage = rooms.filter(
                        (room) => room.packageId === pkg.id && (room.status || '').toLowerCase() === 'available'
                      ).length;
                      const hasAvailableRooms = availableRoomsForPackage > 0;
                      
                      return (
                        <option 
                          key={`${pkg.id}-${pkg.price}`} 
                          value={pkg.id}
                          disabled={!hasAvailableRooms}
                          style={!hasAvailableRooms ? { color: '#9ca3af', backgroundColor: '#f3f4f6' } : {}}
                        >
                          {pkg.name} - {pkg.price} {!hasAvailableRooms ? '(No rooms available)' : `(${availableRoomsForPackage} available)`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Customer Lookup Section */}
                {modalMode === "add" && showCustomerLookup && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-blue-900">Returning Customer?</h3>
                      <button
                        onClick={() => setShowCustomerLookup(false)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Enter manually
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Search by name, email, or phone number"
                        value={customerLookup}
                        onChange={(e) => setCustomerLookup(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCustomerSearch();
                          }
                        }}
                        className="flex-1 p-2 border border-blue-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      />
                      <button
                        onClick={handleCustomerSearch}
                        disabled={lookupLoading || !customerLookup.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {lookupLoading ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Searching...
                          </>
                        ) : (
                          'Search'
                        )}
                      </button>
                    </div>
                    
                    {foundCustomers.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-medium text-blue-900">Found {foundCustomers.length} customer{foundCustomers.length > 1 ? 's' : ''}:</p>
                        {foundCustomers.map((customer, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-white border border-blue-200 rounded-lg hover:border-blue-400 cursor-pointer transition"
                            onClick={() => loadCustomerData(customer)}
                          >
                            <p className="font-semibold text-gray-800">{customer.name}</p>
                            <p className="text-sm text-gray-600">{customer.email} • {customer.phone}</p>
                            <p className="text-xs text-gray-500 mt-1">Last visit: {format(new Date(customer.lastVisit), 'MMM dd, yyyy')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Display loaded customer info */}
                {modalMode === "add" && reservation.customerName && !showCustomerLookup && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-green-900 font-medium">Loaded: {reservation.customerName}</span>
                    </div>
                    <button
                      onClick={() => {
                        setReservation({
                          ...reservation,
                          customerName: '',
                          customerEmail: '',
                          contactNumber: '',
                          address: '',
                          nationality: ''
                        });
                        setShowCustomerLookup(true);
                        setFoundCustomers([]);
                        setCustomerLookup('');
                      }}
                      className="text-sm text-green-600 hover:text-green-800 underline"
                    >
                      New customer
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Customer Name *</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Customer Name"
                        value={reservation.customerName}
                        onChange={async (e) => {
                          const value = e.target.value;
                          setReservation({ ...reservation, customerName: value });
                          
                          // Auto-search when user types at least 3 characters
                          if (value.trim().length >= 3 && modalMode === "add" && !showCustomerLookup) {
                            setLookupLoading(true);
                            try {
                              const token = localStorage.getItem("token") || sessionStorage.getItem("token");
                              const customers = await searchCustomerHistory(value.trim(), token);
                              
                              if (customers.length > 0) {
                                setFoundCustomers(customers);
                                setShowCustomerLookup(true);
                                setCustomerLookup(value.trim());
                              }
                            } catch (error) {
                              console.warn("Auto-search failed:", error);
                            } finally {
                              setLookupLoading(false);
                            }
                          }
                        }}
                        className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      />
                      {lookupLoading && modalMode === "add" && (
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                          <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Email *</label>
                    <input
                      type="email"
                      placeholder="Email"
                      value={reservation.customerEmail}
                      onChange={(e) => setReservation({ ...reservation, customerEmail: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Contact Number *</label>
                    <input
                      type="text"
                      placeholder="Contact Number"
                      value={reservation.contactNumber}
                      onChange={(e) => setReservation({ ...reservation, contactNumber: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Address *</label>
                    <input
                      type="text"
                      placeholder="Address"
                      value={reservation.address}
                      onChange={(e) => setReservation({ ...reservation, address: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Nationality</label>
                    <select
                      value={reservation.nationality}
                      onChange={(e) => setReservation({ ...reservation, nationality: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    >
                      <option value="">Select Nationality</option>
                      {countries.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Additional Guests
                      {selectedPackageId && getMaxGuestsForPackage(selectedPackageId) > 0 && (
                        <span className="text-xs text-gray-500 ml-1">(Max: {getMaxGuestsForPackage(selectedPackageId)})</span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={getMaxGuestsForPackage(selectedPackageId) || undefined}
                      value={reservation.additionalGuests}
                      onChange={(e) => {
                        const numValue = parseInt(e.target.value) || 0;
                        const maxGuests = getMaxGuestsForPackage(selectedPackageId);
                        
                        if (maxGuests > 0 && numValue > maxGuests) {
                          Swal.fire({
                            icon: 'warning',
                            title: 'Guest Limit Exceeded',
                            text: `The selected room package allows a maximum of ${maxGuests} guest${maxGuests > 1 ? 's' : ''}. Please select a different room or reduce the number of additional guests.`,
                            confirmButtonColor: '#f59e0b'
                          });
                          return;
                        }
                        
                        setReservation({ ...reservation, additionalGuests: numValue });
                      }}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      disabled={!selectedPackageId}
                    />
                    {!selectedPackageId && (
                      <p className="text-xs text-gray-500 mt-1">Please select a room package first</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Check-In Date *</label>
                    <input
                      type="date"
                      value={reservation.checkInDate}
                      min={format(new Date(), "yyyy-MM-dd")}
                      onChange={(e) => {
                        const newCheckIn = e.target.value;
                        // Check if Single Room package is selected
                        const selectedPkg = packages.find(p => p.id === parseInt(selectedPackageId));
                        const isSingleRoom = selectedPkg && selectedPkg.name.toLowerCase().includes('single room');
                        
                        if (isSingleRoom && newCheckIn) {
                          // Auto-set check-out to next day for Single Room
                          const checkInDate = new Date(newCheckIn);
                          const nextDay = new Date(checkInDate);
                          nextDay.setDate(nextDay.getDate() + 1);
                          const checkOutDate = format(nextDay, "yyyy-MM-dd");
                          setReservation({ ...reservation, checkInDate: newCheckIn, checkOutDate });
                        } else {
                          setReservation({ ...reservation, checkInDate: newCheckIn });
                        }
                      }}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Check-Out Date *
                      {(() => {
                        const selectedPkg = packages.find(p => p.id === parseInt(selectedPackageId));
                        const isSingleRoom = selectedPkg && selectedPkg.name.toLowerCase().includes('single room');
                        return isSingleRoom ? <span className="text-xs text-gray-500 ml-2">(Auto-set for Single Room)</span> : null;
                      })()}
                    </label>
                    <input
                      type="date"
                      value={reservation.checkOutDate}
                      min={format(new Date(), "yyyy-MM-dd")}
                      onChange={(e) => setReservation({ ...reservation, checkOutDate: e.target.value })}
                      disabled={(() => {
                        const selectedPkg = packages.find(p => p.id === parseInt(selectedPackageId));
                        return selectedPkg && selectedPkg.name.toLowerCase().includes('single room');
                      })()}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-600 mb-1">ID Upload *</label>
                    <div className="flex gap-3">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleIdUpload}
                        className="flex-1 p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={startCamera}
                        className="bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        Capture ID
                      </button>
                    </div>
                    {reservation.idUpload && (
                      <div className="mt-3">
                        <img
                          src={reservation.idUpload}
                          alt="Uploaded ID"
                          className="w-full h-32 object-contain rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Additional Requests</label>
                    <textarea
                      placeholder="Additional Requests"
                      value={reservation.additionalRequests ?? ""}
                      onChange={(e) => setReservation({ ...reservation, additionalRequests: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      rows="3"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Remarks</label>
                    <textarea
                      placeholder="Remarks"
                      value={reservation.remarks ?? ""}
                      onChange={(e) => setReservation({ ...reservation, remarks: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      rows="3"
                    />
                  </div>
                  
                  {/* Payment Options Section */}
                  <div className="col-span-2">
                    <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border-2 border-emerald-200 rounded-lg p-6 mt-4">
                      <h3 className="text-lg font-semibold text-emerald-700 mb-4 flex items-center">
                        <svg className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Payment Options
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <button
                          type="button"
                          onClick={() => setReservation({ ...reservation, paymentOption: "full", downpaymentAmount: 0 })}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            reservation.paymentOption === "full"
                              ? "border-blue-600 bg-blue-50 shadow-md"
                              : "border-gray-300 bg-white hover:border-blue-300"
                          }`}
                        >
                          <div className="flex flex-col items-center">
                            <svg className={`w-8 h-8 mb-2 ${reservation.paymentOption === "full" ? "text-blue-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className={`font-semibold ${reservation.paymentOption === "full" ? "text-blue-700" : "text-gray-700"}`}>
                              Full Payment at Checkout
                            </span>
                            <span className="text-xs text-gray-500 mt-1">Pay the entire amount when checking out</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setReservation({ ...reservation, paymentOption: "downpayment" })}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            reservation.paymentOption === "downpayment"
                              ? "border-emerald-600 bg-emerald-50 shadow-md"
                              : "border-gray-300 bg-white hover:border-emerald-300"
                          }`}
                        >
                          <div className="flex flex-col items-center">
                            <svg className={`w-8 h-8 mb-2 ${reservation.paymentOption === "downpayment" ? "text-emerald-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className={`font-semibold ${reservation.paymentOption === "downpayment" ? "text-emerald-700" : "text-gray-700"}`}>
                              Downpayment Now
                            </span>
                            <span className="text-xs text-gray-500 mt-1">Pay partial amount now, rest at checkout</span>
                          </div>
                        </button>
                      </div>

                      {/* Downpayment Amount Input */}
                      {reservation.paymentOption === "downpayment" && (
                        <div className="mt-4 p-4 bg-white rounded-lg border border-emerald-300">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Downpayment Amount (₱) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={reservation.downpaymentAmount}
                            onChange={(e) => setReservation({ ...reservation, downpaymentAmount: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-lg font-semibold"
                            placeholder="Enter downpayment amount"
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            💡 Recommended: 50% of total amount. Customer will pay the remaining balance at checkout.
                          </p>
                        </div>
                      )}

                      {/* Payment Summary */}
                      {selectedPackageId && reservation.checkInDate && reservation.checkOutDate && (
                        <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Payment Summary</h4>
                          {(() => {
                            const selectedPkg = packages.find(p => p.id === parseInt(selectedPackageId));
                            if (!selectedPkg) return <p className="text-sm text-gray-500">Select a package to see pricing</p>;
                            
                            const pkgPrice = parseFloat(selectedPkg.price.replace(/[₱,]/g, ''));
                            const checkIn = parseLocalDate(reservation.checkInDate) || new Date();
                            const checkOut = parseLocalDate(reservation.checkOutDate) || new Date();
                            const nights = Math.max(1, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
                            const totalPrice = nights * pkgPrice; // Fixed: removed the subtraction
                            const downAmount = parseFloat(reservation.downpaymentAmount || 0);
                            const remaining = totalPrice - downAmount;
                            
                            return (
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Package: {selectedPkg.name}</span>
                                  <span className="font-medium">{selectedPkg.price} / night</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Number of Nights:</span>
                                  <span className="font-medium">{nights}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t">
                                  <span className="font-semibold text-gray-800">Total Amount:</span>
                                  <span className="font-bold text-lg text-emerald-600">₱{totalPrice.toFixed(2)}</span>
                                </div>
                                {reservation.paymentOption === "downpayment" && downAmount > 0 && (
                                  <>
                                    <div className="flex justify-between text-emerald-700">
                                      <span className="font-medium">Downpayment:</span>
                                      <span className="font-semibold">₱{downAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-red-600">
                                      <span className="font-medium">Balance Due at Checkout:</span>
                                      <span className="font-bold">₱{remaining.toFixed(2)}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Terms & Conditions Section */}
                  <div className="col-span-2 mt-6">
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6">
                      <h3 className="text-lg font-bold text-amber-900 mb-4 flex items-center">
                        <svg className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        TERMS & CONDITIONS OF STAY
                      </h3>
                      
                      <div className="space-y-3 text-sm text-gray-800">
                        <p>• A valid identification card must be presented upon check-in.</p>
                        
                        <p>• All guests arriving must register with the Hotel&apos;s Front Desk. Check-in time is 2:00 p.m. and check-out time is 12:00 noon.</p>
                        
                        <p>• Should you wish to stay beyond the designated check-out time, please inform the Front Desk. Early check-in and check-out are subject to an additional charge and room availability.</p>
                        
                        <p>• Proper courtesy must be observed at all times. The privacy of other guests must be respected.</p>
                        
                        <p>• Money, valuables, and important documents must be kept in the safety deposit box located inside your room. The hotel will not be held liable for any loss.</p>
                        
                        <p>• Gambling and possession of illegal drugs are not allowed within the hotel premises.</p>
                        
                        <p>• Towels, linens, and appliances should not be brought out or transferred to another room to avoid unnecessary charges.</p>
                        
                        <p>• Amenities are provided for your comfort during your stay. Should you wish to request additional items, please call the Front Desk.</p>
                        
                        <p>• Smoking inside the room and bringing food with a strong odor are not allowed. A fine of ₱5,000.00 for fumigation shall be charged for non-compliance.</p>
                        
                        <p className="pt-2 border-t border-amber-300 font-medium">• By affixing your signature (whether personally, through an agent, or a representative), you hereby agree to the terms and conditions set forth herein and consent to the collection and processing of your data by the hotel, in accordance with the Data Privacy Act and the regulations of the National Privacy Commission (NPC).</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setSelectedRoom(null);
                      setSelectedPackageId("");
                      setReservation({
                        customerName: "",
                        customerEmail: "",
                        contactNumber: "",
                        address: "",
                        nationality: "",
                        checkInDate: "",
                        checkOutDate: "",
                        additionalRequests: "",
                        additionalGuests: 0,
                        remarks: "",
                        idUpload: null,
                        roomId: "",
                        paymentOption: "full",
                        downpaymentAmount: 0,
                      });
                    }}
                    className="bg-gray-200 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={modalMode === "add" ? handleSaveReservation : handleEditReservation}
                    className="relative bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <svg
                          className="animate-spin h-5 w-5 mr-2 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Processing...
                      </div>
                    ) : (
                      modalMode === "add" ? "Create Reservation" : "Update Reservation"
                    )}
                  </button>
                </div>
              </div>
            ) : modalMode === "view" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
                {/* Left Column: Room Details & Billing */}
                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold text-emerald-700">Room Details</h3>
                    <div className="mt-2 text-sm text-gray-700 grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-gray-500">Room</div>
                        <div className="font-medium">{viewRoom.room_number}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Type</div>
                        <div className="font-medium">{viewRoom.type}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Price</div>
                        <div className="font-medium">{viewRoom.price ? (String(viewRoom.price).trim().startsWith('₱') ? viewRoom.price : `₱${viewRoom.price}`) : '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Status</div>
                        <div className="font-medium">{viewRoom.status}</div>
                      </div>
                    </div>
                    {viewRoom.packageId && (
                      <div className="mt-3 text-sm text-gray-700">
                        <div className="text-xs text-gray-500">Package</div>
                        <div className="font-medium">{packages.find((pkg) => pkg.id === viewRoom.packageId)?.name || "N/A"}</div>
                        <div className="text-sm text-gray-500">{packages.find((pkg) => pkg.id === viewRoom.packageId)?.description || ''}</div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-white rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold text-emerald-700">Billing Summary</h3>
                    <div className="mt-2 text-sm text-gray-700 space-y-2">
                      {(() => {
                        // Find the corresponding billing row for this reservation
                        const billingRow = billingRows.find(row => row.reservationId === viewRoom.reservation?.id);
                        if (billingRow) {
                          return (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs text-gray-500">Total Amount</div>
                                <div className="font-medium">{formatCurrency(billingRow.totalPayment)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Downpayment</div>
                                <div className="font-medium">{formatCurrency(billingRow.downpaymentDisplay)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Remaining Balance</div>
                                <div className="font-medium text-red-600">{formatCurrency(billingRow.remainingBalance)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Total Paid</div>
                                <div className="font-medium text-green-600">{formatCurrency(billingRow.totalPaid)}</div>
                              </div>
                            </div>
                          );
                        } else {
                          // Fallback to old calculation if billing data not found
                          return (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs text-gray-500">Total Amount</div>
                                <div className="font-medium">{formatCurrency(viewRoom.reservation?.totalCost ?? viewRoom.reservation?.total ?? 0)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Downpayment</div>
                                <div className="font-medium">{formatCurrency(viewRoom.reservation?.downpaymentAmount ?? viewRoom.reservation?.downpayment ?? 0)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Remaining Balance</div>
                                <div className="font-medium text-red-600">{formatCurrency((viewRoom.reservation?.totalCost ?? viewRoom.reservation?.total ?? 0) - (viewRoom.reservation?.downpaymentAmount ?? viewRoom.reservation?.downpayment ?? 0))}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Total Paid</div>
                                <div className="font-medium text-green-600">{formatCurrency(viewRoom.reservation?.totalPaid ?? 0)}</div>
                              </div>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right Column: Guest & Payments */}
                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold text-emerald-700">Guest Information</h3>
                    {viewRoom.reservation ? (
                      <div className="mt-2 text-sm text-gray-700 space-y-2">
                        <div>
                          <div className="text-xs text-gray-500">Guest</div>
                          <div className="font-medium">{viewRoom.reservation.customerName}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Email</div>
                          <div className="font-medium">{viewRoom.reservation.customerEmail}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Contact</div>
                          <div className="font-medium">{viewRoom.reservation.contactNumber}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Check-in</div>
                          <div className="font-medium">{formatDateString(viewRoom.reservation.checkInDate)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Check-out</div>
                          <div className="font-medium">{formatDateString(viewRoom.reservation.checkOutDate)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Additional Guests</div>
                          <div className="font-medium">{viewRoom.reservation.additionalGuests || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Remarks</div>
                          <div className="font-medium">{viewRoom.reservation.remarks || 'N/A'}</div>
                        </div>
                        {viewRoom.reservation.idUpload && (
                          <div>
                            <div className="text-xs text-gray-500">ID Upload</div>
                            <img src={viewRoom.reservation.idUpload} alt="ID" className="w-full h-32 object-contain rounded-lg mt-2" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No reservation details available.</p>
                    )}
                  </div>

                  <div className="p-4 bg-white rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold text-emerald-700">Reference Number</h3>
                    <div className="mt-2">
                      {(() => {
                        // Find the corresponding billing row for this reservation
                        const billingRow = billingRows.find(row => row.reservationId === viewRoom.reservation?.id);
                        const reference = billingRow?.reference || viewRoom.reservation?.referenceNumber || '—';
                        return (
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="text-xs text-gray-500">Payment Reference</div>
                              <div className="font-medium text-lg">{reference}</div>
                            </div>
                            {reference && reference !== '—' && (
                              <button
                                type="button"
                                onClick={() => handleCopyToClipboard(reference, 'Reference copied')}
                                className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                              >
                                Copy
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold text-emerald-700">Payment Details</h3>
                    {viewRoomPayments && viewRoomPayments.length > 0 ? (
                      <div className="space-y-2 text-sm mt-2">
                        {viewRoomPayments.map((p) => (
                          <div key={p.id || `${p.created_at}-${p.amount}`} className="flex items-center justify-between border-b pb-2">
                            <div className="text-gray-700">
                              <div className="font-medium">{p.method ? p.method.toUpperCase() : 'PAYMENT'} • {p.type}</div>
                              <div className="text-xs text-gray-500">{p.note || ''}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">{formatCurrency(p.amount)}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="text-xs text-gray-500">{p.reference_number || p.reference || '—'}</div>
                                {(p.reference_number || p.reference) && (
                                  <button onClick={() => handleCopyToClipboard(p.reference_number || p.reference, 'Payment reference copied')} className="px-2 py-0.5 bg-gray-100 rounded text-xs hover:bg-gray-200">Copy</button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mt-2">No payments recorded.</p>
                    )}
                  </div>
                </div>
                <div className="col-span-2 flex justify-end gap-3 mt-6">
                  {allowManageRooms && viewRoom?.reservation && ['occupied', 'reserved'].includes((viewRoom?.status || '').toLowerCase()) && (
                    <button
                      onClick={() => handleCheckoutRoom(viewRoom)}
                      className={`bg-orange-500 text-white px-5 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 ${checkoutProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={checkoutProcessing}
                    >
                      {checkoutProcessing && (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {checkoutProcessing ? 'Processing Checkout...' : 'Check Out Room'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowModal(false)}
                    className="bg-gray-200 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : modalMode === "viewPackage" ? (
              <div className="max-h-[70vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-emerald-700">Package Details</h3>
                {viewPackage ? (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      {viewPackage.image && (
                        <img src={viewPackage.image} alt={viewPackage.name} className="w-full h-48 object-cover rounded-lg" />
                      )}
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-800">{viewPackage.name}</div>
                      <div className="text-emerald-700 font-semibold mt-2">{viewPackage.price}</div>
                      <div className="text-sm text-gray-600 mt-2">Guests: {viewPackage.guests}</div>
                      <p className="text-gray-700 mt-3">{viewPackage.description}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600">No package selected.</p>
                )}
                <div className="mt-6 flex justify-end">
                  <button onClick={() => { setShowModal(false); setViewPackage(null); }} className="bg-gray-200 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-300">Close</button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Room Number *</label>
                    <input
                      type="text"
                      placeholder="Room Number"
                      value={newRoom.roomNumber}
                      onChange={(e) => setNewRoom({ ...newRoom, roomNumber: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Type *</label>
                    <input
                      type="text"
                      placeholder="Room Type"
                      value={newRoom.type}
                      onChange={(e) => setNewRoom({ ...newRoom, type: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Price *</label>
                    <input
                      type="text"
                      placeholder="Price"
                      value={newRoom.price}
                      onChange={(e) => setNewRoom({ ...newRoom, price: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
                    <select
                      value={newRoom.status}
                      onChange={(e) => setNewRoom({ ...newRoom, status: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    >
                      <option value="Available">Available</option>
                      <option value="Occupied">Occupied</option>
                      <option value="Reserved">Reserved</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Package *</label>
                    <select
                      value={newRoom.packageId}
                      onChange={(e) => setNewRoom({ ...newRoom, packageId: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    >
                      <option value="">Select Package</option>
                      {packages.map((pkg) => (
                        <option key={`${pkg.id}-${pkg.price}`} value={pkg.id}>
                          {pkg.name} - {pkg.price}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowModal(false)}
                    className="bg-gray-200 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddRoom}
                    className="bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <svg
                          className="animate-spin h-5 w-5 mr-2 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Processing...
                      </div>
                    ) : (
                      "Add Room"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {/* Collect Payment Modal (appears when checkout is blocked due to outstanding) */}
      {showCollectPaymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md text-gray-700 shadow-lg">
            <h2 className="text-xl font-bold mb-3 text-emerald-700">Collect Outstanding Payment</h2>
            <p className="text-sm text-gray-600 mb-4">The reservation has an outstanding balance. Record payment here and we will retry checkout automatically.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600">Room</label>
                <div className="mt-1 text-gray-800 font-semibold">{pendingCheckoutRoom?.room_number ?? '—'}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-600">Guest</label>
                <div className="mt-1 text-gray-800">{pendingCheckoutRoom?.reservation?.customerName ?? '—'}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Amount (₱)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={collectPaymentAmount}
                  onChange={(e) => setCollectPaymentAmount(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Method</label>
                <select
                  value={collectPaymentMethod}
                  onChange={(e) => setCollectPaymentMethod(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 bg-white"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="gcash">Gcash</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Note (optional)</label>
                <input
                  type="text"
                  value={collectPaymentNote}
                  onChange={(e) => setCollectPaymentNote(e.target.value)}
                  placeholder="Note for this payment"
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 bg-white"
                />
              </div>

              {collectPaymentMethod && collectPaymentMethod.toLowerCase() === 'gcash' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">GCash Reference Number *</label>
                  <input
                    type="text"
                    value={collectPaymentReference}
                    onChange={(e) => setCollectPaymentReference(e.target.value)}
                    placeholder="Enter GCash reference number"
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 bg-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-sm text-gray-600">
                <div>Suggested: <span className="font-semibold text-gray-800">₱{Number((pendingCheckoutRoom?.remainingBalance ?? collectPaymentAmount) || 0).toFixed(2)}</span></div>
                {Number(collectPaymentAmount) < Number(pendingCheckoutRoom?.remainingBalance ?? 0) && (
                  <div className="text-red-600">Amount is less than outstanding</div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowCollectPaymentModal(false); setPendingCheckoutRoom(null); }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={submitCollectPayment}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
              >
                Record Payment & Retry Checkout
              </button>
            </div>
          </div>
        </div>
      )}
      {showCameraModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-8 rounded-xl w-full max-w-lg text-gray-700 shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-emerald-700">Capture ID</h2>
            <video ref={videoRef} autoPlay className="w-full h-64 object-cover rounded-lg mb-4" />
            <canvas ref={captureCanvasRef} className="hidden" />
            <div className="flex justify-end gap-3">
              <button
                onClick={stopCamera}
                className="bg-gray-200 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                className="bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
