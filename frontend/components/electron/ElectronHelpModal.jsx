import { useState } from 'react';
import { FiX, FiHelpCircle } from 'react-icons/fi';
import { useElectron } from '../../contexts/ElectronContext';

const ElectronHelpModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { isElectron } = useElectron();

  if (!isElectron) return null;

  const shortcuts = [
    { keys: ['Ctrl/Cmd', 'D'], action: 'Go to Dashboard' },
    { keys: ['Ctrl/Cmd', 'V'], action: 'Go to Vouchers' },
    { keys: ['Ctrl/Cmd', 'L'], action: 'Go to Ledgers' },
    { keys: ['Ctrl/Cmd', 'I'], action: 'Go to Inventory' },
    { keys: ['Ctrl/Cmd', 'Shift', 'R'], action: 'Go to Reports' },
    { keys: ['Ctrl/Cmd', 'G'], action: 'Go to GST Returns' },
    { keys: ['Ctrl/Cmd', 'E'], action: 'Go to E-Invoice' },
    { keys: ['Ctrl/Cmd', 'T'], action: 'Go to TDS' },
    { keys: ['Ctrl/Cmd', ','], action: 'Go to Settings' },
    { keys: ['Ctrl/Cmd', 'N'], action: 'New Sales Invoice' },
    { keys: ['Ctrl/Cmd', 'Shift', 'F'], action: 'Focus Search' },
    { keys: ['F1'], action: 'Help & Support' },
    { keys: ['F5'], action: 'Refresh Page' },
    { keys: ['Escape'], action: 'Close Modal/Go Back' },
  ];

  return (
    <>
      {/* Help Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-40"
        title="Keyboard Shortcuts (F1)"
      >
        <FiHelpCircle size={20} />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-modal>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">
                Keyboard Shortcuts & Help
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                data-modal-close
              >
                <FiX size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Keyboard Shortcuts */}
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-4">
                    Keyboard Shortcuts
                  </h3>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100">
                        <div className="flex items-center space-x-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <span key={keyIndex} className="flex items-center">
                              <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded">
                                {key}
                              </kbd>
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className="mx-1 text-gray-400">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                        <span className="text-sm text-gray-600 ml-4">
                          {shortcut.action}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Tips */}
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-4">
                    Quick Tips
                  </h3>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <strong className="text-blue-800">Navigation:</strong>
                      <p>Use the sidebar or keyboard shortcuts to quickly navigate between modules.</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <strong className="text-green-800">Offline Mode:</strong>
                      <p>The app works offline once data is loaded. Changes sync when you&apos;re back online.</p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <strong className="text-yellow-800">Auto-Save:</strong>
                      <p>Your work is automatically saved as you type in most forms.</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <strong className="text-purple-800">Search:</strong>
                      <p>Use Ctrl/Cmd + Shift + F to quickly search across the application.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* App Info */}
              <div className="mt-6 pt-6 border-t">
                <div className="text-center text-sm text-gray-500">
                  <p>Fintranzact Client Desktop App v1.0.0</p>
                  <p className="mt-1">
                    For support, visit{' '}
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        // Navigate to support page
                        window.location.href = '/client/support';
                      }}
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Support Center
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ElectronHelpModal;