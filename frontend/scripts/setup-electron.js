const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Electron for Fintranzact Client...\n');

// Create assets directory if it doesn't exist
const assetsDir = path.join(__dirname, '../electron/assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
  console.log('📁 Created electron/assets directory');
}

// Create placeholder icon files if they don't exist
const iconFiles = [
  { name: 'icon.png', size: '512x512' },
  { name: 'icon.ico', size: '256x256' },
  { name: 'icon.icns', size: '512x512' }
];

iconFiles.forEach(({ name, size }) => {
  const iconPath = path.join(assetsDir, name);
  if (!fs.existsSync(iconPath)) {
    // Create a simple placeholder file
    fs.writeFileSync(iconPath, '');
    console.log(`📄 Created placeholder ${name} (${size}) - Replace with actual icon`);
  }
});

// Update Next.js config for Electron builds
const nextConfigPath = path.join(__dirname, '../next.config.js');
let nextConfig = '';

if (fs.existsSync(nextConfigPath)) {
  nextConfig = fs.readFileSync(nextConfigPath, 'utf8');
} else {
  nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
};

module.exports = nextConfig;`;
}

// Add Electron-specific configuration
if (!nextConfig.includes('ELECTRON_BUILD')) {
  const electronConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Electron-specific configuration
  ...(process.env.ELECTRON_BUILD === 'true' && {
    output: 'export',
    trailingSlash: true,
    images: {
      unoptimized: true,
    },
    assetPrefix: './',
  }),
};

module.exports = nextConfig;`;

  fs.writeFileSync(nextConfigPath, electronConfig);
  console.log('⚙️  Updated next.config.js for Electron builds');
}

// Create TypeScript configuration for Electron types
const tsConfigPath = path.join(__dirname, '../tsconfig.json');
if (fs.existsSync(tsConfigPath)) {
  const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
  
  if (!tsConfig.compilerOptions.types) {
    tsConfig.compilerOptions.types = [];
  }
  
  if (!tsConfig.compilerOptions.types.includes('electron')) {
    tsConfig.compilerOptions.types.push('electron');
  }
  
  if (!tsConfig.include) {
    tsConfig.include = [];
  }
  
  if (!tsConfig.include.includes('types/**/*')) {
    tsConfig.include.push('types/**/*');
  }
  
  fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));
  console.log('📝 Updated tsconfig.json for Electron types');
}

console.log('\n✅ Electron setup complete!');
console.log('\n📋 Next steps:');
console.log('1. Replace placeholder icons in electron/assets/ with actual app icons');
console.log('2. Run "npm run electron:dev" to start development');
console.log('3. Run "npm run electron:build" to build for production');
console.log('4. Run "npm run electron:dist" to create installers');