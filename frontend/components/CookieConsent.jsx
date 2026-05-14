import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'fintranzact_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const persist = (choice) => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice, ts: new Date().toISOString() })
      );
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-5xl rounded-2xl bg-white shadow-xl ring-1 ring-gray-200 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21.598 11.064a1.006 1.006 0 0 0-.854-.172A2.99 2.99 0 0 1 17.66 7.95a1 1 0 0 0-.585-.871 3.004 3.004 0 0 1-1.66-2.176 1 1 0 0 0-.871-.835A9.953 9.953 0 0 0 12 4c-5.514 0-10 4.486-10 10s4.486 10 10 10 10-4.486 10-10c0-.683-.069-1.361-.205-2.024a1.001 1.001 0 0 0-.197-.912ZM12 22C7.589 22 4 18.411 4 14s3.589-8 8-8c.224 0 .443.012.663.029a4.95 4.95 0 0 0 2.621 3.144 4.951 4.951 0 0 0 3.913 3.954 7.999 7.999 0 0 1-7.197 8.873Z" />
                <circle cx="8.5" cy="12.5" r="1.5" />
                <circle cx="14.5" cy="16.5" r="1.5" />
                <circle cx="11" cy="9" r="1" />
                <circle cx="17" cy="13" r="1" />
              </svg>
            </div>
            <div className="text-sm text-gray-700">
              <p className="font-semibold text-gray-900">We use cookies</p>
              <p className="mt-1 text-gray-600">
                We use cookies to keep you signed in, remember your preferences,
                and analyse how Fintranzact is used so we can improve it. See
                our{' '}
                <Link href="/privacy" className="text-primary-600 hover:text-primary-700 underline">
                  Privacy Policy
                </Link>{' '}
                for details.
              </p>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => persist('rejected')}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Reject all
            </button>
            <button
              type="button"
              onClick={() => persist('accepted')}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
