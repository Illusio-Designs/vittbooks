import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children, title = 'Fintranzact - Accounting Software' }) {
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    
    // Redirect to login page
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/admin')) {
        window.location.href = '/admin/login';
      } else {
        window.location.href = '/client/login';
      }
    }
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Complete accounting software platform with GST filing and financial management" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/" className="flex items-center">
                  <div className="bg-white rounded-md px-3 py-2 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src="/Finallogo.png"
                      alt="Fintranzact"
                      className="h-10 w-auto object-contain max-w-[180px]"
                    />
                  </div>
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                {isAuthenticated && user ? (
                  <>
                    <span className="text-gray-700">Welcome, {user.full_name || user.email}</span>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/client/login"
                      className="px-4 py-2 text-sm text-gray-700 hover:text-primary-600"
                    >
                      Client Login
                    </Link>
                    <Link
                      href="/admin/login"
                      className="px-4 py-2 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700"
                    >
                      Admin Login
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </div>
    </>
  );
}

