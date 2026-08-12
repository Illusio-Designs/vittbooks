import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/router';
import { getProfileImageUrl } from '../../lib/imageUtils';
import { companyAPI, searchAPI, authAPI, subscriptionAPI, branchAPI } from '../../lib/api';
import { canAccessClientPortal } from '../../lib/roleConfig';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import {
  FiMenu, FiBell, FiSearch, FiUser, FiSettings,
  FiLogOut, FiChevronDown, FiX, FiBriefcase, FiPlus,
  FiFileText, FiPackage, FiLayers, FiCreditCard, FiUsers, FiHeadphones, FiCamera, FiMapPin,
  FiMinus, FiSquare, FiMaximize2
} from 'react-icons/fi';
import NotificationDropdown from '../notifications/NotificationDropdown';
import CreateBranchModal from '../modals/CreateBranchModal';

export default function Header({ onMenuClick, title, actions }) {
  const { user, logout, switchCompany, updateUser } = useAuth();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showCreateBranchModal, setShowCreateBranchModal] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const menuRef = useRef(null);
  const companyDropdownRef = useRef(null);
  const branchDropdownRef = useRef(null);
  const searchRef = useRef(null);
  const searchResultsRef = useRef(null);
  const fetchingCompaniesRef = useRef(false);
  const companiesFetchedRef = useRef(false);
  const lastUserIdRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const profileImageInputRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    // Check if running in Electron
    setIsElectron(typeof window !== 'undefined' && window.electronAPI);
  }, []);

  // Electron window controls
  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimize();
    }
  };

  const handleMaximize = async () => {
    if (window.electronAPI) {
      await window.electronAPI.maximize();
      setIsMaximized(!isMaximized);
    }
  };

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.close();
    }
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
    
    // Redirect to appropriate login page based on current path
    const currentPath = router.pathname;
    if (currentPath.startsWith('/admin')) {
      router.replace('/admin/login');
    } else if (currentPath.startsWith('/client')) {
      router.replace('/client/login');
    } else {
      // Default to client login for other paths
      router.replace('/client/login');
    }
  };

  const isClientUser = user && canAccessClientPortal(user.role);

  return (
    <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-[55] shadow-sm w-full">
      <div className="flex items-center h-16 px-4 sm:px-6">
        {/* Left: Logo and Menu button */}
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="bg-white rounded-md px-3 py-2 flex items-center justify-center">
            <Image 
              src="/Finallogo.png"
              alt="Fintranzact"
              width={4042}
              height={933}
              className="h-10 w-auto object-contain max-w-[180px]"
              priority
            />
          </div>
          {/* Menu button (mobile only) */}
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
            >
              <FiMenu className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Center: Search bar */}
        <div className="flex-1 flex justify-center px-4">
          {/* Desktop Search */}
          <div className="hidden md:flex items-center relative w-full max-w-md" ref={searchRef}>
            <FiSearch className="absolute left-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search ledgers, vouchers, inventory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all shadow-sm"
            />
          </div>

          {/* Mobile Search Button */}
          <button
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="md:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <FiSearch className="h-5 w-5" />
          </button>
        </div>

        {/* Right: Actions, Notifications, User menu, Window Controls */}
        <div className="flex items-center gap-3">
          {/* Actions */}
          {actions && <div className="flex items-center gap-2">{actions}</div>}

          {/* Notifications */}
          {user && <NotificationDropdown />}

          {/* User menu */}
          {user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-medium">
                  {(user?.name?.charAt(0) || user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-gray-900">
                    {user?.name || user?.full_name || user?.email || 'User'}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {user?.role || ''}
                  </div>
                </div>
                <FiChevronDown className="hidden sm:block h-4 w-4 text-gray-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[70]">
                  <button
                    onClick={() => {
                      if (!mounted) return;
                      const basePath = router.pathname.startsWith('/admin') ? '/admin' : '/client';
                      router.push(`${basePath}/profile`);
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <FiUser className="h-4 w-4" />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!mounted) return;
                      const basePath = router.pathname.startsWith('/admin') ? '/admin' : '/client';
                      router.push(`${basePath}/settings`);
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <FiSettings className="h-4 w-4" />
                    <span>Settings</span>
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    <FiLogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Electron Window Controls */}
          {isElectron && (
            <div className="flex items-center ml-2 no-drag">
              <button
                onClick={handleMinimize}
                className="p-2 hover:bg-gray-200 rounded transition-colors"
                title="Minimize"
              >
                <FiMinus size={14} />
              </button>
              <button
                onClick={handleMaximize}
                className="p-2 hover:bg-gray-200 rounded transition-colors"
                title={isMaximized ? "Restore" : "Maximize"}
              >
                {isMaximized ? <FiSquare size={14} /> : <FiMaximize2 size={14} />}
              </button>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-red-500 hover:text-white rounded transition-colors"
                title="Close"
              >
                <FiX size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Search Bar */}
      {showMobileSearch && (
        <div className="md:hidden border-t border-gray-200 px-4 py-3 bg-white" ref={searchRef}>
          <div className="flex items-center relative">
            <FiSearch className="absolute left-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search ledgers, vouchers, inventory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all shadow-sm"
              autoFocus
            />
            <button
              onClick={() => {
                setShowMobileSearch(false);
                setSearchQuery('');
                setSearchResults([]);
                setShowSearchResults(false);
              }}
              className="ml-2 p-2 text-gray-500 hover:text-gray-700"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}