import { useState, useEffect } from 'react';
import Head from 'next/head';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../contexts/AuthContext';
import {
  FiHome, FiUsers, FiBriefcase, FiTarget, FiDollarSign,
  FiCreditCard, FiGift, FiTag, FiUser, FiHeadphones, FiBarChart2,
  FiFileText, FiSearch, FiSettings
} from 'react-icons/fi';

const getAdminMenuItems = (userRole) => {
  // For distributor and salesman, show limited menu
  if (userRole === 'distributor' || userRole === 'salesman') {
    return [
      {
        label: 'Dashboard',
        href: '/admin/dashboard',
        icon: FiHome,
      },
      {
        label: 'Tenants',
        href: '/admin/tenants',
        icon: FiBriefcase,
      },
      {
        divider: true,
      },
      {
        label: 'Profile',
        href: '/admin/profile',
        icon: FiUser,
      },
    ];
  }

  // For finance manager, show commission and payout management
  if (userRole === 'finance_manager') {
    return [
      {
        label: 'Dashboard',
        href: '/admin/dashboard',
        icon: FiHome,
      },
      {
        divider: true,
      },
      {
        label: 'Commissions & Payouts',
        href: '/admin/commissions-payouts',
        icon: FiDollarSign,
      },
      {
        divider: true,
      },
      {
        label: 'Profile',
        href: '/admin/profile',
        icon: FiUser,
      },
    ];
  }

  // Full menu for admin and super_admin
  return [
    {
      label: 'Dashboard',
      href: '/admin/dashboard',
      icon: FiHome,
    },
    {
      label: 'Tenants',
      href: '/admin/tenants',
      icon: FiBriefcase,
    },
    {
      label: 'Distributors',
      href: '/admin/distributors',
      icon: FiUsers,
    },
    {
      label: 'Salesmen',
      href: '/admin/salesmen',
      icon: FiUsers,
    },
    {
      label: 'Targets',
      href: '/admin/targets',
      icon: FiTarget,
    },
    {
      divider: true,
    },
    {
      label: 'Commissions & Payouts',
      href: '/admin/commissions-payouts',
      icon: FiDollarSign,
    },
    {
      label: 'Referrals',
      href: '/admin/referrals',
      icon: FiGift,
    },
    {
      divider: true,
    },
    {
      label: 'Reports',
      href: '/admin/reports',
      icon: FiBarChart2,
    },
    {
      divider: true,
    },
    {
      label: 'Pricing',
      href: '/admin/pricing',
      icon: FiTag,
    },
    {
      divider: true,
    },
    {
      label: 'Support Tickets',
      href: '/admin/support',
      icon: FiHeadphones,
    },
    {
      divider: true,
    },
    {
      label: 'Users',
      href: '/admin/users',
      icon: FiUsers,
    },
    {
      divider: true,
    },
    {
      label: 'Blog',
      href: '/admin/blog',
      icon: FiFileText,
    },
    {
      label: 'SEO',
      href: '/admin/seo',
      icon: FiSearch,
    },
    {
      divider: true,
    },
    {
      label: 'Profile',
      href: '/admin/profile',
      icon: FiUser,
    },
    {
      label: 'Settings',
      href: '/admin/settings',
      icon: FiSettings,
    },
  ];
};

export default function AdminLayout({ children, title = 'Admin Panel - Fintranzact' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Load sidebar collapsed state from localStorage, default to false
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin-sidebar-collapsed');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [isDesktop, setIsDesktop] = useState(false);
  const { user } = useAuth();

  // Save sidebar collapsed state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin-sidebar-collapsed', JSON.stringify(sidebarCollapsed));
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-gray-50">
        <Sidebar
          items={getAdminMenuItems(user?.role)}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        {/* Full width header */}
        <Header
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        {/* Main content area with sidebar offset */}
        <main 
          className="w-full overflow-x-hidden overflow-y-auto transition-all duration-300"
          style={{ 
            marginLeft: isDesktop ? (sidebarCollapsed ? '96px' : '288px') : '0',
            paddingTop: '64px',
            minHeight: 'calc(100vh - 64px)',
            width: isDesktop ? `calc(100% - ${sidebarCollapsed ? '96px' : '288px'})` : '100%'
          }}
        >
          <div className="w-full max-w-full mx-auto p-4 sm:p-5 lg:p-6">
            <div className="w-full max-w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
