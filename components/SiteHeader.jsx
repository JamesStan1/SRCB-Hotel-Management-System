"use client";

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navigation = [
  { href: '/home#home', label: 'Home' },
  { href: '/home#about', label: 'About Us' },
  { label: 'Terms & Conditions', type: 'button' },
  { href: '/services', label: 'Services' },
  { href: '/home#contact', label: 'Contact Us' },
];

const stayTerms = [
  'A valid identification card must be presented upon check-in.',
  'All guests arriving must register with the hotel front desk. Check-in time is 2:00 PM, and check-out time is 12:00 NN.',
  'Early check-in and late check-out are subject to additional charges and room availability. Please inform the front desk.',
  'Proper courtesy must be observed at all times. The privacy of other guests must be respected.',
  'Money, valuables, and important documents should be kept secure. The hotel is not responsible for items left unattended.',
  'Gambling and possession of illegal drugs are not allowed within the hotel premises.',
  'Towels, linens, and appliances should not be brought out or transferred to another room.',
  'Smoking inside the room and bringing food with a strong odor are prohibited. Non-compliance may incur a ₱5,000 fumigation fee.',
  'Guests are responsible for damage to hotel property during their stay.',
  'By making a reservation, guests agree to follow these terms and applicable hotel policies.',
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    if (!termsOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setTermsOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [termsOpen]);

  if (pathname?.startsWith('/dashboard')) {
    return null;
  }

  const closeMenu = () => setMenuOpen(false);
  const openTerms = () => {
    closeMenu();
    setTermsOpen(true);
  };

  const renderNavigation = (mobile = false) =>
    navigation.map(({ href, label }) => {
      const className = mobile
        ? 'rounded-lg px-3 py-3 text-left font-medium text-gray-700 transition hover:bg-green-50 hover:text-green-800'
        : 'relative whitespace-nowrap py-2 text-sm font-medium text-gray-600 transition hover:text-green-700 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:rounded-full after:bg-green-700 after:transition-all hover:after:w-full';

      if (!href) {
        return (
          <button
            key={label}
            type="button"
            onClick={openTerms}
            className={className}
          >
            {label}
          </button>
        );
      }

      return (
        <Link
          key={label}
          href={href}
          onClick={closeMenu}
          aria-current={
            (label === 'Home' && (pathname === '/' || pathname === '/home')) ||
            (label === 'Services' && pathname === '/services') ||
            (label === 'Contact Us' && pathname === '/contact')
              ? 'page'
              : undefined
          }
          className={className}
        >
          {label}
        </Link>
      );
    });

  return (
    <>
      <header className="site-header sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto grid min-h-20 max-w-7xl grid-cols-[1fr_auto] items-center gap-x-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr] lg:px-8">
          <Link
            href="/home"
            className="flex min-w-0 items-center gap-2 sm:gap-3"
            aria-label="SRCB Hotel & Café home"
          >
            <Image
              src="/srcb-hotel-logo.jpg"
              alt="St. Rita's College of Balingasag Hospitality Management Program"
              width={64}
              height={64}
              sizes="(max-width: 639px) 48px, 56px"
              className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
              priority
            />
            <span className="min-w-0 leading-tight">
              <span className="block text-sm font-semibold tracking-[0.08em] text-gray-900 sm:text-base">SRCB</span>
              <span className="mt-1 block text-[9px] tracking-[0.04em] text-gray-500 sm:text-[10px] sm:tracking-[0.08em]">
                HOTEL &amp; CAFÉ
              </span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="public-site-nav hidden items-center gap-4 md:flex lg:gap-6">
            {renderNavigation()}
          </nav>

          <Link
            href="/components/sign-in"
            className="public-site-login hidden justify-self-end whitespace-nowrap rounded-full bg-green-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-800 hover:shadow-md lg:px-6 md:inline-flex"
          >
            Staff Login
          </Link>

          <button
            type="button"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex rounded-lg p-2 text-gray-700 transition hover:bg-green-50 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 md:hidden"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div
            id="mobile-navigation"
            className="absolute inset-x-0 top-full border-t border-gray-100 bg-white px-4 py-5 shadow-lg md:hidden"
          >
            <nav aria-label="Mobile navigation" className="public-site-nav mx-auto flex max-w-7xl flex-col gap-1">
              {renderNavigation(true)}
              <Link
                href="/components/sign-in"
                onClick={closeMenu}
                className="public-site-login mt-2 rounded-full bg-green-700 px-5 py-3 text-center font-medium text-white transition hover:bg-green-800"
              >
                Staff Login
              </Link>
            </nav>
          </div>
        )}
      </header>

      {termsOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTermsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="stay-terms-title"
            className="public-terms-dialog flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
                  Guest information
                </p>
                <h2 id="stay-terms-title" className="mt-1 text-xl font-semibold text-gray-900 sm:text-2xl">
                  Terms &amp; Conditions
                </h2>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setTermsOpen(false)}
                aria-label="Close terms and conditions"
                className="rounded-full p-2 text-2xl leading-none text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-5 sm:px-7">
              <p className="mb-5 text-sm leading-6 text-gray-600">
                Please review these general guest terms before your stay at SRCB Hotel &amp; Café.
                Reservation-specific terms may also apply when booking a room or event.
              </p>
              <ol className="space-y-3">
                {stayTerms.map((term, index) => (
                  <li key={term} className="flex gap-3 text-sm leading-6 text-gray-700">
                    <span className="font-semibold text-green-700">{index + 1}.</span>
                    <span>{term}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500">
                Personal information provided with a reservation is handled in accordance with applicable
                data-protection requirements, including the Data Privacy Act of 2012 (RA 10173).
              </p>
            </div>
            <div className="flex justify-end border-t border-gray-100 bg-gray-50 px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="rounded-full bg-green-700 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
