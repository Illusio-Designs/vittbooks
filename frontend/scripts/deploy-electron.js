const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Deploying Fintranzact Client Desktop App...\n');

const platform = process.platform;
const arch = process.arch;

try {
  // Clean previous builds
  console.log('🧹 Cleaning previous builds...');
  if (fs.existsSync('dist-electron')) {
    fs.rmSync('dist-electron', { recursive: true, force: true });
  }
  if (fs.existsSync('out')) {
    fs.rmSync('out', { recursive: true, force: true });
  }

  // Set environment for production build
  process.env.ELECTRON_BUILD = 'true';
  process.env.NODE_ENV = 'production';

  console.log('📦 Building Next.js app for production...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('✅ Next.js build complete!');

  // Build for specific platforms
  const buildTargets = {
    win32: 'electron-builder --win --x64',
    darwin: 'electron-builder --mac --x64 --arm64',
    linux: 'electron-builder --linux --x64'
  };

  console.log(`🔧 Building Electron app for ${platform}...`);
  const buildCommand = buildTargets[platform] || 'electron-builder';
  execSync(buildCommand, { stdio: 'inherit' });

  console.log('✅ Electron build complete!');

  // Show build results
  console.log('\n🎉 Desktop app built successfully!');
  console.log('📁 Build artifacts:');
  
  if (fs.existsSync('dist-electron')) {
    const files = fs.readdirSync('dist-electron');
    files.forEach(file => {
      const filePath = path.join('dist-electron', file);
      const stats = fs.statSync(filePath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`   - ${file} (${sizeInMB} MB)`);
    });
  }

  console.log('\n📋 Next steps:');
  console.log('1. Test the installer before distribution');
  console.log('2. Code sign the app for production (if needed)');
  console.log('3. Upload to your distribution platform');

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}