#!/usr/bin/env node

/**
 * Environment Setup Script for Fintranzact Mobile App
 * 
 * This script helps set up environment configurations for different environments.
 * Usage: node scripts/setup-env.js [environment]
 * 
 * Environments: development, production, staging
 */

const fs = require('fs');
const path = require('path');

const environments = {
  development: '.env.development',
  production: '.env.production',
  staging: '.env.staging'
};

function copyEnvFile(environment) {
  const sourceFile = environments[environment];
  const targetFile = '.env';
  
  if (!sourceFile) {
    console.error(`❌ Unknown environment: ${environment}`);
    console.log('Available environments:', Object.keys(environments).join(', '));
    process.exit(1);
  }
  
  const sourcePath = path.join(__dirname, '..', sourceFile);
  const targetPath = path.join(__dirname, '..', targetFile);
  
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Environment file not found: ${sourceFile}`);
    process.exit(1);
  }
  
  try {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`✅ Environment set to: ${environment}`);
    console.log(`📁 Copied ${sourceFile} to .env`);
    
    // Update app.json extra configuration
    updateAppJsonConfig(environment);
    
  } catch (error) {
    console.error(`❌ Error copying environment file:`, error.message);
    process.exit(1);
  }
}

function updateAppJsonConfig(environment) {
  const appJsonPath = path.join(__dirname, '..', 'app.json');
  
  if (!fs.existsSync(appJsonPath)) {
    console.warn('⚠️  app.json not found, skipping configuration update');
    return;
  }
  
  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    
    // Load environment variables from the selected environment file
    const envFile = environments[environment];
    const envPath = path.join(__dirname, '..', envFile);
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Parse environment variables
    const envVars = {};
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=');
        if (key.startsWith('EXPO_PUBLIC_')) {
          envVars[key] = value;
        }
      }
    });
    
    // Update app.json extra configuration
    if (!appJson.expo.extra) {
      appJson.expo.extra = {};
    }
    
    // Merge environment variables into extra configuration
    Object.assign(appJson.expo.extra, envVars);
    
    // Write updated app.json
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
    console.log(`✅ Updated app.json configuration for ${environment}`);
    
  } catch (error) {
    console.error(`❌ Error updating app.json:`, error.message);
  }
}

function showCurrentEnvironment() {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❓ No environment file found (.env)');
    return;
  }
  
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const nodeEnvMatch = envContent.match(/NODE_ENV=(.+)/);
    const apiUrlMatch = envContent.match(/EXPO_PUBLIC_API_URL=(.+)/);
    
    if (nodeEnvMatch) {
      console.log(`🌍 Current environment: ${nodeEnvMatch[1]}`);
    }
    
    if (apiUrlMatch) {
      console.log(`🌐 API URL: ${apiUrlMatch[1]}`);
    }
    
  } catch (error) {
    console.error(`❌ Error reading environment file:`, error.message);
  }
}

function showHelp() {
  console.log(`
📱 Fintranzact Mobile App - Environment Setup

Usage:
  node scripts/setup-env.js [command] [environment]

Commands:
  set <env>     Set environment (development, production, staging)
  current       Show current environment configuration
  help          Show this help message

Examples:
  node scripts/setup-env.js set development
  node scripts/setup-env.js set production
  node scripts/setup-env.js current

Available environments:
  - development: Local development with localhost API
  - production:  Production build with live API
  - staging:     Staging environment (if configured)
`);
}

// Main script logic
const args = process.argv.slice(2);
const command = args[0];
const environment = args[1];

switch (command) {
  case 'set':
    if (!environment) {
      console.error('❌ Please specify an environment');
      console.log('Usage: node scripts/setup-env.js set <environment>');
      process.exit(1);
    }
    copyEnvFile(environment);
    break;
    
  case 'current':
    showCurrentEnvironment();
    break;
    
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
    
  default:
    if (command && environments[command]) {
      // Backward compatibility: allow direct environment name
      copyEnvFile(command);
    } else {
      console.error('❌ Unknown command:', command || '(none)');
      showHelp();
      process.exit(1);
    }
}