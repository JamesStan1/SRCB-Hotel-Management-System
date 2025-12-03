"use client";

import { useState, useEffect, createContext, useContext, useRef } from "react";

// Context to share sidebar collapse state with nested nav items
const SidebarCollapseContext = createContext(false);
import {
  ChartBarIcon,
  UsersIcon,
  ClipboardDocumentIcon,
  DocumentTextIcon,
  TruckIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ShoppingCartIcon,
  HomeIcon,
  DocumentArrowDownIcon,
  ArchiveBoxIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CogIcon,
  ChevronDownIcon,
  UserCircleIcon,
  CheckCircleIcon,
  BellAlertIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { Roles, Permissions, can } from "../lib/rbac";
import useIsNarrow from "../lib/useIsNarrow";
import Overview from "./overview/page";
import StaffManagement from "./staff-management/page";
import InventoryManagement from "./inventory-management/page";
import RoomManagement from "./reservation/room-management/page";
import EventCateringManagement from "./reservation/event-catering-management/page";
import CafeManagement from "./cafe-managment/page";
import Settings from "./settings/page";
import POS from "./pos/page";
import OrderHistory from "./pos/order-history/page";
import Downpayments from "./pos/downpayments/page";
import ArchivedRooms from "./reservation/room-management/archived_rooms/page";
import ArchivedEvents from "./reservation/event-catering-management/archived_events/page";
import EditRoom from "./reservation/room-management/editroom/page";
import EditPackage from "./reservation/event-catering-management/editpackage/page";
import ArchivedStaff from "./staff-management/archived_staff/page";
import ArchivedCafe from "./cafe-managment/archived_cafe/page";
import ArchivedInventory from "./inventory-management/archived_inventory/page";
import ReservationHistory from "./reservation/reservation-history/page";
import ReservationApproval from "./reservation/reservation-approval/page";
import FrontDeskNotifications from "./front-desk-notifications/page";
import HousekeepingPage from "./housekeeping/page";
import BillsPage from "./bills/page";
import Image from "next/image";

// Small coffee-cup icon (inline SVG) used for Cafe/Cafe Management entries.
function CoffeeIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8h14v3a4 4 0 01-4 4H7a4 4 0 01-4-4V8z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 4h8" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M18 9v1a3 3 0 003 3" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 20h8" />
    </svg>
  );
}

export default function Dashboard() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState("overview");
  const [staffManagementOpen, setStaffManagementOpen] = useState(false);
  const [reservationManagementOpen, setReservationManagementOpen] = useState(false);
  const [roomManagementOpen, setRoomManagementOpen] = useState(false);
  const [eventManagementOpen, setEventManagementOpen] = useState(false);
  const [cafeManagementOpen, setCafeManagementOpen] = useState(false);
  const [inventoryManagementOpen, setInventoryManagementOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [posManagementOpen, setPosManagementOpen] = useState(false);
  const [billsManagementOpen, setBillsManagementOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [highlightedReservationId, setHighlightedReservationId] = useState(null);
  const { user, token, isInitialized, logoutCurrent } = useAuth();
  const router = useRouter();
  const isNarrow = useIsNarrow();

  // Ensure the sidebar remains expanded on desktop (not narrow).
  useEffect(() => {
    if (!isNarrow) {
      setIsSidebarCollapsed(false);
    }
  }, [isNarrow]);

  const rolePermissions = {
    admin: [
      "overview",
      "staff",
      "attendance",
      "payroll",
      "reports",
      "archived_staff",
      "rooms",
      "archived_rooms",
      "edit-room",
      "event-catering",
      "archived_events",
      "edit-package",
      "cafe-management",
      "archived_cafe",
      "inventory-management",
      "archived_inventory",
      "pos",
      "downpayments",
      "order-history",
      "bills",
      "bills-history",
      "general",
      "export",
      "reservation-history",
      "reservation-approval",
    ],
    manager: [
      "overview",
      "staff",
      "attendance",
      "payroll",
      "reports",
      "archived_staff",
      "rooms",
      "archived_rooms",
      "edit-room",
      "event-catering",
      "archived_events",
      "edit-package",
      "cafe-management",
      "archived_cafe",
      "inventory-management",
      "archived_inventory",
      "pos",
      "downpayments",
      "order-history",
      "bills",
      "bills-history",
      "general",
      "export",
      "reservation-history",
      "reservation-approval",
    ],
    frontdesk: [
      "rooms",
      "event-catering",
      "pos",
      "downpayments",
      "order-history",
      "bills",
      "bills-history",
      "reservation-history",
      "reservation-approval",
      "housekeeping",
      "front-desk-notifications",
      "cafe-management",
      "inventory-management",
    ],
    chef: [],
    housekeeping: [
      "housekeeping",
      "rooms",
    ],
    maintenance: [
      "rooms",
      "inventory-management",
    ],
    security: [
      "rooms",
    ],
    user: ["overview"],
  };

  const getAvailablePages = () => {
    if (!user || !user.role) return ["overview"];
    const roleKey = String(user.role).toLowerCase();
    return rolePermissions[roleKey] || ["overview"];
  };

  // Determine if current user has Security role
  const isSecurity = (user?.role || '').toLowerCase() === 'security';
  // Determine if current user is privileged (admin or manager)
  const isPrivileged = (user?.role || '').toLowerCase() === 'admin' || (user?.role || '').toLowerCase() === 'manager';

  useEffect(() => {
    if (isInitialized && !user) {
      router.push("/components/sign-in");
    } else if (isInitialized && user && user.role === 'Chef') {
      // Redirect chefs to their dedicated page
      router.push("/dashboard/chef-orders");
    }
  }, [user, isInitialized, router]);

  // (keep isNarrow available for CSS/layout but do not auto-close the mobile overlay)

  // Restore last active page after refresh, constrained by role access
  useEffect(() => {
    if (!isInitialized || !user) return;
    try {
      const stored = localStorage.getItem("activePage");
      const available = getAvailablePages();
      // Prefer the stored value when valid. If none, prefer 'overview' when available,
      // otherwise fall back to the first available page.
      if (stored && available.includes(stored)) {
        if (stored !== activePage) setActivePage(stored);
      } else if (available.includes("overview")) {
        if (activePage !== "overview") setActivePage("overview");
      } else if (!available.includes(activePage) && available.length > 0) {
        setActivePage(available[0]);
      }
    } catch (_) {
      // ignore storage errors
    }
  }, [isInitialized, user]);

  const handleLogout = () => {
    logoutCurrent();
    setIsUserDropdownOpen(false);
    setIsMobileMenuOpen(false);
    try { localStorage.removeItem('activePage'); } catch (_) {}
  };

  const handlePageChange = (page) => {
    if (page !== activePage && !isLoading) {
      setIsLoading(true);
      
      // Clear highlighted reservation ID when navigating away from reservation-approval
      if (page !== 'reservation-approval' && highlightedReservationId) {
        setHighlightedReservationId(null);
      }
      
      setTimeout(() => {
        setActivePage(page);
        try { localStorage.setItem('activePage', page); } catch (_) {}
        if (
          page === "rooms" ||
          page === "archived_rooms" ||
          page === "edit-room" ||
          page === "reservation-history"
        ) {
          setReservationManagementOpen(true);
          setRoomManagementOpen(
            page === "rooms" ||
            page === "archived_rooms" ||
            page === "edit-room"
          );
          setEventManagementOpen(false);
        } else if (
          page === "event-catering" ||
          page === "archived_events" ||
          page === "edit-package"
        ) {
          setReservationManagementOpen(true);
          setEventManagementOpen(true);
          setRoomManagementOpen(false);
        } else {
          setReservationManagementOpen(false);
          setRoomManagementOpen(false);
          setEventManagementOpen(false);
        }
        setStaffManagementOpen(false);
        setCafeManagementOpen(false);
        setInventoryManagementOpen(false);
        setSettingsOpen(false);
        setPosManagementOpen(false);
        setIsLoading(false);
        setIsMobileMenuOpen(false);
      }, 1200);
    }
  };

  // Persist when activePage changes outside of handlePageChange (e.g., role-driven redirects)
  useEffect(() => {
    try { localStorage.setItem('activePage', activePage); } catch (_) {}
  }, [activePage]);

  const hasAccess = (page) => {
    if (!user || !user.role) return false;
    const roleKey = String(user.role).toLowerCase();
    return rolePermissions[roleKey]?.includes(page) || false;
  };

  // Build a small category map for the anchored narrow-screen UI.
  // Each category maps to a list of page keys; we'll filter by the pages
  // the current user is allowed to access (RBAC -> getAvailablePages()).
  const availablePagesNow = getAvailablePages();
  const categoryMap = {
    "Staff": ["staff", "attendance", "payroll", "reports", "archived_staff"],
    "Reservations": [
      "rooms",
      "archived_rooms",
      "edit-room",
      "event-catering",
      "archived_events",
      "edit-package",
      "reservation-history",
    ],
    "Cafe": ["cafe-management", "archived_cafe"],
    "Inventory": ["inventory-management", "archived_inventory"],
    "POS": ["pos", "order-history", "downpayments"],
    "Bills": ["bills"],
    "Settings": ["general", "export"],
  };

  const visibleCategories = Object.entries(categoryMap)
    .map(([label, pages]) => [label, pages.filter((p) => availablePagesNow.includes(p))])
    .filter(([, pages]) => pages.length > 0);

  // dynamic spacer: measure anchored bar height and set spacerHeight = barHeight + 8
  const anchoredBarRef = useRef(null);
  const [spacerHeight, setSpacerHeight] = useState(76);
  // header spacer: measure header height when anchored on narrow screens
  const headerRef = useRef(null);
  const [topSpacerHeight, setTopSpacerHeight] = useState(0);
  // Notification state moved to header so it's available globally across pages
  const [notifications, setNotifications] = useState([]);
  const [readyRooms, setReadyRooms] = useState([]);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isBellRinging, setIsBellRinging] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [selectedPendingReservation, setSelectedPendingReservation] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [paymentOption, setPaymentOption] = useState('');
  const notifPollingRef = useRef(false);
  const notifAbort = useRef(null);
  useEffect(() => {
    if (!anchoredBarRef) return;
    function updateSpacer() {
      try {
        const el = anchoredBarRef.current;
        const h = el ? el.offsetHeight : 0;
        setSpacerHeight((h || 0) + 8);
      } catch (_) {
        // ignore
      }
    }
    // run on mount and when narrow toggles
    updateSpacer();
    window.addEventListener("resize", updateSpacer);
    return () => window.removeEventListener("resize", updateSpacer);
  }, [anchoredBarRef, isNarrow]);

  useEffect(() => {
    if (!headerRef) return;
    function updateHeaderSpacer() {
      try {
        const el = headerRef.current;
        const h = el ? el.offsetHeight : 0;
        setTopSpacerHeight(h || 0);
      } catch (_) {
        // ignore
      }
    }
    updateHeaderSpacer();
    window.addEventListener("resize", updateHeaderSpacer);
    return () => window.removeEventListener("resize", updateHeaderSpacer);
  }, [headerRef, isNarrow]);

  // --- Header notification fetching (lightweight copy of housekeeping polling) ---
  const fetchHeaderNotifications = async () => {
    try {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (notifPollingRef.current) return;
      notifPollingRef.current = true;
      if (notifAbort.current) notifAbort.current.abort();
      notifAbort.current = new AbortController();

      const userRole = user?.role || 'Housekeeping';
      const resp = await fetch(`/api/notifications?role=${userRole}`, { cache: 'no-store', signal: notifAbort.current.signal });
      if (!resp.ok) {
        notifPollingRef.current = false;
        return;
      }
      const txt = await resp.text();
      let data = [];
      try { data = txt ? JSON.parse(txt) : []; } catch (e) { data = []; }
      const valid = Array.isArray(data) ? data.filter(n => n && (n.id != null || n.pending_reservation_id != null)) : [];
      setNotifications(valid);

      // also fetch ready rooms count
      try {
        const rr = await fetch('/api/housekeeping/by-status?status=pending', { cache: 'no-store' });
        if (rr.ok) {
          const rtxt = await rr.text();
          let rdata = [];
          try { rdata = rtxt ? JSON.parse(rtxt) : []; } catch (e) { rdata = []; }
          const validRooms = Array.isArray(rdata) ? rdata.filter(r => r && r.room_id != null) : [];
          setReadyRooms(validRooms);
          if (valid.length + validRooms.length > 0) setIsBellRinging(true);
        }
      } catch (e) {
        // ignore ready rooms errors
      }
    } catch (e) {
      // ignore
    } finally {
      notifPollingRef.current = false;
    }
  };

  useEffect(() => {
    // restore alerts preference
    try { const saved = localStorage.getItem('housekeeping_alerts_enabled'); setAlertsEnabled(saved === 'true'); } catch (e) {}
    // initial fetch and interval
    fetchHeaderNotifications();
    const iv = setInterval(fetchHeaderNotifications, 30000);
    return () => { clearInterval(iv); if (notifAbort.current) notifAbort.current.abort(); };
  }, []);

  const enableAlerts = async () => {
    try {
      if ('serviceWorker' in navigator) await navigator.serviceWorker.register('/sw.js');
    } catch (e) {}
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setAlertsEnabled(true);
        try { localStorage.setItem('housekeeping_alerts_enabled', 'true'); } catch (e) {}
      } else {
        setAlertsEnabled(false);
        try { localStorage.setItem('housekeeping_alerts_enabled', 'false'); } catch (e) {}
      }
    } catch (e) {}
  };

  const disableAlerts = () => {
    setAlertsEnabled(false);
    try { localStorage.setItem('housekeeping_alerts_enabled', 'false'); } catch (e) {}
  };

  // Auto-enable alerts when on narrow screens and the user visits a housekeeping-related page.
  // Behavior:
  // - If Notification.permission is already 'granted', register the service worker (best-effort)
  //   and set alertsEnabled immediately.
  // - Otherwise attempt to request permission by calling enableAlerts() (this may be blocked
  //   by browsers if not initiated by a user gesture; still a best-effort attempt).
  useEffect(() => {
    const housekeepingKeys = ["rooms", "housekeeping"];
    const onHousekeepingPath = () => {
      if (housekeepingKeys.includes(activePage)) return true;
      try {
        if (typeof window !== 'undefined' && window.location && window.location.pathname) {
          return window.location.pathname.includes('/housekeeping');
        }
      } catch (e) {}
      return false;
    };

    if (!isNarrow) return;
    if (!onHousekeepingPath()) return;
    if (alertsEnabled) return; // already enabled

    (async () => {
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try { if ('serviceWorker' in navigator) await navigator.serviceWorker.register('/sw.js'); } catch (e) {}
          setAlertsEnabled(true);
          try { localStorage.setItem('housekeeping_alerts_enabled', 'true'); } catch (e) {}
          return;
        }

        // Best-effort: request permission (may be blocked if not a user gesture)
        await enableAlerts();
      } catch (e) {
        // Ignore errors — this is a best-effort enhancement for mobile housekeeping flow
        console.debug('Auto-enable alerts attempt failed', e);
      }
    })();
  }, [isNarrow, activePage, alertsEnabled, enableAlerts]);

  const handleHeaderBellClick = () => {
    setIsNotifDropdownOpen(v => !v);
    setIsBellRinging(false);
  };

  // Notification actions (mark read / dismiss) centralized in header
  const handleMarkAllAsRead = async () => {
    if (!isInitialized || !token) return;
    try {
      if (!notifications || notifications.length === 0) return;
      // Filter out pending reservation notifications (they are view-only)
      const notificationsToMarkAsRead = notifications.filter(n => n.type !== 'pending_reservation');
      if (notificationsToMarkAsRead.length === 0) return;
      
      const responses = await Promise.all(
        notificationsToMarkAsRead.map(n =>
          fetch('/api/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ id: n.id, status: 'read' }),
          })
        )
      );
      // Refresh after marking
      fetchHeaderNotifications();
      setIsNotifDropdownOpen(false);
    } catch (e) {
      console.error('Failed to mark all as read', e);
    }
  };

  const handleDismissNotification = async (id) => {
    if (!isInitialized || !token || !id) return;
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status: 'read' }),
      });
      if (res.ok) {
        // remove locally for instant feedback
        setNotifications((prev) => prev.filter(n => n.id !== id));
      }
    } catch (e) {
      console.error('Failed to dismiss notification', e);
    }
  };

  const handlePendingReservationClick = (notification) => {
    // Redirect to reservation approval page and highlight the specific reservation
    setHighlightedReservationId(notification.reservation_id);
    setActivePage('reservation-approval');
    setReservationManagementOpen(true); // Ensure the reservation management section is open
    setIsNotifDropdownOpen(false);
    setIsBellRinging(false);
  };

  const handleApprovePendingReservation = async () => {
    if (!paymentOption || !selectedPendingReservation) {
      alert('Please select a payment option');
      return;
    }

    try {
      const response = await fetch('/api/pending-reservations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: selectedPendingReservation.id,
          action: 'approve',
          paymentOption: paymentOption
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve reservation');
      }

      alert('Reservation approved successfully!');
      setShowApprovalModal(false);
      setSelectedPendingReservation(null);
      setPaymentOption('');
      fetchHeaderNotifications(); // Refresh notifications
    } catch (error) {
      console.error('Error approving reservation:', error);
      alert(error.message || 'Failed to approve reservation');
    }
  };

  useEffect(() => {
    if (user && user.role && !hasAccess(activePage)) {
      const availablePages = getAvailablePages();
      if (availablePages.length > 0) {
        // Prefer Overview when the role has access to it
        if (availablePages.includes("overview")) {
          handlePageChange("overview");
        } else {
          handlePageChange(availablePages[0]);
        }
      }
    }
  }, [user, activePage]);

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-gray-600 text-lg sm:text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const renderPage = () => {
    if (!hasAccess(activePage)) {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <div className="text-center p-6 sm:p-8 bg-white rounded-lg shadow-md">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
            <p className="text-sm sm:text-base text-gray-600">
              You don&apos;t have permission to access this page.
            </p>
          </div>
        </div>
      );
    }

    switch (activePage) {
      case "overview":
        return <Overview setActivePage={handlePageChange} isLoading={isLoading} isNarrow={isNarrow} />;
      case "staff":
      case "attendance":
      case "payroll":
      case "reports":
        return <StaffManagement activeSubPage={activePage} isLoading={isLoading} isNarrow={isNarrow} />;
      case "archived_staff":
        return <ArchivedStaff isLoading={isLoading} isNarrow={isNarrow} />;
      case "inventory-management":
        return <InventoryManagement activeSubPage={activePage} isLoading={isLoading} isNarrow={isNarrow} />;
      case "archived_inventory":
        return <ArchivedInventory isLoading={isLoading} isNarrow={isNarrow} />;
      case "rooms":
        return <RoomManagement activeSubPage={activePage} isLoading={isLoading} isNarrow={isNarrow} />;
      case "housekeeping":
        return <HousekeepingPage />;
      case "archived_rooms":
        return <ArchivedRooms isLoading={isLoading} isNarrow={isNarrow} />;
      case "edit-room":
        return <EditRoom isLoading={isLoading} isNarrow={isNarrow} />;
      case "event-catering":
        return <EventCateringManagement activeSubPage={activePage} isLoading={isLoading} isNarrow={isNarrow} />;
      case "archived_events":
        return <ArchivedEvents isLoading={isLoading} isNarrow={isNarrow} />;
      case "edit-package":
        return <EditPackage isLoading={isLoading} isNarrow={isNarrow} />;
      case "cafe-management":
        return <CafeManagement activeSubPage={activePage} isLoading={isLoading} isNarrow={isNarrow} />;
      case "archived_cafe":
        return <ArchivedCafe isLoading={isLoading} isNarrow={isNarrow} />;
      case "pos":
        return <POS isLoading={isLoading} isNarrow={isNarrow} />;
      case "downpayments":
        return <Downpayments isLoading={isLoading} isNarrow={isNarrow} />;
      case "order-history":
        return <OrderHistory isLoading={isLoading} isNarrow={isNarrow} />;
      case "bills":
        return <BillsPage />;
      case "general":
      case "export":
        return <Settings activeSubPage={activePage} isLoading={isLoading} isNarrow={isNarrow} />;
      case "reservation-history":
        return <ReservationHistory isLoading={isLoading} isNarrow={isNarrow} />;
      case "reservation-approval":
        return <ReservationApproval isLoading={isLoading} isNarrow={isNarrow} highlightedReservationId={highlightedReservationId} />;
      case "front-desk-notifications":
        return <FrontDeskNotifications isLoading={isLoading} isNarrow={isNarrow} />;
      default:
        return <Overview setActivePage={handlePageChange} isLoading={isLoading} isNarrow={isNarrow} />;
    }
  };

  function LoadingOverlay() {
    return (
      <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-40 md:z-50">
        <div className="text-center animate-fade-in">
          <div className="mb-4">
            <img
              src="/SRCB.png"
              alt="SRCB Logo"
              className="mx-auto w-24 h-16 sm:w-36 sm:h-24 rounded-lg animate-pulse"
            />
          </div>
          <p className="text-base sm:text-lg font-semibold text-gray-700 tracking-wide">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen bg-gray-100 overflow-hidden ${isNarrow ? 'dashboard-vertical' : ''}`}>
  <div className="bg-gray-100 hidden md:flex md:flex-shrink-0 h-screen">
        {/* Provide collapse state to sidebar and nav items */}
        <SidebarCollapseContext.Provider value={isSidebarCollapsed}>
        <Sidebar
          activePage={activePage}
          setActivePage={handlePageChange}
          staffManagementOpen={staffManagementOpen}
          setStaffManagementOpen={setStaffManagementOpen}
          reservationManagementOpen={reservationManagementOpen}
          setReservationManagementOpen={setReservationManagementOpen}
          roomManagementOpen={roomManagementOpen}
          setRoomManagementOpen={setRoomManagementOpen}
          eventManagementOpen={eventManagementOpen}
          setEventManagementOpen={setEventManagementOpen}
          cafeManagementOpen={cafeManagementOpen}
          setCafeManagementOpen={setCafeManagementOpen}
          inventoryManagementOpen={inventoryManagementOpen}
          setInventoryManagementOpen={setInventoryManagementOpen}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          posManagementOpen={posManagementOpen}
          setPosManagementOpen={setPosManagementOpen}
          billsManagementOpen={billsManagementOpen}
          setBillsManagementOpen={setBillsManagementOpen}
          userRole={user?.role}
          hasAccess={hasAccess}
          availablePages={getAvailablePages()}
          isLoading={isLoading}
        />
        </SidebarCollapseContext.Provider>
      </div>
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden">
          <div className="w-64 sm:w-72 bg-green-800 h-full shadow-lg relative z-50">
            {/* mobile menu should not be collapsed */}
            <SidebarCollapseContext.Provider value={false}>
            <Sidebar
              activePage={activePage}
              setActivePage={handlePageChange}
              staffManagementOpen={staffManagementOpen}
              setStaffManagementOpen={setStaffManagementOpen}
              reservationManagementOpen={reservationManagementOpen}
              setReservationManagementOpen={setReservationManagementOpen}
              roomManagementOpen={roomManagementOpen}
              setRoomManagementOpen={setRoomManagementOpen}
              eventManagementOpen={eventManagementOpen}
              setEventManagementOpen={setEventManagementOpen}
              cafeManagementOpen={cafeManagementOpen}
              setCafeManagementOpen={setCafeManagementOpen}
              inventoryManagementOpen={inventoryManagementOpen}
              setInventoryManagementOpen={setInventoryManagementOpen}
              settingsOpen={settingsOpen}
              setSettingsOpen={setSettingsOpen}
              posManagementOpen={posManagementOpen}
              setPosManagementOpen={setPosManagementOpen}
              billsManagementOpen={billsManagementOpen}
              setBillsManagementOpen={setBillsManagementOpen}
              userRole={user?.role}
              hasAccess={hasAccess}
              availablePages={getAvailablePages()}
              isLoading={isLoading}
            />
            </SidebarCollapseContext.Provider>
            <button
              className="absolute top-4 right-4 text-white"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

  <div className="flex flex-col flex-1 overflow-hidden dashboard-main">
  <header ref={headerRef} className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-white border-b ${isNarrow ? 'anchored-header' : ''}`}>
          <div className="flex items-center">
            <button
              className="md:hidden hide-on-720 text-gray-500 focus:outline-none p-2"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            {/* Desktop: collapse/expand sidebar */}
            <button
              className="hidden md:inline-flex text-gray-600 hover:text-gray-800 focus:outline-none p-2 ml-2"
              onClick={() => setIsSidebarCollapsed((v) => !v)}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {/* simple chevron icon */}
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isSidebarCollapsed ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
              </svg>
            </button>
            <h2 className="ml-2 sm:ml-4 text-lg sm:text-xl font-semibold text-white md:text-gray-800 truncate">
              {(() => {
                // default fallback title generation
                const fallback = (activePage || "")
                  .split("-")
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(" ");
                // If not privileged, remove trailing 'Management' from fallback
                const safeFallback = (!isPrivileged ? fallback.replace(/\s*Management$/i, "") : fallback);

                if (activePage === "overview") return "Overview";
                if (activePage === "rooms") return "Rooms";
                if (activePage === "housekeeping") return "Housekeeping";
                if (activePage === "event-catering") return "Event & Catering";
                if (activePage === "archived_rooms") return "Archived Rooms";
                if (activePage === "edit-room") return "Edit Room";
                if (activePage === "archived_events") return "Archived Events";
                if (activePage === "edit-package") return "Edit Package";
                if (activePage === "archived_cafe") return "Archived Cafe";
                if (activePage === "archived_inventory") return "Archived Inventory";
                if (activePage === "archived_staff") return "Archived Staff";
                if (activePage === "order-history") return "Order History";
                if (activePage === "bills") return "Bills & Invoices";
                if (activePage === "reservation-history") return "Reservation History";
                if (activePage === "reservation-approval") return "Reservation Request";
                if (activePage === "front-desk-notifications") return "Front Desk Notifications";
                return safeFallback;
              })()}
            </h2>
          </div>
          <div className="relative flex items-center space-x-2 sm:space-x-4">
            {/* Notifications moved to header so they are consistent across pages */}
            <div className="relative">
                <button
                  onClick={handleHeaderBellClick}
                  className={`relative p-2 text-white md:text-gray-600 md:hover:text-gray-800 focus:outline-none ${isBellRinging ? 'animate-bell-ring' : ''}`}
                title="View Notifications"
                aria-label="Notifications"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {(notifications.length > 0 || readyRooms.length > 0) && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                    {notifications.length + readyRooms.length}
                  </span>
                )}
              </button>
              {isNotifDropdownOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white border rounded-lg shadow-lg z-50 max-h-[500px] overflow-y-auto">
                  <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-white">
                    <div>
                      <h3 className="font-semibold text-gray-800">Notifications</h3>
                      <p className="text-xs text-gray-500">Pending reservations and alerts</p>
                    </div>
                    <div className="text-sm text-gray-600">{notifications.length} new</div>
                  </div>
                  <div className="p-2 space-y-2">
                    {notifications.length === 0 && readyRooms.length === 0 ? (
                      <div className="p-3 text-center text-gray-600">No notifications</div>
                    ) : (
                      <>
                        {notifications.filter(n => n.type === 'pending_reservation').length > 0 && (
                          <div>
                            <h4 className="px-2 text-sm font-medium text-blue-700 mb-2">Pending Reservations</h4>
                            <div className="space-y-2 px-2">
                              {notifications.filter(n => n.type === 'pending_reservation').map(note => (
                                <div key={note.id} className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-800">{note.message}</p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {new Date(note.created_at).toLocaleString()}
                                      </p>
                                      <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-xs text-blue-800">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        View Only
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handlePendingReservationClick(note)}
                                    className="w-full mt-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Show Reservation
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {notifications.filter(n => n.type !== 'pending_reservation').length > 0 && (
                          <div>
                            <h4 className="px-2 text-sm font-medium text-gray-700 mb-2">System Notifications</h4>
                            <div className="space-y-2 px-2">
                              {notifications.filter(n => n.type !== 'pending_reservation').map(note => (
                                <div key={note.id} className="flex items-start justify-between bg-gray-50 p-2 rounded">
                                  <div className="flex-1">
                                    <p className="text-sm text-gray-800">{note.message}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {note.created_at ? new Date(note.created_at).toLocaleString() : ''}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {readyRooms.length > 0 && (
                          <div>
                            <h4 className="px-2 text-sm font-medium text-gray-700 mb-2">Rooms Ready for Cleaning</h4>
                            <div className="space-y-2 px-2">
                              {readyRooms.map(room => (
                                <div key={room.room_id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                  <div className="text-sm text-gray-800">Room {room.room_number} is ready for cleaning</div>
                                  <div className="text-xs text-gray-400">{room.ready_at ? (new Date(room.ready_at)).toLocaleString() : ''}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="p-3 border-t flex gap-2 sticky bottom-0 bg-white">
                    <button
                      onClick={handleMarkAllAsRead}
                      className={`px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm ${notifications.filter(n => n.type !== 'pending_reservation').length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={notifications.filter(n => n.type !== 'pending_reservation').length === 0}
                      title="Mark system notifications as read"
                    >
                      Mark All as Read
                    </button>
                    <button
                      onClick={() => { setIsNotifDropdownOpen(false); setIsBellRinging(false); }}
                      className="flex-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setIsUserDropdownOpen((prev) => !prev)}
                className="flex items-center text-white md:text-gray-600 md:hover:text-gray-800 focus:outline-none p-2"
                aria-label="User menu"
              >
                <UserCircleIcon className="h-7 w-7 sm:h-6 sm:w-6" />
                <ChevronDownIcon className="h-4 w-4 ml-1" />
              </button>
              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-50">
                  <div className="py-2 px-3 border-b">
                    <div className="text-sm font-semibold text-gray-800">{user?.name || 'User'}</div>
                    <div className="text-xs text-gray-500 capitalize">{user?.role || ''}</div>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                    >
                      <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

  {/* when anchored, render a spacer equal to header height so content isn't hidden */}
        {isNarrow && <div aria-hidden style={{ height: topSpacerHeight }} />}
        <main
          className={`flex-1 overflow-y-auto px-4 sm:px-6 ${isNarrow ? 'py-2' : 'py-4 sm:py-6'} bg-gray-50 relative`}
          style={{ minHeight: `calc(100vh - ${topSpacerHeight}px - ${spacerHeight}px)` }}
        >
          {isLoading && <LoadingOverlay />}
          {renderPage()}
        </main>
      </div>

      {/* Pending Reservation Request Modal */}
      {showApprovalModal && selectedPendingReservation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-[100]">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl m-4 relative">
            {/* Close button - top right corner */}
            <button 
              onClick={() => {
                setShowApprovalModal(false);
                setSelectedPendingReservation(null);
                setPaymentOption('');
              }}
              className="absolute top-4 right-4 z-10 text-white hover:text-gray-200 hover:bg-blue-700 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="sticky top-0 bg-blue-600 text-white p-6 rounded-t-xl">
              <h2 className="text-2xl font-bold">Pending Reservation Request</h2>
              <p className="text-blue-100 text-sm mt-1">
                {selectedPendingReservation.type === 'room' ? 'Room Reservation' : 'Event Reservation'}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Name:</span>
                    <p className="text-gray-800">{selectedPendingReservation.customer_name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Email:</span>
                    <p className="text-gray-800">{selectedPendingReservation.customer_email}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Contact:</span>
                    <p className="text-gray-800">{selectedPendingReservation.contact_number}</p>
                  </div>
                  {selectedPendingReservation.nationality && (
                    <div>
                      <span className="font-medium text-gray-600">Nationality:</span>
                      <p className="text-gray-800">{selectedPendingReservation.nationality}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Reservation Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Reservation Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedPendingReservation.type === 'room' ? (
                    <>
                      <div>
                        <span className="font-medium text-gray-600">Room Number:</span>
                        <p className="text-gray-800">{selectedPendingReservation.room_number || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Package:</span>
                        <p className="text-gray-800">{selectedPendingReservation.package_name}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Check-in:</span>
                        <p className="text-gray-800">{new Date(selectedPendingReservation.check_in_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Check-out:</span>
                        <p className="text-gray-800">{new Date(selectedPendingReservation.check_out_date).toLocaleDateString()}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="font-medium text-gray-600">Event Name:</span>
                        <p className="text-gray-800">{selectedPendingReservation.event_name}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Event Date:</span>
                        <p className="text-gray-800">{new Date(selectedPendingReservation.event_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Package:</span>
                        <p className="text-gray-800">{selectedPendingReservation.package_name}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Guests:</span>
                        <p className="text-gray-800">{selectedPendingReservation.guests}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Payment Option Selection */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Select Payment Option</h3>
                <div className="space-y-3">
                  <label className="flex items-center p-3 bg-white rounded-lg border-2 border-gray-200 cursor-pointer hover:border-blue-500 transition-colors">
                    <input
                      type="radio"
                      name="paymentOption"
                      value="downpayment"
                      checked={paymentOption === 'downpayment'}
                      onChange={(e) => setPaymentOption(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="ml-3">
                      <span className="font-medium text-gray-800">Require Downpayment</span>
                      <p className="text-sm text-gray-600">Customer must pay a downpayment before confirmation</p>
                    </div>
                  </label>
                  <label className="flex items-center p-3 bg-white rounded-lg border-2 border-gray-200 cursor-pointer hover:border-blue-500 transition-colors">
                    <input
                      type="radio"
                      name="paymentOption"
                      value="checkout"
                      checked={paymentOption === 'checkout'}
                      onChange={(e) => setPaymentOption(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="ml-3">
                      <span className="font-medium text-gray-800">Pay Upon Checkout</span>
                      <p className="text-sm text-gray-600">Customer will pay when checking out</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 bg-gray-50 p-6 border-t flex gap-3 rounded-b-xl">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedPendingReservation(null);
                  setPaymentOption('');
                }}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprovePendingReservation}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!paymentOption}
              >
                Approve Reservation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* When the viewport is narrow (<=720px) render a compact, anchored grid (no logo) */}
      {isNarrow && (
        <>
          {/* spacer so the main content isn't hidden by the anchored bar (dynamic: bar height + 8px) */}
          <div aria-hidden style={{ height: spacerHeight }} />

          <div ref={anchoredBarRef} className="fixed bottom-0 left-0 w-full bg-green-800 text-white z-50 border-t anchored-bar">
            <div className="max-w-7xl mx-auto px-4 py-2">
              {/* compute columns based on how many visible categories we have */}
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, visibleCategories.length))}, minmax(0, 1fr))` }}
              >
                {/* map page keys to icon components for compact icon-only buttons */}
                {/**
                 * Note: keep icons small and provide sr-only labels for accessibility.
                 */}
                {
                  /* build icon map */
                }
                {(() => {
                  const pageIconMap = {
                    overview: ChartBarIcon,
                    staff: UsersIcon,
                    attendance: ClockIcon,
                    payroll: CurrencyDollarIcon,
                    reports: DocumentTextIcon,
                    archived_staff: ArchiveBoxIcon,
                    rooms: HomeIcon,
                    housekeeping: ClipboardDocumentIcon,
                    archived_rooms: ArchiveBoxIcon,
                    "edit-room": DocumentTextIcon,
                    "event-catering": TruckIcon,
                    archived_events: ArchiveBoxIcon,
                    "edit-package": DocumentTextIcon,
                    "reservation-history": ClockIcon,
                    "reservation-approval": CheckCircleIcon,
                    "front-desk-notifications": BellAlertIcon,
                    "cafe-management": CoffeeIcon,
                    archived_cafe: ArchiveBoxIcon,
                    "inventory-management": ClipboardDocumentIcon,
                    archived_inventory: ArchiveBoxIcon,
                    pos: ShoppingCartIcon,
                    "order-history": DocumentTextIcon,
                    bills: DocumentTextIcon,
                    downpayments: CurrencyDollarIcon,
                    general: Cog6ToothIcon,
                    export: DocumentArrowDownIcon,
                  };

                  return visibleCategories.map(([label, pages]) => (
            <div key={label}>
              <div className="flex flex-wrap gap-2">
                        {pages.map((p) => {
                          const Icon = pageIconMap[p] || DocumentTextIcon;
                          const labelText = (() => {
                            if (p === "housekeeping") return "Housekeeping";
                            if (p === "event-catering") return isPrivileged ? "Event & Catering Management" : "Event & Catering";
                            if (p === "cafe-management") return isPrivileged ? "Café Menu" : "Café";
                            if (p === "inventory-management") return isPrivileged ? "Inventory Management" : "Inventory";
                            if (p === "pos") return isPrivileged ? "POS" : "Point of Sale";
                            if (p === "order-history") return "Order History";
                            if (p === "bills") return "Bills";
                            if (p === "downpayments") return "Downpayments";
                            if (p === "archived_rooms") return "Archived Rooms";
                            if (p === "edit-room") return "Edit Room";
                            if (p === "archived_events") return "Archived Events";
                            if (p === "edit-package") return "Edit Package";
                            if (p === "reservation-history") return "Reservation History";
                            if (p === "reservation-approval") return "Reservation Request";
                            if (p === "front-desk-notifications") return "Food Ready Alerts";
                            if (p === "archived_cafe" || p === "archived_inventory" || p === "archived_staff") return "Archived";
                            return p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, ' ');
                          })();

                          return (
                            <button
                              key={p}
                              onClick={() => handlePageChange(p)}
                              className="anchored-button flex flex-col items-center justify-center w-12 h-12 rounded bg-transparent focus:outline-none"
                              aria-label={labelText}
                              aria-pressed={activePage === p}
                              role="button"
                            >
                              <Icon className={`h-6 w-6 ${activePage === p ? 'text-white' : 'text-green-100'}`} />
                              <span className="sr-only">{labelText}</span>
                              {/* visible caption on hover/focus and when active */}
                              <span className="anchored-caption" aria-hidden>{activePage === p ? labelText : ''}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
                
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Sidebar({
  activePage,
  setActivePage,
  staffManagementOpen,
  setStaffManagementOpen,
  reservationManagementOpen,
  setReservationManagementOpen,
  roomManagementOpen,
  setRoomManagementOpen,
  eventManagementOpen,
  setEventManagementOpen,
  cafeManagementOpen,
  setCafeManagementOpen,
  inventoryManagementOpen,
  setInventoryManagementOpen,
  settingsOpen,
  setSettingsOpen,
  posManagementOpen,
  setPosManagementOpen,
  billsManagementOpen,
  setBillsManagementOpen,
  userRole,
  hasAccess,
  availablePages,
  isLoading,
}) {
  // Local calculation for Security role to avoid relying on parent-scope variable
  const isSecurity = (userRole || '').toLowerCase() === 'security';
  const isPrivileged = (userRole || '').toLowerCase() === 'admin' || (userRole || '').toLowerCase() === 'manager';
  // Read collapse state from context (defaults to false)
  const isCollapsed = useContext(SidebarCollapseContext);
  const showOverview = availablePages.includes("overview");
  const showStaffManagement = availablePages.some((page) =>
    ["staff", "attendance", "payroll", "reports", "archived_staff"].includes(page)
  );
  const showReservationManagement = availablePages.some((page) =>
    ["rooms", "archived_rooms", "edit-room", "event-catering", "archived_events", "edit-package", "reservation-history", "reservation-approval"].includes(page)
  );
  const showCafeManagement = availablePages.some((page) =>
    ["cafe-management", "archived_cafe"].includes(page)
  );
  const showInventoryManagement = availablePages.some((page) =>
    ["inventory-management", "archived_inventory"].includes(page)
  );
  const showPOS = availablePages.includes("pos") || availablePages.includes("order-history") || availablePages.includes("cafe-management");
  const showBills = availablePages.includes("bills");
  const showSettings = availablePages.some((page) =>
    ["general", "export"].includes(page)
  );

  return (
    
  <div className={`flex flex-col ${isCollapsed ? 'w-16 sm:w-20' : 'w-64 sm:w-72'} bg-green-800 h-full dashboard-sidebar justify-between`}>
    {/* Navigation Bar */}
    <div className="flex items-center justify-center h-16 sm:h-20 bg-green-800">
        <h1 className="flex items-center text-white text-lg sm:text-xl font-bold">
          <Image
            src="/SRCB.png"
            alt="SRCB Logo"
            width={isCollapsed ? 48 : 150}
            height={isCollapsed ? 48 : 150}
            className={`mr-2 rounded transition-all ${isCollapsed ? 'mx-auto' : ''}`}
          />
        </h1>
      </div>
      
      <div className="flex flex-col flex-grow px-3 sm:px-2 py-2 overflow-y-auto pr-2">
        <nav className="flex-1 space-y-1 sm:space-y-2">
          {showOverview && (
            <DashboardNavItem
              icon={<ChartBarIcon className="h-6 w-6" />}
              title="Dashboard"
              active={activePage === "overview"}
              onClick={() => setActivePage("overview")}
              isLoading={isLoading}
              isPrivileged={isPrivileged}
              isCollapsed={isCollapsed}
            />
          )}

          {showStaffManagement && (
            <DashboardNavItem
              icon={<UsersIcon className="h-6 w-6" />}
              title={isPrivileged ? "Staff Management" : "Staff"}
              active={["staff", "attendance", "payroll", "reports", "archived_staff"].includes(activePage)}
              onClick={(page) => setActivePage(page || "staff")}
              hasDropdown
              isDropdownOpen={staffManagementOpen}
              onToggleDropdown={() => setStaffManagementOpen(!staffManagementOpen)}
              availablePages={availablePages}
              isLoading={isLoading}
            isPrivileged={isPrivileged}
            isCollapsed={isCollapsed}
            />
          )}

          {showReservationManagement && (
            <DashboardNavItem
              icon={<ClipboardDocumentIcon className="h-6 w-6" />}
              title={isPrivileged ? "Reservation Management" : "Reservation"}
              active={["rooms", "housekeeping", "archived_rooms", "edit-room", "event-catering", "archived_events", "edit-package", "reservation-history", "reservation-approval"].includes(activePage)}
              onClick={(page) => setActivePage(page || "rooms")}
              hasDropdown
              isDropdownOpen={reservationManagementOpen}
              onToggleDropdown={() => setReservationManagementOpen(!reservationManagementOpen)}
              availablePages={availablePages}
              isLoading={isLoading}
            isPrivileged={isPrivileged}
            isCollapsed={isCollapsed}
            >
              {availablePages.includes("housekeeping") && (
                <button
                  onClick={() => setActivePage("housekeeping")}
                  className={`flex items-center px-4 py-3 rounded-lg w-full text-left transition-colors text-sm sm:text-base ${
                    activePage === "housekeeping"
                      ? "bg-green-600 text-white"
                      : "text-green-100 hover:bg-green-600 hover:text-white"
                  } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={isLoading}
                >
                  <ClipboardDocumentIcon className="h-5 w-5 mr-3" />
                  <span className={`${isCollapsed ? 'hidden' : 'font-medium'}`}>🧹 Housekeeping</span>
                </button>
              )}
              {availablePages.includes("rooms") && (
                <DashboardNavItem
                  icon={<HomeIcon className="h-5 w-5" />}
                  title={isPrivileged ? "Rooms" : "Room"}
                  active={activePage === "rooms" || activePage === "archived_rooms" || activePage === "edit-room"}
                  onClick={() => setActivePage("rooms")}
                  hasDropdown
                  isDropdownOpen={roomManagementOpen}
                  onToggleDropdown={() => setRoomManagementOpen(!roomManagementOpen)}
                  availablePages={availablePages}
                  isLoading={isLoading}
                isPrivileged={isPrivileged}
                isCollapsed={isCollapsed}
                >
                  {availablePages.includes("rooms") && (
                    <button
                      onClick={() => setActivePage("rooms")}
                      className={`flex items-center px-4 py-3 rounded-lg w-full text-left transition-colors text-sm sm:text-base ${
                        activePage === "rooms"
                          ? "bg-green-600 text-white"
                          : "text-green-100 hover:bg-green-600 hover:text-white"
                      } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                      disabled={isLoading}
                    >
                      <HomeIcon className="h-5 w-5 mr-3" />
                        <span className={`${isCollapsed ? 'hidden' : 'font-medium'}`}>Management</span>
                    </button>
                  )}
                  {availablePages.includes("edit-room") && (
                    !isSecurity && (
                      <button
                        onClick={() => setActivePage("edit-room")}
                        className={`flex items-center px-4 py-3 rounded-lg w-full text-left transition-colors text-sm sm:text-base ${
                          activePage === "edit-room"
                            ? "bg-green-600 text-white"
                            : "text-green-100 hover:bg-green-600 hover:text-white"
                        } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={isLoading}
                      >
                        <DocumentTextIcon className="h-5 w-5 mr-3" />
                        <span className={`${isCollapsed ? 'hidden' : 'font-medium'}`}>Edit Room</span>
                      </button>
                    )
                  )}
                  {availablePages.includes("archived_rooms") && (
                    !isSecurity && (
                      <button
                        onClick={() => setActivePage("archived_rooms")}
                        className={`flex items-center px-4 py-3 rounded-lg w-full text-left transition-colors text-sm sm:text-base ${
                          activePage === "archived_rooms"
                            ? "bg-green-600 text-white"
                            : "text-green-100 hover:bg-green-600 hover:text-white"
                        } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={isLoading}
                      >
                        <ArchiveBoxIcon className="h-5 w-5 mr-3" />
                        <span className={`${isCollapsed ? 'hidden' : 'font-medium'}`}>Archived</span>
                      </button>
                    )
                  )}
                </DashboardNavItem>
              )}
              {availablePages.includes("event-catering") && (
                <DashboardNavItem
                  icon={<TruckIcon className="h-5 w-5" />}
                  title={isPrivileged ? "Event & Catering" : "Event & Catering"}
                  active={activePage === "event-catering" || activePage === "archived_events" || activePage === "edit-package"}
                  onClick={() => setActivePage("event-catering")}
                  hasDropdown
                  isDropdownOpen={eventManagementOpen}
                  onToggleDropdown={() => setEventManagementOpen(!eventManagementOpen)}
                  availablePages={availablePages}
                  isLoading={isLoading}
                isPrivileged={isPrivileged}
                isCollapsed={isCollapsed}
                >
                  {availablePages.includes("event-catering") && (
                    <button
                      onClick={() => setActivePage("event-catering")}
                      className={`flex items-center px-4 py-3 rounded-lg w-full text-left transition-colors text-sm sm:text-base ${
                        activePage === "event-catering"
                          ? "bg-green-600 text-white"
                          : "text-green-100 hover:bg-green-600 hover:text-white"
                      } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                      disabled={isLoading}
                    >
                      <TruckIcon className="h-5 w-5 mr-3" />
                        <span className={`${isCollapsed ? 'hidden' : 'font-medium'}`}>Management</span>
                    </button>
                  )}
                  {availablePages.includes("edit-package") && (
                    !isSecurity && (
                      <button
                        onClick={() => setActivePage("edit-package")}
                        className={`flex items-center px-4 py-3 rounded-lg w-full text-left transition-colors text-sm sm:text-base ${
                          activePage === "edit-package"
                            ? "bg-green-600 text-white"
                            : "text-green-100 hover:bg-green-600 hover:text-white"
                        } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={isLoading}
                      >
                        <DocumentTextIcon className="h-5 w-5 mr-3" />
                          <span className={`${isCollapsed ? 'hidden' : 'font-medium'}`}>Edit Package</span>
                      </button>
                    )
                  )}
                  {availablePages.includes("archived_events") && (
                    !isSecurity && (
                      <button
                        onClick={() => setActivePage("archived_events")}
                        className={`flex items-center px-4 py-3 rounded-lg w-full text-left transition-colors text-sm sm:text-base ${
                          activePage === "archived_events"
                            ? "bg-green-600 text-white"
                            : "text-green-100 hover:bg-green-600 hover:text-white"
                        } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={isLoading}
                      >
                        <ArchiveBoxIcon className="h-5 w-5 mr-3" />
                        <span className={`${isCollapsed ? 'hidden' : 'font-medium'}`}>Archived Events</span>
                      </button>
                    )
                  )}
                </DashboardNavItem>
              )}
              {availablePages.includes("reservation-history") && (
                <button
                  onClick={() => setActivePage("reservation-history")}
                  className={`flex items-center px-4 py-3 rounded-lg w-full text-left transition-colors text-sm sm:text-base ${
                    activePage === "reservation-history"
                      ? "bg-green-600 text-white"
                      : "text-green-100 hover:bg-green-600 hover:text-white"
                  } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={isLoading}
                >
                  <ClockIcon className="h-5 w-5 mr-3" />
                      <span className={`${isCollapsed ? 'hidden' : 'font-medium'}`}>Reservation History</span>
                </button>
              )}
              {availablePages.includes("reservation-approval") && (
                <button
                  onClick={() => setActivePage("reservation-approval")}
                  className={`flex items-center px-4 py-3 rounded-lg w-full text-left transition-colors text-sm sm:text-base ${
                    activePage === "reservation-approval"
                      ? "bg-green-600 text-white"
                      : "text-green-100 hover:bg-green-600 hover:text-white"
                  } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={isLoading}
                >
                  <CheckCircleIcon className="h-5 w-5 mr-3" />
                      <span className={`${isCollapsed ? 'hidden' : 'font-medium'}`}>Reservation Request</span>
                </button>
              )}
            </DashboardNavItem>
          )}

          {/* Cafe pages are now grouped under POS as "Café Menu" */}

          {showInventoryManagement && (
            <DashboardNavItem
              icon={<ClipboardDocumentIcon className="h-6 w-6" />}
              title={isPrivileged ? "Inventory Management" : "Inventory"}
              active={["inventory-management", "archived_inventory"].includes(activePage)}
              onClick={(page) => setActivePage(page || "inventory-management")}
              hasDropdown
              isDropdownOpen={inventoryManagementOpen}
              onToggleDropdown={() => setInventoryManagementOpen(!inventoryManagementOpen)}
              availablePages={availablePages}
              isLoading={isLoading}
            isPrivileged={isPrivileged}
            isCollapsed={isCollapsed}
            />
          )}

          {showPOS && (
            <DashboardNavItem
              icon={<ShoppingCartIcon className="h-6 w-6" />}
              title={isPrivileged ? "POS" : "Point of Sale"}
              active={activePage === "pos" || activePage === "order-history" || activePage === "downpayments"}
              onClick={(page) => setActivePage(page || "pos")}
              hasDropdown
              isDropdownOpen={posManagementOpen}
              onToggleDropdown={() => setPosManagementOpen(!posManagementOpen)}
              availablePages={availablePages}
              isLoading={isLoading}
            isPrivileged={isPrivileged}
            isCollapsed={isCollapsed}
            />
          )}

          {showBills && (
            <DashboardNavItem
              icon={<DocumentTextIcon className="h-6 w-6" />}
              title="Bills"
              active={activePage === "bills"}
              onClick={(page) => setActivePage(page || "bills")}
              hasDropdown
              isDropdownOpen={billsManagementOpen}
              onToggleDropdown={() => setBillsManagementOpen(!billsManagementOpen)}
              availablePages={availablePages}
              isLoading={isLoading}
            isPrivileged={isPrivileged}
            isCollapsed={isCollapsed}
            />
          )}

          {availablePages.includes("front-desk-notifications") && (
            <DashboardNavItem
              icon={<BellAlertIcon className="h-6 w-6" />}
              title="Food Ready Alerts"
              active={activePage === "front-desk-notifications"}
              onClick={() => setActivePage("front-desk-notifications")}
              isLoading={isLoading}
              isPrivileged={isPrivileged}
              isCollapsed={isCollapsed}
            />
          )}

          {showSettings && (
            <DashboardNavItem
              icon={<Cog6ToothIcon className="h-6 w-6" />}
              title="Settings"
              active={["general", "export"].includes(activePage)}
              onClick={(page) => setActivePage(page || "general")}
              hasDropdown
              isDropdownOpen={settingsOpen}
              onToggleDropdown={() => setSettingsOpen(!settingsOpen)}
              availablePages={availablePages}
              isLoading={isLoading}
            isPrivileged={isPrivileged}
            isCollapsed={isCollapsed}
            />
          )}
        </nav>
      </div>
    </div>
  );
}

function DashboardNavItem({
  icon,
  title,
  active = false,
  onClick,
  hasDropdown = false,
  isDropdownOpen = false,
  onToggleDropdown,
  availablePages = [],
  isLoading,
  children,
  isPrivileged = false,
}) {
  const getDropdownItems = () => {
    if (title === "Staff Management") {
      return ["staff", "attendance", "payroll", "reports", "archived_staff"].filter((item) =>
        availablePages.includes(item)
      );
    } else if (title === "Cafe Management") {
      return ["cafe-management", "archived_cafe"].filter((item) =>
        availablePages.includes(item)
      );
    } else if (title === "Inventory Management") {
      return ["inventory-management", "archived_inventory"].filter((item) =>
        availablePages.includes(item)
      );
    } else if (title === "POS") {
      // Include cafe pages under POS so Cafe Management appears as "Café Menu" inside POS
      return ["pos", "order-history", "downpayments", "cafe-management", "archived_cafe"].filter((item) =>
        availablePages.includes(item)
      );
    } else if (title === "Bills") {
      return ["bills"].filter((item) =>
        availablePages.includes(item)
      );
    } else if (title === "Settings") {
      return ["general", "export"].filter((item) =>
        availablePages.includes(item)
      );
    } else if (title === "Reservation Management") {
      // Remove "reservation-history" to avoid duplication
      return [];
    }
    return [];
  };

  const dropdownItems = getDropdownItems();
  const shouldShowDropdown = hasDropdown && (dropdownItems.length > 0 || children);
  // read collapsed state
  const isCollapsed = useContext(SidebarCollapseContext);

  return (
    <div className="w-full">
      <button
        onClick={shouldShowDropdown ? onToggleDropdown : () => onClick()}
        className={`flex items-center justify-between px-4 py-3 sm:py-4 rounded-lg w-full text-left transition-colors text-sm sm:text-base ${
          active
            ? "bg-green-700 text-white"
            : "text-green-200 hover:bg-green-700 hover:text-white focus:bg-green-700 focus:text-white"
        } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        aria-expanded={shouldShowDropdown ? isDropdownOpen : undefined}
        aria-controls={shouldShowDropdown ? `dropdown-${title.replace(/\s+/g, "-")}` : undefined}
        disabled={isLoading}
      >
        <div className="flex items-center">
          <span className="mr-3">{icon}</span>
          <span className={`${isCollapsed ? 'hidden' : 'font-medium'}`}>{title}</span>
        </div>
        {shouldShowDropdown && (
          <ChevronDownIcon
            className={`h-5 w-5 transition-transform ${isDropdownOpen ? "transform rotate-180" : ""}`}
          />
        )}
      </button>

      {shouldShowDropdown && isDropdownOpen && !isCollapsed && (
        <div id={`dropdown-${title.replace(/\s+/g, "-")}`} className="ml-6 sm:ml-8 mt-1 sm:mt-2 space-y-1 sm:space-y-2">
          {dropdownItems.length > 0 &&
            dropdownItems.map((sub) => (
              <button
                key={sub}
                onClick={() => onClick(sub)}
                className={`flex items-center px-4 py-3 rounded-lg w-full text-left transition-colors text-sm sm:text-base ${
                  active === sub
                    ? "bg-green-600 text-white"
                    : "text-green-100 hover:bg-green-600 hover:text-white focus:bg-green-600 focus:text-white"
                } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={isLoading}
              >
                {sub === "staff" && <UsersIcon className="h-5 w-5 mr-3" />}
                {sub === "attendance" && <ClockIcon className="h-5 w-5 mr-3" />}
                {sub === "payroll" && <CurrencyDollarIcon className="h-5 w-5 mr-3" />}
                {sub === "reports" && <DocumentTextIcon className="h-5 w-5 mr-3" />}
                {sub === "archived_staff" && <ArchiveBoxIcon className="h-5 w-5 mr-3" />}
                {sub === "cafe-management" && <CoffeeIcon className="h-5 w-5 mr-3" />}
                {sub === "archived_cafe" && <ArchiveBoxIcon className="h-5 w-5 mr-3" />}
                {sub === "inventory-management" && <ClipboardDocumentIcon className="h-5 w-5 mr-3" />}
                {sub === "archived_inventory" && <ArchiveBoxIcon className="h-5 w-5 mr-3" />}
                {sub === "pos" && <ShoppingCartIcon className="h-5 w-5 mr-3" />}
                {sub === "order-history" && <DocumentTextIcon className="h-5 w-5 mr-3" />}
                {sub === "bills" && <DocumentTextIcon className="h-5 w-5 mr-3" />}
                {sub === "downpayments" && <CurrencyDollarIcon className="h-5 w-5 mr-3" />}
                {sub === "general" && <CogIcon className="h-5 w-5 mr-3" />}
                {sub === "export" && <DocumentArrowDownIcon className="h-5 w-5 mr-3" />}
                <span className="font-medium">
                  {(() => {
                    // For non-privileged users, drop the 'Management' suffix
                    const mapLabel = (s) => {
                      if (s === "event-catering") return isPrivileged ? "Event & Catering Management" : "Event & Catering";
                      if (s === "cafe-management") return isPrivileged ? "Café Menu" : "Café";
                      if (s === "inventory-management") return isPrivileged ? "Inventory Management" : "Inventory";
                      if (s === "pos") return isPrivileged ? "POS" : "Point of Sale";
                      if (s === "order-history") return "Order History";
                      if (s === "bills") return "Bills & Invoices";
                      if (s === "downpayments") return "DP only";
                      if (s === "archived_rooms") return "Archived Rooms";
                      if (s === "edit-room") return "Edit Room";
                      if (s === "archived_events") return "Archived Events";
                      if (s === "edit-package") return "Edit Package";
                      if (s === "archived_cafe" || s === "archived_inventory" || s === "archived_staff") return "Archived";
                      return s.charAt(0).toUpperCase() + s.slice(1);
                    };
                    return mapLabel(sub);
                  })()}
                </span>
              </button>
            ))}
          {children}
        </div>
      )}
    </div>
  );
}