"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CalendarIcon,
  EyeIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import Toast from "../../../../components/Toast";

export default function LeaveHistory() {
  const { user, token } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    approvedDays: 0,
  });

  // Fetch leaves
  useEffect(() => {
    async function fetchLeaves() {
      try {
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch("/api/leaves", { headers });
        if (!res.ok) throw new Error("Failed to fetch leaves");

        const data = await res.json();
        setLeaves(data);

        // Calculate statistics
        const stats = {
          total: data.length,
          approved: data.filter((l) => l.status === "approved").length,
          pending: data.filter((l) => l.status === "pending").length,
          rejected: data.filter((l) => l.status === "rejected").length,
          approvedDays: data
            .filter((l) => l.status === "approved")
            .reduce(
              (sum, l) =>
                sum +
                Math.ceil(
                  (new Date(l.end_date) - new Date(l.start_date)) /
                    (1000 * 60 * 60 * 24)
                ) +
                1,
              0
            ),
        };
        setStats(stats);
        setError("");
      } catch (err) {
        setError("Failed to load leave history: " + err.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLeaves();
  }, [token]);

  // Filter leaves based on status
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
      case "cancelled":
        return (
          <div className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
            <XCircleIcon className="w-4 h-4" />
            Cancelled
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

  const handleViewDetails = (leave) => {
    setSelectedLeave(leave);
    setShowDetailsModal(true);
  };

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <CalendarIcon className="w-6 h-6" />
        Leave History & Tracking
      </h2>

      {error && (
        <Toast message={error} type="error" onClose={() => setError("")} />
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Requests</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.total}
                  </p>
                </div>
                <CalendarIcon className="w-8 h-8 text-blue-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.approved}
                  </p>
                </div>
                <CheckCircleIcon className="w-8 h-8 text-green-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {stats.pending}
                  </p>
                </div>
                <ClockIcon className="w-8 h-8 text-yellow-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Days Used</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {stats.approvedDays}
                  </p>
                </div>
                <DocumentTextIcon className="w-8 h-8 text-purple-500 opacity-20" />
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
                <DocumentTextIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No leave requests found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Leave Type
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Start Date
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        End Date
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
                          {leave.leave_type_name}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {formatDate(leave.start_date)}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {formatDate(leave.end_date)}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-gray-900">
                          {calculateDays(leave.start_date, leave.end_date)}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(leave.status)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleViewDetails(leave)}
                            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 justify-center mx-auto"
                          >
                            <EyeIcon className="w-4 h-4" />
                            View
                          </button>
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

      {/* Details Modal */}
      {showDetailsModal && selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Leave Details
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
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

              <div>
                <p className="text-sm text-gray-600">Status</p>
                <div className="mt-1">
                  {getStatusBadge(selectedLeave.status)}
                </div>
              </div>

              {selectedLeave.reason && (
                <div>
                  <p className="text-sm text-gray-600">Reason</p>
                  <p className="text-gray-900">{selectedLeave.reason}</p>
                </div>
              )}

              {selectedLeave.approved_at && (
                <div>
                  <p className="text-sm text-gray-600">
                    {selectedLeave.status === "approved"
                      ? "Approved On"
                      : "Processed On"}
                  </p>
                  <p className="font-medium text-gray-900">
                    {formatDate(selectedLeave.approved_at)}
                  </p>
                </div>
              )}

              {selectedLeave.approved_by_name && (
                <div>
                  <p className="text-sm text-gray-600">
                    {selectedLeave.status === "approved"
                      ? "Approved By"
                      : "Processed By"}
                  </p>
                  <p className="font-medium text-gray-900">
                    {selectedLeave.approved_by_name}
                  </p>
                </div>
              )}

              {selectedLeave.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm text-red-800 font-medium">
                    Rejection Reason
                  </p>
                  <p className="text-red-700 text-sm mt-1">
                    {selectedLeave.rejection_reason}
                  </p>
                </div>
              )}

              {selectedLeave.created_at && (
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Submitted on {formatDate(selectedLeave.created_at)}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowDetailsModal(false)}
              className="w-full mt-6 px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
