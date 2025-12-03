"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../context/AuthContext";
import packagesData from "../data/packages";
import {
  HomeIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@heroicons/react/24/outline";

// Status color utility
const getStatusColor = (status) => {
  switch (status) {
    case "Available":
      return "bg-blue-100 text-blue-800";
    case "Occupied":
      return "bg-red-100 text-red-800";
    case "Maintenance":
      return "bg-yellow-100 text-yellow-800";
    case "Reserved":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

// Package lookup
const getPackageById = (packages, id) =>
  packages.find((pkg) => String(pkg.id) === String(id));

export default function RoomManagement() {
  const [rooms, setRooms] = useState([]);
  const [packages, setPackages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "room_number",
    direction: "asc",
  });
  const [editingRoom, setEditingRoom] = useState(null);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [roomForm, setRoomForm] = useState({
    id: null,
    room_number: "",
    type: "",
    price: "",
    status: "Available",
    packageId: "",
  });
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { token, isInitialized } = useAuth();
  const router = useRouter();

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

  // Fetch rooms and packages on component mount
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

        const roomResponse = await fetch("/api/room", { headers: { Authorization: `Bearer ${token}` } });
        if (!roomResponse.ok) {
          throw new Error("Failed to fetch rooms: Server error");
        }
        const roomData = await roomResponse.json();
        const packageData = packagesData;

        setRooms(roomData);
        setPackages(packageData);
      } catch (err) {
        setError(err.message || "An unexpected error occurred while fetching data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isInitialized, token, router]);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle sort
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Handle room form changes
  const handleRoomFormChange = (e) => {
    const { name, value } = e.target;
    setRoomForm((prev) => ({ ...prev, [name]: value }));
  };

  // Start editing a room
  const startEditingRoom = (room) => {
    setEditingRoom(room.id);
    setIsAddingRoom(false);
    setRoomForm({
      id: room.id,
      room_number: room.room_number,
      type: room.type || "",
      price: room.price || "",
      status: room.status,
      packageId: room.packageId || "",
    });
    setError(null);
  };

  // Start adding a new room
  const startAddingRoom = () => {
    setIsAddingRoom(true);
    setEditingRoom(null);
    setRoomForm({
      id: null,
      room_number: "",
      type: "",
      price: "",
      status: "Available",
      packageId: "",
    });
    setError(null);
  };

  // Validate form inputs
  const validateForm = () => {
    if (!roomForm.room_number.trim()) {
      return "Room number is required";
    }
    if (!roomForm.type.trim()) {
      return "Room type is required";
    }
    if (!roomForm.price || parseFloat(roomForm.price) < 0) {
      return "Price must be a non-negative number";
    }
    if (!roomForm.packageId) {
      return "Please select a package";
    }
    return null;
  };

  // Save room (add or edit)
  const handleAddRoom = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Validate form
      const validationError = validateForm();
      if (validationError) {
        throw new Error(validationError);
      }

      if (!isInitialized) return;
      if (!token) {
        setError("Authentication token not found. Please log in.");
        router.push('/components/sign-in');
        setIsLoading(false);
        return;
      }

      const url = isAddingRoom ? "/api/room/editroom" : `/api/room/${roomForm.id}`;
      const method = isAddingRoom ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          room_number: roomForm.room_number.trim(),
          type: roomForm.type.trim(),
          price: parseFloat(roomForm.price),
          status: roomForm.status,
          packageId: parseInt(roomForm.packageId),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isAddingRoom ? "add" : "save"} room`);
      }

      const updatedRoom = await response.json();
      if (isAddingRoom) {
        setRooms([...rooms, updatedRoom]);
      } else {
        setRooms(
          rooms.map((room) =>
            room.id === updatedRoom.id ? { ...room, ...updatedRoom } : room
          )
        );
      }
      
      setEditingRoom(null);
      setIsAddingRoom(false);
      setRoomForm({
        id: null,
        room_number: "",
        type: "",
        price: "",
        status: "Available",
        packageId: "",
      });
      setSuccessMessage(`Room ${isAddingRoom ? "added" : "updated"} successfully!`);
    } catch (err) {
      setError(err.message || `An unexpected error occurred while ${isAddingRoom ? "adding" : "updating"} room`);
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel editing or adding
  const cancelEditing = () => {
    setEditingRoom(null);
    setIsAddingRoom(false);
    setRoomForm({
      id: null,
      room_number: "",
      type: "",
      price: "",
      status: "Available",
      packageId: "",
    });
    setError(null);
  };

  // Delete room
  const deleteRoom = async (id) => {
    setError(null);
    setIsLoading(true);
    
    try {
      if (!isInitialized) return;
      if (!token) {
        setError("Authentication token not found. Please log in.");
        router.push('/components/sign-in');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`/api/room?id=${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete room");
      }

      setRooms(rooms.filter((room) => room.id !== id));
      setSuccessMessage("Room deleted successfully!");
    } catch (err) {
      setError(err.message || "An unexpected error occurred while deleting room");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort rooms
  const sortedRooms = [...rooms]
    .filter((room) => {
      const searchLower = searchTerm.toLowerCase();
      const fieldsToSearch = [
        room.room_number,
        room.type,
        room.status,
        room.price,
      ];
      return fieldsToSearch.some((field) =>
        field?.toString().toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const aValue = a?.[sortConfig.key] ?? "";
      const bValue = b?.[sortConfig.key] ?? "";
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
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

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <HomeIcon className="h-7 w-7 text-blue-600" />
            <h2 className="text-2xl font-semibold text-blue-700">Manage Rooms</h2>
          </div>
          <button
            onClick={startAddingRoom}
            disabled={isLoading}
            className={`px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
              isLoading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <PlusIcon className="h-5 w-5 inline-block mr-2" />
            Add Room
          </button>
        </div>

        {/* Add/Edit Form */}
        {(editingRoom || isAddingRoom) && (
          <div className="mb-8 p-6 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-800 mb-4">
              {isAddingRoom ? "Add New Room" : "Edit Room Details"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1.5">
                  Room Number
                </label>
                <input
                  type="text"
                  name="room_number"
                  value={roomForm.room_number}
                  onChange={handleRoomFormChange}
                  className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1.5">
                  Type
                </label>
                <input
                  type="text"
                  name="type"
                  value={roomForm.type}
                  onChange={handleRoomFormChange}
                  className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1.5">
                  Price (₱)
                </label>
                <input
                  type="number"
                  name="price"
                  value={roomForm.price}
                  onChange={handleRoomFormChange}
                  min="0"
                  step="0.01"
                  className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1.5">
                  Status
                </label>
                <select
                  name="status"
                  value={roomForm.status}
                  onChange={handleRoomFormChange}
                  className="w-full px-4 py-2 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  disabled={isLoading}
                >
                  <option value="Available">Available</option>
                  <option value="Occupied">Occupied</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Reserved">Reserved</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-blue-700 mb-1.5">
                  Package
                </label>
                <select
                  name="packageId"
                  value={roomForm.packageId}
                  onChange={handleRoomFormChange}
                  className="w-full px-4 py-2 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  disabled={isLoading}
                >
                  <option value="">Select a package</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleAddRoom}
                disabled={isLoading}
                className={`px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isLoading ? "Processing..." : isAddingRoom ? "Add Room" : "Save Room"}
              </button>
              <button
                onClick={cancelEditing}
                disabled={isLoading}
                className={`px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Room List */}
        <div>
          <h3 className="text-lg font-large text-blue-800 mb-4">Room List</h3>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              disabled={isLoading}
            />
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Table for larger screens; horizontally scrollable on small devices */}
            <div className="overflow-x-auto">
              <div className="min-w-full">
                <div className="overflow-y-auto" style={{ maxHeight: "500px" }}>
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-100 text-left text-gray-700">
                        <th
                          className="p-3 bg-gray-100 cursor-pointer"
                          onClick={() => handleSort("room_number")}
                        >
                          <div className="flex items-center">
                            Room No.
                            {sortConfig.key === "room_number" &&
                              (sortConfig.direction === "asc" ? (
                                <ArrowUpIcon className="ml-1 h-4 w-4" />
                              ) : (
                                <ArrowDownIcon className="ml-1 h-4 w-4" />
                              ))}
                          </div>
                        </th>
                        <th
                          className="p-3 bg-gray-100 cursor-pointer"
                          onClick={() => handleSort("type")}
                        >
                          <div className="flex items-center">
                            Type
                            {sortConfig.key === "type" &&
                              (sortConfig.direction === "asc" ? (
                                <ArrowUpIcon className="ml-1 h-4 w-4" />
                              ) : (
                                <ArrowDownIcon className="ml-1 h-4 w-4" />
                              ))}
                          </div>
                        </th>
                        <th
                          className="p-3 bg-gray-100 cursor-pointer"
                          onClick={() => handleSort("price")}
                        >
                          <div className="flex items-center">
                            Price
                            {sortConfig.key === "price" &&
                              (sortConfig.direction === "asc" ? (
                                <ArrowUpIcon className="ml-1 h-4 w-4" />
                              ) : (
                                <ArrowDownIcon className="ml-1 h-4 w-4" />
                              ))}
                          </div>
                        </th>
                        <th
                          className="p-3 bg-gray-100 cursor-pointer"
                          onClick={() => handleSort("status")}
                        >
                          <div className="flex items-center">
                            Status
                            {sortConfig.key === "status" &&
                              (sortConfig.direction === "asc" ? (
                                <ArrowUpIcon className="ml-1 h-4 w-4" />
                              ) : (
                                <ArrowDownIcon className="ml-1 h-4 w-4" />
                              ))}
                          </div>
                        </th>
                        <th className="p-3 bg-gray-100">Package</th>
                        <th className="p-3 bg-gray-100">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRooms.map((room, index) => (
                        <tr
                          key={`${room.id}-${index}`}
                          className="border-t hover:bg-gray-50 text-gray-700"
                        >
                          <td className="p-3">{room.room_number}</td>
                          <td className="p-3">{room.type}</td>
                          <td className="p-3">${room.price}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                room.status
                              )}`}
                            >
                              {room.status}
                            </span>
                          </td>
                          <td className="p-3">
                            {room.packageId
                              ? getPackageById(packages, room.packageId)?.name || "—"
                              : "—"}
                          </td>
                          <td className="p-3 flex gap-2">
                            <button
                              onClick={() => startEditingRoom(room)}
                              disabled={isLoading}
                              className={`p-2 bg-yellow-100 rounded-md touch-manipulation ${isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-yellow-200"}`}
                              title="Edit"
                            >
                              <PencilIcon className="h-4 w-4 text-yellow-600" />
                            </button>
                            <button
                              onClick={() => deleteRoom(room.id)}
                              disabled={isLoading}
                              className={`p-2 bg-red-100 rounded-md touch-manipulation ${isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-red-200"}`}
                              title="Delete"
                            >
                              <TrashIcon className="h-4 w-4 text-red-600" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {sortedRooms.length === 0 && (
                        <tr>
                          <td colSpan="6" className="p-4 text-center text-gray-500">
                            {isLoading ? "Loading rooms..." : "No rooms found."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

            {/* Mobile: card list */}
            <div className="md:hidden space-y-3 mt-4">
              {sortedRooms.map((room) => (
                <div key={room.id} className="bg-white p-4 rounded-lg shadow flex flex-col">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800">Room {room.room_number}</h4>
                      <p className="text-sm text-gray-500">{room.type} • ₱{room.price}</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>{room.status}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => startEditingRoom(room)} className="flex-1 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-md touch-manipulation">Edit</button>
                    <button onClick={() => deleteRoom(room.id)} className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-md touch-manipulation">Delete</button>
                  </div>
                </div>
              ))}
            </div>
        </div>
      </div>
    </div>
  );
}
