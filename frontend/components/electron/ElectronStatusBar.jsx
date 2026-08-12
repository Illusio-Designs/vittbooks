import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const ElectronStatusBar = () => {
  const router = useRouter();
  const [isElectron, setIsElectron] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('online');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && window.electronAPI);
    
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Monitor connection status
    const handleOnline = () => setConnectionStatus('online');
    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isElectron) return null;

  const getPageTitle = () => {
    const pathMap = {
      '/client/dashboard': 'Dashboard',
      '/client/vouchers/vouchers': 'Vouchers',
      '/client/ledgers': 'Ledgers',
      '/client/inventory-items-unified': 'Inventory Items',
      '/client/reports': 'Reports',
      '/client/gst/returns/gstr1': 'GSTR-1',
      '/client/einvoice': 'E-Invoice',
      '/client/ewaybill': 'E-Way Bill',
      '/client/tds': 'TDS',
      '/client/settings': 'Settings',
    };
    return pathMap[router.pathname] || 'Fintranzact Client';
  };

  return (
    <div className="flex items-center justify-between bg-gray-100 border-t px-4 py-1 text-xs text-gray-600">
      <div className="flex items-center space-x-4">
        <span className="font-medium">{getPageTitle()}</span>
        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'online' ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className="capitalize">{connectionStatus}</span>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <span>v1.0.0</span>
        <span>{currentTime.toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default ElectronStatusBar;