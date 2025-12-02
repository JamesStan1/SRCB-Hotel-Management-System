"use client";

import { useState, useEffect, useCallback } from "react";
import useIsNarrow from '../../lib/useIsNarrow';
import { useAuth } from "../../context/AuthContext";
import { canAccessArchives } from '../../lib/rbac';
import { apiFetch } from '../../lib/apiClient';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import { useMemo } from 'react';

const TABS = ["Room", "Kitchen", "Event", "Catering", "Other"];

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener("mouseenter", Swal.stopTimer);
    toast.addEventListener("mouseleave", Swal.resumeTimer);
  },
});

const handleError = (error, defaultMessage = "An unexpected error occurred") => {
  console.error("Error:", error);
  return Toast.fire({
    icon: "error",
    title: error.message || defaultMessage,
  });
};

const handleSuccess = (message) => {
  return Toast.fire({
    icon: "success",
    title: message,
  });
};

export default function InventoryManagement() {
  const { token, isInitialized, user } = useAuth();
  const canArchive = canAccessArchives(user?.role);
  const [activeTab, setActiveTab] = useState("Room");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [withdrawItem, setWithdrawItem] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawNote, setWithdrawNote] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activity, setActivity] = useState([]);
  const isNarrow = useIsNarrow();
  // add/withdraw functionality removed per request; activity is read-only via audit logs

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/inventory", { timeout: 10000 }, token);
      
      // Handle permission errors gracefully
      if (res.status === 403) {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.error || 'You do not have permission to access inventory';
        handleError({ message: errorMsg }, errorMsg);
        setInventory([]); // Set empty inventory to prevent further errors
        return;
      }
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch inventory: ${res.statusText}`);
      }
      
      const data = await res.json();
      setInventory(data);
    } catch (err) {
      handleError(err, "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // Wait until auth is initialized to ensure token is available when making API calls
    if (!isInitialized) return;
    fetchInventory();
  }, [fetchInventory, isInitialized]);

  const filteredInventory = [...inventory]
    .filter(
      (i) =>
        i.category === activeTab &&
        (i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          i.category.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

  const requestSort = (key) => {
    let dir = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") dir = "desc";
    setSortConfig({ key, direction: dir });
  };

  const handleAddItem = async (newItem) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...newItem, section: activeTab }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to add item");
      }

      const added = await res.json();
      setInventory((prev) => [...prev, added]);
      setShowAddModal(false);
      handleSuccess("Item added successfully!");
    } catch (err) {
      handleError(err, "Failed to add item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const item = inventory.find((item) => item.id === id);
    const itemName = item?.name || "this item";

    const { value: reason } = await Swal.fire({
      title: "Archive Item",
      text: `Please provide a reason for archiving ${itemName}:`,
      input: "textarea",
      inputPlaceholder: "Enter reason for archiving...",
      inputAttributes: {
        "aria-label": "Reason for archiving",
      },
      showCancelButton: true,
      confirmButtonText: "Archive",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      customClass: {
        confirmButton: "bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded ml-2",
        cancelButton: "bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded mr-2",
      },
      buttonsStyling: false,
      inputValidator: (value) => {
        if (!value) {
          return "You must provide a reason for archiving!";
        }
      },
    });

    if (reason) {
      setIsSubmitting(true);
      try {
        const res = await apiFetch(`/api/inventory/${id}`, { method: 'DELETE', body: { id, reason }, timeout: 10000 }, token);

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Failed to archive item');
        }

        setInventory((prev) => prev.filter((i) => i.id !== id));
        handleSuccess(`${itemName} has been archived`);
      } catch (err) {
        handleError(err, 'Failed to archive item');
      } finally {
        setIsSubmitting(false);
      }
    } else if (reason === undefined) {
      handleSuccess(`${itemName} archival cancelled`);
    }
  };

  const handleEdit = async (id) => {
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/inventory/${id}`, { timeout: 10000 }, token);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to fetch item');
      }
      const data = await res.json();
      setEditItem(data);
      setShowEditModal(true);
    } catch (err) {
      handleError(err, 'Failed to load item for editing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateItem = async (updated) => {
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/inventory/${updated.id}`, { method: 'PUT', body: updated, timeout: 10000 }, token);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update item');
      }

      const saved = await res.json();
      setInventory((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
      setShowEditModal(false);
      handleSuccess("Item updated successfully!");
    } catch (err) {
      handleError(err, "Failed to update item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleView = async (id) => {
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/inventory/${id}`, { timeout: 10000 }, token);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to fetch item');
      }
      const data = await res.json();
      setViewItem(data);
      setShowViewModal(true);
    } catch (err) {
      handleError(err, 'Failed to load item details');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenActivity = async () => {
    setShowActivityModal(true);
    try {
      const res = await apiFetch('/api/inventory/activity', { timeout: 10000 }, token);
      if (!res.ok) throw new Error('Failed to load activity');
      const data = await res.json();
      setActivity(data);
    } catch (err) {
      handleError(err, 'Failed to load activity');
    }
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Inventory</h1>
            <p className="text-sm text-gray-500 mt-1">Manage stock, view activity, and archive items</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center bg-gray-100 rounded-lg px-3 py-1">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-500 mr-2" />
              <input
                type="text"
                placeholder="Search items..."
                className="bg-transparent outline-none text-sm text-gray-700 w-48"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              disabled={isSubmitting}
              className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-700 transition ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <PlusIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Add</span>
            </button>

            <button
              onClick={handleOpenActivity}
              disabled={isSubmitting}
              className={`inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg shadow-sm hover:bg-sky-700 transition ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <EyeIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Activity</span>
            </button>

            <button
              onClick={() => {
                setWithdrawItem(null);
                setWithdrawAmount(0);
                setWithdrawNote('');
                setShowWithdrawModal(true);
              }}
              disabled={isSubmitting}
              className={`inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg shadow-sm hover:bg-orange-600 transition ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <ArrowDownIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Withdraw</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 -mx-2">
          <div className="overflow-x-auto px-2">
            {isNarrow ? (
              <div className="px-2">
                <label htmlFor="tab-select" className="sr-only">Select category</label>
                <select
                  id="tab-select"
                  className="w-full p-3 border border-gray-300 rounded-lg text-black"
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value)}
                  disabled={isSubmitting}
                >
                  {TABS.map((tab) => (
                    <option key={tab} value={tab}>{tab}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="inline-flex gap-2">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    disabled={isSubmitting}
                    className={`whitespace-nowrap px-4 py-2 rounded-md font-semibold ${
                      activeTab === tab
                        ? "bg-green-600 text-white"
                        : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 md:hidden">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search items..."
            className="pl-10 pr-4 py-2 w-full border rounded-md text-gray-700 focus:ring-2 focus:ring-emerald-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      ) : filteredInventory.length === 0 ? (
        <p className="text-black text-center py-4">No items found</p>
      ) : (
        <>
          {/* Desktop / Tablet: table */}
          <div className="hidden md:block bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { key: 'name', label: 'Name' },
                    { key: 'category', label: 'Category' },
                    { key: 'quantity', label: 'Quantity' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer"
                      onClick={() => !isSubmitting && requestSort(col.key)}
                    >
                      <div className="flex items-center">
                        <span>{col.label}</span>
                        {sortConfig.key === col.key &&
                          (sortConfig.direction === 'asc' ? (
                            <ArrowUpIcon className="h-4 w-4 ml-2 text-gray-400" />
                          ) : (
                            <ArrowDownIcon className="h-4 w-4 ml-2 text-gray-400" />
                          ))}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Threshold</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">On Delivery</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 text-gray-700">
                {filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{item.name}</td>
                    <td className="px-6 py-4 text-sm">{item.category}</td>
                    <td className="px-6 py-4 text-sm font-medium">{item.quantity}</td>
                    <td className="px-6 py-4 text-sm">{item.unit}</td>
                    <td className="px-6 py-4 text-sm">{item.threshold}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                          item.status === "In Stock"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.status === "Low Stock"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">{item.on_delivery ? "Yes" : "No"}</td>
                    <td className="px-6 py-4 text-right text-sm space-x-2">
                      <button
                        onClick={() => handleView(item.id)}
                        disabled={isSubmitting}
                        aria-label={`View ${item.name}`}
                        className={`inline-flex items-center justify-center h-8 w-8 bg-sky-50 text-sky-700 rounded-md hover:bg-sky-100 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(item.id)}
                        disabled={isSubmitting}
                        aria-label={`Edit ${item.name}`}
                        className={`inline-flex items-center justify-center h-8 w-8 bg-amber-50 text-amber-700 rounded-md hover:bg-amber-100 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      {canArchive && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={isSubmitting}
                          aria-label={`Archive ${item.name}`}
                          className={`inline-flex items-center justify-center h-8 w-8 bg-rose-50 text-rose-700 rounded-md hover:bg-rose-100 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <div className="md:hidden space-y-4">
            {filteredInventory.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm flex flex-col">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
                    <p className="text-sm text-gray-500">{item.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-800">{item.quantity}</p>
                    <p className="text-sm text-gray-500">{item.unit}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${item.status === 'In Stock' ? 'bg-emerald-100 text-emerald-800' : item.status === 'Low Stock' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>{item.status}</span>
                    <span className="text-sm text-gray-500">{item.on_delivery ? 'On Delivery' : 'No Delivery'}</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button onClick={() => handleView(item.id)} className="flex-1 sm:flex-none w-full sm:w-auto p-3 bg-sky-600 text-white rounded-lg touch-manipulation text-center">View</button>
                    <button onClick={() => handleEdit(item.id)} className="flex-1 sm:flex-none w-full sm:w-auto p-3 bg-amber-500 text-white rounded-lg touch-manipulation text-center">Edit</button>
                    {canArchive && (
                      <button onClick={() => handleDelete(item.id)} className="flex-1 sm:flex-none w-full sm:w-auto p-3 bg-rose-600 text-white rounded-lg touch-manipulation text-center">Archive</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showAddModal && (
        <ItemModal
          title={`Add Item - ${activeTab}`}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddItem}
          isSubmitting={isSubmitting}
        />
      )}

      {showEditModal && editItem && (
        <ItemModal
          title="Edit Item"
          item={editItem}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdateItem}
          isSubmitting={isSubmitting}
        />
      )}

      {showViewModal && viewItem && (
        <ViewModal item={viewItem} onClose={() => setShowViewModal(false)} />
      )}

      {/* Removed secondary View Activity button for cleaner UI; header button remains */}

      {/* add/withdraw UI removed; adjustments should be done via Edit which logs audits */}

      {showActivityModal && (
        <ActivityModal activity={activity} onClose={() => setShowActivityModal(false)} />
      )}

      {showWithdrawModal && (
        <WithdrawModal
          items={inventory}
          item={withdrawItem}
          amount={withdrawAmount}
          note={withdrawNote}
          isSubmitting={isSubmitting}
          onClose={() => setShowWithdrawModal(false)}
          onAmountChange={(v) => setWithdrawAmount(v)}
          onNoteChange={(v) => setWithdrawNote(v)}
          onSubmit={async (selectedItemId, amount, note) => {
            // handle submission when modal provides selectedItemId
            const amt = Number(amount) || 0;
            if (amt <= 0) {
              return handleError(new Error('Please enter a positive quantity to withdraw'));
            }
            const selected = inventory.find((it) => it.id === selectedItemId);
            if (!selected) return handleError(new Error('Selected item not found'));
            if (amt > (selected.quantity || 0)) {
              return handleError(new Error('Withdraw amount exceeds available quantity'));
            }
            setIsSubmitting(true);
            try {
              const payload = { item_id: selectedItemId, amount: amt, note };
              const res = await apiFetch('/api/inventory/withdraw', { method: 'POST', body: payload, timeout: 10000 }, token);
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'Failed to withdraw item');
              }
              const result = await res.json().catch(() => ({}));
              // update local inventory
              setInventory((prev) => prev.map((it) => (it.id === selectedItemId ? { ...it, quantity: Math.max(0, (it.quantity || 0) - amt) } : it)));
              // optionally refresh activity list
              try {
                const actResp = await apiFetch('/api/inventory/activity', { timeout: 10000 }, token);
                if (actResp.ok) {
                  const acts = await actResp.json();
                  setActivity(acts);
                }
              } catch (e) {
                // ignore
              }
              setShowWithdrawModal(false);
              handleSuccess(result.message || 'Withdrawal successful');
            } catch (err) {
              handleError(err, 'Failed to withdraw item');
            } finally {
              setIsSubmitting(false);
            }
          }}
        />
      )}

      {/* Withdraw Modal Component */}
      
    </div>
  );
}

// AdjustModal removed

function ActivityModal({ activity, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 relative">
        {/* Close button - top right corner */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-bold mb-4 text-gray-700">Inventory Activity</h2>
        <div className="max-h-96 overflow-y-auto">
          {activity.length === 0 ? (
            <p className="text-gray-600">No activity found.</p>
          ) : (
            <table className="min-w-full text-green-700">
              <thead>
                <tr>
                  <th className="text-left">Item</th>
                  <th className="text-left">Change</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Note</th>
                  <th className="text-left">By</th>
                  <th className="text-left">When</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a) => (
                <tr key={a.id} className="border-t text-black">
                    <td className="py-2">{a.item_id}</td>
                    <td className={`py-2 ${a.change_amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{a.change_amount}</td>
                    <td className="py-2">{a.type}</td>
                    <td className="py-2">{a.note}</td>
                    <td className="py-2">
                      {a.performed_by_name ? (
                        <>
                          <div className="font-medium">{a.performed_by_name}</div>
                          <div className="text-xs text-green-700">{a.performed_by_role || ''}</div>
                        </>
                      ) : (
                        <div>System</div>
                      )}
                    </td>
                    <td className="py-2">{new Date(a.occurred_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded text-white hover:bg-gray-700">Close</button>
        </div>
      </div>
    </div>
  );
}

function ItemModal({ title, onClose, onSubmit, item, isSubmitting }) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        {/* Close button - top right corner */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
          aria-label="Close modal"
          disabled={isSubmitting}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-bold mb-4 text-gray-700">{title}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = e.target;
            onSubmit({
              id: item?.id,
              name: f.name.value,
              category: f.category.value,
              quantity: parseInt(f.quantity.value),
              unit: f.unit.value,
              threshold: parseInt(f.threshold.value),
              on_delivery: f.on_delivery.checked,
            });
          }}
        >
          <div className="space-y-3">
            <input
              type="text"
              name="name"
              defaultValue={item?.name || ""}
              placeholder="Name"
              required
              disabled={isSubmitting}
              className={`w-full border p-2 rounded text-gray-700 ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            />
            <select
              name="category"
              defaultValue={item?.category || ""}
              required
              disabled={isSubmitting}
              className={`w-full border p-2 rounded text-gray-700 ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <option value="">Select category</option>
              <option value="Room">Room</option>
              <option value="Event">Event</option>
              <option value="Kitchen">Kitchen</option>
              <option value="Catering">Catering</option>
              <option value="Other">Other</option>
            </select>
            <input
              type="number"
              name="quantity"
              defaultValue={item?.quantity || ""}
              placeholder="Quantity"
              required
              disabled={isSubmitting}
              className={`w-full border p-2 rounded text-gray-700 ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            />
            <select
              name="unit"
              defaultValue={item?.unit || "piece"}
              required
              disabled={isSubmitting}
              className={`w-full border p-2 rounded text-gray-700 ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <option value="piece">Piece</option>
              <option value="pack">Pack</option>
              <option value="bundle">Bundle</option>
            </select>
            <input
              type="number"
              name="threshold"
              defaultValue={item?.threshold || ""}
              placeholder="Threshold"
              required
              disabled={isSubmitting}
              className={`w-full border p-2 rounded text-gray-700 ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            />
            <label className="flex items-center space-x-2 text-black">
              <input
                type="checkbox"
                name="on_delivery"
                defaultChecked={item?.on_delivery || false}
                disabled={isSubmitting}
                className={`h-4 w-4 text-green-600 ${
                  isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
              <span>On Delivery</span>
            </label>
          </div>
          <div className="mt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`px-4 py-2 border rounded text-gray-700 bg-gray-100 hover:bg-gray-200 ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing...
                </div>
              ) : item ? (
                "Update"
              ) : (
                "Add"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewModal({ item, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        {/* Close button - top right corner */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-bold mb-4 text-green-700">View Item</h2>
        <div className="space-y-2 text-black">
          <p><strong>Name:</strong> {item.name}</p>
          <p><strong>Category:</strong> {item.category}</p>
          <p><strong>Quantity:</strong> {item.quantity}</p>
          <p><strong>Unit:</strong> {item.unit}</p>
          <p><strong>Threshold:</strong> {item.threshold}</p>
          <p><strong>Status:</strong> {item.status}</p>
          <p><strong>On Delivery:</strong> {item.on_delivery ? "✅" : "❎"}</p>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-sky-600 rounded hover:bg-sky-700 text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function WithdrawModal({ items = [], item, amount, note, isSubmitting, onClose, onAmountChange, onNoteChange, onSubmit }) {
  const [selectedId, setSelectedId] = useState(item?.id || (items && items.length > 0 ? items[0].id : null));
  const selected = item || items.find((it) => it.id === selectedId) || null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        {/* Close button - top right corner */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
          aria-label="Close modal"
          disabled={isSubmitting}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-bold mb-4 text-green-700">Withdraw Item</h2>
        <div className="text-black mb-3">
          {!selected ? (
            <p className="text-sm text-gray-600">Select an item to withdraw</p>
          ) : (
            <>
              <p><strong>Item:</strong> {selected.name}</p>
              <p><strong>Available:</strong> {selected.quantity}</p>
            </>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selected) return handleError(new Error('Please select an item'));
            onSubmit(selected.id, amount, note);
          }}
        >
          <div className="space-y-3">
            {!item && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Item</label>
                <select
                  value={selectedId || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedId(parseInt(v, 10));
                    onAmountChange(0);
                    onNoteChange('');
                  }}
                  disabled={isSubmitting}
                  className={`w-full border p-2 rounded text-gray-700 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>{`${it.name} (Available: ${it.quantity})`}</option>
                  ))}
                </select>
              </div>
            )}
            <label className="block text-sm font-medium text-gray-700">Quantity to withdraw</label>
            <input
              type="number"
              min="1"
              max={selected ? selected.quantity : undefined}
              value={amount}
              onChange={(e) => onAmountChange(Number(e.target.value))}
              required
              disabled={isSubmitting}
              className={`w-full border p-2 rounded text-gray-700 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            <label className="block text-sm font-medium text-gray-700">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              rows={3}
              disabled={isSubmitting}
              placeholder="Reason for withdrawal, e.g. used for event, spoilage"
              className={`w-full border p-2 rounded text-gray-700 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
          <div className="mt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`px-4 py-2 border rounded text-white bg-gray-500 hover:bg-gray-600 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Processing...' : 'Withdraw'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
