"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';

// Dynamically import MapContainer to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

export default function ContactPage() {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);

  // Hotel coordinates (example - replace with actual coordinates)
  const hotelPosition = [8.744403676914459, 124.78162551747702]; // Balingasag, Misamis Oriental, Philippines
  const hotelName = "SRCB";
  const hotelAddress = "Madroño St., Balingasag, 9005 Misamis Oriental";

  useEffect(() => {
    // Load Leaflet CSS and fix marker icons
    if (typeof window !== 'undefined') {
      import('leaflet/dist/leaflet.css');
      
      // Fix Leaflet marker icon issue
      import('leaflet').then((L) => {
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
      });
      
      setMapLoaded(true);
    }
  }, []);

    useEffect(() => {
      if (!mapInstance) return;
      const handleResize = () => {
        try {
          mapInstance.invalidateSize();
        } catch (e) {
          // ignore if map is not yet initialized
        }
      };
      // Invalidate once on mount to fix initial size if container changed
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [mapInstance]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-blue-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center">
            <Image 
              src="/SRCB.png" 
              alt="SRCB Logo" 
              width={120} 
              height={120} 
              className="mx-auto mb-4 drop-shadow-lg" 
            />
            <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
            <p className="text-xl">We&apos;d love to hear from you</p>
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Map */}
          <div className="lg:sticky lg:top-8 h-fit">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Find Us</h2>
            <div className="rounded-2xl shadow-xl overflow-hidden w-full h-64 sm:h-80 md:h-96 lg:h-[600px]" role="region" aria-label="Hotel location map">
              {mapLoaded ? (
                <MapContainer
                  center={hotelPosition}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                  whenCreated={(map) => setMapInstance(map)}
                  className="w-full h-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={hotelPosition}>
                    <Popup>
                      <div className="text-center p-2">
                        <strong className="text-lg block mb-1">{hotelName}</strong>
                        <p className="text-sm text-gray-600">{hotelAddress}</p>
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${hotelPosition[0]},${hotelPosition[1]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
                        >
                          Open in Google Maps →
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              ) : (
                <div className="bg-gray-300 h-full flex items-center justify-center">
                  <div className="text-center text-gray-600">
                    <svg className="h-16 w-16 mx-auto mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-lg">Loading map...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Contact Information */}
          <div className="space-y-6">
            {/* Contact Details Card */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Contact Information</h2>
              
              <div className="space-y-6">
                {/* Address */}
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 p-3 rounded-full flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-1">Address</h3>
                    <p className="text-gray-600">
                      SRCB<br />
                      123 Main Street<br />
                      City, Province 1234
                    </p>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${hotelPosition[0]},${hotelPosition[1]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-flex items-center transition"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Get Directions
                    </a>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 p-3 rounded-full flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-1">Phone</h3>
                    <p className="text-gray-600">+63 123 456 7890</p>
                    <p className="text-gray-600">+63 987 654 3210</p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 p-3 rounded-full flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-1">Email</h3>
                    <p className="text-gray-600">info@srcb.com</p>
                    <p className="text-gray-600">reservations@srcb.com</p>
                  </div>
                </div>

                {/* Hours */}
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 p-3 rounded-full flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-1">Business Hours</h3>
                    <p className="text-gray-600">Monday - Sunday: 24/7</p>
                    <p className="text-gray-600 text-sm mt-1">Front Desk Available Round the Clock</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Quick Links</h3>
              <div className="space-y-3">
                <a href="/services" className="flex items-center text-blue-700 hover:text-blue-800 transition">
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  View Our Services
                </a>
                <a href="/reservations/room" className="flex items-center text-blue-700 hover:text-blue-800 transition">
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Book a Room
                </a>
                <a href="/reservations/event" className="flex items-center text-blue-700 hover:text-blue-800 transition">
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Book an Event
                </a>
              </div>
            </div>

            {/* Social Media Card */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Follow Us</h3>
              <div className="flex gap-4">
                <a 
                  href="https://www.facebook.com/joannasnook.inquire" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="bg-[#1877F2] text-white p-3 rounded-full hover:bg-[#0C63D4] transition transform hover:scale-110"
                  title="Follow us on Facebook"
                >
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a 
                  href="https://www.instagram.com/joannasnookofficial/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="bg-gradient-to-tr from-[#FEDA75] via-[#FA7E1E] via-[#D62976] to-[#4F5BD5] text-white p-3 rounded-full hover:opacity-90 transition transform hover:scale-110"
                  title="Follow us on Instagram"
                >
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm">© 2025 SRCB. All rights reserved.</p>
          <p className="text-xs text-gray-400 mt-2">Experience comfort and hospitality at its finest.</p>
        </div>
      </footer>
    </div>
  );
}

// Invalidate map size on resize to handle responsive container changes
// This effect is intentionally declared outside the component to keep logic simple,
// but we still need it inside to reference mapInstance — so create a small effect.
