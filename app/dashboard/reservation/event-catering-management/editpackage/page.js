"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../context/AuthContext";
import { HomeIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { modalConfirm, modalAlert, notifySuccess } from "../../../../../lib/swal";

export default function ManagePackages() {
  const [packages, setPackages] = useState([]);
  const [editingPackage, setEditingPackage] = useState(null);
  const [packageForm, setPackageForm] = useState({ id: null, name: "", price: "", guests: "", description: "", max_per_dish: "", image: "" });
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const { token, isInitialized, user } = useAuth();
  const role = user?.role?.toLowerCase();
  const canModify = role === "admin" || role === "manager";
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        if (!isInitialized) return;
        const res = await fetch("/api/event_packages", { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to fetch packages");
        }
        const data = await res.json();
        if (mounted) setPackages(Array.isArray(data) ? data : []);
      } catch (err) {
        if (mounted) setError(err.message || String(err));
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, [isInitialized, token]);

  const handlePackageFormChange = (e) => {
    const { name, value } = e.target;
    setPackageForm((p) => ({ ...p, [name]: value }));
  };

  const startEditingPackage = (pkg = null) => {
    setEditingPackage(pkg ? pkg.id : "new");
    setPackageForm(pkg ? { id: pkg.id, name: pkg.name, price: pkg.price, guests: pkg.guests, description: pkg.description, max_per_dish: pkg.max_per_dish, image: pkg.image } : { id: null, name: "", price: "", guests: "", description: "", max_per_dish: "", image: "" });
    setError(null);
  };

  const savePackage = async () => {
    try {
      if (!packageForm.name || !packageForm.description || parseFloat(packageForm.price) < 0 || parseInt(packageForm.guests) < 1 || parseInt(packageForm.max_per_dish) < 0 || !packageForm.image) {
        throw new Error("All fields are required, and price/guests/max per dish must be valid");
      }
      if (!isInitialized) return;
      const url = editingPackage === "new" ? "/api/event_packages" : "/api/event_packages";
      const method = editingPackage === "new" ? "POST" : "PUT";
      const body = {
        name: packageForm.name,
        price: parseFloat(packageForm.price),
        guests: parseInt(packageForm.guests),
        description: packageForm.description,
        max_per_dish: parseInt(packageForm.max_per_dish),
        image: packageForm.image,
        ...(editingPackage !== "new" && { id: packageForm.id }),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save package");
      }
      const updated = await res.json();
      setPackages((prev) => (editingPackage === "new" ? [...prev, updated] : prev.map((p) => (p.id === updated.id ? updated : p))));
      setEditingPackage(null);
      setPackageForm({ id: null, name: "", price: "", guests: "", description: "", max_per_dish: "", image: "" });
      setSaveSuccess("Package " + (editingPackage === "new" ? "created" : "updated") + " successfully!");
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const deletePackage = async (id) => {
    try {
      if (!isInitialized) return;
      const conf = await modalConfirm({ title: "Delete package?", text: "Are you sure you want to delete this event package? This action cannot be undone.", icon: "warning", showCancelButton: true, confirmButtonText: "Delete", cancelButtonText: "Cancel" });
      if (!conf.isConfirmed) return;
      const res = await fetch(`/api/event_packages?id=${id}`, { method: "DELETE", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete package");
      }
      setPackages((p) => p.filter((pkg) => pkg.id !== id));
  setSaveSuccess("Package deleted successfully!");
  notifySuccess("deleted", "Package deleted", "Package deleted");
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      setError(err.message || String(err));
      modalAlert("Delete failed", err.message || "Failed to delete package", "error");
    }
  };

  const cancelEditing = () => {
    setEditingPackage(null);
    setPackageForm({ id: null, name: "", price: "", guests: "", description: "", max_per_dish: "", image: "" });
    setError(null);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Alerts */}
      {saveSuccess && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-green-100 rounded-lg shadow-sm border border-green-200">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-green-800 font-medium">{saveSuccess}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-100 rounded-lg shadow-sm border border-red-200">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <p className="text-red-800 font-medium">{error}</p>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <HomeIcon className="h-7 w-7 text-green-600" />
          <h2 className="text-2xl font-semibold text-green-700">Manage Event Packages</h2>
        </div>

        {/* Package Edit/Create Form */}
        {editingPackage && (
          <div className="mb-8 p-6 bg-gray-50 rounded-lg">
            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-2">
              <h3 className="text-lg font-medium text-gray-800 mb-4">{editingPackage === "new" ? "Create Event Package" : "Edit Event Package"}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-green-700 mb-1.5">Package Name</label>
                  <input type="text" name="name" value={packageForm.name} onChange={handlePackageFormChange} className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-green-700 mb-1.5">Price ($)</label>
                  <input type="number" name="price" value={packageForm.price} onChange={handlePackageFormChange} min="0" className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-green-700 mb-1.5">Guests</label>
                  <input type="number" name="guests" value={packageForm.guests} onChange={handlePackageFormChange} min="1" className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-green-700 mb-1.5">Max Per Dish</label>
                  <input type="number" name="max_per_dish" value={packageForm.max_per_dish} onChange={handlePackageFormChange} min="0" className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-green-700 mb-1.5">Description</label>
                  <textarea name="description" value={packageForm.description} onChange={handlePackageFormChange} className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg" rows={4} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-green-700 mb-1.5">Image URL</label>
                  <input name="image" value={packageForm.image} onChange={handlePackageFormChange} className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={savePackage} className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700">{editingPackage === "new" ? "Create Package" : "Save Package"}</button>
                <button onClick={cancelEditing} className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Package List */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-large text-green-800">Event Packages</h3>
            {canModify && <button onClick={() => startEditingPackage()} className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700">Add New Package</button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className="p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{pkg.name}</p>
                  <p className="text-sm text-gray-600">₱{pkg.price} - {pkg.guests} Guests</p>
                  <p className="text-sm text-gray-500">Max Per Dish: {pkg.max_per_dish}</p>
                  <p className="text-sm text-gray-500">Description: {pkg.description}</p>
                </div>
                <div className="mt-3 flex gap-2 justify-end">
                  {canModify ? (
                    <>
                      <button onClick={() => startEditingPackage(pkg)} className="p-2 text-green-600"><PencilIcon className="h-5 w-5" /></button>
                      <button onClick={() => deletePackage(pkg.id)} className="p-2 text-red-600"><TrashIcon className="h-5 w-5" /></button>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">View only</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
