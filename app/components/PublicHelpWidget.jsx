"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PublicHelpWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (pathname?.startsWith('/dashboard') || pathname === '/components/sign-in') {
    return null;
  }

  const contactHref = pathname === '/' || pathname === '/home' ? '#contact' : '/home#contact';

  return (
    <div className="public-help-widget fixed bottom-5 right-5 z-50 sm:bottom-6 sm:right-6">
      {isOpen && (
        <section
          id="public-help-panel"
          aria-labelledby="public-help-title"
          className="mb-3 flex max-h-[calc(100dvh-7.5rem)] w-[calc(100vw-2.5rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl"
        >
          <div className="flex items-start gap-3 bg-green-700 p-4 text-white sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
              <span className="text-xl font-semibold" aria-hidden="true">?</span>
            </div>
            <div className="min-w-0">
              <h2 id="public-help-title" className="text-lg font-semibold text-white">
                How to Book with SRCB
              </h2>
              <p id="public-help-description" className="mt-1 text-sm leading-5 text-green-50">
                Step-by-step guest booking guide
              </p>
            </div>
          </div>

          <div
            aria-describedby="public-help-description"
            className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5"
          >
            <section aria-labelledby="booking-start-title">
              <h3 id="booking-start-title" className="mb-3 flex items-center gap-2 text-sm font-bold text-green-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100 text-xs font-bold text-green-800">A</span>
                Getting Started
              </h3>
              <ol className="space-y-3">
                <li className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-green-800 shadow-sm">1</span>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Visit the Services Page</h4>
                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      Browse all rooms and event packages. No account is needed to browse.
                    </p>
                    <Link
                      href="/services"
                      onClick={() => setIsOpen(false)}
                      className="public-help-inline-link mt-2 inline-flex text-xs font-semibold"
                    >
                      Browse services <span className="ml-1" aria-hidden="true">→</span>
                    </Link>
                  </div>
                </li>
                <li className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-green-800 shadow-sm">2</span>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Choose a Service Type</h4>
                    <p className="mt-1 text-xs leading-5 text-gray-600">Browse the available options.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-700">🏨 Room Stay</span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-700">🎉 Event Package</span>
                    </div>
                  </div>
                </li>
              </ol>
            </section>

            <section aria-labelledby="booking-reservation-title">
              <h3 id="booking-reservation-title" className="mb-3 flex items-center gap-2 text-sm font-bold text-green-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100 text-xs font-bold text-green-800">B</span>
                Making Your Reservation
              </h3>
              <ol className="space-y-3">
                <li className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-green-800 shadow-sm">3</span>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Click “Reserve”</h4>
                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      Choose a room or package, then click “Reserve This Room” or “Reserve This Package” to open the booking form.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-green-800 shadow-sm">4</span>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Select Your Date</h4>
                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      Choose check-in and check-out dates for rooms, or the event date for packages. Past dates can’t be selected.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-green-800 shadow-sm">5</span>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Fill In Your Details</h4>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-5 text-gray-600">
                      <li>Full name and email</li>
                      <li>Contact number and address</li>
                      <li>Number of guests</li>
                      <li>Valid government-issued ID (photo or PDF)</li>
                    </ul>
                  </div>
                </li>
                <li className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-green-800 shadow-sm">6</span>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Read &amp; Agree to Terms</h4>
                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      Scroll through the entire Terms &amp; Conditions box, then tick both checkboxes to proceed.
                    </p>
                    <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs leading-5 text-amber-800">
                      Checkboxes stay locked until you have read all the terms.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-green-800 shadow-sm">7</span>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Submit Your Reservation</h4>
                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      Click “Submit Reservation”. You’ll receive a unique Reference Number to track your booking.
                    </p>
                    <p className="mt-2 text-xs font-medium text-green-800">
                      Save or write down your reference number.
                    </p>
                  </div>
                </li>
              </ol>
            </section>

            <section aria-labelledby="booking-payment-title">
              <h3 id="booking-payment-title" className="mb-3 flex items-center gap-2 text-sm font-bold text-green-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100 text-xs font-bold text-green-800">C</span>
                Paying Your Down Payment
              </h3>
              <ol className="space-y-3">
                <li className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-green-800 shadow-sm">8</span>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Wait for Down Payment Instructions</h4>
                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      After your reservation is approved, follow the instructions to submit the required down payment and secure your booking.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-green-800 shadow-sm">9</span>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900">Select a Payment Method</h4>
                    <ul className="mt-2 space-y-2">
                      <li className="rounded-lg bg-white p-2.5">
                        <p className="text-xs font-semibold text-gray-800">📱 GCash</p>
                        <p className="mt-0.5 text-xs leading-5 text-gray-600">Send to the provided GCash number and upload a screenshot as proof.</p>
                      </li>
                      <li className="rounded-lg bg-white p-2.5">
                        <p className="text-xs font-semibold text-gray-800">💵 Cash On-Site</p>
                        <p className="mt-0.5 text-xs leading-5 text-gray-600">Pay at the front desk on or before your check-in date.</p>
                      </li>
                      <li className="rounded-lg bg-white p-2.5">
                        <p className="text-xs font-semibold text-gray-800">🏦 Bank Transfer</p>
                        <p className="mt-0.5 text-xs leading-5 text-gray-600">Transfer to the provided account and send a receipt photo.</p>
                      </li>
                    </ul>
                  </div>
                </li>
              </ol>
            </section>

            <section aria-labelledby="booking-status-title">
              <h3 id="booking-status-title" className="mb-3 flex items-center gap-2 text-sm font-bold text-green-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100 text-xs font-bold text-green-800">D</span>
                Checking Your Booking Status
              </h3>
              <ol className="space-y-3">
                <li className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-green-800 shadow-sm">10</span>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Check Your Reservation Status</h4>
                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      Contact us with your Reference Number and our staff can tell you the current status.
                    </p>
                    <ul className="mt-2 space-y-2">
                      <li className="rounded-lg bg-amber-50 p-2.5">
                        <p className="text-xs font-semibold text-amber-800">⏳ PENDING</p>
                        <p className="mt-0.5 text-xs leading-5 text-gray-600">Being reviewed. Wait for an update.</p>
                      </li>
                      <li className="rounded-lg bg-green-50 p-2.5">
                        <p className="text-xs font-semibold text-green-800">✅ APPROVED</p>
                        <p className="mt-0.5 text-xs leading-5 text-gray-600">Your booking is approved. Follow the down-payment instructions to secure it.</p>
                      </li>
                      <li className="rounded-lg bg-red-50 p-2.5">
                        <p className="text-xs font-semibold text-red-800">❌ REJECTED</p>
                        <p className="mt-0.5 text-xs leading-5 text-gray-600">Contact us to ask about another date or room.</p>
                      </li>
                    </ul>
                  </div>
                </li>
              </ol>
            </section>
          </div>

          <div className="flex shrink-0 justify-end border-t border-gray-100 bg-white p-4">
            <Link
              href={contactHref}
              onClick={() => setIsOpen(false)}
              className="public-help-contact rounded-full bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800"
            >
              Contact Us
            </Link>
          </div>
        </section>
      )}

      <button
        type="button"
        aria-label={isOpen ? 'Close help panel' : 'Open help panel'}
        aria-expanded={isOpen}
        aria-controls="public-help-panel"
        onClick={() => setIsOpen((open) => !open)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-2xl font-semibold text-white shadow-lg transition hover:scale-105 hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-200"
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 6 12 12M18 6 6 18" />
          </svg>
        ) : (
          '?'
        )}
      </button>
    </div>
  );
}
