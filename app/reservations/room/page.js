"use client";

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Swal from 'sweetalert2';

export default function RoomReservation({ selectedPackage = null, onClose = null }) {
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    contactNumber: '',
    address: '',
    nationality: '',
    additionalGuests: 0,
    checkInDate: '',
    checkOutDate: '',
    additionalRequests: '',
  });
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [idUpload, setIdUpload] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsScrolled, setTermsScrolled] = useState(false);
  const [dataPrivacyAccepted, setDataPrivacyAccepted] = useState(false);
  const [termsConditionsAccepted, setTermsConditionsAccepted] = useState(false);
  const [showDataPrivacyModal, setShowDataPrivacyModal] = useState(false);
  const [showTermsConditionsModal, setShowTermsConditionsModal] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const fileRef = useRef(null);
  const termsRef = useRef(null);

  useEffect(() => {
    // Fetch rooms availability
    const fetchRooms = async () => {
      try {
        setRoomsLoading(true);
        const res = await fetch("/api/room");
        if (res.ok) {
          const data = await res.json();
          setRooms(data || []);
        }
      } catch (err) {
        console.error("Failed to fetch rooms:", err);
      } finally {
        setRoomsLoading(false);
      }
    };
    
    fetchRooms();
  }, []);

  useEffect(() => {
    // Fetch packages from the static data
    const fetchPackages = async () => {
      try {
        // Import the packages data directly
        const packagesData = [
          { id: 1, name: "Single Room", price: "₱350-₱500", guests: "1-2", image: "/room/singleroom.jpg", description: "₱350 = 6hrs, ₱500 = 12hrs with common toilet and bath, aircon, and wifi." },
          { id: 7, name: "Single Room (Private)", price: "₱450-₱600", guests: "1-2", image: "/room/singleroom.jpg", description: "₱450 = 6hrs, ₱600 = 12hrs with private toilet and bath, aircon, and wifi." },
          { id: 2, name: "Standard Room", price: "₱1,500", guests: "1-2", image: "/room/standardroom.jpg", description: "With free Breakfast, private toilet and bath, aircon, and wifi." },
          { id: 3, name: "Double Standard", price: "₱2,000", guests: "2", image: "/room/doublestandard.jpg", description: "With free Breakfast, private toilet and bath, aircon, and wifi." },
          { id: 4, name: "Triple Room", price: "₱2,200", guests: "3", image: "/room/tripleroom.jpg", description: "With free Breakfast, private toilet and bath, aircon, and wifi." },
          { id: 5, name: "Family Room", price: "₱2,500", guests: "4", image: "/room/familyroom.jpg", description: "Extension and Early Check-in: ₱150/hr. With free Breakfast, private toilet and bath, aircon, and wifi." },
          { id: 6, name: "Barkadahan Room", price: "₱4,000", guests: "8", image: "/room/barkadahanroom.jpg", description: "With private toilet and bath, aircon, and wifi." },
        ];
        setPackages(packagesData);
        
        // If selectedPackage prop is provided, pre-select it
        if (selectedPackage && selectedPackage.id) {
          setSelectedPackageId(String(selectedPackage.id));
        }
      } catch (err) {
        console.error('Error loading packages', err);
        setPackages([]);
      }
    };
    fetchPackages();
  }, [selectedPackage]);

  // Helper function to get maximum guests allowed for selected package
  const getMaxGuests = () => {
    if (!selectedPackageId) return 0;
    const selectedPkg = packages.find(p => p.id === parseInt(selectedPackageId));
    if (!selectedPkg || !selectedPkg.guests) return 0;
    
    const guestsStr = selectedPkg.guests;
    // Parse guest limits like "1-2", "2", "3", "4", "8"
    const match = guestsStr.match(/(\d+)(?:-(\d+))?/);
    if (match) {
      // If range (e.g., "1-2"), return the max value
      const maxGuests = match[2] ? parseInt(match[2]) : parseInt(match[1]);
      return maxGuests;
    }
    return 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Validate additional guests against package maximum
    if (name === 'additionalGuests') {
      const maxGuests = getMaxGuests();
      const numValue = parseInt(value) || 0;
      
      if (maxGuests > 0 && numValue > maxGuests) {
        Swal.fire({
          icon: 'warning',
          title: 'Guest Limit Exceeded',
          text: `The selected room package allows a maximum of ${maxGuests} guest${maxGuests > 1 ? 's' : ''}. Please select a different room or reduce the number of additional guests.`,
          confirmButtonColor: '#f59e0b'
        });
        return; // Don't update the value
      }
    }
    
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setIdUpload(reader.result);
    reader.readAsDataURL(file);
  };

  // Calculate estimated total based on package price and additional guests
  const calculateEstimatedTotal = () => {
    if (!selectedPackageId) return 0;
    const selectedPkg = packages.find(p => p.id === parseInt(selectedPackageId));
    if (!selectedPkg) return 0;
    
    // Check if this is a Single Room package
    const isSingleRoom = selectedPkg.name.toLowerCase().includes('single room');
    
    // Extract base price from package price string
    const priceStr = selectedPkg.price || '';
    let basePrice = 0;
    
    if (isSingleRoom) {
      // For Single Room packages with range pricing (e.g., "₱350-₱500")
      // Use the 6hrs price as default
      const priceMatch = priceStr.match(/₱?([\d,]+)/);
      basePrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
    } else {
      // For other packages, extract the first price
      const priceMatch = priceStr.match(/[\d,]+/);
      basePrice = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : 0;
    }
    
    // For Single Room: Fixed one-day pricing
    if (isSingleRoom) {
      const additionalGuestCount = parseInt(form.additionalGuests) || 0;
      const additionalGuestCost = basePrice * additionalGuestCount;
      return basePrice + additionalGuestCost;
    }
    
    // For other rooms: Calculate based on reserved days
    const msPerDay = 1000 * 60 * 60 * 24;
    let reservedDays = 1;
    try {
      if (form.checkInDate && form.checkOutDate) {
        const inDate = new Date(form.checkInDate);
        const outDate = new Date(form.checkOutDate);
        const diff = Math.ceil((outDate - inDate) / msPerDay);
        reservedDays = diff > 0 ? diff : 1;
      }
    } catch (err) {
      reservedDays = 1;
    }

    // Formula: Room Price × Reserved Days (fixed to support 1-night stays)
    let baseTotal = basePrice * reservedDays;

    // Calculate additional guest cost
    const additionalGuestCount = parseInt(form.additionalGuests) || 0;
    const additionalGuestCost = basePrice * additionalGuestCount;

    return baseTotal + additionalGuestCost;
  };

  const handleTermsScroll = (e) => {
    const element = e.target;
    const scrolledToBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 5;
    if (scrolledToBottom) {
      setTermsScrolled(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!selectedPackageId) {
        alert('Please select a room package');
        setSubmitting(false);
        return;
      }
      
      // Check if both Data Privacy and Terms & Conditions are accepted
      if (!dataPrivacyAccepted || !termsConditionsAccepted) {
        await Swal.fire({
          icon: 'warning',
          title: 'Agreement Required',
          text: 'Please read and agree to the Data Privacy & Policy and Terms & Conditions before submitting your reservation.',
          confirmButtonColor: '#f59e0b'
        });
        setSubmitting(false);
        return;
      }
      
      if (!termsAccepted) {
        await Swal.fire({
          icon: 'warning',
          title: 'Terms and Conditions Required',
          text: 'Please read and accept the Terms and Conditions to continue.',
          confirmButtonColor: '#f59e0b'
        });
        setSubmitting(false);
        return;
      }
      const selectedPackage = packages.find(p => p.id === parseInt(selectedPackageId));
      
      // Extract price value from package price string (e.g., "₱350-₱500" or "₱1,500")
      const priceStr = selectedPackage?.price || '';
      const priceMatch = priceStr.match(/[\d,]+/);
      const basePrice = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : 0;
      
      // Calculate total with additional guests
      const estimatedTotal = calculateEstimatedTotal();
      
      // Submit to pending reservations API (for approval workflow)
      const response = await fetch('/api/pending-reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'room', // Specify this is a room reservation
          package_id: selectedPackage?.id || null,
          package_name: selectedPackage?.name,
          customer_name: form.customerName,
          customer_email: form.customerEmail,
          contact_number: form.contactNumber,
          check_in_date: form.checkInDate,
          check_out_date: form.checkOutDate,
          address: form.address,
          nationality: form.nationality,
          additional_guests: parseInt(form.additionalGuests) || 0,
          additional_requests: form.additionalRequests,
          total: estimatedTotal,
          id_upload: idUpload,
          status: 'pending_approval', // Initial status for approval workflow
          payment_option: 'checkout' // Default for homepage submissions
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Reservation Submitted!',
          html: 'Your reservation is pending approval from our management team.<br>We will contact you shortly.',
          confirmButtonColor: '#3b82f6',
          confirmButtonText: 'OK'
        });
        
        // Reset form
        setForm({
          customerName: '',
          customerEmail: '',
          contactNumber: '',
          address: '',
          nationality: '',
          additionalGuests: 0,
          checkInDate: '',
          checkOutDate: '',
          additionalRequests: '',
        });
        setSelectedPackageId('');
        setIdUpload(null);
        setTermsAccepted(false);
        setTermsScrolled(false);
        if (fileRef.current) fileRef.current.value = '';
        
        // Close modal if onClose callback provided
        if (onClose) {
          setTimeout(() => onClose(), 500);
        }
      } else {
        console.error('Server error:', data);
        await Swal.fire({
          icon: 'error',
          title: 'Submission Failed',
          html: `<div class="text-left">
            <p class="mb-2"><strong>Error:</strong> ${data.error || 'Unknown error occurred'}</p>
            ${data.details ? `<p class="text-sm text-gray-600"><strong>Details:</strong> ${data.details}</p>` : ''}
          </div>`,
          confirmButtonColor: '#ef4444'
        });
      }
    } catch (err) {
      console.error('Submission error:', err);
      await Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        html: `<div class="text-left">
          <p class="mb-2">Failed to submit reservation. Please try again.</p>
          <p class="text-sm text-gray-600"><strong>Error:</strong> ${err.message}</p>
        </div>`,
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-white py-12 px-6">
      <div className="max-w-4xl mx-auto bg-gray-50 border rounded-lg p-6">
        <div className="text-center mb-6">
          <Image src="/SRCB.png" alt="Logo" width={96} height={96} className="mx-auto" />
          <h1 className="text-2xl font-bold mt-4">Room Reservation</h1>
          <p className="text-gray-600">Fill in the details below to reserve a room.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Room Package *</label>
            <select
              value={selectedPackageId}
              onChange={(e) => {
                const pkgId = e.target.value;
                setSelectedPackageId(pkgId);
                
                // Reset additional guests when package changes
                setForm(f => ({ ...f, additionalGuests: 0 }));
                
                // If Single Room package selected, auto-set check-out date
                const selectedPkg = packages.find(p => p.id === parseInt(pkgId));
                if (selectedPkg && selectedPkg.name.toLowerCase().includes('single room')) {
                  // If check-in date exists, set check-out to next day
                  if (form.checkInDate) {
                    const checkInDate = new Date(form.checkInDate);
                    const nextDay = new Date(checkInDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    const year = nextDay.getFullYear();
                    const month = String(nextDay.getMonth() + 1).padStart(2, '0');
                    const day = String(nextDay.getDate()).padStart(2, '0');
                    const checkOutDate = `${year}-${month}-${day}`;
                    setForm(f => ({ ...f, checkOutDate }));
                  } else {
                    // If no check-in date, set to today and tomorrow
                    const today = new Date();
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    
                    const todayStr = today.toISOString().split('T')[0];
                    const tomorrowStr = tomorrow.toISOString().split('T')[0];
                    
                    setForm(f => ({ ...f, checkInDate: todayStr, checkOutDate: tomorrowStr }));
                  }
                }
              }}
              className="w-full p-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              required
            >
              <option value="">Select Package</option>
              {packages.map((pkg) => {
                // Check if there are available rooms for this package
                const availableRoomsForPackage = rooms.filter(
                  (room) => room.packageId === pkg.id && (room.status || '').toLowerCase() === 'available'
                ).length;
                const hasAvailableRooms = availableRoomsForPackage > 0;
                
                return (
                  <option 
                    key={pkg.id} 
                    value={pkg.id}
                    disabled={!roomsLoading && !hasAvailableRooms}
                    style={!roomsLoading && !hasAvailableRooms ? { color: '#9ca3af', backgroundColor: '#f3f4f6' } : {}}
                  >
                    {pkg.name} - {pkg.price} (Guests: {pkg.guests})
                    {!roomsLoading && !hasAvailableRooms ? ' - Fully Booked' : ''}
                    {!roomsLoading && hasAvailableRooms ? ` - ${availableRoomsForPackage} available` : ''}
                  </option>
                );
              })}
            </select>
            {!roomsLoading && selectedPackageId && (() => {
              const availableRoomsForSelectedPackage = rooms.filter(
                (room) => room.packageId === parseInt(selectedPackageId) && (room.status || '').toLowerCase() === 'available'
              ).length;
              if (availableRoomsForSelectedPackage === 0) {
                return (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      <strong>⚠️ Notice:</strong> This package is currently fully booked. Please select a different package or contact us for availability updates.
                    </p>
                  </div>
                );
              }
              return null;
            })()}
            {selectedPackageId && packages.find(p => p.id === parseInt(selectedPackageId)) && (
              <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex gap-3">
                  <Image 
                    src={packages.find(p => p.id === parseInt(selectedPackageId)).image} 
                    alt="Package" 
                    width={80} 
                    height={60} 
                    className="object-cover rounded"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">{packages.find(p => p.id === parseInt(selectedPackageId)).name}</div>
                    <div className="text-sm text-gray-600 mb-2">{packages.find(p => p.id === parseInt(selectedPackageId)).description}</div>
                    {(() => {
                      const selectedPkg = packages.find(p => p.id === parseInt(selectedPackageId));
                      const isSingleRoom = selectedPkg && selectedPkg.name.toLowerCase().includes('single room');
                      if (isSingleRoom) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-xs text-yellow-800 inline-block">
                            ⚠️ Single Room: One day reservation only
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                {/* Display price immediately after selection */}
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Selected Package Price:</span>
                    <span className="text-lg font-bold text-blue-700">
                      {packages.find(p => p.id === parseInt(selectedPackageId)).price}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer Name *</label>
              <input name="customerName" value={form.customerName} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email *</label>
              <input name="customerEmail" type="email" value={form.customerEmail} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Number *</label>
              <input name="contactNumber" value={form.contactNumber} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address *</label>
              <input name="address" value={form.address} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Select Country</label>
              <select name="nationality" value={form.nationality} onChange={handleChange} className="mt-1 p-2 border rounded w-full bg-white text-black">
                <option value="">Select Country</option>
                <option value="Philippines">Philippines</option>
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Australia">Australia</option>
                <option value="Japan">Japan</option>
                <option value="South Korea">South Korea</option>
                <option value="China">China</option>
                <option value="Singapore">Singapore</option>
                <option value="Malaysia">Malaysia</option>
                <option value="Thailand">Thailand</option>
                <option value="Indonesia">Indonesia</option>
                <option value="Vietnam">Vietnam</option>
                <option value="India">India</option>
                <option value="Germany">Germany</option>
                <option value="France">France</option>
                <option value="Italy">Italy</option>
                <option value="Spain">Spain</option>
                <option value="Netherlands">Netherlands</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Additional Guests
                {selectedPackageId && getMaxGuests() > 0 && (
                  <span className="text-xs text-gray-500 ml-1">(Max: {getMaxGuests()})</span>
                )}
              </label>
              <input 
                name="additionalGuests" 
                type="number" 
                min="0" 
                max={getMaxGuests() || undefined}
                value={form.additionalGuests} 
                onChange={handleChange} 
                className="mt-1 p-2 border rounded w-full text-black"
                disabled={!selectedPackageId}
              />
              {!selectedPackageId && (
                <p className="text-xs text-gray-500 mt-1">Please select a room package first</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Check-In Date *</label>
              <input 
                name="checkInDate" 
                type="date" 
                value={form.checkInDate} 
                onChange={(e) => {
                  const newCheckIn = e.target.value;
                  // Check if Single Room package is selected
                  const selectedPkg = packages.find(p => p.id === parseInt(selectedPackageId));
                  const isSingleRoom = selectedPkg && selectedPkg.name.toLowerCase().includes('single room');
                  
                  if (isSingleRoom && newCheckIn) {
                    // Auto-set check-out to next day for Single Room
                    const checkInDate = new Date(newCheckIn);
                    const nextDay = new Date(checkInDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    const year = nextDay.getFullYear();
                    const month = String(nextDay.getMonth() + 1).padStart(2, '0');
                    const day = String(nextDay.getDate()).padStart(2, '0');
                    const checkOutDate = `${year}-${month}-${day}`;
                    setForm(f => ({ ...f, checkInDate: newCheckIn, checkOutDate }));
                  } else {
                    handleChange(e);
                  }
                }}
                className="mt-1 p-2 border rounded w-full text-black" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Check-Out Date *
                {(() => {
                  const selectedPkg = packages.find(p => p.id === parseInt(selectedPackageId));
                  const isSingleRoom = selectedPkg && selectedPkg.name.toLowerCase().includes('single room');
                  return isSingleRoom ? <span className="text-xs text-gray-500 ml-2">(Auto-set for Single Room)</span> : null;
                })()}
              </label>
              <input 
                name="checkOutDate" 
                type="date" 
                value={form.checkOutDate} 
                onChange={handleChange} 
                disabled={(() => {
                  const selectedPkg = packages.find(p => p.id === parseInt(selectedPackageId));
                  return selectedPkg && selectedPkg.name.toLowerCase().includes('single room');
                })()}
                className="mt-1 p-2 border rounded w-full text-black disabled:bg-gray-100 disabled:cursor-not-allowed" 
                required 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">ID Upload *</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="mt-1 text-black" required />
            {idUpload && <img src={idUpload} alt="ID" className="mt-3 w-48 h-32 object-contain" />}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Additional Requests</label>
            <textarea name="additionalRequests" value={form.additionalRequests} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" rows={3} />
          </div>

          {/* Display Estimated Total */}
          {selectedPackageId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Estimated Total:</p>
                  {(() => {
                    const selectedPkg = packages.find(p => p.id === parseInt(selectedPackageId));
                    const isSingleRoom = selectedPkg && selectedPkg.name.toLowerCase().includes('single room');
                    
                    if (isSingleRoom) {
                      return (
                        <p className="text-xs text-gray-500 mt-1">
                          One Day Rate (6hrs or 12hrs)
                          {parseInt(form.additionalGuests) > 0 && ` + ${form.additionalGuests} Guest(s)`}
                        </p>
                      );
                    } else {
                      // Calculate nights for non-Single Room packages
                      let nights = 1;
                      if (form.checkInDate && form.checkOutDate) {
                        const msPerDay = 1000 * 60 * 60 * 24;
                        const inDate = new Date(form.checkInDate);
                        const outDate = new Date(form.checkOutDate);
                        const diff = Math.ceil((outDate - inDate) / msPerDay);
                        nights = diff > 0 ? diff : 1;
                      }
                      
                      return (
                        <p className="text-xs text-gray-500 mt-1">
                          {nights} Night{nights > 1 ? 's' : ''}
                          {parseInt(form.additionalGuests) > 0 && ` + ${form.additionalGuests} Additional Guest(s)`}
                        </p>
                      );
                    }
                  })()}
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  ₱{calculateEstimatedTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}

          {/* Terms and Conditions Section */}
          <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Terms and Conditions *</h3>
            <div 
              ref={termsRef}
              onScroll={handleTermsScroll}
              className="border border-gray-300 rounded p-4 h-64 overflow-y-scroll bg-white text-sm text-gray-700 mb-4"
            >
              <h4 className="font-bold text-base mb-2">Valid ID Requirement</h4>
              <ul className="list-disc ml-5 mb-4 space-y-1">
                <li>A clear photo or scanned copy of a valid government-issued ID must be uploaded with your reservation request.</li>
                <li>The reservation name must match the name on the ID.</li>
                <li>If booking for another person, an authorization and their ID must be provided.</li>
              </ul>

              <h4 className="font-bold text-base mb-2">Verification & Confirmation</h4>
              <ul className="list-disc ml-5 mb-4 space-y-1">
                <li>All reservation requests are subject to approval after ID verification.</li>
                <li>The management may contact you for additional requirements before confirming the booking.</li>
              </ul>

              <h4 className="font-bold text-base mb-2">Check-In Policy</h4>
              <ul className="list-disc ml-5 mb-4 space-y-1">
                <li>You must present the same ID used during online reservation upon check-in.</li>
                <li>Failure to provide proper identification may result in denied check-in without refund.</li>
              </ul>

              <h4 className="font-bold text-base mb-2">Personal Data Protection</h4>
              <ul className="list-disc ml-5 mb-4 space-y-1">
                <li>ID and personal information are collected only for reservation and security purposes.</li>
                <li>All data will be handled in compliance with the Data Privacy Act of 2012 (RA 10173).</li>
                <li>Information will not be shared with unauthorized parties.</li>
              </ul>

              <h4 className="font-bold text-base mb-2">False or Fraudulent Reservations</h4>
              <ul className="list-disc ml-5 mb-4 space-y-1">
                <li>The management reserves the right to decline or cancel any reservation if submitted documents are false, expired, or suspicious.</li>
              </ul>

              <h4 className="font-bold text-base mb-2">Agreement</h4>
              <ul className="list-disc ml-5 mb-4 space-y-1">
                <li>By checking the box and submitting this form, you confirm that all information provided is true and accurate, and you accept these Terms & Conditions.</li>
              </ul>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="termsCheckbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                disabled={!termsScrolled}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                required
              />
              <label 
                htmlFor="termsCheckbox" 
                className={`text-sm ${!termsScrolled ? 'text-gray-400' : 'text-gray-700'}`}
              >
                I have read and accept the Terms and Conditions
                {!termsScrolled && <span className="block text-xs text-orange-600 mt-1">* Please scroll through and read all terms above to enable this checkbox</span>}
              </label>
            </div>
          </div>

          {/* New Mandatory Checkboxes */}
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mt-6">
            <h3 className="text-lg font-bold text-blue-900 mb-4">Required Agreements</h3>
            
            {/* Data Privacy & Policy Checkbox */}
            <div className="flex items-start gap-3 mb-4">
              <input
                type="checkbox"
                id="dataPrivacyCheckbox"
                checked={dataPrivacyAccepted}
                onChange={(e) => setDataPrivacyAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 cursor-pointer"
              />
              <label htmlFor="dataPrivacyCheckbox" className="text-sm text-gray-700 cursor-pointer flex-1">
                I have read and agree to the{' '}
                <button
                  type="button"
                  onClick={() => setShowDataPrivacyModal(true)}
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  Data Privacy & Policy
                </button>
                <span className="text-red-600 ml-1">*</span>
              </label>
            </div>

            {/* Terms & Conditions Checkbox */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="termsConditionsCheckbox"
                checked={termsConditionsAccepted}
                onChange={(e) => setTermsConditionsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 cursor-pointer"
              />
              <label htmlFor="termsConditionsCheckbox" className="text-sm text-gray-700 cursor-pointer flex-1">
                I have read and agree to the{' '}
                <button
                  type="button"
                  onClick={() => setShowTermsConditionsModal(true)}
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  Terms & Conditions of Stay
                </button>
                <span className="text-red-600 ml-1">*</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button 
              type="submit" 
              disabled={submitting || !dataPrivacyAccepted || !termsConditionsAccepted} 
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Reservation'}
            </button>
          </div>
        </form>
      </div>

      {/* Data Privacy & Policy Modal */}
      {showDataPrivacyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">DATA PRIVACY & POLICY</h2>
              <button
                onClick={() => setShowDataPrivacyModal(false)}
                className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4 text-gray-700">
              <div>
                <h3 className="font-bold text-lg text-blue-800 mb-2">Valid ID Requirement</h3>
                <ul className="list-disc ml-6 space-y-1">
                  <li>A clear photo or scanned copy of a valid government-issued ID must be uploaded with your reservation request.</li>
                  <li>The reservation name must match the name on the ID.</li>
                  <li>If booking for another person, an authorization and their ID must be provided.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-lg text-blue-800 mb-2">Verification & Confirmation</h3>
                <ul className="list-disc ml-6 space-y-1">
                  <li>All reservation requests are subject to approval after ID verification.</li>
                  <li>The management may contact you for additional requirements before confirming the booking.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-lg text-blue-800 mb-2">Check-In Policy</h3>
                <ul className="list-disc ml-6 space-y-1">
                  <li>You must present the same ID used during online reservation upon check-in.</li>
                  <li>Failure to provide proper identification may result in denied check-in without refund.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-lg text-blue-800 mb-2">Personal Data Protection</h3>
                <ul className="list-disc ml-6 space-y-1">
                  <li>ID and personal information are collected only for reservation and security purposes.</li>
                  <li>All data will be handled in compliance with the Data Privacy Act of 2012 (RA 10173).</li>
                  <li>Information will not be shared with unauthorized parties.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-lg text-blue-800 mb-2">False or Fraudulent Reservations</h3>
                <ul className="list-disc ml-6 space-y-1">
                  <li>The management reserves the right to decline or cancel any reservation if submitted documents are false, expired, or suspicious.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-lg text-blue-800 mb-2">Agreement</h3>
                <ul className="list-disc ml-6 space-y-1">
                  <li>By checking the box and submitting this form, you confirm that all information provided is true and accurate, and you accept these Terms & Conditions.</li>
                </ul>
              </div>
            </div>
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t flex justify-end">
              <button
                onClick={() => {
                  setShowDataPrivacyModal(false);
                  setDataPrivacyAccepted(true);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                I Understand and Agree
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms & Conditions Modal */}
      {showTermsConditionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">TERMS & CONDITIONS OF STAY</h2>
              <button
                onClick={() => setShowTermsConditionsModal(false)}
                className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-3 text-gray-700">
              <p>• A valid identification card must be presented upon check-in.</p>
              
              <p>• All guests arriving must register with the Hotel&apos;s Front Desk. Check-in time is 2:00 PM, and check-out time is 12:00 NN.</p>
              
              <p>• Should you wish to stay beyond the designated check-out time, please inform the Front Desk. Early check-in and check-out are subject to additional charges and room availability.</p>
              
              <p>• Proper courtesy must be observed at all times. The privacy of other guests must be respected.</p>
              
              <p>• Money, valuables, and important documents must be kept in the safety deposit box located inside your room. The hotel will not be held liable for any loss.</p>
              
              <p>• Gambling and possession of illegal drugs are not allowed within the hotel premises.</p>
              
              <p>• Towels, linens, and appliances should not be brought out or transferred to another room to avoid unnecessary charges.</p>
              
              <p>• Amenities are provided for your comfort during your stay. For additional requests, please call the Front Desk.</p>
              
              <p>• Smoking inside the room and bringing food with a strong odor are prohibited. A fine of ₱5,000.00 (fumigation fee) will be charged for non-compliance.</p>
              
              <p className="font-semibold pt-2 border-t">• By affixing your signature (through an agent, representative, or personally), you hereby agree to the terms and conditions set forth herein and consent to the collection and processing of data in accordance with the Data Privacy Act of 2012 (RA 10173) and related regulations.</p>
            </div>
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t flex justify-end">
              <button
                onClick={() => {
                  setShowTermsConditionsModal(false);
                  setTermsConditionsAccepted(true);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                I Understand and Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
