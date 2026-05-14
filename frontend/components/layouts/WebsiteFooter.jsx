import Link from 'next/link';
import Image from 'next/image';

export default function WebsiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-gray-50 overflow-hidden">
      <div className="container mx-auto px-4 md:px-8 lg:px-12 pt-8 pb-0">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 md:px-12 lg:px-16 py-10 md:py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
            {/* Brand + description + socials */}
            <div className="lg:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <Image
                  src="/Fintranzact/Dark_SVG.svg"
                  alt="Fintranzact"
                  width={4042}
                  height={933}
                  className="h-12 w-auto object-contain max-w-[240px]"
                />
              </Link>
              <p className="text-gray-600 text-sm leading-relaxed max-w-sm">
                Your Trustable Accounting Partner — GST filing, e-invoicing, and
                complete financial management for your business.
              </p>
              <div className="flex items-center gap-4 mt-6">
                <a
                  href="#"
                  aria-label="X (Twitter)"
                  className="text-gray-400 hover:text-gray-700 transition"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.844l-5.36-6.99L4.5 22H1.244l8.02-9.165L1 2h6.99l4.84 6.4L18.244 2Zm-2.4 18h1.9L7.27 4H5.27l10.575 16Z" />
                  </svg>
                </a>
                <a
                  href="#"
                  aria-label="Instagram"
                  className="text-gray-400 hover:text-gray-700 transition"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.2c3.2 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.311.974.975 1.249 2.242 1.311 3.608.058 1.266.069 1.645.069 4.85s-.011 3.585-.069 4.85c-.062 1.366-.337 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.266.058-1.645.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.336-3.608-1.311-.974-.975-1.249-2.242-1.311-3.608C2.212 15.585 2.2 15.206 2.2 12s.012-3.585.07-4.85c.062-1.366.336-2.633 1.311-3.608.975-.975 2.242-1.249 3.608-1.311C8.416 2.212 8.795 2.2 12 2.2Zm0 1.8c-3.155 0-3.516.011-4.755.067-1.045.048-1.95.236-2.535.821-.586.586-.773 1.49-.82 2.535C3.81 8.484 3.8 8.845 3.8 12s.01 3.516.07 4.755c.047 1.045.234 1.95.82 2.535.585.585 1.49.773 2.535.82 1.239.06 1.6.07 4.755.07s3.516-.01 4.755-.07c1.045-.047 1.95-.235 2.535-.82.585-.585.773-1.49.82-2.535.06-1.239.07-1.6.07-4.755s-.01-3.516-.07-4.755c-.047-1.045-.235-1.95-.82-2.535-.585-.585-1.49-.773-2.535-.82C15.516 4.011 15.155 4 12 4Zm0 3.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6Zm0 1.8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.4-2.55a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1Z" />
                  </svg>
                </a>
                <a
                  href="#"
                  aria-label="LinkedIn"
                  className="text-gray-400 hover:text-gray-700 transition"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.063 2.063 0 1 1 0-4.126 2.063 2.063 0 0 1 0 4.126ZM7.119 20.452H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" />
                  </svg>
                </a>
                <a
                  href="#"
                  aria-label="YouTube"
                  className="text-gray-400 hover:text-gray-700 transition"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.376.505A3.016 3.016 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.376-.505a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <h3 className="text-gray-900 font-semibold mb-5">Product</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/features" className="text-gray-600 hover:text-gray-900 transition text-sm">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/use-cases" className="text-gray-600 hover:text-gray-900 transition text-sm">
                    Use Cases
                  </Link>
                </li>
                <li>
                  <Link href="/plans" className="text-gray-600 hover:text-gray-900 transition text-sm">
                    Plans
                  </Link>
                </li>
                <li>
                  <Link href="/docs" className="text-gray-600 hover:text-gray-900 transition text-sm">
                    Documentation
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="text-gray-900 font-semibold mb-5">Support</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/help" className="text-gray-600 hover:text-gray-900 transition text-sm">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-gray-600 hover:text-gray-900 transition text-sm">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/docs" className="text-gray-600 hover:text-gray-900 transition text-sm">
                    Guides
                  </Link>
                </li>
                <li>
                  <Link href="/plans" className="text-gray-600 hover:text-gray-900 transition text-sm">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-gray-900 font-semibold mb-5">Company</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/about" className="text-gray-600 hover:text-gray-900 transition text-sm">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-gray-600 hover:text-gray-900 transition text-sm">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-gray-600 hover:text-gray-900 transition text-sm">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-gray-600 hover:text-gray-900 transition text-sm">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-sm text-gray-500">
                <p>&copy; {year} Fintranzact. All rights reserved.</p>
                <p className="mt-1">
                  Managed by <span className="font-semibold text-gray-700">Fintranzact Solution LLP</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <Link href="/privacy" className="text-gray-500 hover:text-gray-900 transition">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="text-gray-500 hover:text-gray-900 transition">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="text-gray-500 hover:text-gray-900 transition">
                  Cookies
                </Link>
              </div>
            </div>
            <div className="mt-6 flex justify-center items-center gap-2 text-sm text-gray-500">
              <span>Crafted with</span>
              <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21s-7-4.534-9.5-9.066C.5 7.5 3 3 7 3c2.1 0 3.5 1 5 3 1.5-2 2.9-3 5-3 4 0 6.5 4.5 4.5 8.934C19 16.466 12 21 12 21Z" />
              </svg>
              <span>in Rajkot, India</span>
            </div>
          </div>
        </div>
      </div>

      {/* Background brand text */}
      <div
        aria-hidden="true"
        className="select-none pointer-events-none mt-4 text-center font-extrabold tracking-tight text-gray-200/70 leading-none"
        style={{ fontSize: 'clamp(4rem, 18vw, 18rem)' }}
      >
        Fintranzact
      </div>
    </footer>
  );
}
