"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Swal from 'sweetalert2';

export default function EventReservation({ selectedPackage: preselectedPackage = null, onClose = null }) {
  const [form, setForm] = useState({
    eventName: '',
    eventType: '',
    organiserName: '',
    organiserEmail: '',
    contactNumber: '',
    address: '',
    date: '',
    time: '',
    attendees: 0,
    additionalGuests: 0,
    additionalRequests: '',
    supervisor: '',
    remarks: '',
  });

  const [idUpload, setIdUpload] = useState(null);
  const [packages, setPackages] = useState([]);
  const [fetchedDishes, setFetchedDishes] = useState([]);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [selectedDishes, setSelectedDishes] = useState([]);
  const [totalCost, setTotalCost] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [managers, setManagers] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsScrolled, setTermsScrolled] = useState(false);
  const [dataPrivacyAccepted, setDataPrivacyAccepted] = useState(false);
  const [termsConditionsAccepted, setTermsConditionsAccepted] = useState(false);
  const [showDataPrivacyModal, setShowDataPrivacyModal] = useState(false);
  const [showTermsConditionsModal, setShowTermsConditionsModal] = useState(false);
  const fileRef = useRef(null);
  const termsRef = useRef(null);

  useEffect(() => {
    // If preselectedPackage prop is provided, pre-select it
    if (preselectedPackage && preselectedPackage.id) {
      setSelectedPkg(preselectedPackage);
      // prefill attendees if package provides guest count
      try {
        const guests = preselectedPackage.guests || preselectedPackage.guests_count || null;
        if (guests) setForm((f) => ({ ...f, attendees: Number(guests) }));
      } catch (err) {
        console.error('Error pre-filling attendees from preselectedPackage:', err);
      }
    }
  }, [preselectedPackage]);

  useEffect(() => {
    // fetch packages and dishes to offer similar options to dashboard
    const fetchAux = async () => {
      try {
        const [pkgRes, dishRes, staffRes] = await Promise.all([
          fetch('/api/event_packages'),
          fetch('/api/dishes'),
          fetch('/api/staff')
        ]);
        if (pkgRes.ok) {
          const pkgs = await pkgRes.json();
          setPackages(Array.isArray(pkgs) ? pkgs : pkgs.packages || []);
        }
        if (dishRes.ok) {
          const dishes = await dishRes.json();
          setFetchedDishes(Array.isArray(dishes) ? dishes : []);
        }
        if (staffRes.ok) {
          const staff = await staffRes.json();
          const managersList = Array.isArray(staff) 
            ? staff.filter((s) => s.role && s.role.toLowerCase() === 'manager')
            : [];
          setManagers(managersList);
        }
      } catch (err) {
        // non-blocking
        console.error('Failed to fetch packages or dishes:', err);
      }
    };
    fetchAux();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setIdUpload(reader.result);
    reader.readAsDataURL(file);
  };

  const formatTimeTo24h = (time12) => {
    if (!time12) return '';
    // expect input like '10:00' or '10:00 AM' — if contains AM/PM, convert
    if (time12.includes('AM') || time12.includes('PM')) {
      const [time, modifier] = time12.split(' ');
      let [hours, minutes] = time.split(':');
      if (hours === '12') hours = '00';
      if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12);
      return `${hours.padStart(2, '0')}:${minutes}`;
    }
    return time12;
  };

  const sets = [
    { name: 'Set A', price: 250, maxDishes: 3 },
    { name: 'Set B', price: 300, maxDishes: 4 },
    { name: 'Set C', price: 350, maxDishes: 5 },
    { name: 'Set D', price: 400, maxDishes: 6 },
  ];

  const getFilteredDishes = () => {
    try {
      if (!selectedSet) return [];
      const category = selectedSet.name.split(' ')[1];
      return fetchedDishes.filter((d) => d.category === category).map((d) => d.name);
    } catch (err) {
      console.error('Error filtering dishes:', err);
      return [];
    }
  };

  useEffect(() => {
    try {
      if (selectedPkg) {
        const base = parseFloat((selectedPkg.price || '0').toString().replace(/[^\d.]/g, '')) || 0;
        const setPrice = selectedSet ? (selectedSet.price || 0) : 0;
        setTotalCost(base + (Number(form.additionalGuests || 0) * Number(setPrice || 0)));
      } else {
        setTotalCost(0);
      }
    } catch (err) {
      console.error('Error calculating total cost:', err);
      setTotalCost(0);
    }
  }, [selectedPkg, selectedSet, form.additionalGuests]);

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
      if (!form.eventName || !form.eventType || !form.organiserName || !form.contactNumber || !form.supervisor || !form.date || !form.time) {
        alert('Please fill required fields');
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

      // Validate dish selection when a set is selected
      if (selectedSet && selectedDishes.length === 0) {
        await Swal.fire({
          icon: 'warning',
          title: 'Dish Selection Required',
          text: `Please select at least one dish for ${selectedSet.name}.`,
          confirmButtonColor: '#f59e0b'
        });
        setSubmitting(false);
        return;
      }

      const time24 = formatTimeTo24h(form.time);
      const guests = Number(form.attendees || 0) + Number(form.additionalGuests || 0);

      const payload = {
        type: 'event',
        event_name: form.eventName,
        event_type: form.eventType,
        event_package_name: selectedPkg ? selectedPkg.name : null,
        event_package_id: selectedPkg ? selectedPkg.id : null,
        customer_name: form.organiserName,
        customer_email: form.organiserEmail || null,
        contact_number: form.contactNumber || null,
        address: form.address || null,
        supervisor: form.supervisor || null,
        event_date: form.date,
        event_time: time24,
        attendees: guests,
        set_name: selectedSet ? selectedSet.name : null,
        selected_dishes: selectedDishes.length ? selectedDishes : null,
        price: selectedPkg ? parseFloat((selectedPkg.price || '0').toString().replace(/[^\d.]/g, '')) : null,
        total: totalCost || 0,
        additional_requests: form.additionalRequests || null,
        remarks: form.remarks || null,
        id_upload: idUpload
      };

      const res = await fetch('/api/pending-reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('Server error:', data);
        throw new Error(data.error || 'Failed to submit reservation');
      }

      await Swal.fire({
        icon: 'success',
        title: 'Event Reservation Submitted!',
        html: 'Your reservation is pending approval from our management team.<br>We will contact you shortly.',
        confirmButtonColor: '#3b82f6',
        confirmButtonText: 'OK'
      });
      
      // Reset form
      setForm({ 
        eventName: '',
        eventType: '',
        organiserName: '', 
        organiserEmail: '', 
        contactNumber: '',
        address: '',
        date: '', 
        time: '', 
        attendees: 0, 
        additionalGuests: 0, 
        additionalRequests: '',
        supervisor: '',
        remarks: ''
      });
      setIdUpload(null);
      if (fileRef.current) fileRef.current.value = '';
      setTermsAccepted(false);
      setTermsScrolled(false);
      
      // Close modal if onClose callback provided
      if (onClose) {
        setTimeout(() => onClose(), 500);
      }
      
    } catch (err) {
      console.error('Submission error:', err);
      await Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        html: `<div class="text-left">
          <p class="mb-2">Failed to submit event reservation. Please try again.</p>
          <p class="text-sm text-gray-600"><strong>Error:</strong> ${err.message || 'Unknown error'}</p>
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
            <h1 className="text-2xl font-bold mt-4">Event Reservation</h1>
            <p className="text-gray-600">Provide details for your event reservation and our team will contact you.</p>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <span className="font-medium">💡 Smart Pricing:</span> Package prices are automatically calculated when you select an event package. Additional guests will be charged per person based on your chosen food set.
              </p>
            </div>
          </div>        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Event Name *</label>
              <input name="eventName" value={form.eventName} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Event Type *</label>
              <select name="eventType" value={form.eventType} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" required>
                <option value="">Select Type</option>
                <option>Wedding</option>
                <option>Birthday</option>
                <option>Debut</option>
                <option>Anniversary</option>
                <option>Reunion</option>
                <option>Baby Shower</option>
                <option>Graduation Party</option>
                <option>Christening</option>
                <option>Engagement Party</option>
                <option>Retirement Party</option>
                <option>Conference</option>
                <option>Seminar</option>
                <option>Business Meeting</option>
                <option>Orientation</option>
                <option>Academic Conference</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer Name *</label>
              <input name="organiserName" value={form.organiserName} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer Email</label>
              <input name="organiserEmail" type="email" value={form.organiserEmail} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" />
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
              <label className="block text-sm font-medium text-gray-700">Supervisor *</label>
              <select name="supervisor" value={form.supervisor} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" required>
                <option value="">Select Supervisor</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.name}>
                    {manager.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date *</label>
              <input name="date" type="date" value={form.date} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Time Slot *</label>
              <select name="time" value={form.time} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" required>
                <option value="">Select Time</option>
                <option value="10:00">10:00 AM - 1:00 PM</option>
                <option value="13:00">1:00 PM - 4:00 PM</option>
                <option value="16:00">4:00 PM - 7:00 PM</option>
                <option value="19:00">7:00 PM - 10:00 PM</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Estimated Attendees *</label>
              <input name="attendees" type="number" min="1" value={form.attendees} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Additional Guests</label>
              <input name="additionalGuests" type="number" min="0" value={form.additionalGuests} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" />
            </div>

            <div className="col-span-1 md:col-span-2">
              {/* Package selection and sets (simplified for public form) */}
              {packages && packages.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Package (optional)</label>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {packages.map((pkg) => (
                      <button
                        type="button"
                        key={pkg.id}
                        onClick={() => {
                          setSelectedPkg(pkg);
                          setSelectedSet(null);
                          setSelectedDishes([]);
                          try {
                            const guests = pkg.guests || pkg.guests_count || null;
                            if (guests) setForm((f) => ({ ...f, attendees: Number(guests) }));
                          } catch (err) {
                            console.error('Error setting attendees from package:', err);
                          }
                        }}
                        className={`p-2 border rounded ${selectedPkg?.id === pkg.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                        <div className="font-medium text-gray-700">{pkg.name}</div>
                        <div className="text-sm text-blue-600">₱{parseFloat((pkg.price||'0').toString().replace(/[^\d.]/g,'')).toFixed(2)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedPkg && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Set (optional)</label>
                  <div className="flex gap-3">
                    {sets.map((set) => (
                      <button
                        key={set.name}
                        type="button"
                        onClick={() => { setSelectedSet(set); setSelectedDishes([]); }}
                        className={`p-2 border rounded ${selectedSet?.name === set.name ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                        <div className="font-medium text-gray-700">{set.name}</div>
                        <div className="text-sm text-blue-600">₱{set.price.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">Up to {set.maxDishes} dishes</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedSet && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Dishes (up to {selectedSet.maxDishes})</label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border p-2 rounded bg-gray-50 text-black">
                    {getFilteredDishes().map((dish) => (
                      <div key={dish} className="flex items-center">
                        <input
                          type="checkbox"
                          id={dish}
                          checked={selectedDishes.includes(dish)}
                          onChange={(e) => {
                            try {
                              if (e.target.checked) {
                                if (selectedDishes.length < selectedSet.maxDishes) setSelectedDishes([...selectedDishes, dish]);
                                else {
                                  e.target.checked = false;
                                  Swal.fire({ title: 'Error', text: `You can select up to ${selectedSet.maxDishes} dishes.`, icon: 'error' });
                                }
                              } else {
                                setSelectedDishes(selectedDishes.filter((d) => d !== dish));
                              }
                            } catch (err) { console.error('Error selecting dish:', err); }
                          }}
                          className="mr-2" />
                        <label htmlFor={dish}>{dish}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700">Additional Requests</label>
                <textarea name="additionalRequests" value={form.additionalRequests} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" rows={3} />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700">Remarks</label>
                <textarea name="remarks" value={form.remarks} onChange={handleChange} className="mt-1 p-2 border rounded w-full text-black" rows={3} />
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Customer ID *</label>
                  <input type="file" accept="image/*,application/pdf" ref={fileRef} onChange={handleFile} className="mt-1 p-2 border rounded w-full text-black" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black ">Estimated Total (₱)</label>
                  <input type="text" readOnly value={`₱${Number(totalCost || 0).toFixed(2)}`} className="mt-1 p-2 border rounded w-full text-black bg-gray-100" />
                </div>
              </div>

              {/* Terms and Conditions Section */}
              <div className="mt-6 mb-4 p-4 border-2 border-amber-500 rounded-lg bg-amber-50">
                <h3 className="text-lg font-semibold mb-3 text-amber-900">Terms and Conditions</h3>
                <div 
                  ref={termsRef}
                  onScroll={handleTermsScroll}
                  className="h-64 overflow-y-scroll border border-gray-300 rounded p-4 mb-3 bg-white text-black"
                >
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-amber-800 mb-2">1. Valid Identification Required</h4>
                      <p className="text-sm text-gray-700">
                        All guests are required to present a valid government-issued ID (such as Driver&apos;s License, Passport, 
                        National ID, or any government-recognized identification) upon check-in. The uploaded ID will be used 
                        for verification purposes and must match the guest information provided in this reservation.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-amber-800 mb-2">2. Identity Verification</h4>
                      <p className="text-sm text-gray-700">
                        The management reserves the right to verify the authenticity of the submitted identification documents. 
                        Failure to provide valid identification or discrepancies in the provided information may result in 
                        reservation cancellation without refund.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-amber-800 mb-2">3. Check-In Verification</h4>
                      <p className="text-sm text-gray-700">
                        During check-in, the physical ID presented must match the uploaded document. The person checking in 
                        must be the individual whose name appears on the reservation. Third-party check-ins are not permitted 
                        unless prior arrangements have been made with management.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-amber-800 mb-2">4. Data Protection and Privacy</h4>
                      <p className="text-sm text-gray-700">
                        Your personal information and identification documents are collected solely for reservation and 
                        security purposes. We adhere to data protection regulations and will not share your information 
                        with third parties without your consent, except as required by law.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-amber-800 mb-2">5. Fraud Prevention</h4>
                      <p className="text-sm text-gray-700">
                        The use of fake, altered, or fraudulent identification documents is strictly prohibited and may 
                        result in immediate cancellation of the reservation, denial of service, and potential legal action. 
                        We maintain a record of all identification documents for security and audit purposes.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-amber-800 mb-2">6. Agreement and Acknowledgment</h4>
                      <p className="text-sm text-gray-700">
                        By checking the box below, you acknowledge that you have read, understood, and agree to comply with 
                        these terms and conditions. You confirm that all information provided is accurate and that the 
                        identification document uploaded is genuine and belongs to you.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="termsCheckbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    disabled={!termsScrolled}
                    className="mt-1 h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <label htmlFor="termsCheckbox" className="text-sm text-gray-700 cursor-pointer">
                    I have read and agree to the Terms and Conditions regarding ID verification and data privacy.
                  </label>
                </div>
                
                {!termsScrolled && (
                  <p className="text-xs text-amber-700 mt-2 italic">
                    Please scroll through the entire Terms and Conditions to enable the checkbox.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Required Agreements Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Required Agreements <span className="text-red-600">*</span></h3>
            
            {/* Data Privacy Checkbox */}
            <div className="flex items-start gap-3 mb-4">
              <input 
                type="checkbox" 
                checked={dataPrivacyAccepted}
                onChange={(e) => setDataPrivacyAccepted(e.target.checked)}
                className="mt-1 w-5 h-5 cursor-pointer"
                id="dataPrivacyCheckbox"
              />
              <label htmlFor="dataPrivacyCheckbox" className="text-gray-700 flex-1">
                I have read and agree to the{' '}
                <button 
                  type="button"
                  onClick={() => setShowDataPrivacyModal(true)}
                  className="text-blue-600 underline hover:text-blue-800 font-medium"
                >
                  Data Privacy & Policy
                </button>
                {' '}<span className="text-red-600">*</span>
              </label>
            </div>

            {/* Terms & Conditions Checkbox */}
            <div className="flex items-start gap-3">
              <input 
                type="checkbox" 
                checked={termsConditionsAccepted}
                onChange={(e) => setTermsConditionsAccepted(e.target.checked)}
                className="mt-1 w-5 h-5 cursor-pointer"
                id="termsConditionsCheckbox"
              />
              <label htmlFor="termsConditionsCheckbox" className="text-gray-700 flex-1">
                I have read and agree to the{' '}
                <button 
                  type="button"
                  onClick={() => setShowTermsConditionsModal(true)}
                  className="text-blue-600 underline hover:text-blue-800 font-medium"
                >
                  Terms & Conditions
                </button>
                {' '}<span className="text-red-600">*</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <button type="button" onClick={() => {
                setForm({ 
                  eventName: '', 
                  eventType: '',
                  organiserName: '', 
                  organiserEmail: '', 
                  contactNumber: '',
                  address: '',
                  date: '', 
                  time: '', 
                  attendees: 0, 
                  additionalGuests: 0, 
                  additionalRequests: '',
                  supervisor: '',
                  remarks: ''
                });
                setIdUpload(null);
                setTermsAccepted(false);
                setTermsScrolled(false);
                setDataPrivacyAccepted(false);
                setTermsConditionsAccepted(false);
              }} className="px-4 py-2 bg-red-600 rounded">Reset</button>
              <button 
                type="submit" 
                disabled={submitting || !dataPrivacyAccepted || !termsConditionsAccepted} 
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Reservation'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Data Privacy & Policy Modal */}
      {showDataPrivacyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowDataPrivacyModal(false)}>
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Data Privacy & Policy</h2>
              <button 
                onClick={() => setShowDataPrivacyModal(false)}
                className="text-gray-500 hover:text-gray-700 text-3xl leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">1. Valid ID Requirement</h3>
                <p className="text-gray-700">
                  All guests must present a valid government-issued ID (such as a Driver&apos;s License, Passport, or National ID) 
                  upon check-in for verification purposes.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">2. Verification Process</h3>
                <p className="text-gray-700">
                  The hotel reserves the right to verify the authenticity of the provided identification and may refuse 
                  accommodation if the ID is deemed invalid or suspicious.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">3. Check-In Policy</h3>
                <p className="text-gray-700">
                  Guests who fail to provide valid identification at check-in may be denied accommodation, and any 
                  advance payments made will be subject to the hotel&apos;s cancellation policy.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">4. Data Protection</h3>
                <p className="text-gray-700">
                  All personal information collected during the reservation and check-in process will be handled in 
                  accordance with the Data Privacy Act of 2012 (RA 10173). Your information will only be used for 
                  registration, verification, and communication purposes related to your stay.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">5. False or Fraudulent Reservations</h3>
                <p className="text-gray-700">
                  Any attempt to make a reservation using false, fraudulent, or misleading information may result in 
                  immediate cancellation without refund and may be reported to the appropriate authorities.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">6. Agreement</h3>
                <p className="text-gray-700">
                  By proceeding with this reservation, you acknowledge that you have read, understood, and agree to 
                  provide valid identification and accurate information as required by the hotel&apos;s policies.
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <button 
                onClick={() => {
                  setDataPrivacyAccepted(true);
                  setShowDataPrivacyModal(false);
                }}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold"
              >
                I Understand and Agree
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms & Conditions Modal */}
      {showTermsConditionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowTermsConditionsModal(false)}>
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Terms & Conditions</h2>
              <button 
                onClick={() => setShowTermsConditionsModal(false)}
                className="text-gray-500 hover:text-gray-700 text-3xl leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="px-6 py-4 space-y-3">
              <p className="text-gray-700"><strong>1.</strong> Check-in time is 2:00 PM and check-out time is 12:00 PM.</p>
              <p className="text-gray-700"><strong>2.</strong> Guests are expected to maintain courtesy and respect towards hotel staff and other guests.</p>
              <p className="text-gray-700"><strong>3.</strong> The hotel is not responsible for lost or stolen valuables. Please use the in-room safe.</p>
              <p className="text-gray-700"><strong>4.</strong> Illegal drugs, gambling, and other unlawful activities are strictly prohibited.</p>
              <p className="text-gray-700"><strong>5.</strong> Guests are responsible for any damage to hotel property during their stay.</p>
              <p className="text-gray-700"><strong>6.</strong> Smoking is only allowed in designated areas. Violation may result in additional cleaning charges of ₱5,000.</p>
              <p className="text-gray-700"><strong>7.</strong> Hotel amenities (towels, linens, etc.) are for use within the premises only and must not be taken out.</p>
              <p className="text-gray-700"><strong>8.</strong> Visitors must register at the front desk and follow hotel visiting hours policy.</p>
              <p className="text-gray-700"><strong>9.</strong> The hotel reserves the right to refuse service or terminate stay for violations of these terms.</p>
              <p className="text-gray-700"><strong>10.</strong> By proceeding with this reservation, you consent to the collection and processing of your personal data in accordance with the Data Privacy Act of 2012 (RA 10173).</p>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <button 
                onClick={() => {
                  setTermsConditionsAccepted(true);
                  setShowTermsConditionsModal(false);
                }}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold"
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
