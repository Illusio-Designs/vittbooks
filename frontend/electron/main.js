const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
// Use our own development detection
const isDev = process.env.ELECTRON_IS_DEV === 'true' || process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  const iconPath = path.resolve(__dirname, '../public/Fav Icon/Fav_White_PNG@4x.png');
  console.log('🎨 Using icon path:', iconPath);
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: iconPath,
    show: false, // Don't show until ready
    frame: false, // Remove title bar
    titleBarStyle: 'hidden' // Hide title bar completely
  });

  // Load the app - start with client login page
  const startUrl = isDev 
    ? 'http://localhost:3002/client/login'
    : `file://${path.join(__dirname, '../out/client/login.html')}`;

  mainWindow.loadURL(startUrl);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent navigation to external sites and non-client routes
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Allow only localhost in development
    if (isDev && parsedUrl.origin !== 'http://localhost:3002') {
      event.preventDefault();
      return;
    }
    
    // In production, only allow file protocol
    if (!isDev && !parsedUrl.protocol.startsWith('file:')) {
      event.preventDefault();
      return;
    }
    
    // Block navigation to non-client routes
    const path = parsedUrl.pathname;
    if (!path.startsWith('/client/') && path !== '/auth/callback') {
      event.preventDefault();
      // Redirect to client login instead
      mainWindow.loadURL(isDev 
        ? 'http://localhost:3002/client/login'
        : `file://${path.join(__dirname, '../out/client/login.html')}`
      );
    }
  });

  // Also intercept any attempts to load non-client pages
  mainWindow.webContents.on('did-start-loading', () => {
    const currentUrl = mainWindow.webContents.getURL();
    if (currentUrl) {
      try {
        const parsedUrl = new URL(currentUrl);
        const path = parsedUrl.pathname;
        
        // If loading homepage or other non-client pages, redirect to client login
        if (path === '/' || path === '/index' || path.startsWith('/admin') || 
            path.startsWith('/about') || path.startsWith('/contact') || 
            path.startsWith('/features') || path.startsWith('/pricing') ||
            path.startsWith('/plans') || path.startsWith('/use-cases') ||
            path.startsWith('/help') || path.startsWith('/docs') ||
            path.startsWith('/privacy') || path.startsWith('/terms')) {
          
          console.log('🚫 Blocked non-client page:', path);
          mainWindow.loadURL(isDev 
            ? 'http://localhost:3002/client/login'
            : `file://${path.join(__dirname, '../out/client/login.html')}`
          );
        }
      } catch (error) {
        // Ignore URL parsing errors
      }
    }
  });

  // Set up menu
  createMenu();
}

function setupIPC() {
  // Window controls
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      return mainWindow.isMaximized();
    }
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });

  // App info
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  // Navigation
  ipcMain.handle('navigate:to', (event, path) => {
    if (mainWindow) {
      const baseUrl = isDev 
        ? 'http://localhost:3002'
        : `file://${path.join(__dirname, '../out')}`;
      mainWindow.loadURL(`${baseUrl}${path}`);
    }
  });

  // File operations
  ipcMain.handle('file:select', async () => {
    if (mainWindow) {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'PDF Files', extensions: ['pdf'] }
        ]
      });
      return result;
    }
  });

  // Notifications
  ipcMain.handle('notification:show', (event, title, body) => {
    if (mainWindow) {
      const { Notification } = require('electron');
      if (Notification.isSupported()) {
        new Notification({
          title,
          body,
          icon: path.join(__dirname, '../public/Fav Icon/Fav_White_PNG@4x.png')
        }).show();
      }
    }
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            mainWindow.loadURL(isDev 
              ? 'http://localhost:3002/client/dashboard'
              : `file://${path.join(__dirname, '../out/client/dashboard.html')}`
            );
          }
        },
        { type: 'separator' },
        {
          label: 'Refresh',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.reload();
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Accounting',
      submenu: [
        {
          label: 'All Vouchers',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            mainWindow.loadURL(isDev 
              ? 'http://localhost:3002/client/vouchers/vouchers'
              : `file://${path.join(__dirname, '../out/client/vouchers/vouchers.html')}`
            );
          }
        },
        {
          label: 'Ledgers',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            mainWindow.loadURL(isDev 
              ? 'http://localhost:3002/client/ledgers'
              : `file://${path.join(__dirname, '../out/client/ledgers.html')}`
            );
          }
        },
        {
          label: 'Reports',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            mainWindow.loadURL(isDev 
              ? 'http://localhost:3002/client/reports'
              : `file://${path.join(__dirname, '../out/client/reports.html')}`
            );
          }
        }
      ]
    },
    {
      label: 'Inventory',
      submenu: [
        {
          label: 'Inventory Items',
          click: () => {
            mainWindow.loadURL(isDev 
              ? 'http://localhost:3002/client/inventory'
              : `file://${path.join(__dirname, '../out/client/inventory.html')}`
            );
          }
        },
        {
          label: 'Stock Adjustment',
          click: () => {
            mainWindow.loadURL(isDev 
              ? 'http://localhost:3002/client/inventory-adjustment'
              : `file://${path.join(__dirname, '../out/client/inventory-adjustment.html')}`
            );
          }
        }
      ]
    },
    {
      label: 'GST',
      submenu: [
        {
          label: 'GST Returns',
          click: () => {
            mainWindow.loadURL(isDev 
              ? 'http://localhost:3002/client/gst/returns/gstr1'
              : `file://${path.join(__dirname, '../out/client/gst/returns/gstr1.html')}`
            );
          }
        },
        {
          label: 'E-Invoice',
          click: () => {
            mainWindow.loadURL(isDev 
              ? 'http://localhost:3002/client/einvoice'
              : `file://${path.join(__dirname, '../out/client/einvoice.html')}`
            );
          }
        },
        {
          label: 'E-Way Bill',
          click: () => {
            mainWindow.loadURL(isDev 
              ? 'http://localhost:3002/client/ewaybill'
              : `file://${path.join(__dirname, '../out/client/ewaybill.html')}`
            );
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Support',
          click: () => {
            mainWindow.loadURL(isDev 
              ? 'http://localhost:3002/client/support'
              : `file://${path.join(__dirname, '../out/client/support.html')}`
            );
          }
        },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Fintranzact Client',
              message: 'Fintranzact Client v1.0.0',
              detail: 'Complete GST & Accounting Software for Businesses'
            });
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event listeners
app.whenReady().then(() => {
  createWindow();
  
  // Set up IPC handlers once when app is ready
  setupIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});