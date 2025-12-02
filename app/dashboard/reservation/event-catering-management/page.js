"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import { can, Permissions } from '../../../lib/rbac';
import { PlusIcon, TrashIcon, PencilIcon, EyeIcon, MagnifyingGlassIcon, ClockIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon, PrinterIcon } from "@heroicons/react/24/outline";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { format } from "date-fns";
import Image from "next/image";
import Swal from "sweetalert2";

// Helper functions
const formatTimeTo12h = (timeInput) => {
  try {
    if (!timeInput) return "";
    if (timeInput.includes('T')) {
      const date = new Date(timeInput);
      if (isNaN(date.getTime())) throw new Error("Invalid date format");
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const suffix = hours >= 12 ? 'PM' : 'AM';
      hours = ((hours + 11) % 12 + 1);
      return `${hours}:${minutes} ${suffix}`;
    }
    let [hours, minutes] = timeInput.split(':');
    hours = parseInt(hours, 10);
    if (isNaN(hours) || !minutes) throw new Error("Invalid time format");
    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours = ((hours + 11) % 12 + 1);
    return `${hours}:${minutes} ${suffix}`;
  } catch (error) {
    console.error("Error formatting time:", error);
    return "";
  }
};

const formatTimeTo24h = (time12) => {
  try {
    if (!time12) return "";
    const [time, modifier] = time12.split(' ');
    let [hours, minutes] = time.split(':');
    if (!hours || !minutes) throw new Error("Invalid time format");
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
    return `${hours}:${minutes}`;
  } catch (error) {
    console.error("Error converting to 24h format:", error);
    return "";
  }
};

const formatDate = (dateString) => {
  try {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) throw new Error("Invalid date format");
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "";
  }
};

// Safe number parsing and currency formatting
const safeNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (value) => {
  const n = safeNumber(value);
  return `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Search for returning customers by email or phone
const searchCustomerHistory = async (searchTerm, token) => {
  try {
    const response = await fetch(`/api/reservation-history?customer_name=${encodeURIComponent(searchTerm)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    
    if (!response.ok) throw new Error('Failed to search customers');
    
    const data = await response.json();
    
    // Combine room and event reservations and extract unique customers
    const allReservations = [
      ...(data.roomReservations || []),
      ...(data.eventReservations || [])
    ];
    
    // Filter by email or phone match
    const matchingReservations = allReservations.filter(res => {
      const email = (res.customer_email || '').toLowerCase();
      const phone = (res.contact_number || '').replace(/\D/g, '');
      const searchTermClean = searchTerm.toLowerCase().replace(/\D/g, '');
      
      return email.includes(searchTerm.toLowerCase()) || 
             phone.includes(searchTermClean);
    });
    
    // Get unique customers (by email or name)
    const uniqueCustomers = [];
    const seen = new Set();
    
    matchingReservations.forEach(res => {
      const key = `${res.customer_email}-${res.customer_name || res.booked_by}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCustomers.push({
          name: res.customer_name || res.booked_by,
          email: res.customer_email,
          phone: res.contact_number,
          lastVisit: res.check_in_date || res.event_date || res.date || res.created_at
        });
      }
    });
    
    return uniqueCustomers;
  } catch (error) {
    console.error('Customer search error:', error);
    return [];
  }
};

const sets = [
  { name: "Set A", price: 250, maxDishes: 3 },
  { name: "Set B", price: 300, maxDishes: 4 },
  { name: "Set C", price: 350, maxDishes: 5 },
  { name: "Set D", price: 400, maxDishes: 6 },
];

export default function EventCateringManagement() {
  const { user, token } = useAuth();
  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [approvedEventReservations, setApprovedEventReservations] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedEventReference, setSelectedEventReference] = useState(null);
  const [selectedEventPayments, setSelectedEventPayments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookedDates, setBookedDates] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [packages, setPackages] = useState([]);
  const [managers, setManagers] = useState([]);
  const [customerIdFile, setCustomerIdFile] = useState(null);
  const [eSignature, setESignature] = useState(null);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedDishes, setSelectedDishes] = useState([]);
  const [totalCost, setTotalCost] = useState(0);
  const [additionalGuests, setAdditionalGuests] = useState(0);
  const [guestCount, setGuestCount] = useState(0);
  const [fetchedDishes, setFetchedDishes] = useState([]);
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [showCameraPopup, setShowCameraPopup] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [showSignaturePopup, setShowSignaturePopup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Returning customer lookup states
  const [customerLookup, setCustomerLookup] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [foundCustomers, setFoundCustomers] = useState([]);
  const [showCustomerLookup, setShowCustomerLookup] = useState(true);
  const [newEvent, setNewEvent] = useState({
    bookedBy: "",
    contactNumber: "",
    address: "",
  });

  // Payment collection modal states (similar to room management)
  const [showCollectPaymentModal, setShowCollectPaymentModal] = useState(false);
  const [collectPaymentAmount, setCollectPaymentAmount] = useState(0);
  const [collectPaymentMethod, setCollectPaymentMethod] = useState('cash');
  const [collectPaymentReference, setCollectPaymentReference] = useState('');
  const [collectPaymentNote, setCollectPaymentNote] = useState('');
  const [pendingCheckoutEvent, setPendingCheckoutEvent] = useState(null);

  // Check user role permissions using RBAC helpers
  const role = user?.role || '';

  // Today's date in yyyy-MM-dd format for input min attributes
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const canAdd = can(role, Permissions.Reservations, 'create');
  const canEdit = can(role, Permissions.Reservations, 'update') || can(role, Permissions.Reservations, 'manage');
  const canDelete = can(role, Permissions.Reservations, 'delete') || can(role, Permissions.Reservations, 'manage');
  // Prevent Security role from being able to edit or delete events via the UI
  const isSecurity = (role || '').toLowerCase() === 'security';
  const allowEdit = canEdit && !isSecurity;
  const allowDelete = canDelete && !isSecurity;

  // Fetch data with improved error handling
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchDishes(),
          fetchPackages(),
          fetchEvents(),
          fetchOrders(),
          fetchManagers(),
          fetchApprovedEventReservations()
        ]);
      } catch (error) {
        console.error("Error fetching initial data:", error);
        Swal.fire({
          title: "Error",
          text: error.message || "Failed to load initial data. Please try again.",
          icon: "error",
          confirmButtonText: "Retry",
        }).then((result) => {
          if (result.isConfirmed) fetchData();
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const fetchDishes = async () => {
    try {
      const res = await fetch('/api/dishes', { timeout: 10000 });
      if (!res.ok) throw new Error(`Failed to fetch dishes: ${res.statusText}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid dishes data format");
      setFetchedDishes(data);
    } catch (error) {
      throw new Error(`Error fetching dishes: ${error.message}`);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/event_packages', { timeout: 10000 });
      if (!res.ok) throw new Error(`Failed to fetch packages: ${res.statusText}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid packages data format");
      setPackages(data);
    } catch (error) {
      throw new Error(`Error fetching packages: ${error.message}`);
    }
  };

  const fetchManagers = async () => {
    try {
      const res = await fetch('/api/staff', { timeout: 10000 });
      if (!res.ok) throw new Error(`Failed to fetch staff: ${res.statusText}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid staff data format");
      const managerList = data.filter((staff) => staff.role?.toLowerCase() === 'manager');
      setManagers(managerList);
    } catch (error) {
      throw new Error(`Error fetching managers: ${error.message}`);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/event", {
  headers: { Authorization: `Bearer ${token}` },
  timeout: 10000,
});
      if (!res.ok) throw new Error(`Failed to fetch events: ${res.statusText}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid events data format");

      const formattedEvents = data.map((event) => ({
        ...event,
        contact_number: event.contact_number || null,
        totalCost: event.total_cost != null ? Number(event.total_cost) : 0,
        packagePrice: event.price != null ? Number(event.price) : (event.total != null ? Number(event.total) : 0),
        // If API returns explicit fields use them, otherwise try to parse from remarks
        downpaymentAmount: event.downpayment_amount != null
          ? Number(event.downpayment_amount)
          : (() => {
              try {
                if (!event.remarks) return 0;
                const m = event.remarks.match(/Downpayment:\s*₱?([\d,]+(?:\.\d+)?)/i);
                if (m && m[1]) return Number(String(m[1]).replace(/,/g, ''));
              } catch (e) {
                // ignore
              }
              return 0;
            })(),
        remainingBalance: event.remaining_balance != null
          ? Number(event.remaining_balance)
          : (() => {
              try {
                if (!event.remarks) return 0;
                const m = event.remarks.match(/Remaining:\s*₱?([\d,]+(?:\.\d+)?)/i);
                if (m && m[1]) return Number(String(m[1]).replace(/,/g, ''));
              } catch (e) {
                // ignore
              }
              return 0;
            })(),
        dishes: Array.isArray(event.dishes) ? event.dishes : (event.dishes ? [event.dishes] : []),
        set: event.set || null,
      }));

      setEvents(formattedEvents);
      const eventsByDate = {};
      data
        .filter((e) => e.status?.toLowerCase() !== "cancelled")
        .forEach((e) => {
          try {
            const dateStr = format(new Date(e.date), "yyyy-MM-dd");
            eventsByDate[dateStr] = (eventsByDate[dateStr] || 0) + 1;
          } catch (error) {
            console.error(`Error processing event date for event ${e.id}:`, error);
          }
        });
      const fullyBookedDates = Object.entries(eventsByDate)
        .filter(([_, count]) => count >= 2)
        .map(([date]) => date);
      setBookedDates(fullyBookedDates);
    } catch (error) {
      throw new Error(`Error fetching events: ${error.message}`);
    }
  };

  const fetchApprovedEventReservations = async () => {
    try {
      const res = await fetch("/api/approved-reservations?type=event", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      if (!res.ok) throw new Error(`Failed to fetch approved event reservations`);
      const data = await res.json();
      setApprovedEventReservations(data.reservations || []);
    } catch (error) {
      console.error('Error fetching approved event reservations:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/catering", { timeout: 10000 });
      if (!res.ok) throw new Error(`Failed to fetch orders: ${res.statusText}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid orders data format");
      setOrders(data);
    } catch (error) {
      throw new Error(`Error fetching orders: ${error.message}`);
    }
  };

  // Refresh events with notification
  useEffect(() => {
    const handleStorageChange = async () => {
      try {
        await fetchEvents();
        Swal.fire({
          title: "Updated",
          text: "Event list has been refreshed",
          icon: "info",
          timer: 1500,
          showConfirmButton: false
        });
      } catch (error) {
        console.error("Error refreshing events:", error);
        Swal.fire({
          title: "Error",
          text: "Failed to refresh events",
          icon: "error",
          timer: 2000,
          showConfirmButton: false
        });
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Handle customer search
  const handleCustomerSearch = async () => {
    if (!customerLookup.trim()) return;
    
    setLookupLoading(true);
    setFoundCustomers([]);
    
    try {
      const customers = await searchCustomerHistory(customerLookup.trim(), token);
      
      setFoundCustomers(customers);
      
      if (customers.length === 0) {
        Swal.fire({
          title: "Info",
          text: "No previous reservations found for this customer",
          icon: "info",
          timer: 2000,
          showConfirmButton: false
        });
      } else if (customers.length === 1) {
        // Auto-load if only one customer found
        loadCustomerData(customers[0]);
        Swal.fire({
          title: "Success",
          text: "Customer information loaded",
          icon: "success",
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      Swal.fire({
        title: "Error",
        text: "Failed to search customer history",
        icon: "error",
        timer: 2000,
        showConfirmButton: false
      });
    } finally {
      setLookupLoading(false);
    }
  };

  // Load customer data into form
  const loadCustomerData = (customer) => {
    setNewEvent({
      ...newEvent,
      bookedBy: customer.name || '',
      contactNumber: customer.phone || ''
    });
    setShowCustomerLookup(false);
    setFoundCustomers([]);
    setCustomerLookup('');
  };

  // Signature canvas setup
  useEffect(() => {
    if (showSignaturePopup && canvasRef.current) {
      try {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = 400 * dpr;
        canvas.height = 200 * dpr;
        canvas.style.width = '400px';
        canvas.style.height = '200px';
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'black';
        setESignature(null);
      } catch (error) {
        console.error("Error setting up signature canvas:", error);
        Swal.fire({
          title: "Error",
          text: "Failed to initialize signature canvas",
          icon: "error"
        });
      }
    }
  }, [showSignaturePopup]);

  // Reset form states
  useEffect(() => {
    if (showAddModal) {
      setSelectedDishes([]);
      setSelectedSet(null);
      setSelectedPackage(null);
      setTotalCost(0);
      setAdditionalGuests(0);
      setGuestCount(0);
      setCustomerIdFile(null);
      setESignature(null);
      setShowCameraPopup(false);
      setCameraError(null);
      setSelectedEvent(null);
    }
  }, [showAddModal]);

  useEffect(() => {
    if (showEditModal && selectedEvent) {
      try {
        setSelectedDishes(Array.isArray(selectedEvent.dishes) ? selectedEvent.dishes : []);
        setSelectedSet(sets.find((s) => s.name === selectedEvent.set) || null);
        setSelectedPackage(packages.find((p) => p.name === selectedEvent.menu) || null);
        setTotalCost(selectedEvent.totalCost || 0);
        setAdditionalGuests(selectedEvent.additional_guests || 0);
        setGuestCount(selectedEvent.guests || 0);
        setCustomerIdFile(null);
        setShowCameraPopup(false);
        setCameraError(null);
      } catch (error) {
        console.error("Error setting up edit modal:", error);
        Swal.fire({
          title: "Error",
          text: "Failed to load event data for editing",
          icon: "error"
        });
      }
    }
  }, [showEditModal, selectedEvent, packages]);

  // Calculate total cost
  useEffect(() => {
    try {
      if (selectedPackage && selectedSet) {
        const baseCost = parseFloat(selectedPackage.price.replace(/[^\d.]/g, '')) || 0;
        const additionalCost = additionalGuests * selectedSet.price;
        setTotalCost(baseCost + additionalCost);
      } else if (selectedPackage) {
        setTotalCost(parseFloat(selectedPackage.price.replace(/[^\d.]/g, '')) || 0);
      } else {
        setTotalCost(0);
      }
    } catch (error) {
      console.error("Error calculating total cost:", error);
      setTotalCost(0);
      Swal.fire({
        title: "Error",
        text: "Failed to calculate total cost",
        icon: "error",
        timer: 2000,
        showConfirmButton: false
      });
    }
  }, [selectedPackage, selectedSet, additionalGuests]);

  // Print event reservation info for client
  const printEventReservationInfo = (eventInfo) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the reservation confirmation.');
      return;
    }
    
    // Generate confirmation number and date if not present
    const confirmationNumber = eventInfo.confirmationNumber || eventInfo.confirmation_number || eventInfo.id || 'N/A';
    const createdAt = eventInfo.createdAt || eventInfo.created_at || new Date().toLocaleDateString();
    
    // Safely parse numeric values that might be strings or embedded in remarks
    const safeParseNumber = (v) => {
      try {
        if (v === null || v === undefined) return 0;
        const n = Number(v);
        if (!isNaN(n)) return n;
        const cleaned = String(v).replace(/[^0-9.-]+/g, '');
        const nn = Number(cleaned);
        return isNaN(nn) ? 0 : nn;
      } catch (e) {
        return 0;
      }
    };

    const totalValRaw = eventInfo.totalCost ?? eventInfo.total_cost ?? eventInfo.total ?? eventInfo.price ?? 0;
    const downRaw = eventInfo.downpaymentAmount ?? eventInfo.downpayment_amount ?? eventInfo.downpayment ?? 0;
    const remainingRaw = eventInfo.remainingBalance ?? eventInfo.remaining_balance ?? eventInfo.remaining ?? (totalValRaw ? (safeParseNumber(totalValRaw) - safeParseNumber(downRaw)) : 0);

    const totalVal = safeParseNumber(totalValRaw);
    const downVal = safeParseNumber(downRaw);
    const remainingVal = safeParseNumber(remainingRaw);

    const totalFormatted = `₱${totalVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const downFormatted = `₱${downVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const remainingFormatted = `₱${remainingVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Event Reservation Confirmation - Joanna's Hotel</title>
          <style>
            @page { size: A4; margin: 10mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              padding: 8px;
              max-width: 210mm;
              width: 210mm;
              margin: 0 auto;
              line-height: 1.3;
              font-size: 11px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #10b981;
              padding-bottom: 8px;
              margin-bottom: 10px;
            }
            .logo {
              font-size: 20px;
              font-weight: bold;
              color: #10b981;
              margin-bottom: 3px;
            }
            .subtitle {
              color: #666;
              font-size: 11px;
            }
            .confirmation-number {
              background: #f0fdf4;
              border: 1px solid #10b981;
              padding: 6px;
              text-align: center;
              margin: 8px 0;
              border-radius: 4px;
              font-size: 11px;
            }
            .confirmation-number strong {
              color: #10b981;
              font-size: 12px;
            }
            .two-column-layout {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin: 10px 0;
            }
            .column {
              min-width: 0;
            }
            .section {
              margin-bottom: 10px;
            }
            .section-title {
              font-size: 12px;
              font-weight: bold;
              color: #10b981;
              margin-bottom: 5px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 3px;
            }
            .info-row {
              display: flex;
              padding: 3px 0;
              border-bottom: 1px solid #f3f4f6;
            }
            .info-label {
              font-weight: 600;
              width: 110px;
              color: #374151;
              font-size: 10px;
            }
            .info-value {
              flex: 1;
              color: #1f2937;
              font-size: 10px;
            }
            .full-width-section {
              grid-column: 1 / -1;
              margin-top: 8px;
            }
            .dishes-section {
              background: #f9fafb;
              padding: 8px;
              border-radius: 4px;
              margin-top: 8px;
            }
            .dish-item {
              padding: 2px 0;
              font-size: 10px;
              border-bottom: 1px solid #e5e7eb;
            }
            .dish-item:last-child {
              border-bottom: none;
            }
            .terms-section {
              background: #fef3c7;
              border-left: 3px solid #f59e0b;
              padding: 8px;
              margin: 8px 0;
              font-size: 9px;
            }
            .terms-section h3 {
              color: #92400e;
              margin-bottom: 4px;
              font-size: 11px;
            }
            .terms-section ul {
              margin-left: 15px;
              margin-top: 4px;
            }
            .terms-section li {
              margin-bottom: 2px;
              line-height: 1.2;
            }
            .acknowledgment-section {
              margin-top: 10px;
              padding: 8px;
              border: 1px solid #e5e7eb;
              border-radius: 4px;
              background: #fafafa;
            }
            .acknowledgment-section h3 {
              color: #10b981;
              margin-bottom: 5px;
              font-size: 11px;
            }
            .acknowledgment-text {
              font-size: 9px;
              color: #374151;
              line-height: 1.3;
              margin-bottom: 8px;
            }
            .signature-line {
              border-bottom: 1px solid #000;
              width: 200px;
              margin: 15px 0 5px 0;
            }
            .signature-label {
              font-size: 9px;
              color: #6b7280;
            }
            .footer {
              margin-top: 10px;
              padding-top: 8px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 9px;
            }
            @media print {
              @page { 
                size: A4; 
                margin: 10mm; 
              }
              body { 
                padding: 0;
                width: 210mm;
                margin: 0;
              }
              .no-print, .print-button, button { 
                display: none !important; 
              }
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
            <div class="logo">🏨 Joanna's Hotel</div>
            <div class="subtitle">Event Reservation Confirmation</div>
          </div>

          <div class="confirmation-number">
            <strong>Confirmation #: ${confirmationNumber}</strong>
            <div style="margin-top: 5px; font-size: 12px; color: #666;">
              Created: ${createdAt}
            </div>
          </div>

          <div class="two-column-layout">
            <div class="column">
              <div class="section">
                <div class="section-title">Customer Information</div>
                <div class="info-row">
                  <div class="info-label">Booked By:</div>
                  <div class="info-value">${eventInfo.booked_by || 'N/A'}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Contact Number:</div>
                  <div class="info-value">${eventInfo.contact_number || 'N/A'}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Event Name:</div>
                  <div class="info-value">${eventInfo.name || 'N/A'}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Event Type:</div>
                  <div class="info-value">${eventInfo.type || 'N/A'}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Supervisor:</div>
                  <div class="info-value">${eventInfo.supervisor || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div class="column">
              <div class="section">
                <div class="section-title">Event Details</div>
                <div class="info-row">
                  <div class="info-label">Date:</div>
                  <div class="info-value">${formatDate(eventInfo.date) || 'N/A'}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Time:</div>
                  <div class="info-value">${eventInfo.allotted_time || 'N/A'}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Number of Guests:</div>
                  <div class="info-value">${eventInfo.guests || 0}${(eventInfo.additional_guests && eventInfo.additional_guests > 0) ? ` + ${eventInfo.additional_guests} additional` : ''}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Package:</div>
                  <div class="info-value">${eventInfo.menu || 'N/A'}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Set:</div>
                  <div class="info-value">${eventInfo.set || 'N/A'}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Total Cost:</div>
                  <div class="info-value">${totalFormatted}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Downpayment:</div>
                  <div class="info-value">${downFormatted}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Remaining:</div>
                  <div class="info-value">${remainingFormatted}</div>
                </div>
              </div>
            </div>
          </div>

          ${eventInfo.dishes && eventInfo.dishes.length > 0 ? `
          <div class="dishes-section full-width-section">
            <div class="section-title">Selected Dishes</div>
            ${eventInfo.dishes.map(dish => `
              <div class="dish-item">• ${dish}</div>
            `).join('')}
          </div>
          ` : ''}

          ${eventInfo.additional_requests ? `
          <div class="full-width-section">
            <div class="section-title">Additional Requests</div>
            <p style="font-size: 13px; color: #374151;">${eventInfo.additional_requests}</p>
          </div>
          ` : ''}

          <div class="terms-section full-width-section">
            <h3>⚠️ Terms and Regulations</h3>
            <ul>
              <li>Please bring this confirmation and a valid ID on the event date</li>
              <li>Setup time begins 2 hours before the event</li>
              <li>Cancellations must be made 7 days in advance for a full refund</li>
              <li>Any damages to hotel property will be charged to the customer</li>
              <li>Maximum occupancy must be observed at all times</li>
              <li>Menu changes must be requested at least 3 days before the event</li>
              <li>Additional guests beyond the confirmed count may incur extra charges</li>
            </ul>
          </div>

          <div class="acknowledgment-section">
            <h3>Reservation Confirmation Acknowledgment</h3>
            <div class="acknowledgment-text">
              I, <strong>${eventInfo.booked_by}</strong>, acknowledge that I have read, understood, and agree to comply with all the terms and regulations stated above for the event reservation at Joanna's Hotel. I confirm that all information provided is accurate and complete. I understand that failure to comply with these terms may result in cancellation of the reservation and/or additional charges.
            </div>
            <div style="display: flex; justify-content: space-between; gap: 50px;">
              <div style="flex: 1;">
                <div class="signature-line"></div>
                <div class="signature-label">Customer Signature</div>
              </div>
              <div style="flex: 1;">
                <div class="signature-line"></div>
                <div class="signature-label">Date</div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p><strong>Joanna's Hotel</strong></p>
            <p>Thank you for choosing us! We look forward to hosting your event.</p>
            <p style="margin-top: 10px;">For inquiries or changes, please contact our events team.</p>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `;

    try {
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Focus the print window
      printWindow.focus();
    } catch (error) {
      console.error('Error writing to print window:', error);
      alert('Error generating print document. Please try again.');
      printWindow.close();
    }
  };

  // Print event bill (summary for billing) - only prints invoice/bill details, not the contract/terms
  const printEventBill = (eventInfo) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the event bill.');
      return;
    }

    const invoiceId = `INV-EVENT-${eventInfo.id || Date.now()}`;
    const createdAt = eventInfo.createdAt || eventInfo.created_at || new Date().toLocaleString();

    const safeNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const formatCurrency = (v) => `₱${safeNumber(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const total = eventInfo.totalCost ?? eventInfo.total_cost ?? eventInfo.total ?? eventInfo.price ?? 0;
    const downpayment = eventInfo.downpaymentAmount ?? eventInfo.downpayment_amount ?? eventInfo.downpayment ?? 0;
    const remaining = eventInfo.remainingBalance ?? eventInfo.remaining_balance ?? eventInfo.remaining ?? (safeNumber(total) - safeNumber(downpayment));

    const itemsList = Array.isArray(eventInfo.dishes) ? eventInfo.dishes : (eventInfo.dishes ? [eventInfo.dishes] : []);

    const billHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Event Bill - ${invoiceId}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
            .header { text-align:center; margin-bottom: 12px; }
            .logo { font-size: 20px; color: #10b981; font-weight: 700; }
            .meta { display:flex; justify-content:space-between; margin: 8px 0; }
            .meta .left, .meta .right { width: 48%; }
            .section { margin-top: 12px; }
            table { width:100%; border-collapse:collapse; margin-top:8px; }
            th, td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
            th { text-align: left; background: #f3faf7; }
            .totals { margin-top: 12px; width:100%; display:flex; justify-content:flex-end; }
            .totals .col { min-width: 260px; background:#f9fafb; padding: 12px; border-radius:6px; }
            .totals-row { display:flex; justify-content:space-between; margin-bottom:8px; }
            .big { font-weight:700; font-size: 18px; color: #10b981; }
            @media print { button { display:none } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">Joanna's Hotel — Event Bill</div>
            <div class="subtitle">Event Invoice</div>
          </div>
          <div class="meta">
            <div class="left">
              <div><strong>Invoice ID:</strong> ${invoiceId}</div>
              <div><strong>Created:</strong> ${createdAt}</div>
              <div><strong>Customer:</strong> ${eventInfo.booked_by || eventInfo.customer_name || 'N/A'}</div>
              <div><strong>Contact:</strong> ${eventInfo.contact_number || 'N/A'}</div>
            </div>
            <div class="right">
              <div><strong>Event:</strong> ${eventInfo.name || eventInfo.title || 'N/A'}</div>
              <div><strong>Package:</strong> ${eventInfo.menu || eventInfo.package || 'N/A'}</div>
              <div><strong>Set:</strong> ${eventInfo.set || 'N/A'}</div>
              <div><strong>Date/Time:</strong> ${formatDate(eventInfo.date)} ${eventInfo.allotted_time || ''}</div>
            </div>
          </div>

          <div class="section">
            <table>
              <thead>
                <tr><th>Description</th><th style="text-align:right; width:120px">Amount</th></tr>
              </thead>
              <tbody>
                ${itemsList.length > 0 ? itemsList.map(item => `<tr><td>${item}</td><td style="text-align:right">${formatCurrency(0)}</td></tr>`).join('') : ''}
                <tr><td>Event Charge</td><td style="text-align:right">${formatCurrency(total)}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="totals">
            <div class="col">
              <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(total)}</span></div>
              <div class="totals-row"><span>Downpayment</span><span>${formatCurrency(downpayment)}</span></div>
              <div class="totals-row big"><span>Remaining</span><span>${formatCurrency(remaining)}</span></div>
            </div>
          </div>

          <div style="margin-top: 20px; text-align:center; font-size: 12px; color: #666;">This is a payment bill for the event. Contract copies should be printed from the reservation details if required.</div>

          <script>
            window.onload = function () { setTimeout(() => { window.print(); }, 200); };
          </script>
        </body>
      </html>
    `;

    try {
      printWindow.document.open();
      printWindow.document.write(billHtml);
      printWindow.document.close();
      printWindow.focus();
    } catch (error) {
      console.error('Error writing to print window:', error);
      alert('Error generating print document. Please try again.');
      printWindow.close();
    }
  };

  // Signature handling
  const getCoordinates = (event, canvas) => {
    try {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (event.type.startsWith('touch')) {
        return {
          x: (event.touches[0].clientX - rect.left) * dpr,
          y: (event.touches[0].clientY - rect.top) * dpr,
        };
      }
      return {
        x: (event.clientX - rect.left) * dpr,
        y: (event.clientY - rect.top) * dpr,
      };
    } catch (error) {
      console.error("Error getting canvas coordinates:", error);
      return { x: 0, y: 0 };
    }
  };

  const handleDrawStart = (e) => {
    try {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not found");
      const ctx = canvas.getContext('2d');
      const { x, y } = getCoordinates(e, canvas);
      setIsDrawing(true);
      ctx.beginPath();
      ctx.moveTo(x, y);
    } catch (error) {
      console.error("Error starting signature draw:", error);
      Swal.fire({
        title: "Error",
        text: "Failed to start drawing signature",
        icon: "error"
      });
    }
  };

  const handleDrawMove = (e) => {
    try {
      e.preventDefault();
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not found");
      const ctx = canvas.getContext('2d');
      const { x, y } = getCoordinates(e, canvas);
      ctx.lineTo(x, y);
      ctx.stroke();
    } catch (error) {
      console.error("Error drawing signature:", error);
    }
  };

  const handleDrawEnd = () => {
    try {
      if (isDrawing) {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas not found");
        setESignature(canvas.toDataURL('image/png'));
      }
    } catch (error) {
      console.error("Error ending signature draw:", error);
      Swal.fire({
        title: "Error",
        text: "Failed to save signature",
        icon: "error"
      });
    }
  };

  const clearSignature = () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not found");
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setESignature(null);
    } catch (error) {
      console.error("Error clearing signature:", error);
      Swal.fire({
        title: "Error",
        text: "Failed to clear signature",
        icon: "error"
      });
    }
  };

  const saveSignature = () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not found");
      setESignature(canvas.toDataURL('image/png'));
      setShowSignaturePopup(false);
      Swal.fire({
        title: "Success",
        text: "Signature saved successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      console.error("Error saving signature:", error);
      Swal.fire({
        title: "Error",
        text: "Failed to save signature",
        icon: "error"
      });
    }
  };

  const cancelSignature = () => {
    setShowSignaturePopup(false);
    clearSignature();
  };

  // Camera handling
  const startCamera = async () => {
    setCameraError(null);
    setShowCameraPopup(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError(`Unable to access camera: ${err.message}. Please ensure permissions are granted.`);
      Swal.fire({
        title: "Camera Error",
        text: `Unable to access camera: ${err.message}`,
        icon: "error"
      });
    }
  };

  const stopCamera = () => {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      setShowCameraPopup(false);
      setCameraError(null);
    } catch (error) {
      console.error("Error stopping camera:", error);
      Swal.fire({
        title: "Error",
        text: "Failed to stop camera",
        icon: "error"
      });
    }
  };

  const capturePhoto = () => {
    try {
      const video = videoRef.current;
      const canvas = photoCanvasRef.current;
      if (!video || !canvas) throw new Error("Video or canvas not found");
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        try {
          const file = new File([blob], "captured-id.png", { type: "image/png" });
          setCustomerIdFile(file);
          stopCamera();
          Swal.fire({
            title: "Success",
            text: "Photo captured successfully",
            icon: "success",
            timer: 1500,
            showConfirmButton: false
          });
        } catch (error) {
          console.error("Error processing photo:", error);
          Swal.fire({
            title: "Error",
            text: "Failed to process captured photo",
            icon: "error"
          });
        }
      }, 'image/png');
    } catch (error) {
      console.error("Error capturing photo:", error);
      Swal.fire({
        title: "Error",
        text: "Failed to capture photo",
        icon: "error"
      });
    }
  };

  const handleViewEvent = async (event) => {
    try {
      setSelectedEvent(event);
      setSelectedEventReference(null);
      setIsModalOpen(true);
      // Try to fetch payments for this event and extract any GCash reference stored in payment.note
      try {
        const res = await fetch(`/api/payments?eventId=${event.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        // capture raw body even on non-OK so we can debug
        const text = await res.text();
        let payload = null;
        try { payload = text ? JSON.parse(text) : null; } catch (e) { payload = text; }
        

        const payments = Array.isArray(payload?.payments) ? payload.payments : Array.isArray(payload) ? payload : [];
        setSelectedEventPayments(payments || []);

        // Prefer explicit reference fields on any payment, then fall back to digits in notes
        let ref = null;
        const withRef = (payments || []).find(p => p && (p.reference_number || p.reference || p.ref || p.gcash_ref));
        if (withRef) {
          ref = withRef.reference_number || withRef.reference || withRef.ref || withRef.gcash_ref;
        }
        if (!ref && payments && payments.length > 0) {
          const recent = payments[0];
          const note = (recent?.note || recent?.description || '') + '';
          const m = note.match(/\b(\d{6,})\b/);
          if (m) ref = m[1];
        }
        setSelectedEventReference(ref || null);
      } catch (e) {
        console.error('Error fetching payments for event reference:', e);
        setSelectedEventPayments([]);
      }

    } catch (error) {
      console.error("Error viewing event:", error);
      Swal.fire({
        title: "Error",
        text: "Failed to load event details",
        icon: "error"
      });
    }
  };

  const handleRecordEventDownpayment = async () => {
    if (!selectedEvent) return;
    try {
      const proceed = await Swal.fire({
        title: 'Record Downpayment as Payment?',
        html: `This will create a payment record for the downpayment amount of <strong>${formatCurrency(selectedEvent.downpaymentAmount || 0)}</strong>. Continue?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, record payment',
        cancelButtonText: 'Cancel',
      });
      if (!proceed.isConfirmed) return;
      setIsLoading(true);
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ eventId: selectedEvent.id, amount: Number(selectedEvent.downpaymentAmount || 0), method: 'cash', type: 'downpayment', note: `Backfilled from event ${selectedEvent.id}` }),
      });
      const data = await (res.text().then(t => { try { return JSON.parse(t); } catch(e) { return t; } }));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      Swal.fire({ title: 'Recorded', text: 'Downpayment recorded as a payment.', icon: 'success', timer: 1500, showConfirmButton: false });
      // Refresh payments for modal
      // reuse handleViewEvent's payments fetch by calling it again with current event
      await handleViewEvent(selectedEvent);
    } catch (err) {
      console.error('Failed to record downpayment as payment:', err);
      Swal.fire({ title: 'Error', text: err.message || 'Failed to record payment', icon: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    try {
      setIsModalOpen(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error("Error closing modal:", error);
    }
  };

  const handleAdd = async (newEvent) => {
    if (!canAdd) {
      Swal.fire({
        title: "Access Denied",
        text: "You do not have permission to add events.",
        icon: "error",
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }
    setIsLoading(true);
    try {
      // Enhanced client-side validation
      if (!newEvent.name?.trim()) throw new Error("Event name is required");
      if (!newEvent.type) throw new Error("Event type is required");
      if (!newEvent.date) throw new Error("Event date is required");
      if (!newEvent.allotted_time || !/^\d{2}:\d{2}$/.test(newEvent.allotted_time)) {
        throw new Error("Please select a valid time slot (e.g., 10:00)");
      }
      if (!newEvent.guests || newEvent.guests < 1) throw new Error("At least one guest is required");
      if (!newEvent.booked_by?.trim()) throw new Error("Booked by is required");
      if (!newEvent.supervisor) throw new Error("Supervisor is required");
      if (!selectedPackage?.name || !selectedPackage?.id) throw new Error("Please select a valid package");
      if (!selectedSet?.name) throw new Error("Please select a valid set");
      if (!customerIdFile) throw new Error("Please upload a customer ID or capture a photo");
      if (selectedDishes.length > selectedSet.maxDishes) {
        throw new Error(`You can select up to ${selectedSet.maxDishes} dishes for ${selectedSet.name}`);
      }

      // Check for event conflicts
      const dateStr = format(new Date(newEvent.date), "yyyy-MM-dd");
      const eventsOnDate = events.filter(
        (e) => format(new Date(e.date), "yyyy-MM-dd") === dateStr && e.status.toLowerCase() !== "cancelled"
      );
      if (eventsOnDate.length >= 2) {
        throw new Error("This date already has the maximum of 2 events. Please choose another date.");
      }

      const time24 = formatTimeTo24h(newEvent.allotted_time);
      let isoDate;
      try {
        const localDate = `${newEvent.date}T${time24}:00`;
        const [year, month, day] = newEvent.date.split('-');
        const [hour, minute] = time24.split(':');
        isoDate = new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute),
          0
        ).toISOString();
      } catch (err) {
        throw new Error("Invalid date or time format");
      }

      const formData = new FormData();
      const eventData = {
        name: newEvent.name,
        type: newEvent.type,
        date: isoDate,
        allotted_time: time24,
        guests: Number(newEvent.guests),
        booked_by: newEvent.booked_by,
        supervisor: newEvent.supervisor,
        status: newEvent.status || "Pending",
        menu: selectedPackage.name,
        dishes: selectedDishes,
        set: selectedSet.name,
        total_cost: Number(totalCost.toFixed(2)),
        event_package_id: Number(selectedPackage.id),
        additional_requests: newEvent.additional_requests || null,
        additional_guests: Number(newEvent.additional_guests) || 0,
        remarks: newEvent.remarks || null,
      };
      formData.append("event", JSON.stringify(eventData));
      formData.append("customerId", customerIdFile);

      const res = await fetch("/api/event", {
        method: "POST",
        body: formData,
        timeout: 10000
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to add event: ${res.statusText}`);
      }

      const createdEvent = await res.json();
      setEvents((prev) => [
        ...prev,
        {
          ...createdEvent,
          totalCost: createdEvent.total_cost,
          dishes: Array.isArray(createdEvent.dishes) ? createdEvent.dishes : [],
        },
      ]);
      setOrders((prev) => [
        ...prev,
        {
          id: createdEvent.id,
          event: createdEvent.name,
          menu: createdEvent.menu,
          date: createdEvent.date,
          guests: createdEvent.guests,
          status: createdEvent.status,
        },
      ]);

      const eventInfo = {
        confirmationNumber: createdEvent.id || Date.now(),
        createdAt: new Date().toLocaleString(),
        booked_by: createdEvent.booked_by,
        name: createdEvent.name,
        type: createdEvent.type,
        supervisor: createdEvent.supervisor,
        date: createdEvent.date,
        allotted_time: formatTimeTo12h(createdEvent.allotted_time),
        guests: createdEvent.guests,
        additional_guests: createdEvent.additional_guests || 0,
        menu: createdEvent.menu,
        set: createdEvent.set,
        total_cost: createdEvent.total_cost,
        dishes: createdEvent.dishes || [],
        additional_requests: createdEvent.additional_requests || ''
      };

      setShowAddModal(false);
      Swal.fire({
        title: "Success",
        text: "Event added successfully!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false
      });

      // Ask if user wants to print reservation info
      setTimeout(() => {
        if (window.confirm('Event created successfully! Would you like to print a copy for the client?')) {
          printEventReservationInfo(eventInfo);
        }
      }, 1600);

      window.dispatchEvent(new Event("storage"));
    } catch (error) {
      console.error("Error adding event:", error);
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to add event. Please try again.",
        icon: "error"
      });
    } finally {
      setIsLoading(false);
      setSelectedPackage(null);
      setSelectedSet(null);
      setCustomerIdFile(null);
      setESignature(null);
      setTotalCost(0);
      setAdditionalGuests(0);
      setGuestCount(0);
      stopCamera();
    }
  };

  const handleEdit = async (updatedEvent) => {
    if (!canEdit) {
      Swal.fire({
        title: "Access Denied",
        text: "You do not have permission to edit events.",
        icon: "error",
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }
    setIsLoading(true);
    try {
      const requiredFields = ['name', 'type', 'date', 'allotted_time', 'guests', 'booked_by', 'supervisor', 'status'];
      for (const field of requiredFields) {
        if (!updatedEvent[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      if (!/^\d{2}:\d{2}$/.test(updatedEvent.allotted_time)) {
        throw new Error("Invalid time format. Use HH:mm format (e.g., 10:00).");
      }

      if (updatedEvent.guests < 0 || (updatedEvent.additional_guests && updatedEvent.additional_guests < 0)) {
        throw new Error("Guests and additional guests must be non-negative.");
      }

      if (updatedEvent.total_cost < 0) {
        throw new Error("Total cost must be non-negative.");
      }

      if (!selectedPackage?.name && !updatedEvent.menu) {
        throw new Error("Please select a valid package or retain the existing menu");
      }

      if (!selectedSet?.name && !updatedEvent.set) {
        throw new Error("Please select a set or retain the existing set");
      }

      if (selectedDishes.length > (selectedSet?.maxDishes || sets.find(s => s.name === updatedEvent.set)?.maxDishes)) {
        throw new Error(`You can select up to the maximum dishes allowed for this set.`);
      }

      const dateStr = format(new Date(updatedEvent.date), "yyyy-MM-dd");
      const eventsOnDate = events.filter(
        (e) => e.id !== updatedEvent.id && format(new Date(e.date), "yyyy-MM-dd") === dateStr && e.status.toLowerCase() !== "cancelled"
      );

      if (eventsOnDate.length >= 2) {
        throw new Error("This date already has the maximum of 2 events. Please choose another date.");
      }

      const effectiveMenu = selectedPackage?.name || updatedEvent.menu;
      const effectiveSet = selectedSet?.name || updatedEvent.set;

      const formData = new FormData();
      formData.append("event", JSON.stringify({
        id: updatedEvent.id,
        ...updatedEvent,
        booked_by: updatedEvent.booked_by,
        total_cost: totalCost,
        menu: effectiveMenu,
        dishes: selectedDishes,
        set: effectiveSet,
        event_package_id: selectedPackage?.id || events.find(e => e.id === updatedEvent.id)?.event_package_id,
      }));

      if (customerIdFile) {
        formData.append("customerId", customerIdFile);
      }

      const res = await fetch("/api/event", {
        method: 'PUT',
        body: formData,
        timeout: 10000
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to update event: ${res.statusText}`);
      }

      const savedEvent = await res.json();
      setEvents((prev) => prev.map((e) => (e.id === updatedEvent.id ? savedEvent : e)));
      setOrders((prev) =>
        prev.map((o) =>
          o.id === updatedEvent.id
            ? {
              ...o,
              event: updatedEvent.name,
              menu: effectiveMenu,
              date: updatedEvent.date,
              guests: updatedEvent.guests,
              status: updatedEvent.status,
            }
            : o
        )
      );
      setShowEditModal(false);
      Swal.fire({
        title: "Success",
        text: "Event updated successfully!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false
      });
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error("Error updating event:", error);
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to update event. Please try again.",
        icon: "error"
      });
    } finally {
      setIsLoading(false);
      setSelectedPackage(null);
      setSelectedSet(null);
      setCustomerIdFile(null);
      setESignature(null);
      setTotalCost(0);
      setAdditionalGuests(0);
      setGuestCount(0);
      stopCamera();
    }
  };

  const handleDelete = async (id, name) => {
    if (!canDelete) {
      Swal.fire({
        title: "Access Denied",
        text: "You do not have permission to delete events.",
        icon: "error",
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Do you really want to delete "${name}"? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "No, cancel!",
      customClass: {
        confirmButton: "bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded ml-2",
        cancelButton: "bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded mr-2"
      },
    });

    if (result.isConfirmed) {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/event?id=${id}`, {
          method: "DELETE",
          timeout: 10000
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || `Failed to delete event: ${res.statusText}`);
        }
        setEvents((prev) => prev.filter((e) => e.id !== id));
        setOrders((prev) => prev.filter((o) => o.id !== id));
        await fetchEvents();
        Swal.fire({
          title: "Deleted!",
          text: `"${name}" has been deleted successfully.`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false
        });
        window.dispatchEvent(new Event('storage'));
      } catch (error) {
        console.error("Error deleting event:", error);
        Swal.fire({
          title: "Error",
          text: error.message || "Failed to delete event. Please try again.",
          icon: "error"
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle settling the bill: call checkout API which archives the event to history and deletes it from active events
  const handleSettle = async (event) => {
    if (!event || !event.id) return;
    if (!can(role, Permissions.Reservations, 'update') && !can(role, Permissions.Reservations, 'manage')) {
      Swal.fire({ title: 'Access Denied', text: 'You do not have permission to settle bills.', icon: 'error' });
      return;
    }
    try {
      const defaultCashier = user?.name || user?.email || '';
      const { value: formValues } = await Swal.fire({
        title: `Settle Bill — ${event.name || ''}`,
        html:
          `<div class="grid gap-2">
             <label style="font-weight:600">Invoice ID</label>
             <input id="swal-invoice" class="swal2-input" placeholder="Invoice # (optional)" />
             <label style="font-weight:600">Payment Method</label>
             <select id="swal-method" class="swal2-input">
               <option value="Cash">Cash</option>
               <option value="Card">Card</option>
               <option value="GCash">GCash</option>
               <option value="Other">Other</option>
             </select>
             <label style="font-weight:600">Cashier</label>
             <input id="swal-cashier" class="swal2-input" value="${defaultCashier}" />
           </div>`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Settle & Archive',
        preConfirm: () => {
          const invoiceId = document.getElementById('swal-invoice')?.value || `${Date.now()}`;
          const paymentMethod = document.getElementById('swal-method')?.value || 'Cash';
          const cashierName = document.getElementById('swal-cashier')?.value || defaultCashier;
          return { invoiceId, paymentMethod, cashierName };
        }
      });

      if (!formValues) return; // cancelled

      setIsLoading(true);
      const paymentDetails = {
        invoiceId: formValues.invoiceId,
        customerName: event.booked_by || event.booked_by || event.customer_name || event.booked_by || '',
        paymentMethod: formValues.paymentMethod,
        discountType: null,
        discountAmount: 0,
        subtotal: event.total_cost ?? event.total ?? event.price ?? 0,
        total: event.total_cost ?? event.total ?? event.price ?? 0,
        cashierName: formValues.cashierName,
      };

      const res = await fetch('/api/event/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, paymentDetails }),
        timeout: 15000
      });

      const data = await res.json();
      if (!res.ok) {
        // If server indicates outstanding payment (402), open payment collection modal
        if (res.status === 402) {
          const msg = data?.message || data?.error || 'Outstanding payment required before checkout.';
          const outstanding = data?.outstanding;
          const display = outstanding ? `${msg} Outstanding: ₱${Number(outstanding).toFixed(2)}` : msg;
          
          Swal.fire({
            title: 'Payment Required',
            text: display,
            icon: 'warning',
            confirmButtonText: 'OK'
          });

          // Prefill modal with outstanding amount and event info
          setCollectPaymentAmount(Number(outstanding) || 0);
          setCollectPaymentMethod('cash');
          setCollectPaymentNote(`Collected during checkout for Event: ${event.name || event.id}`);
          setPendingCheckoutEvent(event);
          setShowCollectPaymentModal(true);
          setIsLoading(false);
          return;
        }
        throw new Error(data.error || 'Failed to settle event');
      }

      // Remove event from list (it should be deleted server-side by checkout)
      setEvents((prev) => prev.filter((e) => e.id !== event.id));

      Swal.fire({ title: 'Settled', text: 'Event bill settled and archived to Reservation History.', icon: 'success', timer: 1800, showConfirmButton: false });
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error('Error settling event:', error);
      Swal.fire({ title: 'Error', text: error.message || 'Failed to settle bill', icon: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Retry event checkout without confirmation after payment is recorded
  const doEventCheckoutNow = async (event) => {
    if (!event) return;
    if (!token) {
      Swal.fire({ title: 'Error', text: 'Authentication token missing. Please sign in again.', icon: 'error' });
      return;
    }
    
    setIsLoading(true);
    try {
      const defaultCashier = user?.name || user?.email || '';
      const paymentDetails = {
        invoiceId: `INV-${Date.now()}`,
        customerName: event.booked_by || event.customer_name || '',
        paymentMethod: 'Cash',
        discountType: null,
        discountAmount: 0,
        subtotal: event.total_cost ?? event.total ?? 0,
        total: event.total_cost ?? event.total ?? 0,
        cashierName: defaultCashier,
      };

      const res = await fetch('/api/event/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, paymentDetails }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          const msg = data?.message || data?.error || 'Outstanding payment required before checkout.';
          Swal.fire({ title: 'Payment Required', text: msg, icon: 'warning' });
          setIsLoading(false);
          return;
        }
        throw new Error(data.error || 'Failed to check out event');
      }

      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      setPendingCheckoutEvent(null);
      Swal.fire({ title: 'Checked Out', text: 'Event successfully settled and archived.', icon: 'success', timer: 1800, showConfirmButton: false });
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error('Automatic event checkout failed:', err);
      Swal.fire({ title: 'Error', text: err.message || 'Failed to check out event', icon: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Submit payment collection and retry checkout
  const submitCollectPayment = async () => {
    if (!pendingCheckoutEvent) {
      Swal.fire({ title: 'Error', text: 'No pending checkout context found.', icon: 'error' });
      return;
    }
    
    const eventId = pendingCheckoutEvent.id;
    if (!eventId) {
      Swal.fire({ title: 'Error', text: 'Event not found. Cannot record payment.', icon: 'error' });
      return;
    }

    // Basic validation
    const amount = Number(collectPaymentAmount || 0);
    if (!amount || amount <= 0) {
      Swal.fire({ title: 'Error', text: 'Please enter a valid payment amount', icon: 'error' });
      return;
    }

    if ((collectPaymentMethod || '').toLowerCase() === 'gcash' && !collectPaymentReference) {
      Swal.fire({ title: 'Error', text: 'Please enter GCash reference number', icon: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const paymentData = {
        eventId: eventId,
        amount: amount,
        method: collectPaymentMethod || 'cash',
        type: 'payment',
        note: collectPaymentNote || `Payment collected during checkout for event ${eventId}`,
      };

      if (collectPaymentMethod && collectPaymentMethod.toLowerCase() === 'gcash' && collectPaymentReference) {
        paymentData.reference = collectPaymentReference;
      }

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(paymentData),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error || 'Failed to record payment');
      }

      Swal.fire({ title: 'Recorded', text: 'Payment recorded successfully. Retrying checkout...', icon: 'success', timer: 1500, showConfirmButton: false });
      setShowCollectPaymentModal(false);
      
      // Retry checkout now without extra confirmation
      await doEventCheckoutNow(pendingCheckoutEvent);
    } catch (err) {
      console.error('Failed to record payment:', err);
      Swal.fire({ title: 'Error', text: err.message || 'Failed to record payment', icon: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await fetchEvents();
      Swal.fire({
        title: "Refreshed",
        text: "Event list has been updated.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      console.error("Error refreshing events:", error);
      Swal.fire({
        title: "Error",
        text: "Failed to refresh event list",
        icon: "error"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEvents = events.filter(
    (e) =>
      e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const selectedDateBookings = events.filter(
    (e) =>
      format(new Date(e.date), "yyyy-MM-dd") === selectedDateStr &&
      e.status?.toLowerCase() !== "cancelled"
  );

  const handleDateClick = (date) => {
    try {
      setSelectedDate(date);
    } catch (error) {
      console.error("Error handling date click:", error);
      Swal.fire({
        title: "Error",
        text: "Failed to select date",
        icon: "error"
      });
    }
  };

  const getStatusIcon = (status) => {
    try {
      switch (status?.toLowerCase()) {
        case "confirmed":
          return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
        case "preparing":
          return <ClockIcon className="h-5 w-5 text-yellow-500" />;
        case "delivered":
          return <CheckCircleIcon className="h-5 w-5 text-blue-500" />;
        case "cancelled":
          return <XCircleIcon className="h-5 w-5 text-red-500" />;
        default:
          return <ClockIcon className="h-5 w-5 text-gray-500" />;
      }
    } catch (error) {
      console.error("Error getting status icon:", error);
      return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getFilteredDishes = () => {
    try {
      if (!selectedSet) return [];
      const category = selectedSet.name.split(' ')[1];
      return fetchedDishes.filter((dish) => dish.category === category).map((dish) => dish.name);
    } catch (error) {
      console.error("Error filtering dishes:", error);
      return [];
    }
  };

  const renderDishes = (dishes) => {
    try {
      if (!dishes || !Array.isArray(dishes)) return "N/A";
      return dishes.length > 0 ? dishes.join(', ') : "N/A";
    } catch (error) {
      console.error("Error rendering dishes:", error);
      return "N/A";
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {isLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <p className="text-green-700">Loading...</p>
          </div>
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50">
          <p>{errorMessage}</p>
          <button
            onClick={() => setErrorMessage(null)}
            className="mt-2 px-2 py-1 bg-red-700 rounded"
          >
            Close
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Total Bookings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Bookings</p>
              <p className="text-3xl font-bold text-green-700 mt-2">{events.length}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Pending Event Reservations */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Pending Reservations</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{approvedEventReservations.filter(r => r.status === 'pending' || r.status === 'awaiting_downpayment').length}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <ClockIcon className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Revenue</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {formatCurrency(events.reduce((sum, event) => sum + safeNumber(event.totalCost || event.total_cost || event.total || event.price || 0), 0))}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Upcoming Event */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div>
            <p className="text-sm text-gray-600 font-medium mb-2">Upcoming Event</p>
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const upcomingEvents = events
                .filter(e => {
                  const eventDate = new Date(e.date);
                  eventDate.setHours(0, 0, 0, 0);
                  return eventDate >= today && e.status?.toLowerCase() !== 'cancelled';
                })
                .sort((a, b) => new Date(a.date) - new Date(b.date));
              
              if (upcomingEvents.length > 0) {
                const nextEvent = upcomingEvents[0];
                return (
                  <div>
                    <p className="font-semibold text-gray-800 truncate" title={nextEvent.name}>{nextEvent.name}</p>
                    <p className="text-sm text-gray-600 mt-1">{formatDate(nextEvent.date)}</p>
                    <p className="text-sm text-gray-600">{formatTimeTo12h(nextEvent.allotted_time)}</p>
                  </div>
                );
              } else {
                return <p className="text-gray-500">No upcoming events</p>;
              }
            })()}
          </div>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-3">
        <div className="relative w-full md:w-auto flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search events..."
            className="pl-10 pr-4 py-2 border rounded w-full text-gray-700 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          {canAdd && (
            <button
              onClick={() => {
                setShowAddModal(true);
                setShowCustomerLookup(true);
                setFoundCustomers([]);
                setCustomerLookup('');
                setNewEvent({ bookedBy: '', contactNumber: '', address: '' });
              }}
              disabled={isLoading}
              className={`flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700'}`}
            >
              <PlusIcon className="h-5 w-5" />
              Add Reservation
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
          >
            <ArrowPathIcon className="h-5 w-5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Event Reservations Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="text-green-700 font-bold text-xl p-4 border-b bg-white">Event Reservations</div>
        <div className="overflow-auto" style={{ maxHeight: '400px' }}>
          <table className="min-w-full bg-white">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr>
                <th className="p-3 text-left text-green-700 font-semibold">Type</th>
                <th className="p-3 text-left text-green-700 font-semibold">Date</th>
                <th className="p-3 text-left text-green-700 font-semibold">Time</th>
                <th className="p-3 text-left text-green-700 font-semibold">Guests</th>
                <th className="p-3 text-left text-green-700 font-semibold">Set</th>
                <th className="p-3 text-right text-green-700 font-semibold">Total Amount</th>
                <th className="p-3 text-right text-green-700 font-semibold">Downpayment</th>
                <th className="p-3 text-right text-green-700 font-semibold">Remaining</th>
                <th className="p-3 text-left text-green-700 font-semibold">Status</th>
                <th className="p-3 text-center text-green-700 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan="10" className="p-4 text-center text-gray-500">No events found. Try adjusting the search or adding a new event.</td>
                </tr>
              ) : (
                filteredEvents.map((event) => (
                  <tr key={event.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 text-gray-700 truncate max-w-xs" title={event.type}>{event.type}</td>
                    <td className="p-3 text-gray-700">{formatDate(event.date)}</td>
                    <td className="p-3 text-gray-700">{formatTimeTo12h(event.allotted_time)}</td>
                    <td className="p-3 text-gray-700">{event.guests}</td>
                    <td className="p-3 text-gray-700 truncate max-w-xs" title={event.set || "N/A"}>{event.set || "N/A"}</td>
                    <td className="p-3 text-right text-gray-700">{formatCurrency(event.totalCost ?? event.total_cost ?? event.total ?? event.price)}</td>
                    <td className="p-3 text-right text-gray-700">{formatCurrency(event.downpaymentAmount ?? event.downpayment_amount ?? event.downpayment ?? 0)}</td>
                    <td className="p-3 text-right text-gray-700">{formatCurrency(event.remainingBalance ?? event.remaining_balance ?? event.remaining ?? 0)}</td>
                    <td className="p-3 text-gray-700 flex items-center">{getStatusIcon(event.status)}<span className="ml-1">{event.status}</span></td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-center">
                        <button
                          title="Print Event Bill"
                          className="text-purple-600 hover:text-purple-900"
                          onClick={() => printEventBill(event)}
                          disabled={isLoading}
                        >
                          <PrinterIcon className="h-5 w-5" />
                        </button>
                        <button
                          title="Settle Bill"
                          className="text-emerald-600 hover:text-emerald-900"
                          onClick={() => handleSettle(event)}
                          disabled={isLoading}
                        >
                          <CheckCircleIcon className="h-5 w-5" />
                        </button>
                        <button className="text-blue-600 hover:text-blue-900" onClick={() => handleViewEvent(event)} disabled={isLoading}><EyeIcon className="h-5 w-5" /></button>
                        {allowEdit && <button className="text-yellow-600 hover:text-yellow-900" onClick={() => { setSelectedEvent(event); setShowEditModal(true); }} disabled={isLoading}><PencilIcon className="h-5 w-5" /></button>}
                        {allowDelete && <button className="text-red-600 hover:text-red-900" onClick={() => handleDelete(event.id, event.name)} disabled={isLoading}><TrashIcon className="h-5 w-5" /></button>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calendar and Event Details Section - Side by Side Layout */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Calendar */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-6 text-green-700">Event Calendar</h3>
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
              value={selectedDate}
              onClickDay={handleDateClick}
              tileClassName={({ date, view }) => {
                if (view !== 'month') return '';
                const dateStr = format(date, 'yyyy-MM-dd');
                const eventsOnDate = events.filter(
                  (e) => format(new Date(e.date), 'yyyy-MM-dd') === dateStr && e.status?.toLowerCase() !== 'cancelled'
                );
                if (eventsOnDate.length >= 2) return 'occupied-day';
                if (eventsOnDate.length === 1) {
                  const eventStatus = eventsOnDate[0].status?.toLowerCase();
                  if (eventStatus === 'confirmed' || eventStatus === 'delivered') return 'occupied-day';
                  if (eventStatus === 'pending') return 'reserved-day';
                }
                return null;
              }}
              tileDisabled={({ date }) => {
                const today = new Date(); today.setHours(0,0,0,0); return date < today;
              }}
              className="border-none w-full text-lg"
            />
          </div>
        </div>

        {/* Right: Event Details */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-6 text-green-700">Event Information</h3>
          <h4 className="text-base font-medium text-green-600 mb-4">
            Events on {format(selectedDate, 'MMMM d, yyyy')}
          </h4>
            {selectedDateBookings.length > 0 ? (
              <div className="space-y-4">
                {selectedDateBookings.map((event) => (
                  <div key={event.id} className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-l-4 border-green-600 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-bold text-gray-800 text-lg">{event.name}</h5>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        event.status?.toLowerCase() === 'confirmed' ? 'bg-green-100 text-green-700' :
                        event.status?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        event.status?.toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {event.status}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">{formatTimeTo12h(event.allotted_time) || 'Time not specified'}</span>
                      </div>
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span>{event.type}</span>
                      </div>
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>{event.guests} guests</span>
                      </div>
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>{event.booked_by}</span>
                      </div>
                      {event.menu && (
                        <div className="flex items-center text-gray-700">
                          <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          <span>{event.menu} - {event.set || 'N/A'}</span>
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-600">Total:</span>
                          <span className="font-bold text-green-700">{formatCurrency(event.totalCost ?? event.total_cost ?? event.total ?? event.price)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleViewEvent(event)}
                        className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-500">No events scheduled for this date</p>
              </div>
            )}
        </div>
      </div>

      {isModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white text-black p-6 rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto relative">
            {/* Close button - top right corner */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
              disabled={isLoading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold mb-6 text-green-700 border-b pb-2">{selectedEvent.name}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-emerald-700 mb-3">Event Information</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium">{selectedEvent.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium">{formatDate(selectedEvent.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Time:</span>
                      <span className="font-medium">{formatTimeTo12h(selectedEvent.allotted_time)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Guests:</span>
                      <span className="font-medium">{selectedEvent.guests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Additional Guests:</span>
                      <span className="font-medium">{selectedEvent.additional_guests || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium">{selectedEvent.status}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-emerald-700 mb-3">Contact Information</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Booked By:</span>
                      <span className="font-medium">{selectedEvent.booked_by}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Contact Number:</span>
                      <span className="font-medium">{selectedEvent.contact_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Supervisor:</span>
                      <span className="font-medium">{selectedEvent.supervisor}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-emerald-700 mb-3">Additional Information</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-gray-600 block mb-1">Additional Requests:</span>
                      <span className="font-medium">{selectedEvent.additional_requests || 'None'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-emerald-700 mb-3">Menu & Dishes</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Menu:</span>
                      <span className="font-medium">{selectedEvent.menu || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Set:</span>
                      <span className="font-medium">{selectedEvent.set || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 block mb-1">Dishes:</span>
                      <div className="font-medium">{renderDishes(selectedEvent.dishes)}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-emerald-700 mb-3">Financial Details</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Cost:</span>
                      <span className="font-semibold text-lg">{formatCurrency(selectedEvent.totalCost || selectedEvent.total_cost || 0)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-600">Downpayment:</span>
                      <span className="font-medium text-green-600">{formatCurrency(selectedEvent.downpaymentAmount || selectedEvent.downpayment_amount || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Remaining Balance:</span>
                      <span className="font-medium text-red-600">{formatCurrency(selectedEvent.remainingBalance || selectedEvent.remaining_balance || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-gray-600">Reference Number:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{selectedEventReference || selectedEvent.reference || selectedEvent.reference_number || 'N/A'}</span>
                        {(selectedEventReference || selectedEvent.reference_number) && (
                          <button
                            type="button"
                            onClick={() => {
                              const val = selectedEventReference || selectedEvent.reference_number || '';
                              try {
                                if (val) navigator.clipboard.writeText(String(val));
                                Swal.fire({ title: 'Copied', text: 'Reference copied to clipboard', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                              } catch (e) {
                                console.error('Copy failed', e);
                                Swal.fire({ title: 'Error', text: 'Failed to copy reference', icon: 'error' });
                              }
                            }}
                            className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"
                          >
                            Copy
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {(selectedEvent.id_upload || selectedEvent.customer_id_url) && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-emerald-700 mb-3">Uploaded ID</h3>
                    <div>
                      {selectedEvent.id_upload ? (
                        selectedEvent.id_upload.startsWith('data:') ? (
                          <img
                            src={selectedEvent.id_upload}
                            alt="Uploaded ID"
                            className="w-full h-auto rounded border object-contain max-h-96"
                          />
                        ) : (
                          <Image
                            src={selectedEvent.id_upload}
                            alt="Uploaded ID"
                            width={300}
                            height={150}
                            className="object-contain rounded border w-full"
                          />
                        )
                      ) : selectedEvent.customer_id_url ? (
                        <Image
                          src={selectedEvent.customer_id_url}
                          alt="Customer ID"
                          width={300}
                          height={150}
                          className="object-contain rounded border w-full"
                        />
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && canAdd && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white text-black p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => {
                setShowAddModal(false);
                setSelectedPackage(null);
                setSelectedSet(null);
                setCustomerIdFile(null);
                setESignature(null);
                setTotalCost(0);
                setAdditionalGuests(0);
                setGuestCount(0);
                setShowCustomerLookup(true);
                setFoundCustomers([]);
                setCustomerLookup('');
                setNewEvent({ bookedBy: '', contactNumber: '', address: '' });
                stopCamera();
              }}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
              disabled={isLoading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold mb-4 text-green-700 border-b pb-2">Add New Event</h2>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-1/3 border-r pr-4">
                <h3 className="text-lg font-semibold mb-3 text-green-700">Select Package</h3>
                <div className="space-y-3">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      onClick={() => {
                        setSelectedPackage(pkg);
                        setSelectedSet(null);
                        setSelectedDishes([]);
                        setTotalCost(parseFloat(pkg.price.replace(/[^\d.]/g, '')) || 0);
                        setGuestCount(pkg.guests);
                      }}
                      className={`p-3 border rounded-lg cursor-pointer ${selectedPackage?.id === pkg.id
                        ? "border-green-500 bg-green-50"
                        : "border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                      <h4 className="font-bold text-gray-700">{pkg.name}</h4>
                      <p className="text-green-600">₱{parseFloat(pkg.price.replace(/[^\d.]/g, '')).toFixed(2)}</p>
                      <p className="text-sm text-gray-600">{pkg.guests} Guests</p>
                    </div>
                  ))}
                </div>
                {selectedPackage && (
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold mb-3 text-green-700">Select Set</h3>
                    <div className="space-y-3">
                      {sets.map((set) => (
                        <div
                          key={set.name}
                          onClick={() => {
                            setSelectedSet(set);
                            setSelectedDishes([]);
                            const baseCost = parseFloat(selectedPackage.price.replace(/[^\d.]/g, '')) || 0;
                            setTotalCost(baseCost + (additionalGuests * set.price));
                          }}
                          className={`p-3 border rounded-lg cursor-pointer ${selectedSet?.name === set.name
                            ? "border-green-500 bg-green-50"
                            : "border-gray-300 hover:bg-gray-50"
                            }`}
                        >
                          <h4 className="font-bold text-gray-700">{set.name}</h4>
                          <p className="text-green-600">₱{set.price.toFixed(2)}</p>
                          <p className="text-sm text-gray-600">Up to {set.maxDishes} Dishes</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="md:w-2/3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target;
                    handleAdd({
                      name: form.name.value,
                      type: form.type.value,
                      date: form.date.value,
                      allotted_time: form.allottedTime.value,
                      guests: parseInt(form.guests.value) || 0,
                      booked_by: form.bookedBy.value,
                      supervisor: form.supervisor.value,
                      status: form.status.value,
                      additional_requests: form.additionalRequests.value || null,
                      additional_guests: parseInt(form.additionalGuests.value) || 0,
                      remarks: form.remarks.value || null,
                      total_cost: totalCost,
                    });
                  }}
                >
                  {/* Customer Lookup Section */}
                  {showCustomerLookup && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-blue-900">Returning Customer?</h3>
                        <button
                          type="button"
                          onClick={() => setShowCustomerLookup(false)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Enter manually
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Search by email or phone number"
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
                          type="button"
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
                  {newEvent.bookedBy && !showCustomerLookup && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-green-900 font-medium">Loaded: {newEvent.bookedBy}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNewEvent({ bookedBy: '', contactNumber: '', address: '' });
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-gray-700">
                    <div>
                      <label className="block text-sm font-medium mb-1">Event Name:</label>
                      <input name="name" className="border p-2 w-full rounded" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Event Type:</label>
                      <select name="type" className="border p-2 w-full rounded" required>
                        <option value="">Select Type</option>
                        <option>Wedding</option>
                        <option>Birthday</option>
                        <option>Debut</option>
                        <option>Anniversary</option>
                        <option>Reunion</option>
                        <option>Baby Shower</option>
                        <option>Graduation Party</option>
                        <option>Christening</option>
                        <option>Engagement Party</option>
                        <option>Retirement Party</option>
                        <option>Conference</option>
                        <option>Seminar</option>
                        <option>Business Meeting</option>
                        <option>Orientation</option>
                        <option>Academic Conference</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Date:</label>
                      <input
                        type="date"
                        name="date"
                        className="border p-2 w-full rounded"
                        min={todayStr}
                        onChange={(e) => {
                          try {
                            const selected = e.target.value;
                            if (selected && selected < todayStr) {
                              e.target.value = todayStr;
                              Swal.fire({
                                title: 'Invalid Date',
                                text: 'Selecting past dates is not allowed. The date has been set to today.',
                                icon: 'warning',
                              });
                            }
                          } catch (err) {
                            console.error('Error handling date change:', err);
                          }
                        }}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Time Slot:</label>
                      <select name="allottedTime" className="border p-2 w-full rounded" required>
                        <option value="">Select Time</option>
                        <option value="10:00">10:00 AM - 1:00 PM</option>
                        <option value="13:00">1:00 PM - 4:00 PM</option>
                        <option value="16:00">4:00 PM - 7:00 PM</option>
                        <option value="19:00">7:00 PM - 10:00 PM</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Guests:</label>
                      <input
                        type="number"
                        name="guests"
                        value={guestCount}
                        onChange={(e) => setGuestCount(parseInt(e.target.value) || 0)}
                        className="border p-2 w-full rounded"
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Booked By:</label>
                      <input
                        name="bookedBy"
                        value={newEvent.bookedBy}
                        onChange={(e) => setNewEvent({ ...newEvent, bookedBy: e.target.value })}
                        className="border p-2 w-full rounded"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Contact Number:</label>
                      <input
                        name="contactNumber"
                        type="tel"
                        value={newEvent.contactNumber}
                        onChange={(e) => setNewEvent({ ...newEvent, contactNumber: e.target.value })}
                        className="border p-2 w-full rounded"
                        placeholder="09XXXXXXXXX"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Address:</label>
                      <input
                        name="address"
                        type="text"
                        value={newEvent.address}
                        onChange={(e) => setNewEvent({ ...newEvent, address: e.target.value })}
                        className="border p-2 w-full rounded"
                        placeholder="Customer Address"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Supervisor:</label>
                      <select
                        name="supervisor"
                        className="border p-2 w-full rounded"
                        required
                      >
                        <option value="">Select Supervisor</option>
                        {managers.map((manager) => (
                          <option key={manager.id} value={manager.name}>
                            {manager.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Additional Guests:</label>
                      <input
                        type="number"
                        name="additionalGuests"
                        className="border p-2 w-full rounded"
                        min="0"
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setAdditionalGuests(value);
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Status:</label>
                      <select name="status" className="border p-2 w-full rounded" required>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Pending">Pending</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Total Cost (₱)</label>
                      <input
                        type="number"
                        name="totalCost"
                        value={totalCost.toFixed(2)}
                        className="border p-2 w-full rounded bg-gray-100"
                        step="0.01"
                        readOnly
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Customer ID:</label>
                      <div className="flex flex-col gap-2">
                        <input
                          type="file"
                          name="customerId"
                          accept="image/*,application/pdf"
                          onChange={(e) => setCustomerIdFile(e.target.files[0])}
                          className="border p-2 w-full rounded"
                        />
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 w-fit"
                          disabled={isLoading}
                        >
                          Take Photo
                        </button>
                        {customerIdFile && (
                          <p className="text-sm text-gray-600 mt-1">
                            Selected: {customerIdFile.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">E-Signature:</label>
                      <button
                        type="button"
                        onClick={() => setShowSignaturePopup(true)}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 w-fit"
                        disabled={isLoading}
                      >
                        E-Signature
                      </button>
                      {eSignature && (
                        <div className="mt-2">
                          <img
                            src={eSignature}
                            alt="E-Signature"
                            className="w-full h-32 object-contain rounded border"
                          />
                        </div>
                      )}
                    </div>
                    {selectedSet && (
                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">Select Dishes (up to {selectedSet.maxDishes})</label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border p-2 rounded bg-gray-50">
                          {getFilteredDishes().map((dish) => (
                            <div key={dish} className="flex items-center">
                              <input
                                type="checkbox"
                                id={dish}
                                checked={selectedDishes.includes(dish)}
                                onChange={(e) => {
                                  try {
                                    if (e.target.checked) {
                                      if (selectedDishes.length < selectedSet.maxDishes) {
                                        setSelectedDishes([...selectedDishes, dish]);
                                      } else {
                                        e.target.checked = false;
                                        Swal.fire({
                                          title: "Error",
                                          text: `You can select up to ${selectedSet.maxDishes} dishes for ${selectedSet.name}.`,
                                          icon: "error"
                                        });
                                      }
                                    } else {
                                      setSelectedDishes(selectedDishes.filter((d) => d !== dish));
                                    }
                                  } catch (error) {
                                    console.error("Error selecting dish:", error);
                                    Swal.fire({
                                      title: "Error",
                                      text: "Failed to select dish",
                                      icon: "error"
                                    });
                                  }
                                }}
                                className="mr-2"
                                disabled={isLoading}
                              />
                              <label htmlFor={dish}>{dish}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 text-black">
                    <label className="block text-sm font-medium mb-1">Additional Requests:</label>
                    <textarea
                      name="additionalRequests"
                      className="border p-2 w-full rounded"
                      rows="2"
                    ></textarea>
                  </div>
                  <div className="mt-4 text-black">
                    <label className="block text-sm font-medium mb-1">Remarks:</label>
                    <input name="remarks" className="border p-2 w-full rounded" />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setSelectedPackage(null);
                        setSelectedSet(null);
                        setCustomerIdFile(null);
                        setESignature(null);
                        setTotalCost(0);
                        setAdditionalGuests(0);
                        setGuestCount(0);
                        stopCamera();
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedPackage || !selectedSet || isLoading}
                      className={`px-4 py-2 text-white rounded ${selectedPackage && selectedSet && !isLoading
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-gray-400 cursor-not-allowed"
                        }`}
                    >
                      Create Reservation
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white text-black p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => {
                setShowEditModal(false);
                setSelectedEvent(null);
                setSelectedPackage(null);
                setSelectedSet(null);
                stopCamera();
              }}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
              disabled={isLoading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold mb-6 text-green-700">Edit Reservation</h2>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-1/3">
                <h3 className="text-lg font-semibold mb-2">Select Package</h3>
                <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className={`p-3 border rounded cursor-pointer ${selectedPackage?.id === pkg.id ? "bg-green-100" : "bg-white"
                        }`}
                      onClick={() => {
                        setSelectedPackage(pkg);
                        setSelectedDishes([]);
                      }}
                    >
                      <h4 className="font-bold text-gray-700">{pkg.name}</h4>
                      <p className="text-green-600">₱{parseFloat(pkg.price).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                <h3 className="text-lg font-semibold mt-4 mb-2">Select Set</h3>
                <div className="grid grid-cols-2 gap-3">
                  {sets.map((set) => (
                    <div
                      key={set.name}
                      className={`p-3 border rounded cursor-pointer ${selectedSet?.name === set.name ? "bg-green-100" : "bg-white"
                        }`}
                      onClick={() => {
                        setSelectedSet(set);
                        setSelectedDishes([]);
                      }}
                    >
                      <h4 className="font-bold text-gray-700">{set.name}</h4>
                      <p className="text-green-600">₱{set.price.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">Up to {set.maxDishes} Dishes</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:w-2/3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target;
                    handleEdit({
                      id: selectedEvent.id,
                      name: form.name.value,
                      type: form.type.value,
                      date: form.date.value,
                      allotted_time: form.allottedTime.value,
                      guests: parseInt(form.guests.value) || 0,
                      booked_by: form.bookedBy.value,
                      supervisor: selectedEvent.supervisor || 'Online Reservation',
                      status: form.status.value,
                      additional_requests: form.additionalRequests.value || null,
                      additional_guests: parseInt(form.additionalGuests.value) || 0,
                      remarks: form.remarks.value || null,
                    });
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-gray-700">
                    <div>
                      <label className="block text-sm font-medium mb-1">Event Name</label>
                      <input
                        name="name"
                        defaultValue={selectedEvent.name}
                        className="border p-2 w-full rounded"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Event Type</label>
                      <select
                        name="type"
                        defaultValue={selectedEvent.type}
                        className="border p-2 w-full rounded"
                        required
                      >
                        <option value="">Select Type</option>
                        <option>Wedding</option>
                        <option>Birthday</option>
                        <option>Debut</option>
                        <option>Anniversary</option>
                        <option>Reunion</option>
                        <option>Baby Shower</option>
                        <option>Graduation Party</option>
                        <option>Christening</option>
                        <option>Engagement Party</option>
                        <option>Retirement Party</option>
                        <option>Conference</option>
                        <option>Seminar</option>
                        <option>Business Meeting</option>
                        <option>Orientation</option>
                        <option>Academic Conference</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Date</label>
                      <input
                        type="date"
                        name="date"
                        defaultValue={format(new Date(selectedEvent.date), "yyyy-MM-dd")}
                        className="border p-2 w-full rounded"
                        min={todayStr}
                        onChange={(e) => {
                          try {
                            const selected = e.target.value;
                            if (selected && selected < todayStr) {
                              e.target.value = format(new Date(selectedEvent.date), "yyyy-MM-dd");
                              Swal.fire({
                                title: 'Invalid Date',
                                text: 'Selecting past dates is not allowed. Please choose today or a future date.',
                                icon: 'warning',
                              });
                            }
                          } catch (err) {
                            console.error('Error handling edit date change:', err);
                          }
                        }}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Time Slot</label>
                      <select
                        name="allottedTime"
                        defaultValue={selectedEvent.allotted_time}
                        className="border p-2 w-full rounded"
                        required
                      >
                        <option value="">Select Time</option>
                        <option value="10:00">10:00 AM - 1:00 PM</option>
                        <option value="13:00">1:00 PM - 4:00 PM</option>
                        <option value="16:00">4:00 PM - 7:00 PM</option>
                        <option value="19:00">7:00 PM - 10:00 PM</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Guests</label>
                      <input
                        type="number"
                        name="guests"
                        value={guestCount}
                        onChange={(e) => setGuestCount(parseInt(e.target.value) || 0)}
                        className="border p-2 w-full rounded"
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Booked By</label>
                      <input
                        name="bookedBy"
                        defaultValue={selectedEvent.booked_by}
                        className="border p-2 w-full rounded"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Additional Guests</label>
                      <input
                        type="number"
                        name="additionalGuests"
                        defaultValue={selectedEvent.additional_guests || 0}
                        className="border p-2 w-full rounded"
                        min="0"
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setAdditionalGuests(value);
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Status</label>
                      <select
                        name="status"
                        defaultValue={selectedEvent.status}
                        className="border p-2 w-full rounded"
                        required
                      >
                        <option value="Confirmed">Confirmed</option>
                        <option value="Pending">Pending</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Total Cost (₱)</label>
                      <input
                        type="number"
                        name="totalCost"
                        value={totalCost.toFixed(2)}
                        className="border p-2 w-full rounded bg-gray-100"
                        step="0.01"
                        readOnly
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Customer ID</label>
                      <div className="flex flex-col gap-2">
                        <input
                          type="file"
                          name="customerId"
                          accept="image/*,application/pdf"
                          onChange={(e) => setCustomerIdFile(e.target.files[0])}
                          className="border p-2 w-full rounded"
                        />
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 w-fit"
                          disabled={isLoading}
                        >
                          Take Photo
                        </button>
                        {customerIdFile && (
                          <p className="text-sm text-gray-600 mt-1">
                            Selected: {customerIdFile.name}
                          </p>
                        )}
                        {(selectedEvent.id_upload || selectedEvent.customer_id_url) && (
                          <div className="mt-2">
                            <p className="text-sm font-medium">Current Uploaded ID:</p>
                            {selectedEvent.id_upload && selectedEvent.id_upload.startsWith('data:') ? (
                              <img
                                src={selectedEvent.id_upload}
                                alt="Current ID"
                                className="w-48 h-auto object-contain rounded border"
                              />
                            ) : selectedEvent.id_upload ? (
                              <Image
                                src={selectedEvent.id_upload}
                                alt="Current ID"
                                width={200}
                                height={100}
                                className="object-contain rounded border"
                              />
                            ) : selectedEvent.customer_id_url ? (
                              <Image
                                src={selectedEvent.customer_id_url}
                                alt="Current Customer ID"
                                width={200}
                                height={100}
                                className="object-contain rounded border"
                              />
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedSet && (
                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">Select Dishes (up to {selectedSet.maxDishes})</label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border p-2 rounded bg-gray-50">
                          {getFilteredDishes().map((dish) => (
                            <div key={dish} className="flex items-center">
                              <input
                                type="checkbox"
                                id={dish}
                                checked={selectedDishes.includes(dish)}
                                onChange={(e) => {
                                  try {
                                    if (e.target.checked) {
                                      if (selectedDishes.length < selectedSet.maxDishes) {
                                        setSelectedDishes([...selectedDishes, dish]);
                                      } else {
                                        e.target.checked = false;
                                        Swal.fire({
                                          title: "Error",
                                          text: `You can select up to ${selectedSet.maxDishes} dishes for ${selectedSet.name}.`,
                                          icon: "error"
                                        });
                                      }
                                    } else {
                                      setSelectedDishes(selectedDishes.filter((d) => d !== dish));
                                    }
                                  } catch (error) {
                                    console.error("Error selecting dish:", error);
                                    Swal.fire({
                                      title: "Error",
                                      text: "Failed to select dish",
                                      icon: "error"
                                    });
                                  }
                                }}
                                className="mr-2"
                                disabled={isLoading}
                              />
                              <label htmlFor={dish}>{dish}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 text-black">
                    <label className="block text-sm font-medium mb-1">Additional Requests:</label>
                    <textarea
                      name="additionalRequests"
                      defaultValue={selectedEvent.additional_requests || ''}
                      className="border p-2 w-full rounded"
                      rows="2"
                    ></textarea>
                  </div>
                  <div className="mt-4 text-black">
                    <label className="block text-sm font-medium mb-1">Remarks:</label>
                    <input
                      name="remarks"
                      defaultValue={selectedEvent.remarks || ''}
                      className="border p-2 w-full rounded"
                    />
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setSelectedPackage(null);
                        setSelectedSet(null);
                        setCustomerIdFile(null);
                        setESignature(null);
                        setTotalCost(0);
                        setAdditionalGuests(0);
                        setGuestCount(0);
                        stopCamera();
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`px-4 py-2 text-white rounded ${!isLoading
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-gray-400 cursor-not-allowed"
                        }`}
                    >
                      Update Reservation
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signature Popup */}
      {showSignaturePopup && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-green-700">E-Signature</h2>
            <canvas
              ref={canvasRef}
              className="border border-gray-300 w-full h-48 mb-4"
              onMouseDown={handleDrawStart}
              onMouseMove={handleDrawMove}
              onMouseUp={handleDrawEnd}
              onMouseOut={handleDrawEnd}
              onTouchStart={handleDrawStart}
              onTouchMove={handleDrawMove}
              onTouchEnd={handleDrawEnd}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={clearSignature}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                disabled={isLoading}
              >
                Clear
              </button>
              <button
                onClick={cancelSignature}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={saveSignature}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                disabled={isLoading}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Camera Popup */}
      {showCameraPopup && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-green-700">Capture Customer ID</h2>
            {cameraError ? (
              <p className="text-red-600 mb-4">{cameraError}</p>
            ) : (
              <video ref={videoRef} autoPlay className="w-full h-48 mb-4 border rounded" />
            )}
            <canvas ref={photoCanvasRef} className="hidden" />
            <div className="flex justify-end gap-3">
              <button
                onClick={stopCamera}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                disabled={isLoading}
              >
                Cancel
              </button>
              {!cameraError && (
                <button
                  onClick={capturePhoto}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  disabled={isLoading}
                >
                  Capture
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Collection Modal */}
      {showCollectPaymentModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-green-700">Collect Outstanding Payment</h2>
            <p className="text-sm text-gray-600 mb-4">
              The event has an outstanding balance. Record payment here and we will retry checkout automatically.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Event</label>
                <div className="text-gray-800 font-semibold">
                  {pendingCheckoutEvent?.name || pendingCheckoutEvent?.id || '—'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Customer</label>
                <div className="text-gray-800">
                  {pendingCheckoutEvent?.booked_by || pendingCheckoutEvent?.customer_name || '—'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={collectPaymentAmount}
                  onChange={(e) => setCollectPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <select
                  value={collectPaymentMethod}
                  onChange={(e) => setCollectPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  disabled={isLoading}
                >
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {collectPaymentMethod && collectPaymentMethod.toLowerCase() === 'gcash' && (
                <div>
                  <label className="block text-sm font-medium mb-1">GCash Reference Number *</label>
                  <input
                    type="text"
                    value={collectPaymentReference}
                    onChange={(e) => setCollectPaymentReference(e.target.value)}
                    placeholder="Enter GCash reference"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    disabled={isLoading}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Note (optional)</label>
                <textarea
                  value={collectPaymentNote}
                  onChange={(e) => setCollectPaymentNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  disabled={isLoading}
                />
              </div>

              <div className="text-sm bg-blue-50 border border-blue-200 rounded p-3">
                <strong>Suggested: ₱{Number(collectPaymentAmount || 0).toFixed(2)}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCollectPaymentModal(false);
                  setPendingCheckoutEvent(null);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={submitCollectPayment}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Record Payment & Retry Checkout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}