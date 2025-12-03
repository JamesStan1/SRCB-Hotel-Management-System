"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Hide header on dashboard pages
  if (pathname && pathname.startsWith('/dashboard')) {
    return null;
  }

  return (
    <header className="w-full border-b sticky top-0 z-40 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between">
        {/* Logo - Far Left */}
        <div className="flex items-center gap-4">
          <Link href="/home" className="flex items-center gap-3">
            <Image src="/SRCB.png" alt="Logo" width={64} height={64} className="object-contain" />
            <span className="font-semibold text-lg sm:text-xl">SRCB Hotel & Café</span>
          </Link>
        </div>

        {/* Navigation Menu - Center */}
        <div className="hidden md:flex items-center gap-8">
          <Link 
            href="/home" 
            className="text-gray-700 hover:text-blue-600 transition font-medium"
          >
            Home
          </Link>
          <Link 
            href="/services" 
            className="text-gray-700 hover:text-blue-600 transition font-medium"
          >
            Services
          </Link>
          <Link 
            href="/contact" 
            className="text-gray-700 hover:text-blue-600 transition font-medium"
          >
            Contact Us
          </Link>
        </div>

        {/* Desktop: Staff Login - Far Right */}
        <div className="hidden md:flex items-center">
          <Link 
            href="/components/sign-in" 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
            style={{ color: 'white' }}
          >
            Staff Login
          </Link>
        </div>

        {/* Mobile menu trigger */}
        <div className="md:hidden flex items-center">
          <button
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-md text-gray-600 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile: Fullscreen dropdown */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-50" onClick={() => setMenuOpen(false)}>
          <div className="absolute right-4 top-4 bg-white rounded-lg shadow-lg p-4 w-64" onClick={(e) => e.stopPropagation()}>
            <nav className="flex flex-col gap-3">
              <Link href="/home" className="text-gray-700 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>Home</Link>
              <Link href="/services" className="text-gray-700 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>Services</Link>
              <Link href="/contact" className="text-gray-700 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>Contact Us</Link>
              <Link href="/components/sign-in" className="px-3 py-2 mt-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium" onClick={() => setMenuOpen(false)}>Staff Login</Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
