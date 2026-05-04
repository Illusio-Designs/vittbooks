// Validate environment first — exits process with a clear error if any
// required secret/config is missing or too weak.
require('./src/config/env');
const http = require('http');
const sequelize = require('./src/config/database');
const { initDatabase } = require('./src/scripts/initDatabase');
const masterSequelize = require('./src/config/masterDatabase');
const { initMasterDatabase } = require('./src/scripts/initMasterDatabase');
const redisClient = require('./src/config/redis');
const logger = require('./src/utils/logger');
const { syncDatabase } = require('./src/utils/dbSync');
const { initSocketServer } = require('./src/websocket/socketServer');
const cronService = require('./src/services/cronService');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Test database connection
async function startServer() {
  try {
    // Log environment status at startup (without sensitive data)
    logger.info('🚀 Starting Finvera Backend Server...');
    logger.info('🔍 Environment check:');
    logger.info(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    logger.info(`   DB_HOST: ${process.env.DB_HOST || 'NOT SET (will default to localhost)'}`);
    logger.info(`   DB_USER: ${process.env.DB_USER || 'NOT SET (will default to root)'}`);
    logger.info(`   DB_NAME: ${process.env.DB_NAME || 'NOT SET (will default to finvera_main)'}`);
    logger.info(`   MASTER_DB_NAME: ${process.env.MASTER_DB_NAME || 'NOT SET (will default to finvera_master)'}`);
    logger.info(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`   PORT: ${process.env.PORT || '3000'}`);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    logger.info('🔄 Initializing databases...');
    
    // Run automatic database initialization (migrations + seeders) if enabled
    const autoDbInit = process.env.AUTO_DB_INIT === 'true';
    
    if (autoDbInit) {
      logger.info('🔧 Auto database initialization enabled');
      const databaseInitializer = require('./src/utils/databaseInitializer');
      try {
        await databaseInitializer.initialize();
      } catch (initError) {
        logger.error('❌ Database initialization failed:', initError.message);
        logger.warn('⚠️  Attempting to continue with manual initialization...');
      }
    } else {
      logger.info('ℹ️  Auto database initialization disabled (set AUTO_DB_INIT=true to enable)');
    }
    
    // 1. Initialize Master Database (for tenant metadata)
    logger.info('📦 Setting up master database for tenant metadata...');
    
    // Wrap in try-catch to handle WebAssembly memory errors gracefully
    try {
      await initMasterDatabase();
    } catch (initError) {
      // If it's a WebAssembly memory error, log it but try to continue
      if (initError.message && initError.message.includes('WebAssembly') && initError.message.includes('Out of memory')) {
        logger.warn('⚠️  WebAssembly memory error during master DB init, but continuing...');
        logger.warn('   This is often non-fatal. If issues persist, increase NODE_OPTIONS memory limit.');
        // Try to continue - the error might have been caught internally
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw initError;
      }
    }
    
    // Allow memory to be freed
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 2. Initialize Main Database (for admin, salesman, distributor, etc.)
    logger.info('📦 Setting up main database for system models...');
    await initDatabase();
    
    // Allow memory to be freed
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await syncDatabase();

    // Final garbage collection
    if (global.gc) {
      global.gc();
    }

    logger.info('✅ All databases initialized successfully');
    
    // Initialize Cron Service for scheduled tasks
    logger.info('🕒 Initializing scheduled tasks...');
    try {
      await cronService.initialize();
    } catch (cronError) {
      logger.error('❌ Failed to initialize cron service:', cronError);
      // Don't fail server startup if cron fails - log and continue
      logger.warn('⚠️  Server will continue without scheduled tasks');
    }
    
    // Load Express app AFTER database initialization to avoid WebAssembly memory conflicts
    // This ensures databases initialize first, then HTTP server starts
    logger.info('📡 Initializing Express application...');
    let app;
    try {
      app = require('./src/app');
    } catch (appError) {
      if (appError.message && appError.message.includes('WebAssembly')) {
        logger.error('⚠️  WebAssembly error loading Express app. Retrying after cleanup...');
        // Force garbage collection
        if (global.gc) {
          global.gc();
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Retry once
        app = require('./src/app');
      } else {
        throw appError;
      }
    }
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Initialize Socket.IO server
    initSocketServer(server);
    
    // Start server
    // Bind to 0.0.0.0 for Render/cloud platforms (they require it)
    const HOST = process.env.HOST || '0.0.0.0';
    server.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running on ${HOST}:${PORT} in ${NODE_ENV} mode`);
      logger.info(`📍 API: http://localhost:${PORT}/api`);
      logger.info(`🔌 WebSocket: ws://localhost:${PORT}`);
      logger.info(`💚 Health: http://localhost:${PORT}/health`);
      logger.info(`📊 Databases:`);
      logger.info(`   - Main DB: ${process.env.DB_NAME || 'finvera_main'} (Admin, Salesman, Distributor, etc.)`);
      logger.info(`   - Master DB: ${process.env.MASTER_DB_NAME || 'finvera_master'} (Tenant metadata only)`);
      logger.info(`   - Tenant DBs: Created dynamically per tenant`);
      logger.info(`✅ Server started successfully!`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use. Please:`);
        logger.error(`   1. Check if PM2 is running: pm2 list`);
        logger.error(`   2. Stop PM2 process: pm2 stop finvera-backend`);
        logger.error(`   3. Or find and kill the process:`);
        logger.error(`      - Linux: lsof -i :${PORT} or netstat -tulpn | grep ${PORT}`);
        logger.error(`      - Then kill: kill -9 <PID>`);
        logger.error(`   4. Or set a different PORT in your .env file`);
      } else {
        logger.error('❌ Server failed to start:', err);
        logger.error('Error code:', err.code);
        logger.error('Error message:', err.message);
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error('❌ Server startup failed:', error);
    logger.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sql: error.sql,
      sqlState: error.sqlState,
      stack: error.stack,
    });
    if (error.original) {
      logger.error('❌ Original error:', {
        message: error.original.message,
        code: error.original.code,
        errno: error.original.errno,
        sql: error.original.sql,
        sqlState: error.original.sqlState,
      });
    }
    // Log environment variable status (without sensitive data)
    logger.error('❌ Environment check:');
    logger.error(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    logger.error(`   DB_HOST: ${process.env.DB_HOST || 'NOT SET'}`);
    logger.error(`   DB_USER: ${process.env.DB_USER || 'NOT SET'}`);
    logger.error(`   DB_NAME: ${process.env.DB_NAME || 'NOT SET'}`);
    logger.error(`   MASTER_DB_NAME: ${process.env.MASTER_DB_NAME || 'NOT SET'}`);
    logger.error(`   NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
    logger.error(`   PORT: ${process.env.PORT || 'NOT SET'}`);
    
    // Wait a bit to ensure logs are flushed
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  cronService.stopAll();
  await sequelize.close();
  await masterSequelize.close();
  if (redisClient && redisClient.isConnected && redisClient.isConnected()) {
    await redisClient.quit();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  cronService.stopAll();
  await sequelize.close();
  await masterSequelize.close();
  if (redisClient && redisClient.isConnected && redisClient.isConnected()) {
    await redisClient.quit();
  }
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  console.error('Stack:', err.stack);
  
  // Try to use logger if available, otherwise use console
  try {
    if (logger && logger.error) {
      logger.error('Unhandled Promise Rejection:', err);
      logger.error('Stack:', err.stack);
    }
  } catch (e) {
    // Logger might not be initialized yet
  }
  
  // Unhandled rejections leave the process in an unknown state. We log
  // and exit so the orchestrator (PM2 / your platform) restarts a clean
  // worker. Trying to "recover" in-place can mask data corruption.
  console.error('Fatal error, exiting...');
  setTimeout(() => {
    process.exit(1);
  }, 2000);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  console.error('Stack:', err.stack);
  
  try {
    if (logger && logger.error) {
      logger.error('Uncaught Exception:', err);
      logger.error('Stack:', err.stack);
    }
  } catch (e) {
    // Logger might not be initialized yet
  }
  
  // Give time for logs to flush
  setTimeout(() => {
    process.exit(1);
  }, 2000);
});

// Start the server with error handling
startServer().catch((err) => {
  console.error('❌ Failed to start server:', err);
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    code: err.code,
  });
  
  // Try to use logger if available
  try {
    if (logger && logger.error) {
      logger.error('❌ Failed to start server:', err);
    }
  } catch (e) {
    // Logger might not be available
  }
  
  // Exit after a delay to allow logs to flush
  setTimeout(() => {
    process.exit(1);
  }, 2000);
});
