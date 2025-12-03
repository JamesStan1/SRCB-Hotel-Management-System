"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../context/AuthContext";
import {
  ArchiveBoxIcon,
  EyeIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@heroicons/react/24/outline";
import Swal from "sweetalert2";
import { format, parseISO } from "date-fns";
import ManagerApprovalModal from "../../../../components/ManagerApprovalModal";

const formatDateString = (dateString) => {
  if (!dateString) return "—";
  try {
    return format(parseISO(dateString), "yyyy-MM-dd");
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
};

export default function ArchivedItems() {
  const [archivedRooms, setArchivedRooms] = useState([]);
  const [archivedReservations, setArchivedReservations] = useState([]);
  const [roomSearchTerm, setRoomSearchTerm] = useState("");
  const [reservationSearchTerm, setReservationSearchTerm] = useState("");
  const [roomSortConfig, setRoomSortConfig] = useState({ key: "room_number", direction: "asc" });
  const [reservationSortConfig, setReservationSortConfig] = useState({ key: "customer_name", direction: "asc" });
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { token, isInitialized } = useAuth();
  const router = useRouter();
  const [viewItem, setViewItem] = useState(null);
  const [viewType, setViewType] = useState(null); // 'room' or 'reservation'
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [activeTab, setActiveTab] = useState("rooms");
  const { user } = useAuth();
  const role = user?.role || '';
  const isSecurity = (role || '').toLowerCase() === 'security';

  // Clear notifications after timeout
  useEffect(() => {
    let errorTimeout, successTimeout;
    if (error) {
      errorTimeout = setTimeout(() => setError(null), 5000);
    }
    if (successMessage) {
      successTimeout = setTimeout(() => setSuccessMessage(null), 3000);
    }
    return () => {
      clearTimeout(errorTimeout);
      clearTimeout(successTimeout);
    };
  }, [error, successMessage]);

  // Fetch archived rooms and reservations on component mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (!isInitialized) return;
        if (!token) {
          setError("Authentication token not found. Please log in.");
          router.push('/components/sign-in');
          setIsLoading(false);
          return;
        }

        const [roomResponse, reservationResponse] = await Promise.all([
          fetch("/api/archive/restore-room", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/archive/restore-reservation", { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!roomResponse.ok) {
          throw new Error("Failed to fetch archived rooms: Server error");
        }
        if (!reservationResponse.ok) {
          throw new Error("Failed to fetch archived reservations: Server error");
        }

        const [roomData, reservationData] = await Promise.all([
          roomResponse.json(),
          reservationResponse.json(),
        ]);

        // Deduplicate archived rooms by original_id or room_number to avoid redundant rows
        try {
          const map = new Map();
          (roomData || []).forEach((item) => {
            const key = item.original_id || item.room_number || item.id || JSON.stringify(item);
            if (!map.has(key)) {
              map.set(key, {
                id: item.id,
                original_id: item.original_id,
                room_number: item.room_number,
                type: item.type,
                price: item.price,
                status: item.status,
                package_id: item.package_id,
                archived_at: item.archived_at,
              });
            }
          });
          setArchivedRooms(Array.from(map.values()));
        } catch (e) {
          setArchivedRooms(
            roomData.map((item) => ({
              id: item.id,
              original_id: item.original_id,
              room_number: item.room_number,
              type: item.type,
              price: item.price,
              status: item.status,
              package_id: item.package_id,
              archived_at: item.archived_at,
            }))
          );
        }

        setArchivedReservations(
          reservationData.map((item) => ({
            id: item.id,
            original_id: item.original_id,
            room_id: item.room_id,
            customer_name: item.customer_name,
            customer_email: item.customer_email,
            contact_number: item.contact_number,
            address: item.address,
            nationality: item.nationality,
            additional_guests: item.additional_guests,
            additional_requests: item.additional_requests,
            remarks: item.remarks,
            check_in_date: item.check_in_date,
            check_out_date: item.check_out_date,
            id_upload: item.id_upload,
            e_signature: item.e_signature,
            archived_at: item.archived_at,
          }))
        );
      } catch (err) {
        setError(err.message || "An unexpected error occurred while fetching archived data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isInitialized, token, router]);

  // Handle search input changes
  const handleRoomSearchChange = (e) => {
    setRoomSearchTerm(e.target.value.trim());
    setError(null);
  };

  const handleReservationSearchChange = (e) => {
    setReservationSearchTerm(e.target.value.trim());
    setError(null);
  };

  // Handle sort
  const handleRoomSort = (key) => {
    setRoomSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleReservationSort = (key) => {
    setReservationSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Handle restore room
  const handleRestoreRoom = async (id) => {
    const item = archivedRooms.find((item) => item.id === id);
    const roomNumber = item?.room_number || "this room";

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `This will restore Room ${roomNumber}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, restore it!",
      cancelButtonText: "No, cancel!",
      reverseButtons: true,
      customClass: {
        confirmButton: "bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ml-2",
        cancelButton: "bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded mr-2",
      },
      buttonsStyling: false,
    });

    if (result.isConfirmed) {
      // open manager approval modal; actual restore will be performed after approval
      setPendingAction({ type: 'room_restore', id, endpoint: '/api/archive/rooms', method: 'POST', successMsg: `Room ${roomNumber} has been restored successfully.` });
      setApprovalOpen(true);
    }
  };

  // Handle restore reservation
  const handleRestoreReservation = async (id) => {
    const item = archivedReservations.find((item) => item.id === id);
    const customerName = item?.customer_name || "this reservation";

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `This will restore the reservation for ${customerName}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, restore it!",
      cancelButtonText: "No, cancel!",
      reverseButtons: true,
      customClass: {
        confirmButton: "bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ml-2",
        cancelButton: "bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded mr-2",
      },
      buttonsStyling: false,
    });

    if (result.isConfirmed) {
      setPendingAction({ type: 'reservation_restore', id, endpoint: '/api/archive/restore-reservation', method: 'POST', successMsg: `Reservation for ${customerName} has been restored successfully.` });
      setApprovalOpen(true);
    }
  };

  // Handle view item
  const handleViewItem = (item, type) => {
    setViewItem(item);
    setViewType(type);
    setError(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Available":
        return "bg-blue-100 text-blue-800";
      case "Occupied":
        return "bg-red-100 text-red-800";
      case "Maintenance":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const packages = [
    {
      id: 1,
      name: "Single Room",
      price: "₱350-₱500",
      guests: "1-2",
      image: "/room/singleroom.jpg",
      description: "₱350 = 6hrs, ₱500 = 12hrs with common toilet and bath, aircon, and wifi.",
    },
    {
      id: 2,
      name: "Single Room",
      price: "₱450-₱600",
      guests: "1-2",
      image: "/room/singleroom.jpg",
      description: "₱450 = 6hrs, ₱600 = 12hrs with private toilet and bath, aircon, and wifi.",
    },
    {
      id: 3,
      name: "Standard Room",
      price: "₱1,500",
      guests: "1-2",
      image: "/room/standardroom.jpg",
      description: "With free Breakfast, private toilet and bath, aircon, and wifi.",
    },
    {
      id: 4,
      name: "Double Standard",
      price: "₱2,000",
      guests: "2",
      image: "/room/doublestandard.jpg",
      description: "With free Breakfast, private toilet and bath, aircon, and wifi.",
    },
    {
      id: 5,
      name: "Triple Room",
      price: "₱2,200",
      guests: "3",
      image: "/room/tripleroom.jpg",
      description: "With free Breakfast, private toilet and bath, aircon, and wifi.",
    },
    {
      id: 6,
      name: "Family Room",
      price: "₱2,500",
      guests: "4",
      image: "/room/familyroom.jpg",
      description: "Extension and Early Check-in: ₱150/hr. With free Breakfast, private toilet and bath, aircon, and wifi.",
    },
    {
      id: 7,
      name: "Barkadahan Room",
      price: "₱4,000",
      guests: "8",
      image: "/room/tripleroom.jpg",
      description: "With private toilet and bath, aircon, and wifi.",
    },
  ];

  const getPackageById = (id) => packages.find((pkg) => String(pkg.id) === String(id));

  // Filter and sort rooms
  const sortedRooms = [...archivedRooms]
    .filter((item) => {
      const searchLower = roomSearchTerm.toLowerCase();
      const fieldsToSearch = [
        item.room_number,
        item.type,
        item.status,
      ];
      return fieldsToSearch.some((field) =>
        field?.toString().toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      let aValue = a?.[roomSortConfig.key] ?? "";
      let bValue = b?.[roomSortConfig.key] ?? "";
      if (aValue < bValue) return roomSortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return roomSortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

  // Filter and sort reservations
  const sortedReservations = [...archivedReservations]
    .filter((item) => {
      const searchLower = reservationSearchTerm.toLowerCase();
      const fieldsToSearch = [
        item.customer_name,
        item.customer_email,
        item.room_id?.toString(),
      ];
      return fieldsToSearch.some((field) =>
        field?.toString().toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      let aValue = a?.[reservationSortConfig.key] ?? "";
      let bValue = b?.[reservationSortConfig.key] ?? "";
      if (aValue < bValue) return reservationSortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return reservationSortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

  // Called when ManagerApprovalModal returns approval payload
  const onApprove = async (approvalPayload) => {
    setApprovalOpen(false);
    if (!pendingAction) return;
    setIsLoading(true);
    try {
      const { id, endpoint, method, type } = pendingAction;
      const body = { itemId: id, ...approvalPayload };
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw Object.assign(new Error(), { message: errorData.error || `HTTP error! Status: ${response.status}`, response });
      }

      // remove restored item from UI
      if (type === "room_restore") {
        setArchivedRooms((prev) => prev.filter((it) => it.id !== id));
      } else if (type === "reservation_restore") {
        setArchivedReservations((prev) => prev.filter((it) => it.id !== id));
      }

      setSuccessMessage((prev) => {
        // try to show a friendly message returned from server or fallback
        return `Restore completed successfully.`;
      });
      const respJson = await response.json().catch(() => ({}));
      return { success: true, approverEmail: respJson?.approverEmail || null };
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to perform approved action. Please try again.");
      return { success: false, message: err?.message || 'Server error' };
    } finally {
      setIsLoading(false);
      setPendingAction(null);
    }
  };

  return (
    <div>
      {/* Notifications */}
      {successMessage && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-blue-100 rounded-lg shadow-sm border border-blue-200 animate-in fade-in slide-in-from-top-2 duration-300">
          <svg
            className="h-6 w-6 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <p className="text-blue-800 font-medium">{successMessage}</p>
        </div>
      )}
      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-100 rounded-lg shadow-sm border border-red-200 animate-in fade-in slide-in-from-top-2 duration-300">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          <p className="text-red-800 font-medium">{error}</p>
        </div>
      )}
      {isLoading && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-blue-100 rounded-lg shadow-sm border border-blue-200 animate-pulse">
          <svg
            className="h-6 w-6 text-blue-600 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 12a8 8 0 0116 0 8 8 0 01-16 0"
            />
          </svg>
          <p className="text-blue-800 font-medium">Processing...</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex mb-4">
          <button
            onClick={() => setActiveTab("rooms")}
            disabled={isLoading}
            className={`px-4 py-2 ${
              activeTab === "rooms" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
            } rounded-l-lg ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Archived Rooms
          </button>
          <button
            onClick={() => setActiveTab("reservations")}
            disabled={isLoading}
            className={`px-4 py-2 ${
              activeTab === "reservations" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
            } rounded-r-lg ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Archived Reservations
          </button>
        </div>

        {activeTab === "rooms" && (
          <>
            <div className="relative w-full max-w-md mb-6">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search archived rooms..."
                value={roomSearchTerm}
                onChange={handleRoomSearchChange}
                className={`pl-10 pr-4 py-2 border rounded w-full ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
                disabled={isLoading}
              />
            </div>
            <div className="mt-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-700">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer"
                      onClick={() => handleRoomSort("room_number")}
                    >
                      Room Number
                      {roomSortConfig.key === "room_number" && (
                        roomSortConfig.direction === "asc" ? (
                          <ArrowUpIcon className="inline h-4 w-4 ml-1" />
                        ) : (
                          <ArrowDownIcon className="inline h-4 w-4 ml-1" />
                        )
                      )}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleRoomSort("type")}
                    >
                      Type
                      {roomSortConfig.key === "type" && (
                        roomSortConfig.direction === "asc" ? (
                          <ArrowUpIcon className="inline h-4 w-4 ml-1" />
                        ) : (
                          <ArrowDownIcon className="inline h-4 w-4 ml-1" />
                        )
                      )}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleRoomSort("price")}
                    >
                      Price
                      {roomSortConfig.key === "price" && (
                        roomSortConfig.direction === "asc" ? (
                          <ArrowUpIcon className="inline h-4 w-4 ml-1" />
                        ) : (
                          <ArrowDownIcon className="inline h-4 w-4 ml-1" />
                        )
                      )}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleRoomSort("archived_at")}
                    >
                      Archived Date
                      {roomSortConfig.key === "archived_at" && (
                        roomSortConfig.direction === "asc" ? (
                          <ArrowUpIcon className="inline h-4 w-4 ml-1" />
                        ) : (
                          <ArrowDownIcon className="inline h-4 w-4 ml-1" />
                        )
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-50 divide-y divide-gray-200">
                  {sortedRooms.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-gray-100 text-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.room_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ₱{item.price}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateString(item.archived_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewItem(item, "room")}
                          className={`text-blue-600 hover:text-blue-900 mr-4 ${
                            isLoading ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                          disabled={isLoading}
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        {!isSecurity && (
                          <button
                            onClick={() => handleRestoreRoom(item.id)}
                            className={`text-blue-600 hover:text-blue-900 mr-4 ${
                              isLoading ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                            disabled={isLoading}
                            title="Restore Room"
                          >
                            <ArrowPathIcon className="h-5 w-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {sortedRooms.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-6 py-4 text-center text-sm text-gray-500"
                      >
                        {isLoading ? "Loading archived rooms..." : "No archived rooms available."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === "reservations" && (
          <>
            <div className="relative w-full max-w-md mb-6">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search archived reservations..."
                value={reservationSearchTerm}
                onChange={handleReservationSearchChange}
                className={`pl-10 pr-4 py-2 border rounded w-full ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
                disabled={isLoading}
              />
            </div>
            <div className="mt-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-700">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer"
                      onClick={() => handleReservationSort("room_id")}
                    >
                      Room ID
                      {reservationSortConfig.key === "room_id" && (
                        reservationSortConfig.direction === "asc" ? (
                          <ArrowUpIcon className="inline h-4 w-4 ml-1" />
                        ) : (
                          <ArrowDownIcon className="inline h-4 w-4 ml-1" />
                        )
                      )}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleReservationSort("customer_name")}
                    >
                      Customer Name
                      {reservationSortConfig.key === "customer_name" && (
                        reservationSortConfig.direction === "asc" ? (
                          <ArrowUpIcon className="inline h-4 w-4 ml-1" />
                        ) : (
                          <ArrowDownIcon className="inline h-4 w-4 ml-1" />
                        )
                      )}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleReservationSort("customer_email")}
                    >
                      Email
                      {reservationSortConfig.key === "customer_email" && (
                        reservationSortConfig.direction === "asc" ? (
                          <ArrowUpIcon className="inline h-4 w-4 ml-1" />
                        ) : (
                          <ArrowDownIcon className="inline h-4 w-4 ml-1" />
                        )
                      )}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleReservationSort("archived_at")}
                    >
                      Archived Date
                      {reservationSortConfig.key === "archived_at" && (
                        reservationSortConfig.direction === "asc" ? (
                          <ArrowUpIcon className="inline h-4 w-4 ml-1" />
                        ) : (
                          <ArrowDownIcon className="inline h-4 w-4 ml-1" />
                        )
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-50 divide-y divide-gray-200">
                  {sortedReservations.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.room_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.customer_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.customer_email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateString(item.archived_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewItem(item, "reservation")}
                          className={`text-blue-600 hover:text-blue-900 mr-4 ${
                            isLoading ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                          disabled={isLoading}
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        {!isSecurity && (
                          <button
                            onClick={() => handleRestoreReservation(item.id)}
                            className={`text-blue-600 hover:text-blue-900 mr-4 ${
                              isLoading ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                            disabled={isLoading}
                            title="Restore Reservation"
                          >
                            <ArrowPathIcon className="h-5 w-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {sortedReservations.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-6 py-4 text-center text-sm text-gray-500"
                      >
                        {isLoading ? "Loading archived reservations..." : "No archived reservations available."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {viewItem && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-[700px] text-gray-700 flex gap-6">
            {viewType === "room" && viewItem.package_id && (
              <div className="w-1/2">
                <img
                  src={getPackageById(viewItem.package_id)?.image}
                  alt="Package"
                  className="rounded-lg mb-4 w-full h-48 object-cover"
                />
                <h3 className="text-lg font-bold mb-1 text-blue-700">
                  {getPackageById(viewItem.package_id)?.name}
                </h3>
                <p className="text-sm text-gray-600 mb-1">
                  <strong>Guests:</strong> {getPackageById(viewItem.package_id)?.guests}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Description:</strong>{" "}
                  {getPackageById(viewItem.package_id)?.description}
                </p>
              </div>
            )}
            <div className="w-1/2">
              {viewType === "room" ? (
                <>
                  <h2 className="text-xl font-bold mb-3 text-blue-700">
                    Room {viewItem.room_number}
                  </h2>
                  <p><strong>Type:</strong> {viewItem.type}</p>
                  <p><strong>Price:</strong> ₱{viewItem.price}</p>
                  <p>
                    <strong>Status:</strong>
                    <span
                      className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        viewItem.status
                      )}`}
                    >
                      {viewItem.status}
                    </span>
                  </p>
                  <p><strong>Archived Date:</strong> {formatDateString(viewItem.archived_at)}</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold mb-3 text-blue-700">
                    Reservation for Room {viewItem.room_id}
                  </h2>
                  <p><strong>Name:</strong> {viewItem.customer_name}</p>
                  <p><strong>Email:</strong> {viewItem.customer_email}</p>
                  <p><strong>Contact:</strong> {viewItem.contact_number}</p>
                  <p><strong>Address:</strong> {viewItem.address}</p>
                  <p><strong>Nationality:</strong> {viewItem.nationality}</p>
                  <p><strong>Check-in:</strong> {formatDateString(viewItem.check_in_date)}</p>
                  <p><strong>Check-out:</strong> {formatDateString(viewItem.check_out_date)}</p>
                  <p><strong>Additional Guests:</strong> {viewItem.additional_guests}</p>
                  <p><strong>Requests:</strong> {viewItem.additional_requests}</p>
                  <p><strong>Remarks:</strong> {viewItem.remarks}</p>
                  {viewItem.id_upload && (
                    <div className="mt-2">
                      <p><strong>ID Upload:</strong></p>
                      <img
                        src={viewItem.id_upload}
                        alt="ID"
                        className="mt-1 w-full h-32 object-contain rounded"
                      />
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setViewItem(null)}
                  className={`bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg ${
                    isLoading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  disabled={isLoading}
                >
                  Close
                </button>
                {!isSecurity && (
                  <button
                    onClick={() => viewType === "room" ? handleRestoreRoom(viewItem.id) : handleRestoreReservation(viewItem.id)}
                    className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg ${
                      isLoading ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    disabled={isLoading}
                  >
                    {isLoading ? "Processing..." : "Restore"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manager approval modal for privileged actions */}
      <ManagerApprovalModal
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        onApprove={onApprove}
      />
    </div>
  );
}
