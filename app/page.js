"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import CafeCarousel from '../app/components/CafeCarousel';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section with Background Image */}
      <section className="relative flex items-center justify-center min-h-screen px-4 sm:px-6">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image 
            src="/login_joannas.jpg" 
            alt="Joanna&apos;s Hotel Background" 
            fill
            className="object-cover"
            priority
            quality={100}
          />
          {/* Overlay for better text readability */}
          <div className="absolute inset-0 bg-black/50"></div>
        </div>
        
        {/* Content */}
        <div className="relative z-10 max-w-5xl w-full text-center">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white drop-shadow-2xl mb-6 leading-tight">
            Welcome to Joanna&apos;s Hotel
          </h1>
          <p className="text-base sm:text-lg md:text-2xl text-white max-w-3xl mx-auto mb-4 drop-shadow-lg">
            Experience comfort, luxury, and exceptional hospitality
          </p>
          <p className="text-sm sm:text-base md:text-lg text-white/90 max-w-2xl mx-auto mb-12 drop-shadow-md">
            Whether you&apos;re looking for a relaxing stay or planning a special event, 
            we offer the perfect venue and services to make your experience unforgettable.
          </p>
          
          {/* Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            <Link 
              href="/services" 
              className="px-6 py-3 sm:px-8 sm:py-4 bg-emerald-600 text-white text-base sm:text-lg rounded-lg hover:bg-emerald-700 transition font-semibold shadow-2xl hover:shadow-emerald-600/50 hover:scale-105 transform duration-200"
              style={{ color: 'white' }}
            >
              View Our Services
            </Link>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg border border-white/20 hover:bg-white/20 transition">
              <div className="text-3xl sm:text-4xl mb-3">🏨</div>
              <h3 className="text-xl font-bold text-white mb-2">Comfortable Rooms</h3>
              <p className="text-white/90 text-sm">
                Modern accommodations with all the amenities you need for a perfect stay
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg border border-white/20 hover:bg-white/20 transition">
              <div className="text-3xl sm:text-4xl mb-3">🎉</div>
              <h3 className="text-xl font-bold text-white mb-2">Event Hosting</h3>
              <p className="text-white/90 text-sm">
                Celebrate your special occasions with our comprehensive event packages
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg border border-white/20 hover:bg-white/20 transition">
              <div className="text-3xl sm:text-4xl mb-3">⭐</div>
              <h3 className="text-xl font-bold text-white mb-2">Quality Service</h3>
              <p className="text-white/90 text-sm">
                Dedicated staff committed to making your experience memorable
              </p>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <Link href="/services" className="flex flex-col items-center text-white/80 hover:text-white transition">
            <span className="text-sm mb-2">Explore More</span>
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Quick Info Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-4">Why Choose Us?</h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              We pride ourselves on providing exceptional service and comfortable accommodations
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-emerald-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Modern Facilities</h3>
              <p className="text-gray-600">Well-maintained rooms with air conditioning, WiFi, and more</p>
            </div>

            <div className="text-center">
              <div className="bg-blue-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Flexible Booking</h3>
              <p className="text-gray-600">6-hour and 12-hour room options available</p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Event Packages</h3>
              <p className="text-gray-600">Comprehensive packages for weddings, birthdays, and more</p>
            </div>

            <div className="text-center">
              <div className="bg-yellow-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Affordable Rates</h3>
              <p className="text-gray-600">Competitive pricing for both rooms and events</p>
            </div>
          </div>
        </div>
      </section>

      {/* Café Feature Section (now visible on landing) */}
      <section className="py-16 px-6 bg-amber-50">
        <div className="max-w-7xl mx-auto">
          <div className="md:flex md:items-start md:gap-8">
            <div className="md:w-1/2 mb-6 md:mb-0">
              {/* Smaller carousel on the left for better balance */}
              <div className="rounded-lg overflow-hidden shadow-lg">
                <CafeCarousel heightClass="h-56 md:h-72" />
              </div>
            </div>

            <div className="md:w-1/2">
              <h2 className="text-3xl font-bold text-amber-900 mb-4">Joanna&apos;s Café — Dining & Delights</h2>
              <p className="text-amber-800 mb-4">Our on-site café complements your stay with freshly prepared dishes, specialty coffee, and a warm, inviting atmosphere. Whether you&apos;re fueling up for the day or winding down after an event, Joanna&apos;s Café offers a menu crafted for both comfort and flavor.</p>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <li className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="font-semibold text-amber-900">Barista Coffee</div>
                  <div className="text-sm text-amber-700">Espresso, Latte, Cappuccino — locally roasted beans.</div>
                </li>
                <li className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="font-semibold text-amber-900">Hearty Breakfasts</div>
                  <div className="text-sm text-amber-700">Start your day with a selection of hot breakfasts and pastries.</div>
                </li>
                <li className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="font-semibold text-amber-900">Comfort Meals</div>
                  <div className="text-sm text-amber-700">Local favorites and home-style dishes perfect for any time.</div>
                </li>
                <li className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="font-semibold text-amber-900">Room Charge Friendly</div>
                  <div className="text-sm text-amber-700">Order from the café and charge it to your room for checkout convenience.</div>
                </li>
              </ul>

            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Have Questions?</h2>
          <p className="text-gray-600 mb-8 text-lg">
            Our team is here to help you plan your perfect stay or event
          </p>
          <Link 
            href="/contact"
            className="inline-block px-8 py-4 bg-emerald-600 text-white text-lg rounded-lg hover:bg-emerald-700 transition font-semibold shadow-lg hover:shadow-xl"
          >
            Contact Us
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm">© 2025 Joanna&apos;s Hotel. All rights reserved.</p>
          <p className="text-xs text-gray-400 mt-2">Experience comfort and hospitality at its finest.</p>
        </div>
      </footer>
    </div>
  );
}
