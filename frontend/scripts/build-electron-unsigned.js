const { build } = require('electron-builder');
const path = require('path');
const { fixCodeSignCache } = require('./fix-codesign-cache');

async function buildElectron() {
  try {
    console.log('🚀 Starting Electron build (unsigned)...');
    
    // Fix the code signing cache issue first
    console.log('🔧 Fixing code signing cache...');
    fixCodeSignCache();
    
    // Build configuration that skips code signing
    const config = {
      appId: 'com.finvera.desktop',
      productName: 'Fintranzact',
      copyright: 'Copyright © 2025 Fintranzact Solutions',
      directories: {
        output: 'dist-electron'
      },
      files: [
        'out/**/*',
        'electron/**/*',
        'package.json'
      ],
      win: {
        target: 'portable',
        icon: 'public/Fav Icon/Fav_White_PNG@4x.png'
      },
      portable: {
        artifactName: 'Fintranzact-${version}.exe'
      },
      compression: 'store',
      removePackageScripts: true,
      buildDependenciesFromSource: false,
      nodeGypRebuild: false,
      electronDownload: {
        cache: './electron-cache'
      }
    };

    // Set environment variables to skip code signing
    process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
    process.env.WIN_CSC_LINK = '';
    process.env.WIN_CSC_KEY_PASSWORD = '';
    process.env.CSC_LINK = '';
    process.env.CSC_KEY_PASSWORD = '';
    
    const result = await build({
      targets: require('electron-builder').Platform.WINDOWS.createTarget(),
      config: config,
      publish: 'never'
    });

    console.log('✅ Electron build completed successfully!');
    console.log('📦 Output:', result);
    
  } catch (error) {
    console.error('❌ Electron build failed:', error);
    process.exit(1);
  }
}

buildElectron();