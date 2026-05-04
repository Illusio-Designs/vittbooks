<div align="center">

# 💼 Fintranzact

### Multi-Tenant Accounting SaaS Platform

**Complete full-stack accounting solution designed for Indian businesses with GST compliance, TDS management, and sales/distribution management.**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.1-blue.svg)](https://nextjs.org/)
[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-~54.0-000020.svg)](https://expo.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0+-orange.svg)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-5.10-red.svg)](https://redis.io/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success.svg)]()

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [License](#-license)

---

</div>

## 📋 Table of Contents

- [Overview](#-overview)
- [✨ Features](#-features)
- [🛠️ Technology Stack](#️-technology-stack)
- [🚀 Quick Start](#-quick-start)
- [📁 Project Structure](#-project-structure)
- [⚙️ Configuration](#️-configuration)
- [🔐 Security](#-security)
- [📡 API Documentation](#-api-documentation)
- [💻 Development](#-development)
- [🖥️ Desktop Application](#️-desktop-application)
- [📱 Mobile Application](#-mobile-application)
- [🚢 Deployment](#-deployment)
- [📄 License](#-license)

---

## 🎯 Overview

**Fintranzact** is a comprehensive, multi-tenant accounting SaaS platform built specifically for Indian businesses. It provides complete financial management with built-in GST compliance, TDS management, and advanced sales/distribution tracking.

### Key Highlights

- 🏢 **Multi-Tenant Architecture** - Complete data isolation per tenant
- 📊 **Full Accounting Suite** - Double-entry bookkeeping, vouchers, reports
- 🇮🇳 **GST Compliance** - E-Invoice, GSTR-1, GSTR-3B generation
- 💰 **TDS Management** - Automatic calculation and Form 16A generation
- 📈 **Sales & Distribution** - Distributor/salesman management with commissions
- 🔔 **Real-Time Notifications** - WebSocket-powered instant updates
- 🖥️ **Desktop App** - Native macOS and Windows applications (Electron)
- 📱 **Mobile App** - Native iOS and Android applications (React Native + Expo)
- 🔒 **Enterprise Security** - End-to-end encryption, RBAC, audit trails

---

## ✨ Features

### 🔐 Authentication & Security
- ✅ JWT-based authentication with Redis sessions
- ✅ Google OAuth 2.0 sign-up/login
- ✅ Role-based access control (RBAC)
- ✅ Database password encryption (AES-256-CBC)
- ✅ API payload encryption (optional)
- ✅ Audit trail logging
- ✅ Rate limiting & security headers

### 📊 Accounting & Finance
- ✅ **Chart of Accounts** - Hierarchical account groups
- ✅ **Ledger Management** - Complete ledger system
- ✅ **Voucher System** - All voucher types (Sales, Purchase, Payment, Receipt, Journal, etc.)
- ✅ **Double-Entry Bookkeeping** - Automatic debit/credit balancing
- ✅ **Bill-Wise Tracking** - Advanced bill allocation system
- ✅ **Financial Reports** - Trial Balance, Balance Sheet, P&L Statement

### 🇮🇳 GST Compliance
- ✅ **GSTIN Management** - Multiple GSTIN support
- ✅ **GST Rate Master** - Configurable tax rates
- ✅ **Automatic GST Calculation** - CGST, SGST, IGST, Cess
- ✅ **GSTR-1 Generation** - Export-ready JSON format
- ✅ **GSTR-3B Generation** - Monthly return preparation
- ✅ **E-Invoice Integration** - IRN generation with QR code
- ✅ **E-Way Bill** - Transportation document management

### 💼 TDS Management
- ✅ **TDS Calculation** - Automatic TDS computation
- ✅ **TDS Return Preparation** - Quarterly returns
- ✅ **Form 16A Generation** - TDS certificates

### 📦 Sales & Distribution
- ✅ **Distributor Management** - Complete distributor lifecycle
- ✅ **Salesman Management** - Sales team tracking
- ✅ **Referral System** - Referral codes and rewards
- ✅ **Commission Calculation** - Automated commission processing
- ✅ **Payout Management** - Commission payout tracking
- ✅ **Target Management** - Sales target setting and tracking

### 🔔 Notification System
- ✅ **Real-Time WebSocket** - Instant notifications
- ✅ **Email Notifications** - Template-based emails
- ✅ **Desktop Notifications** - Browser notifications
- ✅ **Sound Alerts** - Unique sounds per notification type
- ✅ **Notification Preferences** - User-customizable settings
- ✅ **Notification Management UI** - Complete notification center

### 🎨 Invoice Templates
- ✅ **Multiple Templates** - Professional invoice designs
- ✅ **Template Selection** - Tenant-configurable templates
- ✅ **PDF Generation** - Client-side PDF export
- ✅ **Print Size Options** - A4, Letter, Custom sizes
- ✅ **Company Logo** - Logo integration
- ✅ **Digital Signature** - DSC certificate support

### 🖥️ Desktop Application
- ✅ **Native Apps** - macOS and Windows
- ✅ **Auto-Updater** - Automatic update mechanism
- ✅ **Code Signing Ready** - Production-ready signing
- ✅ **Universal Binaries** - macOS Intel + Apple Silicon

### 📱 Mobile Application
- ✅ **Cross-Platform** - iOS and Android (React Native + Expo)
- ✅ **Biometric Authentication** - Face ID, Touch ID, Fingerprint
- ✅ **Offline Mode** - Work without internet connectivity
- ✅ **Push Notifications** - Real-time alerts and reminders
- ✅ **Camera Integration** - Document scanning and barcode reading
- ✅ **Location Services** - Location-based business features
- ✅ **Contact Integration** - Customer/vendor management
- ✅ **Calendar Integration** - GST filing reminders
- ✅ **Document Management** - Photo library and file picker
- ✅ **Print & Share** - Export and share documents

---

## 🛠️ Technology Stack

### Backend
| Category | Technology |
|----------|-----------|
| **Runtime** | Node.js (v18+) |
| **Framework** | Express.js (v5.2.1) |
| **ORM** | Sequelize (v6.37.7) |
| **Database** | MySQL 8.0+ (mysql2 v3.15.3) |
| **Cache/Session** | Redis (v5.10.0) |
| **File Upload** | Multer (v2.0.2) |
| **WebSocket** | Socket.IO (v4.7.2) |
| **Authentication** | JWT (jsonwebtoken v9.0.3) + Passport.js |
| **OAuth** | Google OAuth 2.0 (passport-google-oauth20) |
| **Encryption** | crypto-js (v4.2.0), bcryptjs (v3.0.3) |
| **QR Code** | qrcode (v1.5.4) |
| **HTTP Client** | axios (v1.13.2) |
| **Payments** | Razorpay (v2.9.6) |
| **Scheduling** | node-cron (v4.2.1) |
| **Logging** | Winston (v3.19.0) |
| **Security** | Helmet (v8.1.0), express-rate-limit (v8.2.1) |

### Frontend (Web)
| Category | Technology |
|----------|-----------|
| **Framework** | Next.js (v15.1.0) |
| **UI Library** | React (v18.2.0) |
| **Styling** | Tailwind CSS (v3.4.3) |
| **State Management** | React Context API |
| **WebSocket Client** | Socket.IO Client (v4.7.2) |
| **Desktop App** | Electron (v40.0.0) |
| **PDF Generation** | jsPDF (v3.0.4) + html2canvas (v1.4.1) |
| **Forms** | React Hook Form (v7.51.0) |
| **Animations** | Framer Motion (v12.23.26), GSAP (v3.14.2) |
| **HTTP Client** | axios (v1.7.0) |
| **Encryption** | crypto-js (v4.2.0) |
| **Rich Text** | React Quill (v2.0.0) |
| **Icons** | React Icons (v5.5.0) |
| **Notifications** | React Hot Toast (v2.4.1) |

### Mobile App
| Category | Technology |
|----------|-----------|
| **Framework** | React Native (v0.81.5) |
| **Platform** | Expo (v54.0.33) |
| **UI Library** | React (v19.1.0) |
| **Styling** | NativeWind (v4.2.1) + Tailwind CSS |
| **Navigation** | React Navigation (v7.1.28) |
| **Forms** | React Hook Form (v7.71.1) |
| **HTTP Client** | axios (v1.13.2) |
| **Storage** | AsyncStorage (v2.2.0) |
| **Authentication** | Expo Local Authentication (v17.0.8) |
| **Camera** | Expo Camera (v17.0.10), Barcode Scanner (v14.0.1) |
| **Notifications** | Expo Notifications (v0.32.16) |
| **Location** | Expo Location (v19.0.8) |
| **Documents** | Expo Document Picker (v14.0.8), File System (v19.0.21) |
| **Media** | Expo Image Picker (v17.0.10), Media Library (v18.2.1) |
| **Printing** | Expo Print (v15.0.8) |
| **Contacts** | Expo Contacts (v15.0.11) |
| **Calendar** | Expo Calendar (v15.0.8) |
| **Icons** | React Native Vector Icons (v10.3.0), Expo Vector Icons (v15.0.3) |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- MySQL 8.0+
- Redis (for sessions and caching)
- Git
- For mobile development: Expo CLI and Expo Go app

### Backend Setup

```bash
# Clone repository
git clone https://github.com/Illusio-Designs/fintranzact.git
cd fintranzact/backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
npm run migrate
npm run seed

# Start development server
npm run dev
```

### Frontend Setup

```bash
# Navigate to frontend
cd ../frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

Visit `http://localhost:3001` to see the application.

### Mobile App Setup

```bash
# Navigate to mobile app
cd ../app

# Install dependencies
npm install

# Configure environment
npm run env:dev

# Start Expo development server
npm start

# Run on specific platform
npm run android  # For Android
npm run ios      # For iOS (macOS only)
npm run web      # For web browser
```

Scan the QR code with Expo Go app (Android) or Camera app (iOS) to run on your device.

---

## 📁 Project Structure

```
fintranzact/
├── 📂 backend/                    # Express.js Backend API
│   ├── 📂 docs/                   # Documentation
│   ├── 📂 src/
│   │   ├── 📂 config/             # Configuration files (database, redis, passport, etc.)
│   │   ├── 📂 models/             # Sequelize models (32+ models)
│   │   ├── 📂 migrations/         # Database migrations
│   │   ├── 📂 seeders/           # Database seeders
│   │   ├── � middl eware/        # Express middleware (auth, tenant, encryption, etc.)
│   │   ├── 📂 controllers/       # Route controllers (40+ controllers)
│   │   ├── 📂 services/          # Business logic services
│   │   ├── 📂 websocket/         # WebSocket server (Socket.IO)
│   │   ├── 📂 routes/           # API routes
│   │   ├── 📂 utils/            # Utility functions (logger, encryption, cache, etc.)
│   │   ├── 📂 validators/       # Request validators
│   │   └── 📂 scripts/          # Database initialization scripts
│   ├── 📂 scripts/              # Utility scripts (deployment, monitoring)
│   ├── 📂 uploads/              # File uploads directory
│   ├── 📂 logs/                 # Application logs
│   ├── 📄 STRUCTURE.md          # Directory structure guide
│   └── 📄 server.js             # Application entry point
│
├── 📂 frontend/                  # Next.js Web Frontend
│   ├── 📂 pages/                # Next.js pages (client & admin)
│   ├── 📂 components/           # React components
│   │   ├── 📂 account/          # Account management components
│   │   ├── 📂 electron/         # Electron-specific components
│   │   ├── 📂 forms/           # Form components
│   │   ├── 📂 invoices/        # Invoice templates
│   │   ├── 📂 modals/          # Modal dialogs
│   │   ├── 📂 notifications/   # Notification components
│   │   ├── 📂 reports/         # Report components
│   │   ├── 📂 tables/          # Data table components
│   │   └── 📂 ui/              # Reusable UI components
│   ├── 📂 lib/                 # Utilities, API client, encryption
│   ├── 📂 contexts/            # React contexts (Auth, WebSocket, Electron)
│   ├── 📂 hooks/               # Custom React hooks
│   ├── 📂 electron/           # Electron main process
│   │   ├── 📄 main.js         # Electron main process
│   │   └── 📄 preload.js      # Preload scripts
│   ├── 📂 scripts/            # Build and deployment scripts
│   ├── 📂 styles/             # Global styles
│   ├── 📂 public/             # Static assets
│   └── 📂 dist-electron/      # Electron build output
│
└── 📂 app/                      # React Native Mobile App (Expo)
    ├── 📂 src/
    │   ├── 📂 components/       # React Native components
    │   │   ├── 📂 modals/       # Modal components
    │   │   ├── 📂 navigation/   # Navigation components (Drawer, TabBar)
    │   │   ├── 📂 permissions/  # Permission handling components
    │   │   └── 📂 ui/           # Reusable UI components
    │   ├── 📂 contexts/         # React contexts (Auth, Notification, Drawer, etc.)
    │   ├── 📂 screens/          # App screens
    │   │   ├── 📂 auth/         # Authentication screens
    │   │   └── 📂 client/       # Client screens (dashboard, vouchers, reports, etc.)
    │   ├── 📂 services/         # Services (notifications, etc.)
    │   ├── 📂 utils/            # Utility functions
    │   ├── 📂 lib/              # API client and helpers
    │   ├── 📂 hooks/            # Custom hooks
    │   ├── 📂 config/           # Configuration files
    │   └── 📂 navigation/       # Navigation configuration
    ├── 📂 assets/               # Images, fonts, icons
    ├── 📂 scripts/              # Setup and configuration scripts
    ├── 📄 App.jsx               # Application entry point
    └── 📄 app.json              # Expo configuration
```

---

## ⚙️ Configuration

### Backend Environment Variables

#### Required Variables

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=fintranzact_main
MASTER_DB_NAME=fintranzact_master

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# Encryption
ENCRYPTION_KEY=your-32-character-secret-key-for-db-encryption
PAYLOAD_ENCRYPTION_KEY=your-very-strong-secret-key-at-least-32-chars
```

#### Optional Variables

```env
# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# E-Invoice API
E_INVOICE_API_URL=https://api.example.com
E_INVOICE_API_KEY=your-api-key

# Email/SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password

# Razorpay
RAZORPAY_KEY_ID=your-key-id
RAZORPAY_SECRET_KEY=your-secret-key
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
SESSION_SECRET=your-session-secret
```

### Frontend Environment Variables

#### Required Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_PAYLOAD_ENCRYPTION_KEY=your-very-strong-secret-key-at-least-32-chars
```

#### Optional Variables

```env
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_APP_NAME=Fintranzact
```

### Mobile App Environment Variables

The mobile app uses environment-specific configuration files:
- `.env.development` - Development environment
- `.env.production` - Production environment

#### Key Variables

```env
EXPO_PUBLIC_API_URL=http://192.168.1.39:3000/api
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.39:3000
EXPO_PUBLIC_UPLOADS_BASE_URL=http://192.168.1.39:3000
EXPO_PUBLIC_PAYLOAD_ENCRYPTION_KEY=your-encryption-key
EXPO_PUBLIC_ENABLE_BIOMETRIC_AUTH=true
EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS=true
EXPO_PUBLIC_ENABLE_OFFLINE_MODE=true
EXPO_PUBLIC_DEFAULT_CURRENCY=INR
EXPO_PUBLIC_DEFAULT_COUNTRY=IN
EXPO_PUBLIC_DEFAULT_TIMEZONE=Asia/Kolkata
```

Use the environment scripts to switch between environments:
```bash
npm run env:dev      # Switch to development
npm run env:prod     # Switch to production
npm run env:current  # Check current environment
```

### 🔑 Encryption Keys Setup

**Important:** The encryption keys must be configured correctly for security.

```bash
# Backend .env
ENCRYPTION_KEY=your-32-character-secret-key-change-in-production-must-be-32-chars
PAYLOAD_ENCRYPTION_KEY=your-very-strong-secret-key-at-least-32-characters-long

# Frontend .env
NEXT_PUBLIC_PAYLOAD_ENCRYPTION_KEY=your-very-strong-secret-key-at-least-32-characters-long
```

**⚠️ Security Notes:**
- `ENCRYPTION_KEY` - Used for database password encryption (backend only)
- `PAYLOAD_ENCRYPTION_KEY` and `NEXT_PUBLIC_PAYLOAD_ENCRYPTION_KEY` **must match**
- Never commit `.env` files to version control
- Use strong, random keys in production
- Rotate keys carefully (requires re-encrypting data)

---

## 🔐 Security

### Security Features

- 🔒 **JWT Authentication** - Secure token-based authentication
- 🔐 **Redis Sessions** - Scalable session management
- 🛡️ **Password Hashing** - bcrypt with salt rounds
- 🔑 **Database Password Encryption** - AES-256-CBC encryption at rest
- 📦 **API Payload Encryption** - Optional end-to-end encryption
- 🔐 **Data Encryption** - Sensitive fields (PAN, Aadhaar, bank details)
- 👥 **Role-Based Access Control** - Granular permissions
- 🏢 **Tenant Data Isolation** - Complete multi-tenant security
- ✅ **Input Validation** - Comprehensive sanitization
- 🚦 **Rate Limiting** - DDoS protection
- 🛡️ **Security Headers** - Helmet.js integration
- 📝 **Audit Trail** - Complete activity logging

### Encryption Systems

The application uses two separate encryption systems:

#### 1. Database Password Encryption (Automatic)
- **Purpose:** Encrypts database passwords before storing
- **Algorithm:** AES-256-CBC
- **Key:** `ENCRYPTION_KEY` environment variable
- **Status:** Always active - all DB passwords are encrypted

#### 2. API Payload Encryption (Optional)
- **Purpose:** Encrypts API request/response payloads
- **Algorithm:** CryptoJS AES encryption
- **Keys:** `PAYLOAD_ENCRYPTION_KEY` (backend) and `NEXT_PUBLIC_PAYLOAD_ENCRYPTION_KEY` (frontend)
- **Status:** Activated when client sends encrypted data

### Testing Encryption

```bash
# Test encryption functionality
cd backend
node src/utils/testEncryption.js
```

---

## 📡 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new tenant |
| `POST` | `/api/auth/login` | User login |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `GET` | `/api/auth/google` | Initiate Google OAuth |
| `GET` | `/api/auth/google/callback` | Google OAuth callback |

### Accounting Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/accounting/invoices/sales` | Create sales invoice |
| `POST` | `/api/accounting/invoices/purchase` | Create purchase invoice |
| `POST` | `/api/accounting/payments` | Create payment voucher |
| `POST` | `/api/accounting/receipts` | Create receipt voucher |
| `GET` | `/api/reports/trial-balance` | Get trial balance |
| `GET` | `/api/reports/balance-sheet` | Get balance sheet |
| `GET` | `/api/reports/profit-loss` | Get P&L statement |

### GST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/gst/returns/gstr1` | Generate GSTR-1 |
| `POST` | `/api/gst/returns/gstr3b` | Generate GSTR-3B |
| `POST` | `/api/einvoice/generate` | Generate e-invoice IRN |
| `GET` | `/api/ewaybill/generate` | Generate e-way bill |

### TDS Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tds/calculate` | Calculate TDS |
| `GET` | `/api/tds/certificate/:id` | Generate Form 16A |

### Notification Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notifications` | Get user notifications |
| `GET` | `/api/notifications/unread-count` | Get unread count |
| `PUT` | `/api/notifications/:id/read` | Mark as read |
| `PUT` | `/api/notifications/read-all` | Mark all as read |
| `DELETE` | `/api/notifications/:id` | Delete notification |
| `GET` | `/api/notifications/preferences` | Get preferences |
| `PUT` | `/api/notifications/preferences` | Update preferences |

### Company Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/companies/:id/upload-logo` | Upload company logo |
| `POST` | `/api/companies/:id/upload-signature` | Upload signature |
| `POST` | `/api/companies/:id/upload-dsc-certificate` | Upload DSC certificate |
| `PUT` | `/api/companies/:id/dsc-config` | Update DSC configuration |

---

## 💻 Development

### Backend Development

```bash
cd backend

# Development mode with auto-reload
npm run dev

# Run database migrations
npm run migrate

# Undo last migration
npm run migrate:undo

# Run seeders
npm run seed

# Production mode
npm start
```

### Frontend Development

```bash
cd frontend

# Development server
npm run dev

# Development server for Electron
npm run dev:electron

# Build for production
npm run build

# Production server
npm start

# Run ESLint
npm run lint

# Electron development
npm run electron:dev

# Build Electron app
npm run electron:build
```

### Mobile App Development

```bash
cd app

# Start Expo development server
npm start

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios

# Run in web browser
npm run web

# Switch environments
npm run env:dev
npm run env:prod

# Build for production
npm run build:android
npm run build:ios
```

### Health Checks

```bash
# Backend health check
curl http://localhost:3000/health
curl http://localhost:3000/api/health
```

---

## 🖥️ Desktop Application

Fintranzact is available as a native desktop application for **macOS** and **Windows** using Electron.

### Development

```bash
cd frontend
npm run electron:dev
```

This starts the Next.js dev server and launches Electron.

### Building

```bash
# Build for current platform
npm run electron:build

# Build unsigned (for testing)
npm run electron:build-unsigned

# Build with Electron Builder
npm run electron:dist
```

### Build Outputs

Build outputs are in the `frontend/dist-electron/` directory:

- **Windows**: Portable executable (.exe)
- **macOS**: DMG installer (universal binary - Intel + Apple Silicon)

### Electron Features

- ✅ Native desktop application
- ✅ Auto-updater support (configured)
- ✅ Code signing ready (macOS and Windows)
- ✅ Universal macOS binaries (x64 + arm64)
- ✅ Windows portable version
- ✅ Secure preload scripts
- ✅ DevTools in development mode
- ✅ Custom title bar and window controls
- ✅ Keyboard shortcuts
- ✅ Desktop notifications
- ✅ Status bar integration

---

## 📱 Mobile Application

Fintranzact mobile app is built with **React Native** and **Expo** for iOS and Android.

### Development

```bash
cd app

# Start Expo development server
npm start

# Run on Android device/emulator
npm run android

# Run on iOS device/simulator (macOS only)
npm run ios

# Run in web browser
npm run web
```

### Environment Configuration

```bash
# Switch to development environment
npm run env:dev

# Switch to production environment
npm run env:prod

# Check current environment
npm run env:current
```

### Building for Production

```bash
# Build for Android
npm run build:android

# Build for iOS
npm run build:ios
```

### Mobile App Features

#### Authentication & Security
- ✅ Biometric authentication (Face ID, Touch ID, Fingerprint)
- ✅ Secure token storage with AsyncStorage
- ✅ Auto-login with saved credentials
- ✅ Password reset functionality
- ✅ Google OAuth integration

#### Core Features
- ✅ Dashboard with business insights
- ✅ Voucher management (Sales, Purchase, Payment, Receipt, Journal, Contra, Debit/Credit Notes)
- ✅ Ledger management
- ✅ Inventory management with barcode scanning
- ✅ GST compliance (GSTR-1, GSTR-3B, E-Invoice, E-Way Bill)
- ✅ TDS management and calculations
- ✅ Income tax calculations
- ✅ Financial reports (Balance Sheet, P&L, Trial Balance)
- ✅ Company and branch management
- ✅ Multi-company support with branch selection

#### Advanced Features
- ✅ **Inventory Management**
  - Inventory items with variants
  - Stock adjustments
  - Stock transfers between warehouses
  - Warehouse management
  - Product attributes and variants
  - Barcode scanning

- ✅ **GST Features**
  - Multiple GSTIN management
  - GST rate master
  - E-Invoice generation
  - E-Way Bill generation
  - GSTR-1 and GSTR-3B reports

- ✅ **Tax Management**
  - Income tax calculator
  - TDS calculations
  - Tax planning tools

- ✅ **Business Tools**
  - Tally import functionality
  - Support ticket system
  - Review and rating system
  - Loan application (Finbox integration)
  - Referral program

#### Device Integration
- ✅ **Camera** - Document scanning, profile pictures
- ✅ **Barcode Scanner** - Inventory and product scanning
- ✅ **Location Services** - Location-based features
- ✅ **Contacts** - Customer/vendor management
- ✅ **Calendar** - GST filing reminders
- ✅ **Notifications** - Push notifications and alerts
- ✅ **Document Picker** - File attachments
- ✅ **Media Library** - Photo and document management
- ✅ **Print & Share** - Export and share documents

#### Offline Capabilities
- ✅ Offline mode support
- ✅ Local data caching
- ✅ Sync when online

#### UI/UX
- ✅ Custom drawer navigation
- ✅ Bottom tab navigation (Dashboard, Vouchers, Reports, GST, More)
- ✅ Smooth animations and transitions
- ✅ Custom fonts (Agency)
- ✅ Responsive design for tablets
- ✅ Splash screen with branding
- ✅ Loading states and error handling

### Expo Configuration

The app uses Expo SDK 54 with the following key plugins:
- expo-camera, expo-barcode-scanner
- expo-local-authentication
- expo-notifications
- expo-location
- expo-contacts, expo-calendar
- expo-document-picker, expo-file-system
- expo-image-picker, expo-media-library
- expo-print, expo-sharing

### Permissions

The app requests the following permissions:
- **iOS**: Camera, Photo Library, Microphone, Location, Contacts, Calendar, Face ID, etc.
- **Android**: Camera, Storage, Location, Contacts, Calendar, Biometric, Notifications, etc.

All permissions are requested with clear usage descriptions explaining why they're needed.

---

## 🚢 Deployment

### Backend Deployment

1. Set `NODE_ENV=production` in `.env`.
2. Update all secrets:
   - `JWT_SECRET` and `JWT_REFRESH_SECRET`
   - `ENCRYPTION_KEY` (for database password encryption)
   - `PAYLOAD_ENCRYPTION_KEY` (must match frontend)
3. Configure database credentials via `DATABASE_URL` or individual `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` variables.
4. Configure Redis (`REDIS_HOST`, `REDIS_PORT`, optional `REDIS_PASSWORD`).
5. Set up SSL termination at your reverse proxy / load balancer.
6. Configure third-party API credentials (Razorpay, GST, E-Invoice, E-Way Bill, etc.).
7. Configure backup strategy for MySQL.
8. Set up monitoring and structured logging.

```bash
cd backend
npm ci --omit=dev
npm start
```

### Frontend Deployment

1. Set `NODE_ENV=production` in `.env`
2. Set `NEXT_PUBLIC_API_URL` to production backend URL
3. Set `NEXT_PUBLIC_PAYLOAD_ENCRYPTION_KEY` (must match backend)
4. Build and deploy:
   ```bash
   npm run build
   npm start
   ```

### Desktop Application Deployment

1. Set `NEXT_PUBLIC_API_URL` in `.env` to production backend URL
2. Set `NEXT_PUBLIC_PAYLOAD_ENCRYPTION_KEY` (must match backend)
3. Build for distribution:
   ```bash
   npm run electron:build
   ```
4. Code sign applications (required for distribution)
5. Test installers on clean systems
6. Distribute EXE (Windows) or DMG (macOS) files

### Mobile Application Deployment

1. Configure production environment:
   ```bash
   npm run env:prod
   ```
2. Update `app.json` with production settings:
   - Bundle identifiers
   - App version
   - API URLs
   - Permissions
3. Build for app stores:
   ```bash
   npm run build:android  # For Google Play Store
   npm run build:ios      # For Apple App Store
   ```
4. Test builds on physical devices
5. Submit to app stores following their guidelines

**Note**: Mobile builds require Expo Application Services (EAS) account.

---

## 📊 Database Models

### Core Models (14)
- Tenant, User, Distributor, Salesman
- SubscriptionPlan, ReferralCode, ReferralReward
- Commission, Payout, Lead, LeadActivity
- Target, Notification, NotificationPreference

### Accounting Models (8)
- AccountGroup, Ledger, VoucherType, Voucher
- VoucherItem, VoucherLedgerEntry
- BillWiseDetail, BillAllocation

### GST & Compliance Models (3)
- GSTIN, GSTRReturn, EInvoice
- **Note**: GST rates now fetched from Sandbox API (removed GSTRate model)
- TDSDetail (TDS sections now fetched from Sandbox API)

### System Models (1)
- AuditLog

**Total: 32+ models**

---

## 📄 License

### ISC License

This project is licensed under the ISC License.

### Commercial License

For commercial use or extended licensing options, please contact us to purchase a license.

**Contact Information:**
- 📧 Email: [info@illusiodesigns.agency](mailto:info@illusiodesigns.agency)
- 🌐 Website: [https://illusiodesigns.agency](https://illusiodesigns.agency)
- 📞 Phone: 7600046416

### ⚠️ Legal Notice

**WARNING: Unauthorized Use Prohibited**

This software is protected by copyright and licensing laws. Any use of this software without a valid license is strictly prohibited and constitutes a violation of intellectual property rights.

**Legal Consequences:**
- Unauthorized use, distribution, or modification of this software without a proper license will result in legal action
- Violators will be prosecuted to the full extent of the law
- This includes but is not limited to: civil lawsuits, monetary damages, and criminal prosecution where applicable

**To avoid legal action, please:**
1. Purchase an appropriate license before using this software
2. Contact us at [info@illusiodesigns.agency](mailto:info@illusiodesigns.agency) for licensing inquiries
3. Ensure all team members and users are properly licensed

By using this software, you acknowledge that you have read, understood, and agree to comply with all licensing terms and conditions.

---

<div align="center">

### 🎉 Production Ready

**Fintranzact is a complete, production-ready multi-tenant accounting platform with full GST compliance, TDS management, and sales distribution features.**

**Key Achievements:**
- ✅ 32+ database models with complete multi-tenant isolation
- ✅ Full accounting suite with double-entry bookkeeping
- ✅ GST compliance (E-Invoice, E-Way Bill, GSTR-1, GSTR-3B)
- ✅ TDS management with Form 16A generation
- ✅ Real-time WebSocket notifications
- ✅ Native desktop applications (macOS & Windows with Electron)
- ✅ Native mobile applications (iOS & Android with React Native + Expo)
- ✅ Biometric authentication for mobile
- ✅ Offline mode support for mobile
- ✅ Comprehensive API with 50+ endpoints
- ✅ Enterprise-grade security and encryption
- ✅ 40+ controllers handling complex business logic
- ✅ Multi-platform support (Web, Desktop, Mobile)

---

**Made with ❤️ by [Illusio Designs](https://illusiodesigns.agency)**

[⬆ Back to Top](#-fintranzact)

</div>
