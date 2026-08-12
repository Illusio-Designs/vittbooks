import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ElectronTitleBar from './ElectronTitleBar';
import ElectronStatusBar from './ElectronStatusBar';
import ElectronNotifications from './ElectronNotifications';

const ElectronLayout = ({ children }) => {
  const router = useRouter();
  const [isElectron, setIsElectron] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Detect if running in Electron
    setIsElectron(typeof window !== 'undefined' && window.electronAPI);
  }, []);

  const navigationItems = [
    { name: 'Dashboard', path: '/client/dashboard', icon: '📊', shortName: 'Dash' },
    { name: 'Vouchers', path: '/client/vouchers/vouchers', icon: '📄', shortName: 'Vouch' },
    { name: 'Ledgers', path: '/client/ledgers', icon: '📚', shortName: 'Ledg' },
    { name: 'Inventory', path: '/client/inventory-items-unified', icon: '📦', shortName: 'Inv' },
    { name: 'Reports', path: '/client/reports', icon: '📈', shortName: 'Rep' },
    { name: 'GST Returns', path: '/client/gst/returns/gstr1', icon: '🧾', shortName: 'GST' },
    { name: 'E-Invoice', path: '/client/einvoice', icon: '📋', shortName: 'E-Inv' },
    { name: 'E-Way Bill', path: '/client/ewaybill', icon: '🚛', shortName: 'E-Way' },
    { name: 'TDS', path: '/client/tds', icon: '💰', shortName: 'TDS' },
    { name: 'Settings', path: '/client/settings', icon: '⚙️', shortName: 'Set' },
  ];

  const handleNavigation = (path) => {
    router.push(path);
  };

  if (!isElectron) {
    return children;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Custom Title Bar */}
      <ElectronTitleBar />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white shadow-lg transition-all duration-300`}>
          <div className="p-4 border-b flex items-center justify-between">
            {!sidebarCollapsed && (
              <h1 className="text-xl font-bold text-gray-800">Fintranzact Client</h1>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 hover:bg-gray-100 rounded"
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {sidebarCollapsed ? '→' : '←'}
            </button>
          </div>
          
          <nav className="mt-4">
            {navigationItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`w-full text-left px-4 py-3 flex items-center space-x-3 hover:bg-blue-50 transition-colors ${
                  router.pathname === item.path ? 'bg-blue-100 border-r-2 border-blue-500' : ''
                }`}
                title={sidebarCollapsed ? item.name : ''}
              >
                <span className="text-lg">{item.icon}</span>
                {!sidebarCollapsed && (
                  <span className="text-gray-700">{item.name}</span>
                )}
                {sidebarCollapsed && (
                  <span className="text-xs text-gray-600">{item.shortName}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar with notifications */}
          <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-gray-800">
                {navigationItems.find(item => item.path === router.pathname)?.name || 'Fintranzact Client'}
              </h2>
            </div>
            <div className="flex items-center space-x-4">
              <ElectronNotifications />
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <ElectronStatusBar />
    </div>
  );
};

export default ElectronLayout;