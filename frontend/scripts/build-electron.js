const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building Fintranzact Client Desktop App...\n');

try {
  // Set environment for Electron build
  process.env.ELECTRON_BUILD = 'true';
  process.env.ELECTRON_CLIENT_ONLY = 'true';
  process.env.NODE_ENV = 'production';

  console.log('📦 Building Next.js app for Electron...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('✅ Next.js build complete!');

  console.log('🔧 Building Electron app...');
  execSync('electron-builder', { stdio: 'inherit' });

  console.log('✅ Electron build complete!');
  console.log('\n🎉 Desktop app built successfully!');
  console.log('📁 Check the dist-electron folder for your installers.');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}