"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CalendarIcon,
  DocumentCheckIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import Toast from "../../../../components/toast";

export default function LeaveApprovals() {
  const { user, token } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [userRole, setUserRole] = useState("");

  // Check if user has permission to approve leaves
  useEffect(() => {
    const role = user?.role?.toLowerCase();
    if (!["manager", "hr", "admin"].includes(role)) {
      setError("You do not have permission to approve leaves");
      setIsLoading(false);
      return;
    }
    setUserRole(role);
  }, [user]);

  // Fetch leaves
  useEffect(() => {
    if (!["manager", "hr", "admin"].includes(userRole)) return;

    async function fetchLeaves() {
      try {
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch("/api/leaves?viewAll=true", { headers });
        if (!res.ok) throw new Error("Failed to fetch leaves");

        const data = await res.json();
        setLeaves(data);
        setError("");
      } catch (err) {
        setError("Failed to load leave requests: " + err.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLeaves();
  }, [token, userRole]);

  // Filter leaves
  const filteredLeaves =
    filterStatus === "all"
      ? leaves
      : leaves.filter((l) => l.status === filterStatus);

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
        return (
          <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <CheckCircleIcon className="w-4 h-4" />
            Approved
          </div>
        );
      case "rejected":
        return (
          <div className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
            <XCircleIcon className="w-4 h-4" />
            Rejected
          </div>
        );
      case "pending":
        return (
          <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
            <ClockIcon className="w-4 h-4" />
            Pending
          </div>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const calculateDays = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleApprove = async () => {
    if (!selectedLeave) return;
    setIsProcessing(true);

    try {
      const headers = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/leaves/approve", {
        method: "POST",
        headers,
        body: JSON.stringify({
          leave_id: selectedLeave.id,
          action: "approve",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to approve leave");
      }

      setSuccessMessage("Leave request approved successfully!");
      setLeaves(
        leaves.map((l) => (l.id === selectedLeave.id ? data.leave : l))
      );
      setShowApprovalModal(false);
      setSelectedLeave(null);
      setRejectionReason("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedLeave || !rejectionReason.trim()) {
      setError("Please enter a rejection reason");
      return;
    }
    setIsProcessing(true);

    try {
      const headers = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/leaves/approve", {
        method: "POST",
        headers,
        body: JSON.stringify({
          leave_id: selectedLeave.id,
          action: "reject",
          rejection_reason: rejectionReason,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reject leave");
      }

      setSuccessMessage("Leave request rejected successfully!");
      setLeaves(
        leaves.map((l) => (l.id === selectedLeave.id ? data.leave : l))
      );
      setShowApprovalModal(false);
      setSelectedLeave(null);
      setRejectionReason("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!["manager", "hr", "admin"].includes(userRole)) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <XCircleIcon className="w-12 h-12 mx-auto text-red-600 mb-4" />
          <p className="text-lg font-semibold text-red-800">
            Access Denied
          </p>
          <p className="text-red-700 mt-2">
            You do not have permission to approve leave requests. Only managers
            and HR staff can access this section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <DocumentCheckIcon className="w-6 h-6" />
        Leave Approvals
      </h2>

      {error && (
        <Toast message={error} type="error" onClose={() => setError("")} />
      )}

      {successMessage && (
        <Toast
          message={successMessage}
          type="success"
          onClose={() => setSuccessMessage("")}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Requests</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {leaves.length}
                  </p>
                </div>
                <CalendarIcon className="w-8 h-8 text-blue-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending Review</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {leaves.filter((l) => l.status === "pending").length}
                  </p>
                </div>
                <ClockIcon className="w-8 h-8 text-yellow-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Processed</p>
                  <p className="text-2xl font-bold text-green-600">
                    {leaves.filter((l) => l.status !== "pending").length}
                  </p>
                </div>
                <CheckCircleIcon className="w-8 h-8 text-green-500 opacity-20" />
              </div>
            </div>
          </div>

          {/* Filter and Table */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <div className="flex gap-2 flex-wrap">
                {["all", "pending", "approved", "rejected"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filterStatus === status
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {filteredLeaves.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <DocumentCheckIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No {filterStatus !== "all" ? filterStatus : ""} leave requests found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Staff Member
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Leave Type
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Dates
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">
                        Days
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Status
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaves.map((leave) => (
                      <tr
                        key={leave.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4 font-medium text-gray-900">
                          {leave.user_name}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {leave.leave_type_name}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {formatDate(leave.start_date)} -{" "}
                          {formatDate(leave.end_date)}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-gray-900">
                          {calculateDays(leave.start_date, leave.end_date)}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(leave.status)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {leave.status === "pending" ? (
                            <button
                              onClick={() => {
                                setSelectedLeave(leave);
                                setRejectionReason("");
                                setShowApprovalModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Review
                            </button>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Review Leave Request
              </h3>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Staff Member</p>
                <p className="font-medium text-gray-900">
                  {selectedLeave.user_name}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Leave Type</p>
                <p className="font-medium text-gray-900">
                  {selectedLeave.leave_type_name}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Start Date</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(selectedLeave.start_date)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">End Date</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(selectedLeave.end_date)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600">Number of Days</p>
                <p className="font-medium text-gray-900">
                  {calculateDays(selectedLeave.start_date, selectedLeave.end_date)}
                </p>
              </div>

              {selectedLeave.reason && (
                <div>
                  <p className="text-sm text-gray-600">Reason</p>
                  <p className="text-gray-900">{selectedLeave.reason}</p>
                </div>
              )}
            </div>

            {/* Rejection Reason Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason (if rejecting)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircleIcon className="w-5 h-5" />
                {isProcessing ? "Processing..." : "Approve"}
              </button>
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                <XCircleIcon className="w-5 h-5" />
                {isProcessing ? "Processing..." : "Reject"}
              </button>
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedLeave(null);
                  setRejectionReason("");
                }}
                disabled={isProcessing}
                className="px-4 py-2 bg-gray-300 text-gray-800 font-medium rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
