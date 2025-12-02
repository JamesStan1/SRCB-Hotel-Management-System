"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import {
  ShoppingCartIcon,
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  PrinterIcon,
  CreditCardIcon,
  BanknotesIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import Toast from "../../../components/Toast";
import Swal from "sweetalert2";
import { notifySuccess, toastError, modalAlert } from "../../../lib/swal";

const generateRandomString = (length) => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const generateInvoiceId = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const randomStr = generateRandomString(4);
  return `INV-${year}${month}${day}-${hours}${minutes}${seconds}-${randomStr}`;
};

const coalesce = (obj, keys, fallback = null) => {
  for (const key of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }
  return fallback;
};

const normalizeReceiptItems = (items) => {
  if (Array.isArray(items)) {
    return items;
  }

  if (typeof items === "string") {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Failed to parse receipt items", error);
    }
  }
  return [];
};

const buildBillHtml = (receipt, roomBillingData = null) => {
  console.log("buildBillHtml called with receipt:", receipt);
  console.log("buildBillHtml called with roomBillingData:", roomBillingData);
  const invoiceId = coalesce(receipt, ["invoiceId", "invoice_id", "id"], "N/A");
  const createdAtRaw = coalesce(receipt, ["date", "created_at"], new Date().toISOString());
  const cashier = coalesce(receipt, ["cashier", "cashier_name"], "Unknown");
  const customer = coalesce(receipt, ["customer", "customer_name"], "Guest");
  const paymentMethod = coalesce(receipt, ["paymentMethod", "payment_method"], "N/A");
  const discountType = coalesce(receipt, ["discountType", "discount_type"], "none");
  const subtotal = Number(coalesce(receipt, ["subtotal"], 0)) || 0;
  const discount = Number(coalesce(receipt, ["discount"], 0)) || 0;
  const total = Number(coalesce(receipt, ["total"], 0)) || 0;
  const items = normalizeReceiptItems(coalesce(receipt, ["items"], []));

  console.log("buildBillHtml extracted data:", { invoiceId, customer, subtotal, discount, total, itemsCount: items.length });

  const createdAt = new Date(createdAtRaw);
  const formattedDate = createdAt.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = createdAt.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const rows = items
    .map((item, index) => {
      const name = coalesce(item, ["name", "title", "item"], "Item");
      const quantity = Number(coalesce(item, ["quantity", "qty"], 0)) || 0;
      const price = Number(coalesce(item, ["price", "unit_price"], 0)) || 0;
      const lineTotal = Number(
        coalesce(item, ["subtotal", "total", "amount"], price * quantity)
      ) || price * quantity;
      return `
          <tr>
            <td class="text-center">${index + 1}</td>
            <td>${name}</td>
            <td class="text-center">${quantity}</td>
            <td class="text-right">₱${price.toFixed(2)}</td>
            <td class="text-right">₱${lineTotal.toFixed(2)}</td>
          </tr>`;
    })
    .join("");

  const discountLabel = discountType && discountType !== "none"
    ? discountType.toString().replace(/[-_]/g, " ")
    : "No discount";

  // Add room billing information if available
  let roomBillingSection = "";
  if (roomBillingData && roomBillingData.reservation) {
    const res = roomBillingData.reservation;
    const cafeTotal = res.cafe_payments || 0;
    const roomTotal = res.total_price || 0;
    const totalPaid = res.total_paid_amount || 0;
    const remaining = res.remaining_balance || 0;

    roomBillingSection = `
      <div class="info-card" style="margin-top: 16px; background: #fef3c7; border: 1px solid #f59e0b;">
        <div class="info-label" style="color: #92400e;">Room Billing Summary</div>
        <div style="font-size: 14px; color: #92400e; margin-top: 8px;">
          <div>Room: ${res.room_number || 'N/A'}</div>
          <div>Room Charges: ₱${roomTotal.toFixed(2)}</div>
          <div>Cafe Charges: ₱${cafeTotal.toFixed(2)}</div>
          <div>Total Paid: ₱${totalPaid.toFixed(2)}</div>
          <div>Remaining Balance: ₱${remaining.toFixed(2)}</div>
        </div>
      </div>`;
  }

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Bill ${invoiceId}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: Arial, sans-serif;
        padding: 40px;
        color: #111827;
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
        margin-bottom: 5px;
      }
      .subtitle { color: #6b7280; font-size: 14px; }
      .bill-title {
        margin-top: 16px;
        font-size: 22px;
        font-weight: bold;
        color: #10b981;
      }
      .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }
      .info-card {
        background: #f9fafb;
        padding: 16px;
        border-radius: 10px;
      }
      .info-label {
        font-size: 12px;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 4px;
      }
      .info-value { font-size: 15px; font-weight: 600; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 24px;
      }
      thead tr {
        background: #10b981;
        color: #fff;
      }
      th, td {
        padding: 12px;
        border-bottom: 1px solid #e5e7eb;
        font-size: 14px;
      }
      th { text-transform: uppercase; font-size: 12px; letter-spacing: 0.06em; }
      .summary {
        max-width: 360px;
        margin-left: auto;
        background: #f9fafb;
        border-radius: 10px;
        padding: 20px;
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #e5e7eb;
        font-size: 14px;
      }
      .summary-row.total {
        font-size: 18px;
        font-weight: 700;
        color: #10b981;
        border-top: 2px solid #10b981;
        border-bottom: none;
        margin-top: 12px;
        padding-top: 12px;
      }
      .footer {
        margin-top: 48px;
        text-align: center;
        color: #6b7280;
        font-size: 12px;
        border-top: 1px solid #d1d5db;
        padding-top: 18px;
      }
      @media print {
        body { padding: 24px; }
        .summary { page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="logo">Joanna's Nook</div>
      <div class="subtitle">Madroño St., Brgy 4, Balingasag, Misamis Oriental</div>
      <div class="bill-title">Official Order Bill</div>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <div class="info-label">Invoice Number</div>
        <div class="info-value">${invoiceId}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Date & Time</div>
        <div class="info-value">${formattedDate} at ${formattedTime}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Customer</div>
        <div class="info-value">${customer}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Cashier</div>
        <div class="info-value">${cashier}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Payment Method</div>
        <div class="info-value">${paymentMethod}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Discount</div>
        <div class="info-value">${discountLabel}</div>
      </div>
      ${roomBillingSection}
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 60px; text-align: center;">#</th>
          <th>Description</th>
          <th style="width: 100px; text-align: center;">Qty</th>
          <th style="width: 120px; text-align: right;">Unit Price</th>
          <th style="width: 120px; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-row">
        <span>Subtotal</span>
        <span>₱${subtotal.toFixed(2)}</span>
      </div>
      <div class="summary-row">
        <span>Discount</span>
        <span>₱${discount.toFixed(2)}</span>
      </div>
      <div class="summary-row total">
        <span>Total Due</span>
        <span>₱${total.toFixed(2)}</span>
      </div>
    </div>

    <div class="footer">
      <p><strong>Thank you for dining with us!</strong></p>
      <p style="margin-top: 6px;">This document serves as an official bill for the order listed above.</p>
      <p style="margin-top: 6px;">For questions, please contact our front desk staff.</p>
    </div>

    <script>
      window.onload = function() {
        window.print();
        setTimeout(function(){ window.close(); }, 400);
      };
    </script>
  </body>
</html>`;
  console.log("buildBillHtml returning HTML with length:", html.length);
  return html;
};const buildReceiptHtml = (receipt, width) => {
  const invoiceId = coalesce(receipt, ["invoiceId", "invoice_id"], "N/A");
  const dateInput = coalesce(receipt, ["date", "created_at"], new Date().toISOString());
  const cashier = coalesce(receipt, ["cashier", "cashier_name"], "Unknown");
  const customer = coalesce(receipt, ["customer", "customer_name"], "Guest");
  const discountType = coalesce(
    receipt,
    ["discountType", "discount_type"],
    "none"
  );
  const paymentMethod = coalesce(
    receipt,
    ["paymentMethod", "payment_method"],
    "N/A"
  );
  const amountGiven = Number(coalesce(receipt, ["cashGiven", "amountGiven", "amount_given", "cash_given"], 0)) || 0;
  const subtotal = Number(coalesce(receipt, ["subtotal"], 0)) || 0;
  const discount = Number(coalesce(receipt, ["discount"], 0)) || 0;
  const total = Number(coalesce(receipt, ["total"], 0)) || 0;

  const items = normalizeReceiptItems(coalesce(receipt, ["items"], []));

  const parsedDate = new Date(dateInput);
  const formattedDate = parsedDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const formattedTime = parsedDate.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines = items
    .map((item) => {
      const name = coalesce(item, ["name", "title", "item"], "Item");
      const quantity = Number(coalesce(item, ["quantity", "qty"], 0)) || 0;
      const price = Number(coalesce(item, ["price", "unit_price"], 0)) || 0;
      const subtotalLine =
        Number(coalesce(item, ["subtotal", "total", "amount"], price * quantity)) ||
        price * quantity;

      return `
        <tr>
          <td class="item-name">${name}</td>
          <td class="item-qty">${quantity}</td>
          <td class="item-price">₱${price.toFixed(2)}</td>
          <td class="item-total">₱${subtotalLine.toFixed(2)}</td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${invoiceId}</title>
    <style>
      :root { --receipt-width: ${width}; }
      @page { size: var(--receipt-width) auto; margin: 6mm; }
      body {
        font-family: "Arial", "Helvetica", sans-serif;
        width: var(--receipt-width);
        margin: 0 auto;
        color: #111;
        font-size: 11px;
      }
      .receipt {
        padding: 8px;
      }
      .header {
        text-align: center;
        margin-bottom: 8px;
      }
      .header h1 {
        font-size: 14px;
        margin: 0;
        letter-spacing: 0.5px;
      }
      .header p {
        margin: 2px 0;
        font-size: 10px;
      }
      .meta {
        border-top: 1px dashed #999;
        border-bottom: 1px dashed #999;
        padding: 6px 0;
        margin: 6px 0;
      }
      .meta-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 2px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 6px;
      }
      thead th {
        text-align: left;
        font-size: 10px;
        border-bottom: 1px dashed #999;
        padding-bottom: 4px;
      }
      tbody td {
        padding: 4px 0;
        vertical-align: top;
      }
      .item-name {
        width: 45%;
        font-size: 11px;
        font-weight: 600;
      }
      .item-qty,
      .item-price,
      .item-total {
        width: 18%;
        text-align: right;
        font-size: 11px;
      }
      .summary {
        border-top: 1px dashed #999;
        padding-top: 6px;
        margin-top: 6px;
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 2px;
      }
      .summary-row.total {
        font-weight: 700;
        font-size: 12px;
        margin-top: 4px;
      }
      .footer {
        margin-top: 10px;
        text-align: center;
        font-size: 10px;
        border-top: 1px dashed #999;
        padding-top: 6px;
      }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header">
        <h1>Joanna's Nook</h1>
        <p>Madroño St., Brgy 4, Balingasag, Misamis Oriental</p>
      </div>
      <div class="meta">
        <div class="meta-row"><span>Invoice:</span><span>${invoiceId}</span></div>
        <div class="meta-row"><span>Date:</span><span>${formattedDate}</span></div>
        <div class="meta-row"><span>Time:</span><span>${formattedTime}</span></div>
        <div class="meta-row"><span>Cashier:</span><span>${cashier}</span></div>
        <div class="meta-row"><span>Customer:</span><span>${customer}</span></div>
        <div class="meta-row"><span>Payment:</span><span>${paymentMethod}</span></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th style="text-align:right">Qty</th>
            <th style="text-align:right">Price</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${lines}</tbody>
      </table>
      <div class="summary">
        <div class="summary-row"><span>Subtotal</span><span>₱${subtotal.toFixed(2)}</span></div>
        <div class="summary-row"><span>Discount (${discountType})</span><span>₱${discount.toFixed(2)}</span></div>
        <div class="summary-row total"><span>Total</span><span>₱${total.toFixed(2)}</span></div>
        ${paymentMethod && paymentMethod.toLowerCase() === 'cash' && amountGiven > 0 ? `
          <div class="summary-row"><span>Amount Given</span><span>₱${amountGiven.toFixed(2)}</span></div>
          <div class="summary-row"><span>Change</span><span>₱${(amountGiven - total).toFixed(2)}</span></div>
        ` : ''}
      </div>
      <div class="footer">
        <p>Thank you for dining with us!</p>
        <p>This serves as an official receipt.</p>
      </div>
    </div>
    <script>
      window.onload = function() {
        window.print();
        setTimeout(function(){ window.close(); }, 300);
      };
    </script>
  </body>
</html>`;
};

  const testBillGeneration = () => {
    const testData = {
      invoiceId: "TEST-001",
      customer: "Test Customer",
      cashier: "Test Cashier",
      paymentMethod: "Cash",
      discountType: "none",
      subtotal: 100,
      discount: 0,
      total: 100,
      items: [
        { name: "Test Item", quantity: 1, price: 100, subtotal: 100 }
      ],
      date: new Date().toISOString()
    };

    console.log("Testing bill generation with data:", testData);
    const html = buildBillHtml(testData, null);
    console.log("Generated test HTML:", html);

    // Open a test window to see if HTML renders
    const testWin = window.open("", "_blank", "width=800,height=600,scrollbars=yes,resizable=yes");
    if (testWin) {
      testWin.document.open();
      testWin.document.write(html);
      testWin.document.close();
    } else {
      console.error("Test window blocked");
    }
  };export default function POS({ isLoading, isNarrow }) {
  const { user, isInitialized, token } = useAuth();
  const router = useRouter();

  const [cartItems, setCartItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [discountType, setDiscountType] = useState("none");
  const [discountList, setDiscountList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dishes, setDishes] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [customerName, setCustomerName] = useState("Guest");
  const [chargeToRoom, setChargeToRoom] = useState(false);
  const [reservationOptions, setReservationOptions] = useState([]);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showGcashModal, setShowGcashModal] = useState(false);
  const [cashGiven, setCashGiven] = useState("");
  const [toasts, setToasts] = useState([]);
  const [receiptWidth, setReceiptWidth] = useState("80mm");
  const [lastSavedReceipt, setLastSavedReceipt] = useState(null);
  const [lastReceiptSignature, setLastReceiptSignature] = useState(null);
  const [roomCustomers, setRoomCustomers] = useState([]);

  const itemsPerPage = 9;

  const pushToast = (type, message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    return id;
  };

  const removeToast = (id) => setToasts((prev) => prev.filter((toast) => toast.id !== id));

  useEffect(() => {
    if (isInitialized && !user) {
      router.push("/components/sign-in");
    }
  }, [isInitialized, user, router]);

  useEffect(() => {
    if (!user || !token) {
      return;
    }
    const fetchData = async () => {
      try {
        const dishesResponse = await fetch("/api/cafe_dishes", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!dishesResponse.ok) {
          throw new Error("Failed to fetch dishes");
        }
        const dishesData = await dishesResponse.json();
        const normalized = dishesData.map((dish) => ({
          ...dish,
          price: Number(dish.price) || 0,
        }));
        setDishes(normalized);
        const rawCategories = normalized
          .map((dish) => dish.category?.trim())
          .filter(Boolean);
        setCategories(["All", ...new Set(rawCategories)].sort());
      } catch (error) {
        console.error("Dishes fetch failed", error);
        toastError("Load failed", "Unable to load dishes");
      }
    };

    fetchData();
  }, [token, user]);

  useEffect(() => {
    if (!token) return;
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const disc = data?.billing?.discount?.default || data?.billing?.discount || null;
        const list = Array.isArray(data?.billing?.discount?.list)
          ? data.billing.discount.list
          : Array.isArray(data?.billing?.discount)
          ? data.billing.discount
          : [];
        if (disc) setDiscountType(disc);
        if (Array.isArray(list)) setDiscountList(list);
      } catch (error) {
        console.warn("Failed to load billing settings", error);
      }
    };
    loadSettings();
  }, [token]);

  // Fetch room customers for dropdown when charge to room is enabled
  useEffect(() => {
    if (!token || !chargeToRoom) {
      setRoomCustomers([]);
      return;
    }
    const fetchRoomCustomers = async () => {
      try {
        const res = await fetch("/api/room?scope=billing", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        // API returns { roomReservations: [...] }
        const reservations = Array.isArray(data?.roomReservations) ? data.roomReservations : (Array.isArray(data) ? data : []);
        // Filter active reservations (not checked out yet)
        const activeCustomers = reservations.filter((r) => {
          if (!r.customer_name || !r.room_number) return false;
          // Include confirmed/occupied/reserved status and check if checkout date is in the future
          const status = (r.status || '').toLowerCase();
          const isActive = ['confirmed', 'occupied', 'reserved'].includes(status);
          const notCheckedOut = r.check_out_date ? new Date(r.check_out_date) > new Date() : true;
          return isActive && notCheckedOut;
        });
        setRoomCustomers(activeCustomers);
      } catch (error) {
        console.warn("Failed to fetch room customers", error);
      }
    };
    fetchRoomCustomers();
  }, [token, chargeToRoom]);

  const filteredDishes = useMemo(() => {
    const byCategory = dishes.filter((dish) =>
      activeCategory === "All" ? true : dish.category === activeCategory
    );
    const term = searchTerm.trim().toLowerCase();
    if (!term) return byCategory;
    return byCategory.filter((dish) =>
      dish.name?.toLowerCase().includes(term) || dish.description?.toLowerCase().includes(term)
    );
  }, [dishes, activeCategory, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredDishes.length / itemsPerPage));
  const paginatedDishes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredDishes.slice(start, start + itemsPerPage);
  }, [filteredDishes, currentPage]);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );

  const discount = (() => {
    try {
      const normalizedKey = discountType?.toString?.().toLowerCase?.();
      const found = discountList.find((entry) => {
        const key = entry.key || entry.label?.toLowerCase().replace(/\s+/g, "-");
        return key === normalizedKey;
      });
      const percent = found ? Number(found.percent) || 0 : 0;
      return subtotal * (percent / 100);
    } catch (error) {
      return 0;
    }
  })();

  const total = Math.max(0, subtotal - discount);

  const addToCart = (dish) => {
    const price = Number(dish.price) || 0;
    if (price <= 0) {
      Swal.fire({
        icon: "warning",
        title: "No price",
        text: "This dish has no price set.",
      });
      return;
    }

    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === dish.id);
      if (existing) {
        return prev.map((item) =>
          item.id === dish.id
            ? { ...item, quantity: Number(item.quantity || 0) + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          ...dish,
          price,
          quantity: 1,
          type: "dish",
        },
      ];
    });
  };

  const removeFromCart = (id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id, quantity) => {
    if (quantity < 1) {
      removeFromCart(id);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => {
    setCartItems([]);
    setDiscountType("none");
    setPaymentMethod("");
    setLastSavedReceipt(null);
    setLastReceiptSignature(null);
  };

  const checkActiveReservation = async (customerName) => {
    if (!token || !customerName?.trim()) return null;

    try {
      const response = await fetch("/api/room?scope=billing", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        console.error("Failed to fetch room billing data");
        return null;
      }

      const data = await response.json();
      const activeReservations = data.roomReservations.filter(res =>
        res.customer_name?.toLowerCase() === customerName.toLowerCase() &&
        res.status === 'confirmed' &&
        new Date(res.check_out_date) > new Date()
      );

      return activeReservations.length > 0 ? activeReservations[0] : null;
    } catch (error) {
      console.error('Error checking active reservation:', error);
      return null;
    }
  };

  const generateCafeBillForRoom = async (reservationId, customerNameArg, totalAmount, invoiceId, methodOverride) => {
    if (!token || !customerNameArg?.trim() || totalAmount <= 0) return null;

    try {
      let activeReservation = null;

      // If a reservationId was explicitly provided (via selection), prefer that
      if (reservationId) {
        try {
          const res = await fetch(`/api/room?scope=billing`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            const found = data.roomReservations.find(r => Number(r.id) === Number(reservationId));
            if (found) activeReservation = found;
          }
        } catch (e) {
          console.warn('Failed to validate reservation id:', e);
        }
      }

      // Fallback: try name-based lookup if no explicit reservation selected
      if (!activeReservation) {
        activeReservation = await checkActiveReservation(customerNameArg.trim());
      }

      if (!activeReservation) {
        console.log(`No active reservation found for customer: ${customerNameArg}`);
        return null;
      }

      // Create cafe payment record linked to the reservation
      const paymentData = {
        reservationId: activeReservation.id,
        amount: totalAmount,
        type: 'cafe',
        // when charging to room, allow overriding the payment method (e.g. 'charge_to_room')
        method: methodOverride || paymentMethod || 'cash',
        note: `Cafe order - Invoice: ${invoiceId}`,
      };

      const paymentResponse = await fetch("/api/payments", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(paymentData),
      });

      if (!paymentResponse.ok) {
        let errorData = null;
        try {
          const text = await paymentResponse.text();
          try {
            errorData = JSON.parse(text || "{}");
          } catch (e) {
            errorData = { message: text };
          }
        } catch (e) {
          errorData = { message: 'No response body' };
        }
        console.error('Failed to create cafe payment:', paymentResponse.status, errorData);
        // show a user-friendly toast so cashier knows it failed and why (if available)
        const msg = errorData?.error || errorData?.message || 'Unknown error creating payment';
        try {
          toastError('Payment failed', `Failed to add to room: ${msg}`);
        } catch (e) {
          console.warn('toastError not available', e);
        }
        return null;
      }

      const paymentResult = await paymentResponse.json();
      console.log('Cafe payment created successfully:', paymentResult);

      return {
        reservation: activeReservation,
        payment: paymentResult.payment,
        totals: paymentResult.totals,
      };
    } catch (error) {
      console.error('Error generating cafe bill for room:', error);
      return null;
    }
  };

  const sendToChef = async (invoiceId, items) => {
    if (!token || !items.length) return;
    try {
      const dishItems = items.map((item) => ({
        id: item.id,
        type: "dish",
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: Number(item.price) * Number(item.quantity),
      }));

      await fetch("/api/chef-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invoice_id: invoiceId,
          customer_name: customerName || "Guest",
          items: dishItems,
        }),
      });
    } catch (error) {
      console.error("Failed to send order to kitchen", error);
    }
  };

  const computeReceiptSignature = () => {
    const payload = {
      items: cartItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
      })),
      discountType,
      paymentMethod,
      customerName: customerName?.trim() || "Guest",
      subtotal,
      discount,
      total,
    };
    try {
      return JSON.stringify(payload);
    } catch (error) {
      return null;
    }
  };

  const saveReceipt = async () => {
    if (!token) return null;

    const signature = computeReceiptSignature();
    if (signature && lastSavedReceipt && lastReceiptSignature === signature) {
      return lastSavedReceipt;
    }

    const now = new Date();
    const invoiceId = generateInvoiceId();

    const receiptPayload = {
      invoiceId,
      cashier: user ? user.name : "Unknown",
      customer: customerName || "Guest",
      items: cartItems.map((item) => ({
        id: item.id,
        type: "dish",
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: Number(item.price) * Number(item.quantity),
      })),
      subtotal,
      discount,
      discountType,
      total,
      paymentMethod: paymentMethod || "N/A",
      date: now.toISOString(),
      // Include cash given when paying by cash so it can be printed on the receipt
      ...(paymentMethod === 'Cash' && cashGiven !== '' ? { cashGiven: Number(cashGiven) || 0 } : {}),
    };

    const response = await fetch("/api/receipts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(receiptPayload),
    });

    if (!response.ok) {
      return null;
    }

    const savedRow = await response.json();
    const storedItems = normalizeReceiptItems(savedRow.items || receiptPayload.items);
    const normalized = {
      ...receiptPayload,
      ...savedRow,
      invoiceId,
      invoice_id: savedRow.invoice_id || savedRow.id || invoiceId,
      items: storedItems,
      paymentMethod: savedRow.payment_method || receiptPayload.paymentMethod,
      payment_method: savedRow.payment_method || receiptPayload.paymentMethod,
      cashier: savedRow.cashier || receiptPayload.cashier,
      customer: savedRow.customer || receiptPayload.customer,
      subtotal: Number(savedRow.subtotal ?? receiptPayload.subtotal) || 0,
      discount: Number(savedRow.discount ?? receiptPayload.discount) || 0,
      total: Number(savedRow.total ?? receiptPayload.total) || 0,
      created_at: savedRow.created_at || receiptPayload.date,
      date: receiptPayload.date,
    };

    await sendToChef(invoiceId, cartItems);
    setLastSavedReceipt(normalized);
    setLastReceiptSignature(signature);
    return normalized;
  };

  const printReceiptFromData = (receiptData, targetWindow = null) => {
    console.log("Printing receipt with data:", receiptData);
    const html = buildReceiptHtml(receiptData, receiptWidth);
    console.log("Generated HTML length:", html.length);
    const win = targetWindow || window.open("", "_blank", "width=400,height=600,scrollbars=yes,resizable=yes");
    if (!win) {
      Swal.fire({
        icon: "warning",
        title: "Popup blocked",
        text: "Allow popups to print the receipt.",
      });
      return;
    }
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
      console.log("Receipt HTML written to window");
    } catch (error) {
      console.error("Failed to render receipt", error);
      try {
        win.close();
      } catch (closeErr) {
        console.warn("Unable to close receipt window", closeErr);
      }
      throw error;
    }
  };

  const printBillFromData = (receiptData, targetWindow = null, roomBillingData = null) => {
    console.log("Printing bill with data:", receiptData);
    console.log("Room billing data:", roomBillingData);
    const html = buildBillHtml(receiptData, roomBillingData);
    console.log("Generated bill HTML length:", html.length);
    console.log("Generated bill HTML preview:", html.substring(0, 500));
    const win = targetWindow || window.open("", "_blank", "width=800,height=600,scrollbars=yes,resizable=yes");
    if (!win) {
      Swal.fire({
        icon: "warning",
        title: "Popup blocked",
        text: "Allow popups to print the bill.",
      });
      return;
    }
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
      console.log("Bill HTML written to window successfully");
    } catch (error) {
      console.error("Failed to render bill", error);
      try {
        win.close();
      } catch (closeErr) {
        console.warn("Unable to close bill window", closeErr);
      }
      throw error;
    }
  };

  const openPrintWindow = (type) => {
    console.log(`Opening print window for type: ${type}`);
    const dimensions = type === "bill" ? "width=800,height=600" : "width=400,height=600";
    const win = window.open("", "_blank", `${dimensions},scrollbars=yes,resizable=yes`);
    console.log(`Print window opened:`, win);
    return win;
  };

  const testBillGeneration = () => {
    console.log("Testing bill generation...");
    const testData = {
      invoiceId: "TEST-001",
      cashier: "Test Cashier",
      customer: "Test Customer",
      items: [
        { id: 1, name: "Test Dish 1", quantity: 2, price: 100, subtotal: 200 },
        { id: 2, name: "Test Dish 2", quantity: 1, price: 150, subtotal: 150 }
      ],
      subtotal: 350,
      discount: 35,
      discountType: "senior",
      total: 315,
      paymentMethod: "Cash",
      date: new Date().toISOString()
    };
    console.log("Test data:", testData);
    const html = buildBillHtml(testData);
    console.log("Generated test HTML length:", html.length);
    console.log("Generated test HTML preview:", html.substring(0, 500));
    const win = openPrintWindow("bill");
    if (!win) {
      Swal.fire({
        icon: "warning",
        title: "Popup blocked",
        text: "Allow popups to test bill generation.",
      });
      return;
    }
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
      console.log("Test bill HTML written to window successfully");
    } catch (error) {
      console.error("Failed to render test bill", error);
      try {
        win.close();
      } catch (closeErr) {
        console.warn("Unable to close test bill window", closeErr);
      }
    }
  };

  const handlePrintReceipt = async () => {
    if (!token) {
      modalAlert("Not authenticated", "You must sign in to print receipts", "error");
      return;
    }
    if (!cartItems.length) {
      modalAlert("Cart empty", "Add dishes before printing a receipt", "warning");
      return;
    }
    const printWindow = openPrintWindow("receipt");
    if (!printWindow) {
      Swal.fire({
        icon: "warning",
        title: "Popup blocked",
        text: "Allow popups for this site to print receipts.",
      });
      return;
    }
    try {
      const saved = await saveReceipt();
      if (saved) {
        notifySuccess("added", "Receipt printed", "Receipt printed successfully. Use 'Process Payment' to clear the cart.");
        printReceiptFromData(saved, printWindow);
        // Don't clear cart here - only clear on Process Payment
      } else {
        toastError("Save failed", "Receipt could not be saved");
        try {
          printWindow.close();
        } catch (closeErr) {
          console.warn("Failed to close receipt window", closeErr);
        }
      }
    } catch (error) {
      console.error("Receipt print error", error);
      toastError("Print failed", "Unexpected error while printing receipt");
      try {
        printWindow.close();
      } catch (closeErr) {
        console.warn("Failed to close receipt window", closeErr);
      }
    }
  };

  const handleGenerateBill = async () => {
    if (!token) {
      modalAlert("Not authenticated", "You must sign in to generate a bill", "error");
      return;
    }
    if (!cartItems.length) {
      modalAlert("Cart empty", "Add dishes before generating a bill", "warning");
      return;
    }
    const printWindow = openPrintWindow("bill");
    if (!printWindow) {
      Swal.fire({
        icon: "warning",
        title: "Popup blocked",
        text: "Allow popups for this site to print bills.",
      });
      return;
    }
    try {
      const saved = await saveReceipt();
      if (saved) {
        // Try to add cafe bill to room billing only if Charge to room is enabled
        let roomBillingResult = null;
        if (chargeToRoom && customerName && customerName.trim() !== "Guest") {
          roomBillingResult = await generateCafeBillForRoom(
            selectedReservation ? selectedReservation.id : null,
            customerName.trim(),
            saved.total,
            saved.invoiceId,
            'charge_to_room'
          );

          if (roomBillingResult) {
            notifySuccess("added", "Cafe bill added to room", `Bill added to ${customerName}'s room account`);
            try {
              // Notify other tabs/pages to refresh billing summary
              localStorage.setItem('billing_updated_at', new Date().toISOString());
            } catch (e) {
              console.warn('Failed to set billing_updated_at in localStorage', e);
            }
          }
        }

        notifySuccess("added", "Bill generated", "Bill generated successfully. Use 'Process Payment' to clear the cart.");
        printBillFromData(saved, printWindow, roomBillingResult);
        // Don't clear cart here - only clear on Process Payment
      } else {
        toastError("Bill failed", "Unable to save bill data");
        try {
          printWindow.close();
        } catch (closeErr) {
          console.warn("Failed to close bill window", closeErr);
        }
      }
    } catch (error) {
      console.error("Bill generation error", error);
      toastError("Bill failed", "Unexpected error while generating bill");
      try {
        printWindow.close();
      } catch (closeErr) {
        console.warn("Failed to close bill window", closeErr);
      }
    }
  };

  const processPayment = async () => {
    if (!cartItems.length || !paymentMethod) {
      return;
    }
    setProcessingPayment(true);
    const printWindow = openPrintWindow("receipt");
    if (!printWindow) {
      toastError("Popup blocked", "Enable popups to print the receipt");
      setProcessingPayment(false);
      return;
    }
    try {
      const saved = await saveReceipt();
      if (saved) {
        // Try to add cafe bill to room billing only if Charge to room is enabled
        let roomBillingResult = null;
        if (chargeToRoom && customerName && customerName.trim() !== "Guest") {
          roomBillingResult = await generateCafeBillForRoom(
            selectedReservation ? selectedReservation.id : null,
            customerName.trim(),
            saved.total,
            saved.invoiceId,
            'charge_to_room'
          );

          if (roomBillingResult) {
            notifySuccess("added", "Cafe bill added to room", `Bill added to ${customerName}'s room account`);
          }
        }

        notifySuccess("added", "Payment recorded", "Payment processed successfully");
        printReceiptFromData(saved, printWindow);
        
        // Delete chef orders after successful payment
        try {
          await fetch(`/api/chef-orders?invoice_id=${saved.invoiceId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (deleteError) {
          console.warn("Failed to delete chef orders", deleteError);
        }
        
        clearCart();
      } else {
        toastError("Payment failed", "Unable to save receipt");
        try {
          printWindow.close();
        } catch (closeErr) {
          console.warn("Failed to close receipt window", closeErr);
        }
      }
    } catch (error) {
      console.error("Payment error", error);
      toastError("Payment failed", "Unexpected error occurred");
      try {
        printWindow.close();
      } catch (closeErr) {
        console.warn("Failed to close receipt window", closeErr);
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="min-h-full bg-white rounded-lg p-6">
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            onClose={removeToast}
          />
        ))}
      </div>

      <div className="w-full overflow-x-auto">
        <div className="min-w-[1024px] w-full mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="flex flex-row">
            <div className="w-2/3 p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex flex-wrap gap-2">
                  {isNarrow ? (
                    <select
                      aria-label="Select category"
                      className="w-48 p-2 border border-gray-300 rounded-lg text-gray-800"
                      value={activeCategory}
                      onChange={(event) => {
                        setActiveCategory(event.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  ) : (
                    categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => {
                          setActiveCategory(category);
                          setCurrentPage(1);
                        }}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                          activeCategory === category
                            ? "bg-green-600 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {category}
                      </button>
                    ))
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Search dishes..."
                  className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedDishes.map((dish) => (
                  <button
                    type="button"
                    key={dish.id}
                    onClick={() => addToCart(dish)}
                    className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md text-left transition-all duration-200"
                  >
                    <h3 className="font-semibold text-lg text-gray-800">{dish.name}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{dish.description}</p>
                    <p className="font-bold text-green-600 mt-2">
                      ₱{typeof dish.price === "number" ? dish.price.toFixed(2) : "0.00"}
                    </p>
                  </button>
                ))}

                {!paginatedDishes.length && (
                  <div className="col-span-full text-center py-10 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                    No dishes found for the selected filters.
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex justify-center items-center space-x-2">
                  <button
                    onClick={handlePreviousPage}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      currentPage === 1
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        currentPage === page
                          ? "bg-green-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={handleNextPage}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      currentPage === totalPages
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            <div className="w-1/3 p-6">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Current Order</h2>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cashier</label>
                  <input
                    type="text"
                    readOnly
                    className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
                    value={user ? user.name : "Unknown"}
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name</label>
                  {chargeToRoom ? (
                    <select
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700"
                      value={selectedReservation ? selectedReservation.id : ""}
                      onChange={(e) => {
                        const selected = roomCustomers.find(r => r.id === parseInt(e.target.value));
                        if (selected) {
                          setSelectedReservation(selected);
                          setCustomerName(`${selected.customer_name} (Room ${selected.room_number || 'N/A'})`);
                        } else {
                          setSelectedReservation(null);
                          setCustomerName("Guest");
                        }
                      }}
                    >
                      <option value="">Select Customer</option>
                      {roomCustomers.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.customer_name} - Room {r.room_number || 'N/A'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700"
                      placeholder="Enter customer name"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setSelectedReservation(null);
                      }}
                    />
                  )}
                </div>

                <div className="mb-4 flex items-center space-x-2">
                  <input
                    id="chargeToRoom"
                    type="checkbox"
                    checked={chargeToRoom}
                    onChange={(e) => {
                      const checked = Boolean(e.target.checked);
                      setChargeToRoom(checked);
                      // When enabling Charge to Room, clear payment selections to avoid confusion
                      if (checked) {
                        setPaymentMethod("");
                        setCashGiven("");
                        // keep customer/selection as-is; cashier can choose from dropdown when chargeToRoom is enabled
                      } else {
                        // Reset reservation and default customer when disabling
                        setSelectedReservation(null);
                        setCustomerName("Guest");
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <label htmlFor="chargeToRoom" className="text-sm text-gray-700">Charge to room</label>
                  {chargeToRoom && selectedReservation && (
                    <div className="ml-2 text-sm text-gray-600">Selected: {selectedReservation.customer_name} (Room {selectedReservation.room_number || 'N/A'})</div>
                  )}
                </div>

                <div className="w-full text-center mb-3">
                  <h4 className="text-sm font-bold text-green-600 mb-2">Ordered Dishes</h4>
                </div>

                <div className="mb-6 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  {cartItems.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No dishes selected</p>
                  ) : (
                    cartItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center py-3 border-b border-gray-200"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{item.name}</p>
                          <p className="text-xs text-gray-500">
                            ₱{Number(item.price || 0).toFixed(2)} x {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, Number(item.quantity || 0) - 1)}
                            className="p-1 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors duration-200"
                          >
                            <MinusIcon className="h-4 w-4 text-gray-600" />
                          </button>
                          <span className="text-sm text-gray-700 w-8 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, Number(item.quantity || 0) + 1)}
                            className="p-1 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors duration-200"
                          >
                            <PlusIcon className="h-4 w-4 text-gray-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="p-1 bg-red-100 rounded-full hover:bg-red-200 transition-colors duration-200"
                          >
                            <XMarkIcon className="h-4 w-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-center mb-4">
                  <button
                    type="button"
                    onClick={clearCart}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Clear
                  </button>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700"
                    value={discountType}
                    onChange={(event) => setDiscountType(event.target.value)}
                  >
                    <option value="none">No Discount</option>
                    {discountList && discountList.length > 0 ? (
                      discountList.map((entry, index) => (
                        <option
                          key={entry.key || `${entry.label}-${index}`}
                          value={entry.key || entry.label?.toLowerCase().replace(/\s+/g, "-")}
                        >
                          {entry.label} ({entry.percent}%)
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="senior">Senior Citizen (20%)</option>
                        <option value="pwd">PWD (20%)</option>
                        <option value="employee">Employee (10%)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                  {chargeToRoom && (
                    <p className="text-xs text-gray-500 mt-1">Payment methods are disabled when <strong>Charge to room</strong> is checked</p>
                  )}
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (chargeToRoom) return; // defensive: ignore clicks if disabled
                        setPaymentMethod("Cash");
                        // preserve any existing cashGiven; allow cashier to enter/adjust
                      }}
                      disabled={chargeToRoom}
                      aria-disabled={chargeToRoom}
                      title={chargeToRoom ? "Payment method disabled when 'Charge to room' is checked" : "Select Cash payment"}
                      className={`flex-1 p-3 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        paymentMethod === "Cash"
                          ? "bg-green-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      } ${chargeToRoom ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}`}
                    >
                      <BanknotesIcon className="h-5 w-5 mr-2" />
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (chargeToRoom) return; // defensive: ignore clicks if disabled
                        setPaymentMethod("Gcash");
                        setShowGcashModal(true);
                        // Clear cash given when switching away from Cash
                        setCashGiven("");
                      }}
                      disabled={chargeToRoom}
                      aria-disabled={chargeToRoom}
                      title={chargeToRoom ? "Payment method disabled when 'Charge to room' is checked" : "Select GCash payment"}
                      className={`flex-1 p-3 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        paymentMethod === "Gcash"
                          ? "bg-green-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      } ${chargeToRoom ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}`}
                    >
                      <CreditCardIcon className="h-5 w-5 mr-2" />
                      GCash
                    </button>
                  </div>
                </div>

                {paymentMethod === "Cash" && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount Given</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={cashGiven}
                      onChange={(e) => setCashGiven(e.target.value)}
                      placeholder="Enter cash amount received"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700"
                    />
                  </div>
                )}

                <div className="mb-6 bg-gray-100 p-4 rounded-lg">
                  <div className="flex justify-between text-sm text-gray-700 mb-2">
                    <span>Subtotal</span>
                    <span>₱{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-700 mb-2">
                    <span>Discount ({discountType})</span>
                    <span>₱{discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg text-gray-800">
                    <span>Total</span>
                    <span>₱{total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-3 mb-5">
                  <button
                    type="button"
                    onClick={handleGenerateBill}
                    className={`w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center transition-all duration-200 shadow-md ${
                      // When charging to room, bypass paymentMethod requirement and only require a selected customer (or non-empty name)
                      cartItems.length === 0 || (chargeToRoom ? (!customerName || customerName.trim() === "" || customerName.trim().toLowerCase() === "default") : !paymentMethod)
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    }`}
                    disabled={cartItems.length === 0 || (chargeToRoom ? (!customerName || customerName.trim() === "" || customerName.trim().toLowerCase() === "default") : !paymentMethod)}
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Send to Bill
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintReceipt}
                    className={`w-full p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center transition-all duration-200 shadow-md ${
                      cartItems.length === 0 || !paymentMethod || (chargeToRoom && (!customerName || customerName.trim() === "" || customerName.trim().toLowerCase() === "default"))
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    }`}
                    disabled={cartItems.length === 0 || !paymentMethod || (chargeToRoom && (!customerName || customerName.trim() === "" || customerName.trim().toLowerCase() === "default"))}
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print Receipt
                  </button>

                  <button
                    type="button"
                    onClick={processPayment}
                    className={`w-full p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center transition-all duration-200 shadow-md ${
                      cartItems.length === 0 || !paymentMethod || processingPayment || chargeToRoom
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    }`}
                    disabled={cartItems.length === 0 || !paymentMethod || processingPayment || chargeToRoom}
                  >
                    <ShoppingCartIcon className="h-5 w-5 mr-2" />
                    {processingPayment ? "Processing..." : "Process Payment"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showGcashModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => setShowGcashModal(false)}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-lg font-semibold mb-3">GCash QR</h3>
            <div className="flex justify-center">
              <img src="/Gcash Qr.png" alt="Gcash QR" className="max-h-80 object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
