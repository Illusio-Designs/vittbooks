import { useState, useEffect } from 'react';
import { FiMinus, FiSquare, FiX, FiMaximize2 } from 'react-icons/fi';

const ElectronTitleBar = ({ title = "Fintranzact Client" }) => {
  const [isElectron, setIsElectron] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && window.electronAPI);
  }, []);

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimize();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI) {
      window.electronAPI.maximize();
      setIsMaximized(!isMaximized);
    }
  };

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.close();
    }
  };

  if (!isElectron) return null;

  return (
    <div className="flex items-center justify-between bg-gray-800 text-white h-8 px-4 select-none drag-region">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center">
          <span className="text-xs font-bold">F</span>
        </div>
        <span className="text-sm font-medium">{title}</span>
      </div>
      
      <div className="flex items-center space-x-1 no-drag">
        <button
          onClick={handleMinimize}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
          title="Minimize"
        >
          <FiMinus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <FiSquare size={14} /> : <FiMaximize2 size={14} />}
        </button>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-red-600 rounded transition-colors"
          title="Close"
        >
          <FiX size={14} />
        </button>
      </div>
    </div>
  );
};

export default ElectronTitleBar;