'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';

// Package List
const rooms = [
  {
    id: 1,
    name: "Single Room",
    price: "₱350-₱500",
    guests: "1-2",
    image: "/room/singleroom.jpg",
    description: "₱350 = 6hrs, ₱500 = 12hrs with common toilet and bath, aircon, and wifi.",
  },
  {
    id: 1,
    name: "Single Room",
    price: "₱450-₱600",
    guests: "1-2",
    image: "/room/singleroom.jpg",
    description: "₱450 = 6hrs, ₱600 = 12hrs with private toilet and bath, aircon, and wifi.",
  },
  {
    id: 2,
    name: "Standard Room",
    price: "₱1,500",
    guests: "1-2",
    image: "/room/standardroom.jpg",
    description: "With free Breakfast, private toilet and bath, aircon, and wifi.",
  },
  {
    id: 3,
    name: "Double Standard",
    price: "₱2,000",
    guests: "2",
    image: "/room/doublestandard.jpg",
    description: "With free Breakfast, private toilet and bath, aircon, and wifi.",
  },
  {
    id: 4,
    name: "Triple Room",
    price: "₱2,200",
    guests: "3",
    image: "/room/tripleroom.jpg",
    description: "With free Breakfast, private toilet and bath, aircon, and wifi.",
  },
  {
    id: 5,
    name: "Family Room",
    price: "₱2,500",
    guests: "4",
    image: "/room/familyroom.jpg",
    description: "Extension and Early Check-in: ₱150/hr. With free Breakfast, private toilet and bath, aircon, and wifi.",
  },
  {
    id: 6,
    name: "Barkadahan Room",
    price: "₱4,000",
    guests: "8",
    image: "/room/barkadahanroom.jpg",
    description: "With private toilet and bath, aircon, and wifi.",
  },
];
// Event Package List
const packages = [
  {
    id: 1,
    name: "Basic Event Package",
    price: "₱5,000",
    description: "Includes venue, basic setup, and catering for up to 50 guests.",
  },
  {
    id: 2,
    name: "Premium Event Package",
    price: "₱10,000",
    description: "Includes venue, premium setup, catering, and entertainment for up to 100 guests.",
  },
  {
    id: 3,
    name: "Deluxe Event Package",
    price: "₱15,000",
    description: "Includes venue, deluxe setup, catering, entertainment, and decorations for up to 150 guests.",
  },
];

export default function Reservations() {
  const { token } = useAuth();
  const [roomReservations, setRoomReservations] = useState([]);
  const [eventReservations, setEventReservations] = useState([]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    customerName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('room');
  const tableRef = useRef(null);
  const [roomIdToPackageName, setRoomIdToPackageName] = useState({});
  const [eventPackageIdToName, setEventPackageIdToName] = useState({});

  // Custom notification handler
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Fetch reservations with improved error handling
  const fetchReservations = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch unified archived reservations API and split into room/event lists
      const params = new URLSearchParams();
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.customerName) params.append('customer_name', filters.customerName);

      const url = `/api/archived-reservations?${params.toString()}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`Failed to fetch archived reservations: ${res.statusText}`);
      const rows = await res.json();

      // Normalize into the shapes expected by the UI tables
      const rooms = [];
      const events = [];
      for (const r of rows) {
        if ((r.reservation_type || '').toLowerCase() === 'room') {
          rooms.push({
            id: r.id,
            room_id: r.source_id || null,
            room_number: r.room_number || null,
            package_name: r.metadata?.package_name || r.metadata?.package || r.package_name || null,
            customer_name: r.customer_name || null,
            check_in_date: r.check_in_date || null,
            check_out_date: r.check_out_date || null,
            total_price: r.total != null ? Number(r.total) : (r.subtotal != null ? Number(r.subtotal) : null),
            reference: r.reference_number || r.reference || r.metadata?.reference_number || r.metadata?.ref || r.metadata?.gcash_ref || null,
            raw: r,
          });
        } else if ((r.reservation_type || '').toLowerCase() === 'event') {
          events.push({
            id: r.id,
            source_id: r.source_id || null,
            event_name: r.event_name || null,
            // archived_reservations may not include a dedicated package id column; prefer metadata or package_name
            event_package_id: r.event_package_id || r.package_id || null,
            package_name: r.metadata?.package_name || r.metadata?.package || r.package_name || r.event_package_name || null,
            customer_name: r.customer_name || null,
            event_date: r.event_date || null,
            guests: r.guests || 0,
            total: r.total != null ? Number(r.total) : (r.subtotal != null ? Number(r.subtotal) : 0),
            cashier: r.cashier_name || r.metadata?.cashier_name || r.metadata?.cashier || r.cashier || null,
            reference: r.reference_number || r.reference || r.metadata?.reference_number || r.metadata?.ref || r.metadata?.gcash_ref || null,
            raw: r,
          });
        }
      }

      setRoomReservations(rooms);
      setEventReservations(events);
      showNotification('Reservation history loaded', 'success');
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  // Check for an external navigation request (e.g., Overview stat card) to open a specific tab
  useEffect(() => {
    try {
      const requested = typeof window !== 'undefined' ? localStorage.getItem('reservationHistoryActiveTab') : null;
      if (requested) {
        setActiveTab(requested);
        // remove the flag so repeated visits don't reuse it
        try { localStorage.removeItem('reservationHistoryActiveTab'); } catch (e) {}
        // scroll table into view after render
        setTimeout(() => {
          tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } catch (e) {
      // ignore storage errors
    }
  }, []);

  // Fetch supporting data for package name resolution
  useEffect(() => {
    const fetchMaps = async () => {
      try {
        const [roomsRes, packagesRes] = await Promise.all([
          fetch('/api/room', { headers: token ? { Authorization: `Bearer ${token}` } : undefined }),
          fetch('/api/event_packages', { headers: token ? { Authorization: `Bearer ${token}` } : undefined }),
        ]);
        if (roomsRes.ok) {
          const roomsData = await roomsRes.json();
          const map = {};
          roomsData.forEach((r) => {
            map[r.id] = r.package?.name || r.package_name || 'N/A';
          });
          setRoomIdToPackageName(map);
        }
        if (packagesRes.ok) {
          const pkgs = await packagesRes.json();
          const pkgMap = {};
          pkgs.forEach((p) => { pkgMap[p.id] = p.name; });
          setEventPackageIdToName(pkgMap);
        }
      } catch (e) {
        // silent fail; UI will fallback to N/A
      }
    };
    fetchMaps();
  }, [token]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const applyFilters = (e) => {
    e.preventDefault();
    if (!filters.startDate && !filters.endDate && !filters.customerName) {
      showNotification('Please provide at least one filter criterion', 'warning');
      return;
    }
    fetchReservations();
  };

  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '', customerName: '' });
    showNotification('Filters cleared', 'info');
    setTimeout(fetchReservations, 0);
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Total Calculations with error handling
  const calculateRoomTotal = () => {
    try {
      return roomReservations
        .reduce((sum, res) => {
          // Prefer server-calculated total_price when available
          if (res.total_price !== undefined && res.total_price !== null) {
            const tp = Number(res.total_price || 0);
            if (!isNaN(tp)) return sum + tp;
          }
          if (!res.price || !res.check_in_date || !res.check_out_date) {
            console.warn('Invalid reservation data:', res);
            return sum;
          }
          const checkIn = new Date(res.check_in_date);
          const checkOut = new Date(res.check_out_date);
          if (isNaN(checkIn) || isNaN(checkOut)) {
            console.warn('Invalid date format in reservation:', res);
            return sum;
          }
          const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
          return sum + res.price * nights;
        }, 0)
        .toFixed(2);
    } catch (err) {
      console.error('Error calculating room total:', err);
      return '0.00';
    }
  };

  const calculateEventTotal = () => {
    try {
      return eventReservations
        .reduce((sum, res) => {
          const total = parseFloat(res.total);
          if (isNaN(total)) {
            console.warn('Invalid total in event reservation:', res);
            return sum;
          }
          return sum + total;
        }, 0)
        .toFixed(2);
    } catch (err) {
      console.error('Error calculating event total:', err);
      return '0.00';
    }
  };

  // Get package name by ID
  const getRoomPackageName = (roomId) => {
    return roomIdToPackageName[roomId] || 'N/A';
  };

  const getEventPackageName = (packageId) => {
    return eventPackageIdToName[packageId] || 'N/A';
  };

  return (
    <div className="container mx-auto p-4 sm:p-6">
      {/* Notification Display */}
      {notification && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-md text-white text-sm
          ${notification.type === 'error' ? 'bg-red-500' :
            notification.type === 'success' ? 'bg-blue-500' :
            notification.type === 'warning' ? 'bg-yellow-500' :
            'bg-blue-500'}`}>
          {notification.message}
          <button
            onClick={() => setNotification(null)}
            className="ml-2 font-bold"
          >
            ×
          </button>
        </div>
      )}

      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-blue-700 text-center">
        Reservation History
      </h1>

      <div className="bg-white shadow rounded-lg p-6">
      {/* Filter Form */}
      <form onSubmit={applyFilters} className="mb-8 p-4 bg-gray-100 rounded-lg shadow text-black">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-black">Start Date</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black">End Date</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black">Customer Name</label>
            <input
              type="text"
              name="customerName"
              value={filters.customerName}
              onChange={handleFilterChange}
              placeholder="Enter customer name"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
          <button 
            type="submit" 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:bg-gray-400"
            disabled={loading}
          >
            {loading ? 'Applying...' : 'Apply Filters'}
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm disabled:bg-gray-400"
            disabled={loading}
          >
            Clear Filters
          </button>
        </div>
      </form>

      {/* Tabs */}
      <div className="mb-6 flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0 border-b border-gray-300">
        <button
          onClick={() => switchTab('room')}
          className={`px-4 py-2 font-semibold text-sm sm:text-base ${activeTab === 'room'
              ? 'text-blue-700 border-b-2 border-blue-700'
              : 'text-gray-500 hover:text-blue-700'
            }`}
          disabled={loading}
        >
          Room Reservations
        </button>
        <button
          onClick={() => switchTab('event')}
          className={`px-4 py-2 font-semibold text-sm sm:text-base ${activeTab === 'event'
              ? 'text-blue-700 border-b-2 border-blue-700'
              : 'text-gray-500 hover:text-blue-700'
            }`}
          disabled={loading}
        >
          Event Reservations
        </button>
      </div>

      {loading && (
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-black text-sm mt-2">Loading reservations...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
          <button
            onClick={() => setError(null)}
            className="absolute top-0 right-0 px-4 py-3"
          >
            <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
            </svg>
          </button>
        </div>
      )}

      {/* Tables */}
      <div ref={tableRef}>
        {/* Room Table */}
        {activeTab === 'room' && (
          <div>
            {roomReservations.length === 0 && !loading && !error ? (
              <p className="text-black text-sm">No room reservations found.</p>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="min-w-full bg-white border border-blue-200 text-black table-fixed">
                  <thead>
                    <tr className="bg-blue-100">
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm w-1/6">Room No.</th>
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm w-1/6">Package</th>
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm w-1/6">Customer</th>
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm w-1/6">Check-in</th>
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm w-1/6">Check-out</th>
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm w-1/6">Reference</th>
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm w-1/6">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomReservations.map((res) => (
                      <tr key={res.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">{res.room_number || 'N/A'}</td>
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">
                          {getRoomPackageName(res.room_id)}
                        </td>
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">{res.customer_name || 'N/A'}</td>
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">
                          {res.check_in_date ? new Date(res.check_in_date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">
                          {res.check_out_date ? new Date(res.check_out_date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">{res.reference || 'N/A'}</td>
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">
                          {res.total_price !== undefined && res.total_price !== null ? (
                            `₱${Number(res.total_price || 0).toFixed(2)}`
                          ) : res.price ? (
                            `₱${(
                              res.price *
                              Math.max(
                                1,
                                Math.ceil(
                                  (new Date(res.check_out_date) - new Date(res.check_in_date)) /
                                  (1000 * 60 * 60 * 24)
                                )
                              )
                            ).toFixed(2)}`
                          ) : (
                            'Price not available'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50 font-semibold">
                      <td colSpan="6" className="py-2 px-3 border-t text-left text-xs sm:text-sm">
                        Total
                      </td>
                      <td className="py-2 px-3 border-t text-xs sm:text-sm">₱{calculateRoomTotal()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Event Table */}
        {activeTab === 'event' && (
          <div>
            {eventReservations.length === 0 && !loading && !error ? (
              <p className="text-black text-sm">No event reservations found.</p>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="min-w-full bg-white border border-gray-200 text-black table-fixed">
                  <thead>
                    <tr className="bg-blue-100">
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm">Event Name</th>
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm">Package</th>
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm">Customer</th>
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm">Event Date</th>
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm">Guests</th>
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm">Reference</th>
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm">Cashier</th>
                      <th className="py-2 px-3 border-b text-left text-xs sm:text-sm">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventReservations.map((res) => (
                      <tr key={res.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">{res.event_name || 'N/A'}</td>
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">
                          {res.package_name || getEventPackageName(res.event_package_id ?? res.package_id ?? res.packageId)}
                        </td>
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">{res.customer_name || 'N/A'}</td>
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">
                          {res.event_date ? new Date(res.event_date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">{res.guests || '0'}</td>
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">{res.reference || 'N/A'}</td>
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">{res.cashier || 'N/A'}</td>
                        <td className="py-2 px-3 border-b text-xs sm:text-sm">₱{res.total || '0.00'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50 font-semibold">
                      <td colSpan="7" className="py-2 px-3 border-t text-left text-xs sm:text-sm">
                        Total
                      </td>
                      <td className="py-2 px-3 border-t text-xs sm:text-sm">₱{calculateEventTotal()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
