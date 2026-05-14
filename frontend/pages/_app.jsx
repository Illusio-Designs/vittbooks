import '../styles/globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import { WebSocketProvider } from '../contexts/WebSocketContext';
import ElectronWrapper from '../components/electron/ElectronWrapper';
import CookieConsent from '../components/CookieConsent';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { initDesktopNotifications } from '../lib/desktopNotificationService';
import { preloadSounds } from '../lib/soundService';

export default function App({ Component, pageProps }) {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if running in Electron
    setIsElectron(typeof window !== 'undefined' && window.electronAPI);
    
    // Initialize desktop notifications
    initDesktopNotifications();
    
    // Preload notification sounds
    preloadSounds();
  }, []);

  const AppContent = () => (
    <AuthProvider>
      <WebSocketProvider>
        <Component {...pageProps} />
        <CookieConsent />
      </WebSocketProvider>
    </AuthProvider>
  );

  return (
    <>
      <Head>
        <link 
          rel="preload" 
          href="/fonts/agency.otf" 
          as="font" 
          type="font/otf" 
          crossOrigin="anonymous"
        />
        <link rel="icon" type="image/png" href="/Fav%20Icon/Fav_Dark_PNG@4x.png" />
        <link rel="shortcut icon" type="image/png" href="/Fav%20Icon/Fav_Dark_PNG@4x.png" />
        <link rel="apple-touch-icon" href="/Fav%20Icon/Fav_Dark_PNG@4x.png" />
        <style dangerouslySetInnerHTML={{__html: `
          @font-face {
            font-family: 'Agency';
            src: url('/fonts/agency.otf') format('opentype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }
          html, body, * {
            font-family: 'Agency', 'Arial Black', 'Arial', sans-serif !important;
          }
        `}} />
      </Head>
      
      {isElectron ? (
        <ElectronWrapper>
          <AppContent />
        </ElectronWrapper>
      ) : (
        <AppContent />
      )}
    </>
  );
}

