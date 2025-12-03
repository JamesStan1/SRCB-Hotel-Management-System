"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import RoomReservation from '../reservations/room/page';
import EventReservation from '../reservations/event/page';

export default function ServicesPage() {
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [eventPackages, setEventPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null); // 'room' or 'event'
  const [selectedPackage, setSelectedPackage] = useState(null);

  // Room packages (static data)
  const roomPackages = [
    { 
      id: 1, 
      name: "Single Room", 
      price: "₱350-₱500", 
      guests: "1-2", 
      image: "/room/singleroom.jpg", 
      description: "₱350 = 6hrs, ₱500 = 12hrs with common toilet and bath, aircon, and wifi.",
      features: ["Common Toilet & Bath", "Air Conditioning", "WiFi", "Flexible Hours"]
    },
    { 
      id: 7, 
      name: "Single Room (Private)", 
      price: "₱450-₱600", 
      guests: "1-2", 
      image: "/room/singleroom.jpg", 
      description: "₱450 = 6hrs, ₱600 = 12hrs with private toilet and bath, aircon, and wifi.",
      features: ["Private Toilet & Bath", "Air Conditioning", "WiFi", "Flexible Hours"]
    },
    { 
      id: 2, 
      name: "Standard Room", 
      price: "₱1,500", 
      guests: "1-2", 
      image: "/room/standardroom.jpg", 
      description: "With free Breakfast, private toilet and bath, aircon, and wifi.",
      features: ["Free Breakfast", "Private Toilet & Bath", "Air Conditioning", "WiFi"]
    },
    { 
      id: 3, 
      name: "Double Standard", 
      price: "₱2,000", 
      guests: "2", 
      image: "/room/doublestandard.jpg", 
      description: "With free Breakfast, private toilet and bath, aircon, and wifi.",
      features: ["Free Breakfast", "Private Toilet & Bath", "Air Conditioning", "WiFi"]
    },
    { 
      id: 4, 
      name: "Triple Room", 
      price: "₱2,200", 
      guests: "3", 
      image: "/room/tripleroom.jpg", 
      description: "With free Breakfast, private toilet and bath, aircon, and wifi.",
      features: ["Free Breakfast", "Private Toilet & Bath", "Air Conditioning", "WiFi"]
    },
    { 
      id: 5, 
      name: "Family Room", 
      price: "₱2,500", 
      guests: "4", 
      image: "/room/familyroom.jpg", 
      description: "Extension and Early Check-in: ₱150/hr. With free Breakfast, private toilet and bath, aircon, and wifi.",
      features: ["Free Breakfast", "Private Toilet & Bath", "Air Conditioning", "WiFi", "Extra Hour: ₱150"]
    },
    { 
      id: 6, 
      name: "Barkadahan Room", 
      price: "₱4,000", 
      guests: "8", 
      image: "/room/barkadahanroom.jpg", 
      description: "With private toilet and bath, aircon, and wifi.",
      features: ["Sleeps 8 People", "Private Toilet & Bath", "Air Conditioning", "WiFi"]
    },
  ];

  // Load event packages
  useEffect(() => {
    const loadEventPackages = async () => {
      try {
        const eventRes = await fetch('/api/event_packages');
        if (eventRes.ok) {
          const eventData = await eventRes.json();
          setEventPackages(eventData || []);
        }
      } catch (error) {
        console.error('Error loading event packages:', error);
      } finally {
        setLoading(false);
      }
    };
    loadEventPackages();
  }, []);

  // Auto-advance room carousel every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentRoomIndex((prev) => (prev + 1) % roomPackages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [roomPackages.length]);

  // Auto-advance event carousel every 5 seconds
  useEffect(() => {
    if (eventPackages.length === 0) return;
    const interval = setInterval(() => {
      setCurrentEventIndex((prev) => (prev + 1) % eventPackages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [eventPackages.length]);

  const nextRoom = () => {
    setCurrentRoomIndex((prev) => (prev + 1) % roomPackages.length);
  };

  const prevRoom = () => {
    setCurrentRoomIndex((prev) => (prev - 1 + roomPackages.length) % roomPackages.length);
  };

  const nextEvent = () => {
    setCurrentEventIndex((prev) => (prev + 1) % eventPackages.length);
  };

  const prevEvent = () => {
    setCurrentEventIndex((prev) => (prev - 1 + eventPackages.length) % eventPackages.length);
  };

  const openReservationModal = (type, packageData) => {
    setModalType(type);
    setSelectedPackage(packageData);
    setShowModal(true);
    // Prevent background scroll
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  };

  const closeReservationModal = () => {
    setShowModal(false);
    setModalType(null);
    setSelectedPackage(null);
    // Restore background scroll
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showModal) {
        closeReservationModal();
      }
    };
    if (showModal) {
      window.addEventListener('keydown', handleEscape);
    }
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showModal]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-blue-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-4xl font-bold mb-4">Our Services</h1>
          <p className="text-xl">Discover our room accommodations and event hosting services</p>
        </div>
      </div>

      {/* Services Section */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        
        {/* Room Reservations Carousel */}
        <div className="mb-20">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Room Reservations</h2>
            <p className="text-gray-600">
              Book comfortable accommodations for your stay with modern amenities
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="grid md:grid-cols-2 gap-0">
              {/* Carousel - Left Side */}
              <div className="relative h-[500px] overflow-hidden">
                {/* Main Image with Slide Animation */}
                <div className="relative h-full transition-all duration-700 ease-in-out">
                  <Image 
                    key={`room-${currentRoomIndex}`}
                    src={roomPackages[currentRoomIndex].image} 
                    alt={roomPackages[currentRoomIndex].name}
                    fill
                    className="object-cover animate-fadeIn"
                  />
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                  
                  {/* Navigation Arrows */}
                  <button
                    onClick={prevRoom}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition z-10 group"
                    aria-label="Previous room"
                  >
                    <svg className="h-6 w-6 text-gray-800 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={nextRoom}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition z-10 group"
                    aria-label="Next room"
                  >
                    <svg className="h-6 w-6 text-gray-800 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Dots Indicator */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {roomPackages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentRoomIndex(idx)}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          idx === currentRoomIndex ? 'bg-white w-8' : 'bg-white/50 w-2 hover:bg-white/75'
                        }`}
                        aria-label={`Go to room ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Information - Right Side */}
              <div className="p-8 flex flex-col justify-between">
                <div>
                  <div className="mb-6">
                    <h3 className="text-3xl font-bold text-gray-800 mb-2 animate-slideInRight">
                      {roomPackages[currentRoomIndex].name}
                    </h3>
                    <div className="flex items-center gap-4 mb-4">
                    <span className="text-3xl font-bold text-blue-600 animate-slideInRight">
                      {roomPackages[currentRoomIndex].price}
                    </span>
                      <span className="text-gray-600 flex items-center animate-slideInRight">
                        <svg className="h-5 w-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {roomPackages[currentRoomIndex].guests} guests
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-700 mb-6 leading-relaxed animate-fadeIn">
                    {roomPackages[currentRoomIndex].description}
                  </p>

                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-800 mb-3">Features:</h4>
                    <ul className="grid grid-cols-2 gap-2">
                      {roomPackages[currentRoomIndex].features.map((feature, idx) => (
                        <li key={idx} className="flex items-center text-gray-600 text-sm animate-slideInRight" style={{animationDelay: `${idx * 100}ms`}}>
                          <span className="text-blue-600 mr-2">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  onClick={() => openReservationModal('room', roomPackages[currentRoomIndex])}
                  className="block w-full text-center bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 hover:shadow-lg transition-all font-semibold transform hover:scale-105"
                >
                  Reserve This Room
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Event Reservations Carousel */}
        <div>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Event Reservations</h2>
            <p className="text-gray-600">
              Host your special events with our comprehensive event packages
            </p>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="grid md:grid-cols-2 gap-0">
                <div className="bg-gray-200 animate-pulse h-[500px]"></div>
                <div className="p-8">
                  <div className="bg-gray-200 animate-pulse h-8 w-3/4 mb-4 rounded"></div>
                  <div className="bg-gray-200 animate-pulse h-6 w-1/2 mb-6 rounded"></div>
                  <div className="bg-gray-200 animate-pulse h-32 mb-6 rounded"></div>
                  <div className="bg-gray-200 animate-pulse h-12 rounded"></div>
                </div>
              </div>
            </div>
          ) : eventPackages.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
              <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
              </svg>
              <p className="text-gray-600 mb-4">No event packages available at the moment.</p>
              <Link 
                href="/contact"
                className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                Contact Us for Custom Events
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="grid md:grid-cols-2 gap-0">
                {/* Carousel - Left Side */}
                <div className="relative h-[500px] overflow-hidden">
                  {/* Main Image with Slide Animation */}
                  <div className="relative h-full transition-all duration-700 ease-in-out">
                    {eventPackages[currentEventIndex].image ? (
                      <Image 
                        key={`event-${currentEventIndex}`}
                        src={eventPackages[currentEventIndex].image} 
                        alt={eventPackages[currentEventIndex].name}
                        fill
                        className="object-cover animate-fadeIn"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-gradient-to-br from-purple-100 to-pink-100 animate-fadeIn">
                        <svg className="h-32 w-32 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
                        </svg>
                      </div>
                    )}
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    
                    {/* Navigation Arrows */}
                    <button
                      onClick={prevEvent}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition z-10 group"
                      aria-label="Previous event"
                    >
                      <svg className="h-6 w-6 text-gray-800 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={nextEvent}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition z-10 group"
                      aria-label="Next event"
                    >
                      <svg className="h-6 w-6 text-gray-800 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Dots Indicator */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                      {eventPackages.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentEventIndex(idx)}
                          className={`h-2 rounded-full transition-all duration-300 ${
                            idx === currentEventIndex ? 'bg-white w-8' : 'bg-white/50 w-2 hover:bg-white/75'
                          }`}
                          aria-label={`Go to event ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Information - Right Side */}
                <div className="p-8 flex flex-col justify-between">
                  <div>
                    <div className="mb-6">
                      <h3 className="text-3xl font-bold text-gray-800 mb-2 animate-slideInRight">
                        {eventPackages[currentEventIndex].name}
                      </h3>
                      <div className="flex items-center gap-4 mb-4">
                        <span className="text-3xl font-bold text-purple-600 animate-slideInRight">
                          ₱{parseFloat(eventPackages[currentEventIndex].price || 0).toLocaleString()}
                        </span>
                        <span className="text-gray-600 flex items-center animate-slideInRight">
                          <svg className="h-5 w-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {eventPackages[currentEventIndex].guests || 'N/A'} guests
                        </span>
                      </div>
                    </div>

                    <div className="mb-6">
                      <p className="text-gray-700 leading-relaxed animate-fadeIn">
                        {eventPackages[currentEventIndex].description || 'Premium event package with full catering service, venue setup, and professional staff to make your event unforgettable.'}
                      </p>
                    </div>

                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-800 mb-3">Package Includes:</h4>
                      <ul className="space-y-2">
                        <li className="flex items-center text-gray-600 text-sm animate-slideInRight" style={{animationDelay: '0ms'}}>
                          <span className="text-purple-600 mr-2">✓</span>
                          Full Venue Access
                        </li>
                        <li className="flex items-center text-gray-600 text-sm animate-slideInRight" style={{animationDelay: '100ms'}}>
                          <span className="text-purple-600 mr-2">✓</span>
                          Catering Services
                        </li>
                        <li className="flex items-center text-gray-600 text-sm animate-slideInRight" style={{animationDelay: '200ms'}}>
                          <span className="text-purple-600 mr-2">✓</span>
                          Tables & Chairs Setup
                        </li>
                        <li className="flex items-center text-gray-600 text-sm animate-slideInRight" style={{animationDelay: '300ms'}}>
                          <span className="text-purple-600 mr-2">✓</span>
                          Professional Staff
                        </li>
                      </ul>
                    </div>
                  </div>

                  <button
                    onClick={() => openReservationModal('event', eventPackages[currentEventIndex])}
                    className="block w-full text-center bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 hover:shadow-lg transition-all font-semibold transform hover:scale-105"
                  >
                    Reserve This Package
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Additional Information */}
        <div className="mt-12 bg-white rounded-lg shadow-lg p-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Why Choose SRCB?</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="text-blue-600 text-3xl mb-2">🏨</div>
              <h4 className="font-semibold text-gray-800 mb-2">Quality Accommodations</h4>
              <p className="text-gray-600">
                Clean, comfortable rooms with modern amenities to ensure a pleasant stay.
              </p>
            </div>
            <div>
              <div className="text-blue-600 text-3xl mb-2">💰</div>
              <h4 className="font-semibold text-gray-800 mb-2">Affordable Rates</h4>
              <p className="text-gray-600">
                Competitive pricing with flexible payment options to suit your budget.
              </p>
            </div>
            <div>
              <div className="text-blue-600 text-3xl mb-2">⭐</div>
              <h4 className="font-semibold text-gray-800 mb-2">Excellent Service</h4>
              <p className="text-gray-600">
                Dedicated staff ready to assist you with all your needs during your stay.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Popup for Reservation Forms */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with blur effect */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeReservationModal}
          ></div>
          
          {/* Modal Content */}
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-800">
                {modalType === 'room' ? 'Room Reservation' : 'Event Reservation'}
              </h3>
              <button
                onClick={closeReservationModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6 text-gray-500 group-hover:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
              {modalType === 'room' ? (
                <RoomReservation 
                  selectedPackage={selectedPackage} 
                  onClose={closeReservationModal} 
                />
              ) : (
                <EventReservation 
                  selectedPackage={selectedPackage} 
                  onClose={closeReservationModal} 
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
