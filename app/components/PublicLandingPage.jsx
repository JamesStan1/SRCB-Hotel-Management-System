import Image from 'next/image';
import Link from 'next/link';
import CafeCarousel from './CafeCarousel';

const services = [
  {
    title: 'Comfortable Rooms',
    description:
      'Settle into a welcoming room with the essentials for a relaxing stay, whether you are visiting for a few hours or overnight.',
    image: '/room/standardroom.jpg',
    imageAlt: 'A comfortable SRCB guest room',
  },
  {
    title: 'Events & Celebrations',
    description:
      'Bring family and friends together with flexible event spaces and catering options for your next special occasion.',
    image: '/packages/70pax.jpg',
    imageAlt: 'An event space prepared for a celebration',
  },
];

export default function PublicLandingPage() {
  return (
    <main className="public-landing min-h-screen bg-white text-gray-700">
      <section
        id="home"
        className="relative flex min-h-[400px] items-center justify-center overflow-hidden bg-cover bg-center md:min-h-[600px]"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80')",
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative mx-auto max-w-4xl px-5 py-16 text-center sm:px-8">
          <h1 className="mb-5 text-4xl font-light leading-tight tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Experience comfort, luxury, and exceptional hospitality
          </h1>
          <p className="mx-auto mb-9 max-w-3xl text-base font-light leading-relaxed text-gray-100 sm:text-lg md:text-xl">
            Discover your sanctuary of relaxation with our premium accommodations and
            world-class amenities. Whether you&apos;re planning a restful getaway or an
            unforgettable celebration, our dedicated team ensures every moment exceeds
            your expectations.
          </p>
          <Link
            href="/services"
            className="landing-cta inline-flex rounded-full bg-green-700 px-9 py-4 text-base font-medium text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-green-800 hover:shadow-xl sm:text-lg"
          >
            View Our Services
          </Link>
        </div>
      </section>

      <section id="about" className="bg-gray-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
              Who We Are
            </p>
            <h2 className="text-3xl font-semibold text-gray-800 sm:text-4xl">
              About SRCB Hotel &amp; Café
            </h2>
            <p className="mt-3 text-sm leading-7 text-gray-500 sm:text-base">
              Rooted in the values of St. Rita&apos;s College of Balingasag, we are
              committed to providing an experience grounded in faith, excellence, and
              service.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <article className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-green-200 hover:shadow-lg sm:p-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 11.5 12 4l9 7.5M5.5 10v9h13v-9M9 19v-5h6v5" />
                </svg>
              </div>
              <h3 className="mb-3 text-xl font-semibold text-gray-800">A welcoming place to stay</h3>
              <p className="leading-7 text-gray-600">
                From a short rest to a family getaway, our rooms offer a comfortable
                home base and thoughtful hospitality in the heart of Balingasag.
              </p>
            </article>

            <article className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-green-200 hover:shadow-lg sm:p-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 20h16M6 20V9l6-5 6 5v11M9 12h.01M15 12h.01M9 16h.01M15 16h.01" />
                </svg>
              </div>
              <h3 className="mb-3 text-xl font-semibold text-gray-800">Made for every occasion</h3>
              <p className="leading-7 text-gray-600">
                Enjoy a relaxed café visit, gather with loved ones, or plan a special
                event with the help of our friendly team.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="services" className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
              Make yourself at home
            </p>
            <h2 className="text-3xl font-semibold text-gray-800 sm:text-4xl">
              Stay, celebrate, and enjoy
            </h2>
            <p className="mt-3 text-gray-500">
              Find the right space and service for your visit.
            </p>
          </div>

          <div className="grid gap-7 md:grid-cols-2">
            {services.map((service) => (
              <article
                key={service.title}
                className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative h-56 sm:h-72">
                  <Image
                    src={service.image}
                    alt={service.imageAlt}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6 sm:p-8">
                  <h3 className="text-xl font-semibold text-gray-800">{service.title}</h3>
                  <p className="mt-3 min-h-14 leading-7 text-gray-600">{service.description}</p>
                  <Link
                    href="/services"
                    className="service-link mt-5 inline-flex items-center gap-2 font-medium text-green-700 transition hover:text-green-800"
                  >
                    Explore services
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cafe-feature bg-amber-50 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl shadow-lg">
            <CafeCarousel heightClass="h-64 sm:h-80" />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
              A taste of SRCB
            </p>
            <h2 className="text-3xl font-semibold text-amber-950 sm:text-4xl">
              SRCB Café — Dining &amp; Delights
            </h2>
            <p className="mt-4 leading-7 text-amber-900">
              Make time for freshly prepared dishes, specialty coffee, and a warm,
              inviting atmosphere. Whether you&apos;re starting the day or winding down
              after an event, there&apos;s something delicious waiting for you.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ['Barista Coffee', 'Espresso, latte, and cappuccino.'],
                ['Hearty Breakfasts', 'Hot breakfasts and freshly baked pastries.'],
                ['Comfort Meals', 'Local favorites and home-style dishes.'],
                ['Room Charge Friendly', 'Enjoy convenient room-charge service.'],
              ].map(([title, description]) => (
                <li key={title} className="rounded-xl bg-white p-4 shadow-sm">
                  <h3 className="font-semibold text-amber-950">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-amber-800">{description}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-24 bg-gray-50 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
              We&apos;re here to help
            </p>
            <h2 className="text-3xl font-semibold text-gray-800 sm:text-4xl">
              Have Questions? Contact Us
            </h2>
            <p className="mt-3 leading-7 text-gray-600">
              Our team is ready to help you plan a comfortable stay or a memorable
              event. Visit us in Balingasag or get in touch with our team.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col justify-center rounded-2xl border border-gray-100 bg-white p-7 shadow-sm sm:p-9">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17.657 16.657 13.414 20.9a2 2 0 0 1-2.828 0l-4.243-4.243a8 8 0 1 1 11.314 0ZM15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800">Find SRCB Hotel &amp; Café</h3>
              <address className="mt-3 not-italic leading-7 text-gray-600">
                Madroño St.
                <br />
                Balingasag, 9005 Misamis Oriental
              </address>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/contact"
                  className="landing-cta inline-flex rounded-full bg-green-700 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-green-800 hover:shadow-md"
                >
                  Contact Our Team
                </Link>
                <a
                  href="https://www.google.com/maps/dir/?api=1&destination=8.744403676914459%2C124.78162551747702"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="directions-link inline-flex items-center rounded-full border border-green-700 px-6 py-3 font-medium transition hover:bg-green-50"
                >
                  Get Directions
                </a>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <iframe
                title="Map showing SRCB Hotel in Balingasag"
                src="https://www.openstreetmap.org/export/embed.html?bbox=124.7716%2C8.7344%2C124.7916%2C8.7544&layer=mapnik&marker=8.744403676914459%2C124.78162551747702"
                className="h-72 w-full border-0 sm:h-80 md:h-full md:min-h-80"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="public-footer border-t-4 border-green-700 bg-[#080d18] px-4 py-12 text-gray-300 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
            <div>
              <Link href="/home" className="footer-brand inline-flex items-center gap-3">
                <Image
                  src="/srcb-hotel-logo.jpg"
                  alt="St. Rita's College of Balingasag Hospitality Management Program"
                  width={96}
                  height={96}
                  sizes="80px"
                  className="h-20 w-20 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1"
                />
                <span className="leading-tight">
                  <span className="block font-semibold tracking-wider text-white">SRCB</span>
                  <span className="mt-1 block text-[10px] tracking-wider text-green-400">HOTEL &amp; CAFÉ</span>
                </span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">
                Your welcoming destination for comfortable stays, café dining, and
                memorable gatherings in Balingasag, Misamis Oriental.
              </p>
              <div className="mt-5 flex gap-3">
                <a
                  href="https://www.facebook.com/joannasnook.inquire"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="SRCB Hotel & Café on Facebook"
                  className="footer-social"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.023 4.388 11.016 10.125 11.927v-8.437H7.078v-3.49h3.047V9.411c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97H15.83c-1.491 0-1.956.927-1.956 1.878v2.275h3.328l-.532 3.49h-2.796V24C19.612 23.09 24 18.096 24 12.073Z" />
                  </svg>
                </a>
                <a
                  href="https://www.instagram.com/joannasnookofficial/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="SRCB Hotel & Café on Instagram"
                  className="footer-social"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
                    <rect width="18" height="18" x="3" y="3" rx="5" strokeWidth="2" />
                    <circle cx="12" cy="12" r="4" strokeWidth="2" />
                    <circle cx="18" cy="6" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </a>
              </div>
            </div>

            <nav aria-label="Footer navigation">
              <h2 className="footer-heading">Navigation</h2>
              <ul className="mt-4 space-y-2.5">
                {[
                  ['Home', '/home'],
                  ['About Us', '/home#about'],
                  ['Services', '/services'],
                  ['Contact Us', '/home#contact'],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="footer-link">
                      <span aria-hidden="true">•</span>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <h2 className="footer-heading">Get In Touch</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-400">
                <li className="flex items-start gap-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-green-500" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657 13.414 20.9a2 2 0 0 1-2.828 0l-4.243-4.243a8 8 0 1 1 11.314 0ZM15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  <span>Madroño St., Balingasag, 9005 Misamis Oriental</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-green-500" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span>Front desk available 24/7</span>
                </li>
                <li>
                  <a
                    href="https://www.google.com/maps/dir/?api=1&destination=8.744403676914459%2C124.78162551747702"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-link pl-7"
                  >
                    Get directions <span aria-hidden="true">→</span>
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="footer-heading">Plan Your Visit</h2>
              <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-800/60 p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-green-900/50 text-green-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 11.5 12 4l9 7.5M5.5 10v9h13v-9M9 19v-5h6v5" />
                  </svg>
                </div>
                <h3 className="font-semibold text-white">Your stay starts here</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Explore our rooms and services or get in touch with our team.
                </p>
                <Link href="/services" className="footer-cta mt-4 inline-flex rounded-full bg-green-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-600">
                  Explore Services
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
            <p>© {new Date().getFullYear()} SRCB Hotel &amp; Café. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
