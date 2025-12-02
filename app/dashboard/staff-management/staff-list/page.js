"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import {
  UserPlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

export default function UserList({ isLoading }) {
  const { user, token } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [generatedQRData, setGeneratedQRData] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "Frontdesk",
    email: "",
    phone: "",
    status: "Active",
    password: "",
    confirmPassword: "",
    hourly_rate: 0,
  });
  const [editFormData, setEditFormData] = useState({
    id: "",
    name: "",
    role: "",
    email: "",
    phone: "",
    status: "",
    hourly_rate: 0,
  });
  const [error, setError] = useState({
    message: "",
    type: "", // 'fetch', 'add', 'edit', 'delete', 'qr'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState(null); // { id, action }
  const [approvalForm, setApprovalForm] = useState({ managerEmail: '', managerPassword: '', managerQr: '' });
  const [approvalError, setApprovalError] = useState('');
  const [isApprovalSubmitting, setIsApprovalSubmitting] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function fetchUsers() {
      try {
        setIsSubmitting(true);
        const headers = { "Content-Type": "application/json", "Accept": "application/json" };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch("/api/users", { headers });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to fetch user data");
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          throw new Error("Invalid user data format received");
        }

        setUsers(data);
        setError({ message: "", type: "" });
      } catch (err) {
        setError({
          message: err.message || "An error occurred while fetching users",
          type: "fetch"
        });
      } finally {
        setIsSubmitting(false);
      }
    }
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(
    (user) =>
      user?.name?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
      user?.email?.toLowerCase()?.includes(searchTerm.toLowerCase())
  );

  const formatHourlyRate = (rate) => {
    const num = Number(rate);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError({ message: "", type: "" });
  };

  const generateQRCode = (userData) => {
    try {
      if (!userData?.id || !userData?.name || !userData?.role || !userData?.email) {
        throw new Error("Invalid user data for QR code generation");
      }

      const qrData = {
        userId: userData.id,
        name: userData.name,
        role: userData.role,
        email: userData.email,
        timestamp: new Date().toISOString(),
        system: "JoannaHotelAttendance",
      };

      setGeneratedQRData(JSON.stringify(qrData));
      setShowQRModal(true);
      setError({ message: "", type: "" });
    } catch (err) {
      setError({
        message: err.message || "Failed to generate QR code",
        type: "qr"
      });
    }
  };

  const downloadQRCode = () => {
    (async () => {
      try {
        const svg = document.getElementById("qr-code-canvas");
        if (!svg) throw new Error("QR code element not found");

        // Serialize the SVG
        let svgData = new XMLSerializer().serializeToString(svg);

        // Attempt to embed the Joanna's logo as a data URL inside the SVG so
        // the downloaded PNG contains the logo even if the browser blocks
        // external image loading due to CORS when drawing SVG to canvas.
        try {
          const logoResp = await fetch('/Joannaslogo.png');
          if (logoResp.ok) {
            const blob = await logoResp.blob();
            const reader = new FileReader();
            const dataUrl = await new Promise((resolve, reject) => {
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            // Parse SVG and replace any <image> hrefs with the embedded data URL
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgData, 'image/svg+xml');
            const images = doc.getElementsByTagName('image');
            for (let i = 0; i < images.length; i++) {
              const imgEl = images[i];
              // set both href and xlink:href for compatibility
              imgEl.setAttribute('href', dataUrl);
              imgEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
            }
            svgData = new XMLSerializer().serializeToString(doc.documentElement);
          }
        } catch (embedErr) {
          // Not fatal; fallback to original SVG (external image may still load)
          console.warn('Failed to embed logo into SVG for download:', embedErr);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
          try {
            // Set canvas size to rendered SVG size (use natural size from image)
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const pngFile = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.download = `${(selectedUser?.name || formData.name || 'user').replace(/\s+/g, '_')}_qr.png`;
            downloadLink.href = pngFile;
            downloadLink.click();
            setError({ message: '', type: '' });
          } catch (err) {
            console.error('Error drawing QR to canvas:', err);
            setError({ message: err.message || 'Failed to download QR code', type: 'qr' });
          }
        };

        img.onerror = (e) => {
          console.error('Image load error when converting SVG:', e);
          setError({ message: 'Failed to process QR code image', type: 'qr' });
        };

        // Set image source to the (possibly modified) SVG
        img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
      } catch (err) {
        console.error('downloadQRCode error:', err);
        setError({ message: err.message || 'Failed to initiate QR code download', type: 'qr' });
      }
    })();
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError({ message: "", type: "" });
    setIsSubmitting(true);

    const allowedRoles = [
      "Admin",
      "Manager",
      "Chef",
      "Frontdesk",
      "Security",
      "Maintenance",
      "Housekeeping",
    ];

    try {
      // Input validation
      if (!formData.email || !formData.password) {
        throw new Error("Email and password are required");
      }

      if (formData.password !== formData.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      if (!allowedRoles.includes(formData.role)) {
        throw new Error(`Invalid role. Must be one of: ${allowedRoles.join(", ")}`);
      }

      if (formData.hourly_rate < 0) {
        throw new Error("Hourly rate cannot be negative");
      }

      if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
        throw new Error("Invalid email format");
      }

      if (formData.phone && !/^\+?[\d\s-]{7,15}$/.test(formData.phone)) {
        throw new Error("Invalid phone number format");
      }

      const postHeaders = { "Content-Type": "application/json", "Accept": "application/json" };
      if (token) postHeaders['Authorization'] = `Bearer ${token}`;
      const res = await fetch("/api/users", {
        method: "POST",
        headers: postHeaders,
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      const getHeaders = { "Content-Type": "application/json", "Accept": "application/json" };
      if (token) getHeaders['Authorization'] = `Bearer ${token}`;
      const updated = await fetch("/api/users", { headers: getHeaders });

      if (!updated.ok) {
        throw new Error("Failed to refresh user list");
      }

      const updatedUsers = await updated.json();
      if (!Array.isArray(updatedUsers)) {
        throw new Error("Invalid user data format received");
      }

      setUsers(updatedUsers);

      const newUser = updatedUsers.find((u) => u.email === formData.email);
      if (!newUser) {
        throw new Error("Failed to find newly created user");
      }

      generateQRCode(newUser);
    } catch (err) {
      setError({
        message: err.message || "An error occurred while adding user",
        type: "add"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setIsSubmitting(true);

      if (!id) {
        throw new Error("Invalid user ID");
      }

      const headers = { "Content-Type": "application/json", "Accept": "application/json" };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch("/api/archive/restore-staff", {
        method: "POST",
        headers,
        body: JSON.stringify({ id, action: "archive" }),
      });

      if (res.status === 401) {
        // Manager/admin approval required. Show approval modal and allow retry.
        setApprovalTarget({ id, action: 'archive' });
        setShowApprovalModal(true);
        setIsSubmitting(false);
        return;
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to archive user");
      }

      setUsers((prev) => prev.filter((u) => u.id !== id));
      setShowDeleteModal(false);
      setError({ message: "", type: "" });
    } catch (err) {
      setError({
        message: err.message || "An error occurred while archiving user",
        type: "delete"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprovalInputChange = (e) => {
    setApprovalForm({ ...approvalForm, [e.target.name]: e.target.value });
    setApprovalError('');
  };

  const handleApprovalSubmit = async (e) => {
    e?.preventDefault?.();
    if (!approvalTarget) return setApprovalError('Nothing to approve');
    setIsApprovalSubmitting(true);
    setApprovalError('');

    try {
      const body = {
        id: approvalTarget.id,
        action: approvalTarget.action,
        managerEmail: approvalForm.managerEmail || undefined,
        managerPassword: approvalForm.managerPassword || undefined,
        managerQr: approvalForm.managerQr || undefined,
      };

      const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/archive/restore-staff', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || 'Approval failed';
        setApprovalError(msg);
        return;
      }

      // success
      setUsers((prev) => prev.filter((u) => u.id !== approvalTarget.id));
      setShowApprovalModal(false);
      setShowDeleteModal(false);
      setApprovalForm({ managerEmail: '', managerPassword: '', managerQr: '' });
      setApprovalTarget(null);
      setError({ message: '', type: '' });
    } catch (err) {
      console.error('Approval submit error', err);
      setApprovalError(err?.message || 'Approval request failed');
    } finally {
      setIsApprovalSubmitting(false);
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (user) => {
    try {
      if (!user?.id) {
        throw new Error("Invalid user data for editing");
      }

      setEditFormData({
        id: user.id ?? "",
        name: user.name ?? "",
        role: user.role ?? "",
        email: user.email ?? "",
        phone: user.phone ?? "",
        status: user.status ?? "",
        hourly_rate: user.hourly_rate ?? 0,
      });
      setShowEditModal(true);
      setError({ message: "", type: "" });
    } catch (err) {
      setError({
        message: err.message || "Failed to load user data for editing",
        type: "edit"
      });
    }
  };

  const handleEditChange = (e) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
    setError({ message: "", type: "" });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!editFormData.id) {
        throw new Error("Invalid user ID");
      }

      if (!/^\S+@\S+\.\S+$/.test(editFormData.email)) {
        throw new Error("Invalid email format");
      }

      if (editFormData.phone && !/^\+?[\d\s-]{7,15}$/.test(editFormData.phone)) {
        throw new Error("Invalid phone number format");
      }

      if (editFormData.hourly_rate < 0) {
        throw new Error("Hourly rate cannot be negative");
      }

      const res = await fetch(`/api/users`, {
        method: "PUT",
        headers: (() => { const h = { "Content-Type": "application/json", "Accept": "application/json" }; if (token) h['Authorization'] = `Bearer ${token}`; return h; })(),
        body: JSON.stringify(editFormData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update user");
      }

      const getHeaders = { "Content-Type": "application/json", "Accept": "application/json" };
      if (token) getHeaders['Authorization'] = `Bearer ${token}`;
      const updated = await fetch("/api/users", { headers: getHeaders });

      if (!updated.ok) {
        throw new Error("Failed to refresh user list");
      }

      const updatedUsers = await updated.json();
      if (!Array.isArray(updatedUsers)) {
        throw new Error("Invalid user data format received");
      }

      setUsers(updatedUsers);
      setShowEditModal(false);
      setError({ message: "", type: "" });
    } catch (err) {
      setError({
        message: err.message || "An error occurred while updating user",
        type: "edit"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "Active":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case "On Leave":
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case "Inactive":
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {error.message && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md text-sm flex items-center">
          <XCircleIcon className="h-5 w-5 mr-2" />
          <span>{error.message}</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border p-4 sm:p-6">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end mb-4 gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm sm:text-base"
              disabled={isSubmitting}
            >
              <UserPlusIcon className="h-5 w-5 mr-2" />
              Add User
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-md text-gray-700 text-sm sm:text-base"
            />
          </div>
        </div>

        {isLoading || isSubmitting ? (
          <div className="text-center text-gray-600">Loading...</div>
        ) : users.length === 0 && !error.message ? (
          <div className="text-center text-gray-600">No users found</div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hourly Rate</th>
                    <th className="px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((userItem) => (
                    <tr key={userItem.id}>
                      <td className="px-4 sm:px-6 py-2 text-gray-600 text-sm">{userItem.name || "N/A"}</td>
                      <td className="px-4 sm:px-6 py-2 text-gray-600 text-sm">{userItem.email || "N/A"}</td>
                      <td className="px-4 sm:px-6 py-2 text-gray-600 text-sm">{userItem.role || "N/A"}</td>
                      <td className="px-4 sm:px-6 py-2 text-gray-600 text-sm">{userItem.phone || "N/A"}</td>
                      <td className="px-4 sm:px-6 py-2 flex items-center text-sm">{getStatusIcon(userItem.status)}<span className="ml-2 text-gray-600">{userItem.status || "N/A"}</span></td>
                      <td className="px-4 sm:px-6 py-2 text-gray-600 text-sm">₱{formatHourlyRate(userItem.hourly_rate)}</td>
                      <td className="px-4 sm:px-6 py-2 flex gap-3 justify-center items-center">
                        <button
                          onClick={() => { setSelectedUser(userItem); generateQRCode(userItem); }}
                          className="text-blue-600 hover:text-blue-800"
                          disabled={isSubmitting}
                          aria-label="View / QR"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>

                        <button
                          onClick={() => handleEditClick(userItem)}
                          className="text-amber-500 hover:text-amber-700"
                          disabled={isSubmitting}
                          aria-label="Edit"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>

                        <button
                          onClick={() => { setSelectedUser(userItem.id); setShowDeleteModal(true); }}
                          className="text-red-600 hover:text-red-800"
                          disabled={isSubmitting}
                          aria-label="Delete"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredUsers.map((userItem) => (
                <div key={userItem.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{userItem.name || "N/A"}</p>
                      <p className="text-sm text-gray-600">{userItem.email || "N/A"}</p>
                      <p className="text-sm text-gray-600">{userItem.role || "N/A"}</p>
                      <p className="text-sm text-gray-600">{userItem.phone || "N/A"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(userItem.status)}
                      <span className="text-sm text-gray-600">{userItem.status || "N/A"}</span>
                    </div>
                  </div>
                    <div className="mt-2 flex justify-between items-center">
                    <p className="text-sm text-gray-600">Hourly Rate: ₱{formatHourlyRate(userItem.hourly_rate)}</p>
                    <div className="flex gap-3 items-center">
                      <button onClick={() => { setSelectedUser(userItem); generateQRCode(userItem); }} className="text-blue-600 hover:text-blue-800" disabled={isSubmitting} aria-label="View / QR"><EyeIcon className="h-5 w-5" /></button>
                      <button onClick={() => handleEditClick(userItem)} className="text-amber-500 hover:text-amber-700" disabled={isSubmitting} aria-label="Edit"><PencilIcon className="h-5 w-5" /></button>
                      <button onClick={() => { setSelectedUser(userItem.id); setShowDeleteModal(true); }} className="text-red-600 hover:text-red-800" disabled={isSubmitting} aria-label="Delete"><TrashIcon className="h-5 w-5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 sm:p-6 max-h-[calc(100vh-2rem)] overflow-y-auto relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => {
                setShowAddModal(false);
                setError({ type: "", message: "" });
                setFormData({
                  name: "", role: "Admin", email: "", phone: "",
                  address: "", dateOfBirth: "", emergencyContact: "", hireDate: "",
                  hourlyRate: "", image: null
                });
              }}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-700">Add New Staff</h2>
            {error.type === "add" && error.message && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-md text-sm flex items-center">
                <XCircleIcon className="h-5 w-5 mr-2" />
                <span>{error.message}</span>
              </div>
            )}
            <form onSubmit={handleAddUser} className="space-y-3 sm:space-y-4">
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
                required
              />
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
              >
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Chef">Chef</option>
                <option value="Frontdesk">Frontdesk</option>
                <option value="Security">Security</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Housekeeping">Housekeeping</option>
              </select>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
                required
              />
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
              />
              <label className="block text-sm font-medium text-gray-700">Hourly Rate</label>
              <input
                type="number"
                name="hourly_rate"
                value={formData.hourly_rate}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
              />
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
              >
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </select>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-2.5 text-gray-500"
                >
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
              <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
                required
              />
              <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({
                      name: "",
                      role: "Frontdesk",
                      email: "",
                      phone: "",
                      status: "Active",
                      password: "",
                      confirmPassword: "",
                      hourly_rate: 0,
                    });
                    setError({ message: "", type: "" });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${isSubmitting ? "opacity-75 cursor-not-allowed" : ""
                    }`}
                >
                  {isSubmitting ? "Creating..." : "Create Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 sm:p-6 relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setError({ message: "", type: "" });
              }}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
              disabled={isSubmitting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-red-700">Confirm Archiving</h2>
            {error.type === "delete" && error.message && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-md text-sm flex items-center">
                <XCircleIcon className="h-5 w-5 mr-2" />
                <span>{error.message}</span>
              </div>
            )}
            <p className="mb-4 sm:mb-6 text-black text-sm sm:text-base">
              Are you sure you want to archive this staff member? They can be restored later from the archive.
            </p>
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setError({ message: "", type: "" });
                }}
                className="px-4 py-2 border rounded-md text-gray-700 text-sm hover:bg-gray-50"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(selectedUser)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Archiving..." : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApprovalModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 sm:p-6 relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => {
                setShowApprovalModal(false);
                setApprovalError("");
                setApprovalForm({ managerEmail: "", managerPassword: "", managerToken: "" });
              }}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-700">Manager/Admin Approval Required</h2>
            {approvalError && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-md text-sm flex items-center">
                <XCircleIcon className="h-5 w-5 mr-2" />
                <span>{approvalError}</span>
              </div>
            )}
            <p className="mb-3 text-sm text-gray-600">Enter manager credentials or paste manager QR/JWT to approve this action.</p>
            <form onSubmit={handleApprovalSubmit} className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Manager Email</label>
              <input
                type="email"
                name="managerEmail"
                value={approvalForm.managerEmail}
                onChange={handleApprovalInputChange}
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
              />
              <label className="block text-sm font-medium text-gray-700">Manager Password</label>
              <input
                type="password"
                name="managerPassword"
                value={approvalForm.managerPassword}
                onChange={handleApprovalInputChange}
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
              />
              <div className="text-center text-gray-500 text-sm">OR</div>
              <label className="block text-sm font-medium text-gray-700">Manager QR / JWT</label>
              <textarea
                name="managerQr"
                value={approvalForm.managerQr}
                onChange={handleApprovalInputChange}
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
                rows={3}
              />

              <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowApprovalModal(false);
                    setApprovalError('');
                    setApprovalForm({ managerEmail: '', managerPassword: '', managerQr: '' });
                    setApprovalTarget(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  disabled={isApprovalSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isApprovalSubmitting}
                  className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${isApprovalSubmitting ? "opacity-75 cursor-not-allowed" : ""}`}
                >
                  {isApprovalSubmitting ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 sm:p-6 max-h-[calc(100vh-2rem)] overflow-y-auto relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => {
                setShowEditModal(false);
                setError({ type: "", message: "" });
              }}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
              disabled={isSubmitting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-700">Edit Staff Member</h2>
            {error.type === "edit" && error.message && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-md text-sm flex items-center">
                <XCircleIcon className="h-5 w-5 mr-2" />
                <span>{error.message}</span>
              </div>
            )}
            <form onSubmit={handleUpdateUser} className="space-y-3 sm:space-y-4">
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                name="name"
                value={editFormData.name}
                onChange={handleEditChange}
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
                required
              />
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                name="role"
                value={editFormData.role}
                onChange={handleEditChange}
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
              >
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Chef">Chef</option>
                <option value="Frontdesk">Frontdesk</option>
                <option value="Security">Security</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Housekeeping">Housekeeping</option>
              </select>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                value={editFormData.email}
                onChange={handleEditChange}
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
                required
              />
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={editFormData.phone}
                onChange={handleEditChange}
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
              />
              <label className="block text-sm font-medium text-gray-700">Hourly Rate</label>
              <input
                type="number"
                name="hourly_rate"
                value={editFormData.hourly_rate}
                onChange={handleEditChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
              />
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                name="status"
                value={editFormData.status}
                onChange={handleEditChange}
                className="w-full px-3 py-2 border rounded-md text-gray-700 text-sm"
              >
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </select>
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setError({ message: "", type: "" });
                  }}
                  className="px-4 py-2 border rounded-md text-white bg-red-600 hover:bg-red-700 text-sm"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQRModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 sm:p-6 relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => {
                setShowQRModal(false);
                setError({ message: "", type: "" });
              }}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-700">Staff QR Code</h2>
            {error.type === "qr" && error.message && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-md text-sm flex items-center">
                <XCircleIcon className="h-5 w-5 mr-2" />
                <span>{error.message}</span>
              </div>
            )}
            <div className="flex flex-col items-center">
              <div className="mb-4 text-center">
                <h3 className="font-medium text-gray-900 text-sm sm:text-base">{selectedUser?.name || formData.name || "N/A"}</h3>
                <p className="text-xs sm:text-sm text-gray-500">{selectedUser?.role || formData.role || "N/A"}</p>
                <p className="text-xs sm:text-sm text-gray-500">ID: {selectedUser?.id || "New User"}</p>
                <p className="text-xs sm:text-sm text-gray-500">Status: {selectedUser?.status || formData.status || "N/A"}</p>
              </div>

              <div className="p-3 sm:p-4 border border-gray-200 rounded-lg mb-4">
                <QRCodeSVG
                  id="qr-code-canvas"
                  value={generatedQRData || ""}
                  size={200}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: "/Joannaslogo.png",
                    x: undefined,
                    y: undefined,
                    height: 30,
                    width: 30,
                    excavate: true,
                  }}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                <button
                  onClick={downloadQRCode}
                  className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  disabled={isSubmitting}
                >
                  <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                  Download
                </button>
                <button
                  onClick={() => {
                    setShowQRModal(false);
                    setGeneratedQRData(null);
                    setError({ message: "", type: "" });
                    if (!selectedUser) {
                      setShowAddModal(false);
                        setFormData({
                          name: "",
                          role: "Frontdesk",
                          email: "",
                          phone: "",
                          status: "Active",
                          password: "",
                          confirmPassword: "",
                          hourly_rate: 0,
                        });
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
                  disabled={isSubmitting}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
