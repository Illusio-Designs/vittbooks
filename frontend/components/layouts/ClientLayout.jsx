import { useState, useEffect } from 'react';
import Head from 'next/head';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../contexts/AuthContext';
import { ToastViewport } from '../ui/Toast';
import {
  FiHome, FiFolder, FiFileText, FiTrendingUp, FiTrendingDown,
  FiDollarSign, FiCreditCard, FiRefreshCw, FiFile, FiBarChart2,
  FiShield, FiPercent, FiFileMinus, FiFilePlus, FiMail, FiSettings, FiUser, FiGift,
  FiPackage, FiLayers, FiMove, FiEdit, FiHeadphones, FiUpload, FiStar, FiTag
} from 'react-icons/fi';

const getClientMenuItems = () => [
  {
    label: 'Dashboard',
    href: '/client/dashboard',
    icon: FiHome,
  },
  {
    divider: true,
  },
  {
    label: 'Ledgers',
    href: '/client/ledgers',
    icon: FiFileText,
  },
  {
    divider: true,
  },
  {
    label: 'Import from Tally',
    href: '/client/tally-import',
    icon: FiUpload,
  },
  {
    divider: true,
  },
  {
    label: 'Inventory',
    icon: FiPackage,
    children: [
      { label: 'Items', href: '/client/inventory', icon: FiPackage },
      { label: 'Warehouses', href: '/client/warehouses', icon: FiLayers },
      { label: 'Product Attributes', href: '/client/attributes', icon: FiTag },
      { label: 'Stock Adjustment', href: '/client/inventory-adjustment', icon: FiEdit },
      { label: 'Stock Transfer', href: '/client/inventory-transfer', icon: FiMove },
    ],
  },
  {
    divider: true,
  },
  {
    label: 'Vouchers',
    icon: FiFile,
    children: [
      { label: 'All Vouchers', href: '/client/vouchers/vouchers', icon: FiFile },
      { label: 'Sales Invoice', href: '/client/vouchers/sales-invoice', icon: FiTrendingUp },
      { label: 'Purchase Invoice', href: '/client/vouchers/purchase-invoice', icon: FiTrendingDown },
      { label: 'Payment', href: '/client/vouchers/payment', icon: FiDollarSign },
      { label: 'Receipt', href: '/client/vouchers/receipt', icon: FiCreditCard },
      { label: 'Journal', href: '/client/vouchers/journal', icon: FiFileText },
      { label: 'Contra', href: '/client/vouchers/contra', icon: FiRefreshCw },
      { label: 'Debit Note', href: '/client/vouchers/debit-note', icon: FiFileMinus },
      { label: 'Credit Note', href: '/client/vouchers/credit-note', icon: FiFilePlus },
      { label: 'GST Payment', href: '/client/vouchers/gst-payment', icon: FiShield },
      { label: 'GST Utilization', href: '/client/vouchers/gst-utilization', icon: FiShield },
      { label: 'TDS Payment', href: '/client/vouchers/tds-payment', icon: FiPercent },
      { label: 'TDS Settlement', href: '/client/vouchers/tds-settlement', icon: FiPercent },
    ],
  },
  {
    divider: true,
  },
  {
    label: 'Reports',
    icon: FiBarChart2,
    children: [
      { label: 'Trial Balance', href: '/client/reports/trial-balance', icon: FiBarChart2 },
      { label: 'Balance Sheet', href: '/client/reports/balance-sheet', icon: FiTrendingUp },
      { label: 'Profit & Loss', href: '/client/reports/profit-loss', icon: FiTrendingDown },
      { label: 'Ledger Statement', href: '/client/reports/ledger-statement', icon: FiFileText },
      { label: 'Stock Summary', href: '/client/reports/stock-summary', icon: FiBarChart2 },
      { label: 'Stock Ledger', href: '/client/reports/stock-ledger', icon: FiFileText },
    ],
  },
  {
    divider: true,
  },
  {
    label: 'Compliance',
    icon: FiShield,
    children: [
      { label: 'GSTINs', href: '/client/gstins', icon: FiShield },
      { label: 'GST Rates', href: '/client/gst-rates', icon: FiPercent },
      { label: 'GSTR-1', href: '/client/gst/returns/gstr1', icon: FiFileMinus },
      { label: 'GSTR-3B', href: '/client/gst/returns/gstr3b', icon: FiFileMinus },
      { label: 'TDS', href: '/client/tds', icon: FiDollarSign },
      { label: 'E-Invoice', href: '/client/einvoice', icon: FiMail },
      { label: 'E-Way Bill', href: '/client/ewaybill', icon: FiMail },
    ],
  },
  {
    divider: true,
  },
  {
    label: 'Support',
    href: '/client/support',
    icon: FiHeadphones,
  },
  {
    divider: true,
  },
  {
    label: 'Referral',
    href: '/client/referral',
    icon: FiGift,
  },
  {
    divider: true,
  },
  {
    label: 'Submit Review',
    href: '/client/review',
    icon: FiStar,
  },
  {
    divider: true,
  },
  {
    label: 'Profile',
    href: '/client/profile',
    icon: FiUser,
  },
  {
    label: 'Settings',
    href: '/client/settings',
    icon: FiSettings,
  },
];

export default function ClientLayout({ children, title = 'Client Portal - Fintranzact' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Load sidebar collapsed state from localStorage, default to false
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('client-sidebar-collapsed');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [isDesktop, setIsDesktop] = useState(false);
  const { user } = useAuth();

  // Save sidebar collapsed state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('client-sidebar-collapsed', JSON.stringify(sidebarCollapsed));
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
          items={getClientMenuItems()}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        {/* Full width header */}
        <Header
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          title={title}
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
          <div className="p-4 sm:p-6 lg:p-8 w-full max-w-full">
            {children}
          </div>
        </main>
        {/* Toast notifications viewport */}
        <ToastViewport />
      </div>
    </>
  );
}
