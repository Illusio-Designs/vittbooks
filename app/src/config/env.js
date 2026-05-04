import Constants from 'expo-constants';

/**
 * Environment Configuration for Fintranzact Mobile App
 * 
 * This file centralizes all environment variables and provides
 * type-safe access to configuration values.
 */

// Get environment variables from Expo Constants
const getEnvVar = (key, defaultValue = null) => {
  return Constants.expoConfig?.extra?.[key] || 
         process.env[key] || 
         Constants.manifest?.extra?.[key] || 
         defaultValue;
};

// API Configuration
export const API_CONFIG = {
  BASE_URL: getEnvVar('EXPO_PUBLIC_API_BASE_URL', 'http://localhost:3000'),
  API_URL: getEnvVar('EXPO_PUBLIC_API_URL', 'http://localhost:3000/api'),
  UPLOADS_BASE_URL: getEnvVar('EXPO_PUBLIC_UPLOADS_BASE_URL', 'http://localhost:3000'),
  VERSION: getEnvVar('EXPO_PUBLIC_API_VERSION', 'v1'),
  TIMEOUT: parseInt(getEnvVar('EXPO_PUBLIC_REQUEST_TIMEOUT', '30000')),
  MAX_RETRY_ATTEMPTS: parseInt(getEnvVar('EXPO_PUBLIC_MAX_RETRY_ATTEMPTS', '3')),
  RETRY_DELAY: parseInt(getEnvVar('EXPO_PUBLIC_RETRY_DELAY', '1000')),
  REQUIRE_HTTPS: getEnvVar('EXPO_PUBLIC_REQUIRE_HTTPS', 'false') === 'true',
  // Development fallback IPs (comma-separated list)
  DEV_FALLBACK_IPS: getEnvVar('EXPO_PUBLIC_DEV_FALLBACK_IPS', ''),
};

// Security Configuration
//
// IMPORTANT: there is no default for the encryption key. If
// EXPO_PUBLIC_PAYLOAD_ENCRYPTION_KEY is missing the value is empty
// and any code that needs it will fail loudly rather than silently
// using a guessable placeholder.
export const SECURITY_CONFIG = {
  ENCRYPTION_KEY: getEnvVar('EXPO_PUBLIC_PAYLOAD_ENCRYPTION_KEY', ''),
  ENABLE_BIOMETRIC_AUTH: getEnvVar('EXPO_PUBLIC_ENABLE_BIOMETRIC_AUTH', 'true') === 'true',
};

// App Configuration
export const APP_CONFIG = {
  NAME: getEnvVar('EXPO_PUBLIC_APP_NAME', 'Fintranzact Mobile'),
  VERSION: getEnvVar('EXPO_PUBLIC_APP_VERSION', '1.0.0'),
  ENVIRONMENT: getEnvVar('NODE_ENV', 'development'),
  COMPANY_NAME: getEnvVar('EXPO_PUBLIC_COMPANY_NAME', 'Fintranzact Solutions'),
  COMPANY_WEBSITE: getEnvVar('EXPO_PUBLIC_COMPANY_WEBSITE', 'https://fintranzact.com'),
  SUPPORT_EMAIL: getEnvVar('EXPO_PUBLIC_SUPPORT_EMAIL', 'support@finvera.solutions'),
  SUPPORT_PHONE: getEnvVar('EXPO_PUBLIC_SUPPORT_PHONE', '+91-9876543210'),
};

// File Upload Configuration
export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: parseInt(getEnvVar('EXPO_PUBLIC_MAX_FILE_SIZE', '10485760')), // 10MB
  SUPPORTED_IMAGE_FORMATS: getEnvVar('EXPO_PUBLIC_SUPPORTED_IMAGE_FORMATS', 'jpg,jpeg,png,gif,webp').split(','),
};

// OAuth Configuration
export const OAUTH_CONFIG = {
  GOOGLE_CLIENT_ID: getEnvVar('EXPO_PUBLIC_GOOGLE_CLIENT_ID', ''),
  GOOGLE_CLIENT_SECRET: getEnvVar('EXPO_PUBLIC_GOOGLE_CLIENT_SECRET', ''),
  GOOGLE_REDIRECT_URL: getEnvVar('EXPO_PUBLIC_GOOGLE_REDIRECT_URL', 'com.finvera.mobile://oauth/google'),
};

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_BIOMETRIC_AUTH: getEnvVar('EXPO_PUBLIC_ENABLE_BIOMETRIC_AUTH', 'true') === 'true',
  ENABLE_PUSH_NOTIFICATIONS: getEnvVar('EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS', 'true') === 'true',
  ENABLE_LOCATION_SERVICES: getEnvVar('EXPO_PUBLIC_ENABLE_LOCATION_SERVICES', 'true') === 'true',
  ENABLE_OFFLINE_MODE: getEnvVar('EXPO_PUBLIC_ENABLE_OFFLINE_MODE', 'true') === 'true',
  ENABLE_DEBUG_MODE: getEnvVar('EXPO_PUBLIC_ENABLE_DEBUG_MODE', 'true') === 'true',
  ENABLE_ANALYTICS: getEnvVar('EXPO_PUBLIC_ENABLE_ANALYTICS', 'false') === 'true',
  ENABLE_CRASH_REPORTING: getEnvVar('EXPO_PUBLIC_ENABLE_CRASH_REPORTING', 'true') === 'true',
  USE_MOCK_DATA: getEnvVar('EXPO_PUBLIC_USE_MOCK_DATA', 'false') === 'true',
};

// Debug Configuration
export const DEBUG_CONFIG = {
  DEBUG_API_CALLS: getEnvVar('EXPO_PUBLIC_DEBUG_API_CALLS', 'true') === 'true',
  DEBUG_PERMISSIONS: getEnvVar('EXPO_PUBLIC_DEBUG_PERMISSIONS', 'true') === 'true',
  DEBUG_NAVIGATION: getEnvVar('EXPO_PUBLIC_DEBUG_NAVIGATION', 'false') === 'true',
};

// Storage Configuration
export const STORAGE_CONFIG = {
  PREFIX: getEnvVar('EXPO_PUBLIC_STORAGE_PREFIX', 'finvera_'),
  AUTH_TOKEN_KEY: getEnvVar('EXPO_PUBLIC_AUTH_TOKEN_KEY', 'auth_token'),
  REFRESH_TOKEN_KEY: getEnvVar('EXPO_PUBLIC_REFRESH_TOKEN_KEY', 'refresh_token'),
  USER_DATA_KEY: getEnvVar('EXPO_PUBLIC_USER_DATA_KEY', 'user_data'),
  CACHE_DURATION: parseInt(getEnvVar('EXPO_PUBLIC_CACHE_DURATION', '3600000')), // 1 hour
  IMAGE_CACHE_SIZE: parseInt(getEnvVar('EXPO_PUBLIC_IMAGE_CACHE_SIZE', '100')),
};

// Notification Configuration
export const NOTIFICATION_CONFIG = {
  ICON_COLOR: getEnvVar('EXPO_PUBLIC_NOTIFICATION_ICON_COLOR', '#3e60ab'),
  DEFAULT_CHANNEL: getEnvVar('EXPO_PUBLIC_DEFAULT_NOTIFICATION_CHANNEL', 'finvera_default'),
};

// Localization Configuration
export const LOCALIZATION_CONFIG = {
  DEFAULT_LANGUAGE: getEnvVar('EXPO_PUBLIC_DEFAULT_LANGUAGE', 'en'),
  SUPPORTED_LANGUAGES: getEnvVar('EXPO_PUBLIC_SUPPORTED_LANGUAGES', 'en,hi').split(','),
  DEFAULT_CURRENCY: getEnvVar('EXPO_PUBLIC_DEFAULT_CURRENCY', 'INR'),
  DEFAULT_COUNTRY: getEnvVar('EXPO_PUBLIC_DEFAULT_COUNTRY', 'IN'),
  DEFAULT_TIMEZONE: getEnvVar('EXPO_PUBLIC_DEFAULT_TIMEZONE', 'Asia/Kolkata'),
};

// Business Configuration
export const BUSINESS_CONFIG = {
  DEFAULT_GST_RATE: parseFloat(getEnvVar('EXPO_PUBLIC_DEFAULT_GST_RATE', '18')),
  GST_FILING_REMINDER_DAYS: parseInt(getEnvVar('EXPO_PUBLIC_GST_FILING_REMINDER_DAYS', '7')),
  FINANCIAL_YEAR_START_MONTH: parseInt(getEnvVar('EXPO_PUBLIC_FINANCIAL_YEAR_START_MONTH', '4')), // April
};

// Third-Party Services Configuration
export const THIRD_PARTY_CONFIG = {
  GOOGLE_MAPS_API_KEY: getEnvVar('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', ''),
  RAZORPAY_KEY_ID: getEnvVar('EXPO_PUBLIC_RAZORPAY_KEY_ID', ''),
  SMS_SERVICE_API_KEY: getEnvVar('EXPO_PUBLIC_SMS_SERVICE_API_KEY', ''),
  ANALYTICS_API_KEY: getEnvVar('EXPO_PUBLIC_ANALYTICS_API_KEY', ''),
  SENTRY_DSN: getEnvVar('EXPO_PUBLIC_SENTRY_DSN', ''),
};

// Environment Helpers
export const isDevelopment = () => APP_CONFIG.ENVIRONMENT === 'development';
export const isProduction = () => APP_CONFIG.ENVIRONMENT === 'production';
export const isDebugMode = () => FEATURE_FLAGS.ENABLE_DEBUG_MODE && isDevelopment();

// API URL Builders
export const buildApiUrl = (endpoint) => {
  const baseUrl = API_CONFIG.API_URL.replace(/\/$/, ''); // Remove trailing slash
  const cleanEndpoint = endpoint.replace(/^\//, ''); // Remove leading slash
  return `${baseUrl}/${cleanEndpoint}`;
};

export const buildUploadUrl = (path) => {
  if (!path) return null;
  
  // If path is already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  const baseUrl = API_CONFIG.UPLOADS_BASE_URL.replace(/\/$/, ''); // Remove trailing slash
  let cleanPath = path.replace(/^\//, ''); // Remove leading slash
  
  // If path doesn't start with 'uploads/', add it
  if (!cleanPath.startsWith('uploads/')) {
    cleanPath = `uploads/${cleanPath}`;
  }
  
  return `${baseUrl}/${cleanPath}`;
};

// Storage Key Builders
export const buildStorageKey = (key) => {
  return `${STORAGE_CONFIG.PREFIX}${key}`;
};

// Validation Helpers
export const validateConfig = () => {
  const errors = [];
  
  if (!API_CONFIG.API_URL) {
    errors.push('API_URL is required');
  }
  
  if (!SECURITY_CONFIG.ENCRYPTION_KEY) {
    if (isProduction()) {
      errors.push(
        'EXPO_PUBLIC_PAYLOAD_ENCRYPTION_KEY is required in production and must match the backend.'
      );
    } else {
      console.warn(
        '⚠️  EXPO_PUBLIC_PAYLOAD_ENCRYPTION_KEY is not set. Encrypted requests will fail until you set it.'
      );
    }
  }
  
  if (isProduction() && FEATURE_FLAGS.ENABLE_DEBUG_MODE) {
    console.warn('⚠️  Debug mode is enabled in production. Consider disabling it.');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
  }
  
  return true;
};

// Log Configuration (Development Only)
export const logConfig = () => {
  if (!isDevelopment() || !DEBUG_CONFIG.DEBUG_API_CALLS) return;
  
  console.log('📱 Finvera Mobile App Configuration:');
  console.log('🌐 API URL:', API_CONFIG.API_URL);
  console.log('📁 Uploads URL:', API_CONFIG.UPLOADS_BASE_URL);
  console.log('🏢 Environment:', APP_CONFIG.ENVIRONMENT);
  console.log('🔧 Debug Mode:', FEATURE_FLAGS.ENABLE_DEBUG_MODE);
  console.log('🔐 Biometric Auth:', FEATURE_FLAGS.ENABLE_BIOMETRIC_AUTH);
  console.log('📱 Push Notifications:', FEATURE_FLAGS.ENABLE_PUSH_NOTIFICATIONS);
  console.log('📍 Location Services:', FEATURE_FLAGS.ENABLE_LOCATION_SERVICES);
};

// Initialize and validate configuration
try {
  validateConfig();
  logConfig();
} catch (error) {
  console.error('❌ Configuration Error:', error.message);
}

// Default export with all configurations
export default {
  API_CONFIG,
  SECURITY_CONFIG,
  APP_CONFIG,
  UPLOAD_CONFIG,
  OAUTH_CONFIG,
  FEATURE_FLAGS,
  DEBUG_CONFIG,
  STORAGE_CONFIG,
  NOTIFICATION_CONFIG,
  LOCALIZATION_CONFIG,
  BUSINESS_CONFIG,
  THIRD_PARTY_CONFIG,
  isDevelopment,
  isProduction,
  isDebugMode,
  buildApiUrl,
  buildUploadUrl,
  buildStorageKey,
  validateConfig,
  logConfig,
};