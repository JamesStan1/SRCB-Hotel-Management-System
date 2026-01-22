"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import {
  CheckCircleIcon,
  ExclamationIcon,
  CalendarIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import Toast from "../../../../components/Toast";

export default function LeaveRequest() {
  const { user, token } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [formData, setFormData] = useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedLeaveType, setSelectedLeaveType] = useState(null);
  const [dayCount, setDayCount] = useState(0);

  // Fetch leave types
  useEffect(() => {
    async function fetchLeaveTypes() {
      try {
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch("/api/leave-types", { headers });
        if (!res.ok) throw new Error("Failed to fetch leave types");

        const data = await res.json();
        setLeaveTypes(data);
        setError("");
      } catch (err) {
        setError("Failed to load leave types: " + err.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLeaveTypes();
  }, [token]);

  // Calculate days when dates change
  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      if (end >= start) {
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        setDayCount(days);
      }
    }
  }, [formData.start_date, formData.end_date]);

  // Update selected leave type when leave_type_id changes
  useEffect(() => {
    if (formData.leave_type_id) {
      const selected = leaveTypes.find(
        (lt) => lt.id.toString() === formData.leave_type_id.toString()
      );
      setSelectedLeaveType(selected);
    }
  }, [formData.leave_type_id, leaveTypes]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      // Validation
      if (!formData.leave_type_id || !formData.start_date || !formData.end_date) {
        throw new Error("Please fill in all required fields");
      }

      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        throw new Error("End date must be after start date");
      }

      const headers = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/leaves", {
        method: "POST",
        headers,
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit leave request");
      }

      setSuccessMessage("Leave request submitted successfully!");
      setFormData({
        leave_type_id: "",
        start_date: "",
        end_date: "",
        reason: "",
      });
      setDayCount(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <CalendarIcon className="w-6 h-6" />
        Request Leave
      </h2>

      {error && (
        <Toast
          message={error}
          type="error"
          onClose={() => setError("")}
        />
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
        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Leave Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Leave Type <span className="text-red-500">*</span>
              </label>
              <select
                name="leave_type_id"
                value={formData.leave_type_id}
                onChange={handleInputChange}
                required
                className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Select a leave type</option>
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name}
                    {lt.days_per_year > 0 ? ` (${lt.days_per_year} days/year)` : ""}
                  </option>
                ))}
              </select>
              {selectedLeaveType && (
                <p className="mt-2 text-sm text-gray-600">
                  {selectedLeaveType.description}
                </p>
              )}
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                required
                min={new Date().toISOString().split("T")[0]}
                className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleInputChange}
                required
                min={formData.start_date || new Date().toISOString().split("T")[0]}
                className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Day Count */}
            {dayCount > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Days
                </label>
                <input
                  type="text"
                  value={`${dayCount} day(s)`}
                  disabled
                  className="w-full text-black px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700"
                />
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Leave
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              rows="4"
              placeholder="Enter the reason for your leave request (optional)"
              className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Info Box */}
          {selectedLeaveType && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex gap-3">
                <ExclamationIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Leave Information:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      {selectedLeaveType.requires_approval
                        ? "This leave type requires approval from management"
                        : "This leave type does not require approval"}
                    </li>
                    <li>
                      {selectedLeaveType.is_paid ? "This is paid leave" : "This is unpaid leave"}
                    </li>
                    {selectedLeaveType.days_per_year > 0 && (
                      <li>You have {selectedLeaveType.days_per_year} days allocated per year</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="mt-8 flex gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData({
                  leave_type_id: "",
                  start_date: "",
                  end_date: "",
                  reason: "",
                });
                setDayCount(0);
                setError("");
              }}
              className="px-6 py-2 bg-gray-300 text-gray-800 font-medium rounded-lg hover:bg-gray-400 transition-colors"
            >
              Clear
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
