"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { Roles } from "../../../lib/rbac";
import {
  CreditCardIcon,
  ShieldCheckIcon,
  BellIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

export default function General() {
  const { token, user } = useAuth();

  // --- state
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
  });
  const [defaultDiscount, setDefaultDiscount] = useState("none");
  const [discounts, setDiscounts] = useState([]);
  const [editingDiscountIndex, setEditingDiscountIndex] = useState(null);
  const [discountLabel, setDiscountLabel] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [taxRate, setTaxRate] = useState(8.5);
  const [invoicePrefix, setInvoicePrefix] = useState("JH-");
  const [autoInvoice, setAutoInvoice] = useState(true);
  const [twoFA, setTwoFA] = useState(true);
  const [passwordRotation, setPasswordRotation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [holidayDate, setHolidayDate] = useState("");
  const [notification, setNotification] = useState({
    isVisible: false,
    type: "",
    message: "",
  });
  const [salesRecords, setSalesRecords] = useState([]);
  const [reservationHistory, setReservationHistory] = useState([]);
  const [eventReservationHistory, setEventReservationHistory] = useState([]);
  const [cashierMatches, setCashierMatches] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [recordsErrors, setRecordsErrors] = useState([]);
  const [systemLogs, setSystemLogs] = useState({ activities: [], metrics: { active_users_24h: 0 } });
  const [loadingSystemLogs, setLoadingSystemLogs] = useState(true);
  const [systemLogsError, setSystemLogsError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);

  // UI helpers
  const [auditFilter, setAuditFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState(null);

  // Prefer role from AuthContext when available, otherwise fall back to localStorage sessions (existing pattern)
  const activeUserRole = (user && user.role) || (typeof window !== 'undefined' && window.localStorage ? (() => {
    try {
      const s = localStorage.getItem('sessions');
      if (!s) return null;
      const sessions = JSON.parse(s || '[]');
      const activeId = localStorage.getItem('activeSessionId');
      const active = sessions.find((x) => x.id === activeId);
      return active?.user?.role || active?.role || null;
    } catch (e) {
      return null;
    }
  })() : null);

  const roleKey = String(activeUserRole || '').toLowerCase();
  const showHeaderBell = [Roles.Admin, Roles.Manager, Roles.Housekeeping].some((r) => String(r).toLowerCase() === roleKey);

  // --- Fetch with retry
  const fetchWithRetry = async (url, options, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errBody = await response.json();
            errorMessage = errBody.error || errBody.message || `HTTP ${response.status}`;
          } catch {
            errorMessage = `HTTP ${response.status}: Unable to parse error response`;
          }
          throw new Error(errorMessage);
        }
        return await response.json();
      } catch (error) {
        if (i === retries - 1) {
          if (error.message.includes('Failed to fetch')) {
            throw new Error(`Network error: ${error.message}`);
          }
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  };

  // --- Fetch sales records
  const fetchSalesRecords = async () => {
    setLoadingRecords(true);
    setRecordsErrors((prev) => prev.filter((e) => !e.startsWith("Sales Records")));
    try {
      const data = await fetchWithRetry("/api/receipts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSalesRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching sales records:", error);
      setRecordsErrors((prev) => [...prev.filter((e) => !e.startsWith("Sales Records")), `Sales Records: ${error.message}`]);
    } finally {
      setLoadingRecords(false);
    }
  };

  // --- Fetch reservation history (combined room and event)
  const fetchReservationHistory = async () => {
    setLoadingRecords(true);
    setRecordsErrors((prev) => prev.filter((e) => !e.startsWith("Reservation History") && !e.startsWith("Event Reservation History")));
    try {
      const data = await fetchWithRetry("/api/reservations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReservationHistory(Array.isArray(data.roomReservations) ? data.roomReservations : []);
      setEventReservationHistory(Array.isArray(data.eventReservations) ? data.eventReservations : []);
    } catch (error) {
      console.error("Error fetching reservations:", error);
      setRecordsErrors((prev) => [...prev.filter((e) => !e.startsWith("Reservation History") && !e.startsWith("Event Reservation History")), `Reservations: ${error.message}`]);
    } finally {
      setLoadingRecords(false);
    }
  };

  // --- Fetch all records
  useEffect(() => {
    if (!token) return;
    fetchSalesRecords();
    fetchReservationHistory();
    fetchCashierSalesRecords();
  }, [token]);

  // --- Fetch cashier sales matches (new endpoint that aggregates receipts -> reservations)
  const fetchCashierSalesRecords = async () => {
    try {
      const data = await fetchWithRetry('/api/audit-logs/cashier-sales', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCashierMatches(Array.isArray(data.matched) ? data.matched : []);
    } catch (error) {
      console.warn('Failed to load cashier sales matches:', error);
    }
  };

  // --- Load settings (billing discount)
  useEffect(() => {
    if (!token) return;
    let mounted = true;
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        if (data && data.billing) {
          const disc = data.billing.discount?.default || data.billing?.discount || "none";
          setDefaultDiscount(disc);
          // support legacy single-value and new list format
          const list = Array.isArray(data.billing?.discount?.list)
            ? data.billing.discount.list
            : (Array.isArray(data.billing?.discount) ? data.billing.discount : []);
          setDiscounts(list);
        }
        if (data && data.holidays) {
          setHolidays(Array.isArray(data.holidays) ? data.holidays : []);
        }
      } catch (e) {
        console.warn("Failed to load settings:", e);
      }
    };
    loadSettings();
    return () => { mounted = false; };
  }, [token]);

  // --- Fetch system logs
  useEffect(() => {
    if (!token) return;
    let mounted = true;
    const fetchSystemLogs = async () => {
      try {
        const response = await fetch("/api/system-logs", { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("Failed to fetch system logs");
        const data = await response.json();
        if (mounted) setSystemLogs(data || { activities: [], metrics: { active_users_24h: 0 } });
      } catch (error) {
        if (mounted) setSystemLogsError(error.message);
      } finally {
        if (mounted) setLoadingSystemLogs(false);
      }
    };
    fetchSystemLogs();
    return () => { mounted = false; };
  }, [token]);

  // --- Save
  const handleSave = useCallback(async () => {
    setSaving(true);
    setNotification({ isVisible: false, type: "", message: "" });

    try {
      if (taxRate < 0 || taxRate > 20) {
        throw new Error("Tax rate must be between 0 and 20%");
      }
      if (!invoicePrefix.match(/^[A-Z]{1,3}-$/)) {
        throw new Error("Invoice prefix must be 1-3 uppercase letters followed by a hyphen (e.g. 'JH-')");
      }

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const settings = {
        notifications,
        taxRate,
        invoicePrefix,
        autoInvoice,
        twoFA,
        passwordRotation,
        billing: { discount: { default: defaultDiscount, list: discounts } },
        holidays,
      };

      try {
        if (token) {
          const resBilling = await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ key: "billing", value: settings.billing }),
          });
          if (!resBilling.ok) {
            const err = await resBilling.json().catch(() => ({}));
            throw new Error(err.error || err.message || `Failed to save billing settings (HTTP ${resBilling.status})`);
          }

          const resHolidays = await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ key: "holidays", value: settings.holidays }),
          });
          if (!resHolidays.ok) {
            const err = await resHolidays.json().catch(() => ({}));
            throw new Error(err.error || err.message || `Failed to save holidays (HTTP ${resHolidays.status})`);
          }

          // Re-load settings from server to ensure what POS will read is current
          try {
            const refresh = await fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } });
            if (refresh.ok) {
              const serverSettings = await refresh.json();
              const disc = serverSettings?.billing?.discount?.default || serverSettings?.billing?.discount || "none";
              setDefaultDiscount(disc);
              const list = Array.isArray(serverSettings?.billing?.discount?.list)
                ? serverSettings.billing.discount.list
                : (Array.isArray(serverSettings?.billing?.discount) ? serverSettings.billing.discount : []);
              setDiscounts(list);
            }
          } catch (e) {
            // non-fatal
            console.warn('Failed to refresh settings after save', e);
          }
        }
      } catch (e) {
        console.warn("Failed to persist settings to server:", e);
        setNotification({ isVisible: true, type: 'error', message: String(e.message || e) });
        setSaving(false);
        return;
      }

      setNotification({
        isVisible: true,
        type: "success",
        message: "Settings saved successfully!",
      });

      setTimeout(() => setNotification((p) => ({ ...p, isVisible: false })), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setNotification({
        isVisible: true,
        type: "error",
        message: error.message || "An unexpected error occurred. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }, [notifications, taxRate, invoicePrefix, autoInvoice, twoFA, passwordRotation, defaultDiscount, discounts, holidays, token]);

  // Holiday helpers
  const canManageHolidays = (userRole) => {
    if (!userRole) return false;
    const r = String(userRole).toLowerCase();
    return r === 'admin' || r === 'manager';
  };

  const addHoliday = () => {
    if (!holidayDate) return;
    if (holidays.includes(holidayDate)) {
      setNotification({ isVisible: true, type: 'error', message: 'Holiday already exists' });
      setTimeout(() => setNotification((p) => ({ ...p, isVisible: false })), 3000);
      return;
    }

    // Optimistically update UI
    const next = [...holidays, holidayDate].sort();
    setHolidays(next);
    setHolidayDate('');

    // Persist immediately (best-effort). Use existing fetchWithRetry and token if available.
    (async () => {
      try {
        if (token) {
          await fetchWithRetry('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ key: 'holidays', value: next }),
          }, 3, 800);
        }
        setNotification({ isVisible: true, type: 'success', message: 'Holiday added and saved.' });
        setTimeout(() => setNotification((p) => ({ ...p, isVisible: false })), 2500);
      } catch (err) {
        console.error('Failed to persist holiday:', err);
        setNotification({ isVisible: true, type: 'error', message: 'Failed to save holiday to server.' });
        setTimeout(() => setNotification((p) => ({ ...p, isVisible: false })), 3500);
      }
    })();
  };

  const removeHoliday = (date) => {
    const next = holidays.filter((d) => d !== date);
    setHolidays(next);

    // Persist removal (best-effort)
    (async () => {
      try {
        if (token) {
          await fetchWithRetry('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ key: 'holidays', value: next }),
          }, 3, 800);
        }
        setNotification({ isVisible: true, type: 'success', message: 'Holiday removed and saved.' });
        setTimeout(() => setNotification((p) => ({ ...p, isVisible: false })), 2500);
      } catch (err) {
        console.error('Failed to persist holiday removal:', err);
        setNotification({ isVisible: true, type: 'error', message: 'Failed to remove holiday on server.' });
        setTimeout(() => setNotification((p) => ({ ...p, isVisible: false })), 3500);
      }
    })();
  };

  const toggleNotification = (type) => setNotifications((prev) => ({ ...prev, [type]: !prev[type] }));
  const dismissNotification = () => setNotification((prev) => ({ ...prev, isVisible: false }));

  // --- Calculate days between dates for room reservations
  const calculateRoomDays = (checkIn, checkOut) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; // Minimum 1 day
  };

  // --- Combine and format records for audit logs
  const auditRecords = [
    ...salesRecords.map((r) => ({
      id: r.id,
      timestamp: r.created_at,
      cashier: r.cashier || "N/A",
      item_sold: "Receipt",
      sales_amount: (r.total !== null && r.total !== undefined && r.total !== '') ? Number(r.total) : 0,
    })),
    // Use cashierMatches to override room/event cashier and sales when available
    ...reservationHistory.map((r) => {
      const match = cashierMatches.find((m) => m.source === 'room' && Number(m.id) === Number(r.id));
      const days = calculateRoomDays(r.check_in_date, r.check_out_date);
      const defaultPrice = r.price ? r.price * days : 0;
        return {
          id: r.id,
          timestamp: r.check_in_date,
          // prefer display_name provided by API (receipt cashier) then other fallbacks
          cashier: (match && match.cashier) || r.display_name || r.receipt_cashier || r.cashier_name || r.customer_name || "N/A",
          item_sold: r.package_name || `Room ${r.room_number || ''}`.trim() || "Room",
          sales_amount: match && (typeof match.sales === 'number') ? match.sales : (typeof r.receipt_total === 'number' ? r.receipt_total : defaultPrice),
        };
    }),
    ...eventReservationHistory.map((r) => {
      const match = cashierMatches.find((m) => m.source === 'event' && Number(m.id) === Number(r.id));
      return {
        id: r.id,
        timestamp: r.event_date,
        cashier: (match && match.cashier) || r.receipt_cashier || r.cashier_name || r.customer_name || "N/A",
        item_sold: r.event_name || "Event",
        sales_amount: match && (typeof match.sales === 'number') ? match.sales : (typeof r.receipt_total === 'number' ? r.receipt_total : (r.total || 0)),
      };
    }),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // --- Filter and paginate audit records
  const filteredRecords = auditRecords.filter((r) => {
    if (!auditFilter.trim()) return true;
    const q = auditFilter.toLowerCase();
    const item = (r.item_sold || "").toLowerCase();
    const cashier = (r.cashier || "").toLowerCase();
    return item.includes(q) || cashier.includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPageSafe = Math.min(Math.max(1, currentPage), totalPages);

  // --- Retry all fetches
  const handleRetry = () => {
    setRecordsErrors([]);
    fetchSalesRecords();
    fetchReservationHistory();
  };

  return (
  <div className="min-h-full pb-28 bg-gray-50">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 pt-8">
        <div className="flex flex-col items-start gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
              <Cog6ToothIcon className="h-6 w-6 text-sky-600" />
              System Settings
            </h1>
            <p className="mt-1 text-sm text-gray-600">Manage billing, notifications, security and logs for your system.</p>
          </div>
        <div className="w-full flex items-center justify-between">
          <div className="text-sm flex items-center gap-3">
            {showHeaderBell ? (
              <div className="relative">
                <BellIcon className="h-5 w-5 text-gray-500" />
                {/* small unread dot (purely visual) */}
                {notification.isVisible && notification.type === 'success' ? (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-green-500 rounded-full ring-1 ring-white" />
                ) : null}
              </div>
            ) : null}

            {notification.isVisible ? (
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${notification.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {notification.type === "success" ? (
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                ) : (
                  <ExclamationCircleIcon className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">{notification.message}</span>
              </div>
            ) : (
              <span className="text-gray-500">All changes are saved locally until you click <strong className="text-gray-700">Save</strong>.</span>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`inline-flex items-center gap-3 px-4 py-2 rounded-md text-white shadow ${saving ? "bg-sky-400 cursor-not-allowed" : "bg-sky-600 hover:bg-sky-700"}`}
          >
            {saving ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <DocumentTextIcon className="h-5 w-5" />}
            <span className="font-medium text-sm">{saving ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
        </div>

        {/* Main content: responsive 2-column layout (main + sidebar) */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          <div className="md:col-span-2 space-y-6">
            {/* Discounts */}
            <section className="bg-white rounded-xl shadow p-6 border border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <CreditCardIcon className="h-6 w-6 text-sky-600" />
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">Discounts</h2>
                    <p className="text-sm text-gray-500">Manage discount types shown in the POS. Add, edit or remove discounts and choose the default.</p>
                  </div>
                </div>
                <div className="text-sm text-gray-400">Billing</div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="defaultDiscount" className="block text-sm font-medium text-gray-700 mb-1">Default Discount</label>
                  <select
                    id="defaultDiscount"
                    value={defaultDiscount}
                    onChange={(e) => setDefaultDiscount(e.target.value)}
                    className="block w-full border border-gray-200 rounded-lg px-4 py-3 shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-200 text-base"
                  >
                    <option value="none">No Discount</option>
                    {discounts.map((d, idx) => (
                      <option key={d.key || `${d.label}-${idx}`} value={d.key || d.label.toLowerCase().replace(/\s+/g, "-")}>{`${d.label} (${d.percent}% )`}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">The selected default will be applied when the POS loads.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">Available Discounts</h3>
                    <button
                      onClick={() => {
                        setEditingDiscountIndex(null);
                        setDiscountLabel("");
                        setDiscountPercent(0);
                        setDiscountModalOpen(true);
                      }}
                      className="px-3 py-1 bg-sky-600 text-white rounded-md text-sm"
                    >Add Discount</button>
                  </div>

                  <div className="mt-3">
                    {discounts.length === 0 ? (
                      <div className="text-sm text-gray-500">No discounts configured. Add a discount to make it available in the POS.</div>
                    ) : (
                      <ul className="space-y-2">
                        {discounts.map((d, idx) => (
                          <li key={d.key || `${d.label}-${idx}`} className="flex items-center justify-between border border-gray-100 rounded-md p-2">
                            <div>
                              <div className="text-sm font-medium text-gray-800">{d.label}</div>
                              <div className="text-xs text-gray-500">{d.percent}%</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingDiscountIndex(idx);
                                  setDiscountLabel(d.label || "");
                                  setDiscountPercent(Number(d.percent) || 0);
                                  setDiscountModalOpen(true);
                                }}
                                className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm"
                              >Edit</button>
                              <button
                                onClick={() => {
                                  const ok = confirm(`Delete discount '${d.label}'?`);
                                  if (!ok) return;
                                  const next = discounts.filter((_, i) => i !== idx);
                                  setDiscounts(next);
                                  // if default was deleted, reset to none
                                  if ((d.key || d.label) === defaultDiscount) setDefaultDiscount("none");
                                  setNotification({ isVisible: true, type: 'success', message: 'Discount deleted.' });
                                  setTimeout(() => setNotification((p) => ({ ...p, isVisible: false })), 2500);
                                }}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm"
                              >Delete</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Discount modal */}
              {discountModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setDiscountModalOpen(false)} />
                  <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-4 z-10">
                    <h4 className="text-lg text-green-700 font-medium">{editingDiscountIndex === null ? 'Add Discount' : 'Edit Discount'}</h4>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="block text-sm text-gray-700">Label</label>
                        <input className="w-full p-2 border text-black border-gray-200 rounded" value={discountLabel} onChange={(e) => setDiscountLabel(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700">Percent (%)</label>
                        <input type="number" className="w-full text-black p-2 border border-gray-200 rounded" value={discountPercent} onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)} min="0" max="100" />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button onClick={() => setDiscountModalOpen(false)} className="px-3 py-2 rounded bg-red-600">Cancel</button>
                      <button onClick={() => {
                        const lbl = (discountLabel || '').trim();
                        if (!lbl) { alert('Label is required'); return; }
                        const pct = Number(discountPercent) || 0;
                        const key = lbl.toLowerCase().replace(/\s+/g, '-');
                        const entry = { key, label: lbl, percent: pct };
                          if (editingDiscountIndex === null) {
                            setDiscounts((prev) => {
                              const next = [...prev, entry];
                              // show popup
                              setNotification({ isVisible: true, type: 'success', message: 'Discount added.' });
                              setTimeout(() => setNotification((p) => ({ ...p, isVisible: false })), 2500);
                              return next;
                            });
                          } else {
                            setDiscounts((prev) => {
                              const next = prev.map((v, i) => i === editingDiscountIndex ? entry : v);
                              setNotification({ isVisible: true, type: 'success', message: 'Discount updated.' });
                              setTimeout(() => setNotification((p) => ({ ...p, isVisible: false })), 2500);
                              return next;
                            });
                          }
                          setDiscountModalOpen(false);
                      }} className="px-3 py-2 rounded bg-green-600 text-white">Save</button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Audit Logs */}
            <section className="bg-white rounded-xl shadow p-6 border border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheckIcon className="h-6 w-6 text-sky-600" />
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">Audit Logs</h2>
                    <p className="text-sm text-gray-500">Recent sales, room reservations, and event reservations. Use search to filter by name or items.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="search"
                    value={auditFilter}
                    onChange={(e) => { setAuditFilter(e.target.value); setCurrentPage(1); }}
                    placeholder="Search name or item..."
                    className="px-3 py-2 text-black border border-gray-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <button
                    onClick={() => { setAuditFilter(""); setCurrentPage(1); }}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm border border-gray-200 hover:bg-gray-200"
                  >
                    Clear
                  </button>
                  <button
                    onClick={async () => {
                      setDebugLoading(true);
                      try {
                        const receipts = await fetchWithRetry('/api/receipts', { headers: { Authorization: `Bearer ${token}` } }, 2);
                        const matches = await fetchWithRetry('/api/audit-logs/cashier-sales', { headers: { Authorization: `Bearer ${token}` } }, 2);
                        setDebugInfo({ receipts, matches });
                      } catch (err) {
                        setDebugInfo({ error: String(err) });
                      } finally {
                        setDebugLoading(false);
                      }
                    }}
                    className="px-3 py-2 bg-sky-600 text-white rounded-lg text-sm border border-sky-600 hover:bg-sky-700"
                  >
                    {debugLoading ? 'Checking...' : 'Debug Receipts'}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                {loadingRecords ? (
                  <div className="flex items-center gap-3 text-gray-600 py-8 justify-center">
                    <ArrowPathIcon className="h-5 w-5 animate-spin text-green-600" />
                    <span>Loading audit logs...</span>
                  </div>
                ) : recordsErrors.length > 0 ? (
                  <div className="text-sm text-red-600 py-4">
                    <p>Some data could not be loaded:</p>
                    <ul className="list-disc pl-5">
                      {[...new Set(recordsErrors)].map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                    <button
                      onClick={handleRetry}
                      className="mt-2 px-3 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 flex items-center gap-2"
                    >
                      <ArrowPathIcon className="h-5 w-5" />
                      Retry
                    </button>
                  </div>
                ) : auditRecords.length === 0 ? (
                  <div className="text-sm text-gray-500 py-4">No audit logs available.</div>
                ) : (
                  <>
                    <div className="overflow-x-auto border border-gray-100 rounded-md bg-white">
                      <table className="min-w-full divide-y divide-gray-200 table-auto">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {filteredRecords
                            .slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize)
                            .map((record, idx) => (
                              <tr key={`${record.id}-${record.item_sold}-${idx}`} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900 w-48">
                                  {new Date(record.timestamp || Date.now()).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{record.cashier || "N/A"}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 break-words">{record.item_sold || "N/A"}</td>
                                <td className="px-4 py-3 text-sm text-right text-gray-900">{typeof record.sales_amount === "number" ? `₱${Number(record.sales_amount).toFixed(2)}` : "₱0.00"}</td>
                                <td className="px-4 py-3 text-sm text-center">
                                  <button
                                    onClick={() => { setSelectedAudit(record); setAuditModalOpen(true); }}
                                    className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    Details
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Audit details modal */}
                    {auditModalOpen && selectedAudit ? (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50" onClick={() => { setAuditModalOpen(false); setSelectedAudit(null); }} />
                        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto p-4 z-10">
                          <div className="flex items-start justify-between">
                            <h3 className="text-lg font-medium text-gray-900">Audit details</h3>
                            <button onClick={() => { setAuditModalOpen(false); setSelectedAudit(null); }} className="text-gray-500 hover:text-gray-800">Close</button>
                          </div>
                          <div className="mt-3 text-sm text-gray-800">
                            <div className="mb-2"><strong>Created:</strong> {new Date(selectedAudit.timestamp || Date.now()).toLocaleString()}</div>
                            <div className="mb-2"><strong>Name:</strong> {selectedAudit.cashier || 'N/A'}</div>
                            <div className="mb-2"><strong>Items:</strong> {selectedAudit.item_sold || 'N/A'}</div>
                            <div className="mb-2"><strong>Sales:</strong> {typeof selectedAudit.sales_amount === 'number' ? `₱${Number(selectedAudit.sales_amount).toFixed(2)}` : '₱0.00'}</div>
                            <details className="mt-3 bg-gray-50 p-2 rounded border border-gray-100">
                              <summary className="cursor-pointer">Raw record JSON</summary>
                              <pre className="whitespace-pre-wrap text-xs mt-2 bg-white p-2 rounded border border-gray-100 text-black">{JSON.stringify(selectedAudit, null, 2)}</pre>
                            </details>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* Pagination */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Showing {(currentPageSafe - 1) * pageSize + 1} – {Math.min(currentPageSafe * pageSize, filteredRecords.length)} of {filteredRecords.length}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1 rounded-md border border-gray-200 bg-sky-600 text-white text-sm shadow-sm hover:bg-sky-700"
                          disabled={currentPageSafe === 1}
                        >
                          Prev
                        </button>
                        <div className="px-3 py-1 text-sm text-gray-700">{currentPageSafe} / {totalPages}</div>
                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="px-3 py-1 rounded-md border border-gray-200 bg-sky-600 text-white text-sm shadow-sm hover:bg-sky-700"
                          disabled={currentPageSafe === totalPages}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {/* Debug output (appears after clicking Debug Receipts) */}
              {debugInfo ? (
                <div className="mt-4 p-3 bg-gray-50 border border-gray-100 rounded-md text-sm">
                  {debugInfo.error ? (
                    <div className="text-red-600">Debug error: {debugInfo.error}</div>
                  ) : (
                    <div>
                      <div className="mb-2 text-black">Receipts returned: <strong>{Array.isArray(debugInfo.receipts) ? debugInfo.receipts.length : 'n/a'}</strong></div>
                      <div className="mb-2 text-black" >Matched records returned: <strong>{Array.isArray(debugInfo.matches?.matched) ? debugInfo.matches.matched.length : 'n/a'}</strong></div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-black">Show sample data</summary>
                        <pre className="whitespace-pre-wrap text-xs mt-2 bg-white p-2 rounded border border-gray-100 text-black">
{JSON.stringify({ receipts: (debugInfo.receipts || []).slice(0,5), matches: (debugInfo.matches?.matched || []).slice(0,5) }, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          </div>

          {/* Right column: System logs, Notifications, Security */}
          <div className="md:col-span-1 space-y-6">
            {/* Holidays: Admin / Manager only */}
            <section className="bg-white rounded-xl shadow p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheckIcon className="h-6 w-6 text-sky-600" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Holidays</h3>
                    <p className="text-sm text-gray-500">Set dates that should be treated as holidays.</p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {canManageHolidays((typeof window !== 'undefined' && window.localStorage) ? (() => {
                  try { const s = localStorage.getItem('sessions'); if (!s) return null; const sessions = JSON.parse(s||'[]'); const activeId = localStorage.getItem('activeSessionId'); const active = sessions.find((x)=>x.id===activeId); return active?.user?.role || active?.role || null; } catch { return null; }
                })() : null) ? (
                  <div>
                    <div className="flex items-center gap-3">
                      <input
                        type="date"
                        value={holidayDate}
                        onChange={(e) => setHolidayDate(e.target.value)}
                        className="border border-gray-200 rounded-md px-3 py-2 shadow-sm text-gray-900"
                      />
                      <button
                        onClick={addHoliday}
                        className="px-3 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700"
                      >
                        Add Holiday
                      </button>
                    </div>

                    <div className="mt-4">
                      {holidays.length === 0 ? (
                        <div className="text-sm text-gray-500">No holidays set.</div>
                      ) : (
                        <ul className="space-y-2">
                          {holidays.map((d) => (
                            <li key={d} className="flex items-center justify-between border border-gray-100 rounded-md p-2">
                              <div className="text-sm text-gray-800">{new Date(d).toLocaleDateString()}</div>
                              <button onClick={() => removeHoliday(d)} className="text-red-600 hover:text-red-800 text-sm">Remove</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Only Admins and Managers can manage holidays.</div>
                )}
              </div>
            </section>
            {/* System Logs */}
            <section className="bg-white rounded-xl shadow p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheckIcon className="h-6 w-6 text-sky-600" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">System Logs</h3>
                    <p className="text-sm text-gray-500">Overview of recent system activity</p>
                  </div>
                </div>
                <div className="text-sm text-gray-400">Overview</div>
              </div>

              <div className="mt-4">
                {loadingSystemLogs ? (
                    <div className="flex items-center gap-3 justify-center py-6 text-gray-600">
                    <ArrowPathIcon className="h-5 w-5 animate-spin text-sky-600" />
                    <span>Loading system logs...</span>
                  </div>
                ) : systemLogsError ? (
                  <div className="text-sm text-red-600 py-4">{systemLogsError}</div>
                ) : (
                  <>
                    <div className="text-sm text-gray-700 mb-3">Active users (24h): <span className="font-semibold">{systemLogs?.metrics?.active_users_24h ?? 0}</span></div>
                    <div className="max-h-64 overflow-auto border border-gray-100 rounded-md">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {(systemLogs.activities || []).slice(0, 50).map((log) => (
                            <tr key={log.id ?? Math.random()}>
                              <td className="px-4 py-3 text-sm text-gray-900">{log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{log.user_name || log.user_id || "N/A"}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{log.action || log.category || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Notifications */}
            <section className="bg-white rounded-xl shadow p-6 border border-gray-100">
              <div className="flex items-center gap-3">
                <BellIcon className="h-6 w-6 text-sky-600" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
                  <p className="text-sm text-gray-500">Control how you receive alerts</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Email Notifications</div>
                    <div className="text-xs text-gray-500">Order updates, invoices, and alerts</div>
                  </div>
                    <button
                      onClick={() => toggleNotification("email")}
                      aria-pressed={notifications.email}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full ${notifications.email ? "bg-sky-600" : "bg-gray-200"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${notifications.email ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Push Notifications</div>
                    <div className="text-xs text-gray-500">Live app alerts</div>
                  </div>
                    <button
                      onClick={() => toggleNotification("push")}
                      aria-pressed={notifications.push}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full ${notifications.push ? "bg-sky-600" : "bg-gray-200"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${notifications.push ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
