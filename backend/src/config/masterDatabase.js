// Load .env only if not in production (hosted platforms set env vars directly)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Master Database Connection
 * Stores ONLY tenant metadata (tenant_master table)
 * Admin, salesman, distributor data stays in main database (fintranzact_main)
 * Auto-created on server startup
 */
const masterDbName = process.env.MASTER_DB_NAME || 'fintranzact_master';

// Support DATABASE_URL connection string or individual variables
let masterSequelize;
if (process.env.DATABASE_URL) {
  const connectionUrl = process.env.DATABASE_URL;
  logger.info(`[DB CONFIG] Using DATABASE_URL connection string for master database`);
  // Parse URL and replace database name with master database name
  const url = new URL(connectionUrl);
  url.pathname = `/${masterDbName}`;
  masterSequelize = new Sequelize(url.toString(), {
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 15,
      min: parseInt(process.env.DB_POOL_MIN) || 0,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE_MS) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE_MS) || 10000,
      evict: parseInt(process.env.DB_POOL_EVICT_MS) || 1000,
    },
    dialectOptions: {
      connectTimeout: 60000,
    },
  });
} else {
  // Fallback to individual variables
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT || 3306;
  const dbUser = process.env.DB_USER || 'root';
  
  // Check if DB_HOST is set (required for RDS/remote MySQL)
  if (!dbHost) {
    logger.error(`[DB CONFIG] ❌ DB_HOST is not set!`);
    logger.error(`[DB CONFIG] For RDS/remote MySQL, you must set DB_HOST to your MySQL server address.`);
    logger.error(`[DB CONFIG] Example: DB_HOST=your-rds-endpoint.region.rds.amazonaws.com`);
    throw new Error('DB_HOST environment variable is required for master database connection');
  }
  
  logger.info(`[DB CONFIG] Master DB Connection: host=${dbHost}, port=${dbPort}, user=${dbUser}, database=${masterDbName}`);
  
  masterSequelize = new Sequelize(
    masterDbName,
    dbUser,
    process.env.DB_PASSWORD || '',
    {
      host: dbHost,
      port: parseInt(dbPort),
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 15,
      min: parseInt(process.env.DB_POOL_MIN) || 0,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE_MS) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE_MS) || 10000,
      evict: parseInt(process.env.DB_POOL_EVICT_MS) || 1000,
    },
      dialectOptions: {
      connectTimeout: 60000,
    },
  },
  );
}

/**
 * Initialize master database
 * Creates database and syncs all master models (shared across tenants)
 */
async function initMasterDatabase() {
  try {
    logger.info(`[INIT] Starting master database initialization for: ${masterDbName}`);
    
    // First, try to connect directly to the master database (it might already exist in RDS)
    try {
      await masterSequelize.authenticate();
      logger.info(`[INIT] ✓ Master database '${masterDbName}' already exists and is accessible`);
      // Database exists, continue to sync tables
    } catch (directConnectError) {
      // Check if error is because database doesn't exist (ER_BAD_DB_ERROR) or connection issue
      const isDatabaseNotFound = directConnectError.original?.code === 'ER_BAD_DB_ERROR' || 
                                  directConnectError.message?.includes('Unknown database') ||
                                  directConnectError.message?.includes('does not exist');
      
      if (!isDatabaseNotFound) {
        // If it's a connection error (not database not found), throw it
        // This means RDS/server is not accessible, not that database doesn't exist
        logger.error(`[INIT] ❌ Cannot connect to MySQL server: ${directConnectError.message}`);
        logger.error(`[INIT] Check your DB_HOST, DB_USER, DB_PASSWORD, and network connectivity`);
        throw directConnectError;
      }
      
      // If database doesn't exist, try to create it
      logger.info(`[INIT] Master database '${masterDbName}' does not exist, attempting to create it...`);
      logger.debug(`[INIT] Connection error: ${directConnectError.message}`);
      
      // Connect without database name to create it
      let rootConnection;
      if (process.env.DATABASE_URL) {
        const connectionUrl = process.env.DATABASE_URL;
        logger.info(`[INIT] Using DATABASE_URL connection string for database creation`);
        // Use connection string but without database name
        const url = new URL(connectionUrl);
        url.pathname = '/';
        rootConnection = new Sequelize(url.toString(), {
          dialect: 'mysql',
          logging: false,
          pool: {
            max: 1,
            min: 0,
            acquire: 30000,
            idle: 10000,
          },
        });
        logger.info(`[INIT] Attempting to connect to MySQL server...`);
        await rootConnection.authenticate();
        logger.info(`[INIT] ✓ Connected to MySQL server`);
      } else {
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbUser = process.env.DB_USER || 'root';
        logger.info(`[INIT] Using individual DB variables: host=${dbHost}, user=${dbUser}`);
        rootConnection = new Sequelize('', dbUser, process.env.DB_PASSWORD || '', {
          host: dbHost,
          port: process.env.DB_PORT || 3306,
          dialect: 'mysql',
          logging: false,
          pool: {
            max: 1,
            min: 0,
            acquire: 30000,
            idle: 10000,
          },
        });
        logger.info(`[INIT] Attempting to connect to MySQL server at ${dbHost}...`);
        await rootConnection.authenticate();
        logger.info(`[INIT] ✓ Connected to MySQL server`);
      }

      // Create master database if it doesn't exist
      try {
        logger.info(`[INIT] Creating database: ${masterDbName}`);
        await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${masterDbName}\``);
        logger.info(`[INIT] ✓ Database ${masterDbName} ready`);
      } catch (createError) {
        // If database creation fails (e.g., no permissions in RDS), log warning but continue
        // The database might already exist or be managed externally
        logger.warn(`[INIT] Could not create database ${masterDbName}: ${createError.message}`);
        logger.warn(`[INIT] This is normal if the database already exists or is managed externally (e.g., RDS)`);
      }
      
      if (rootConnection) {
        await rootConnection.close();
      }
      
      // Try connecting again after creation attempt
      await masterSequelize.authenticate();
      logger.info(`[INIT] ✓ Master database connection verified`);
    }
    
    logger.info(`Master database '${masterDbName}' ready`);

    // Test connection with retry logic for WebAssembly errors
    let retries = 3;
    while (retries > 0) {
      try {
    await masterSequelize.authenticate();
    logger.info('Master database connection established');
        break;
      } catch (authError) {
        if (authError.message && authError.message.includes('WebAssembly') && retries > 1) {
          logger.warn(`⚠️  WebAssembly error during auth, retrying... (${retries - 1} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 500));
          if (global.gc) {
            global.gc();
          }
          retries--;
        } else {
          throw authError;
        }
      }
    }

    // Run migrations for master database
    await runMasterMigrations();
    
    // Allow memory to be freed
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Sync all master models (shared accounting structure)
    // Lazy load models to reduce initial memory footprint
    const masterModels = require('../models/masterModels');
    
    // Add delay before sync to allow WebAssembly to initialize if needed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await masterModels.syncMasterModels();
    
    logger.info('Master database models synchronized:');
    logger.info('  ✓ tenant_master (tenant metadata)');
    logger.info('  ✓ account_groups (shared chart of accounts)');
    logger.info('  ✓ voucher_types (shared voucher types)');
    logger.info('  ✓ accounting_years (shared accounting periods)');
    logger.info('  ℹ️  GST rates and TDS sections now fetched from Sandbox API');

    // Allow memory to be freed
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 50));

    // Seed default data using consolidated seeder
    await seedMasterData();
    
    // Allow memory to be freed
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Also run the consolidated admin-master seeder for master DB parts
    await runMasterSeeder();

  } catch (err) {
    logger.error('Failed to initialize master database:', err);
    throw err;
  }
}

/**
 * Run consolidated migration for master database
 */
async function runMasterMigrations() {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const migrationsPath = path.join(__dirname, '../migrations');
    if (!fs.existsSync(migrationsPath)) {
      return;
    }

    // Use consolidated admin-master migration
    const migrationFile = path.join(migrationsPath, '001-admin-master-migration.js');
    
    if (!fs.existsSync(migrationFile)) {
      logger.warn('⚠️  Consolidated admin-master migration file not found');
      return;
    }

    const queryInterface = masterSequelize.getQueryInterface();
    const { Sequelize } = require('sequelize');
    const migration = require(migrationFile);
    
    if (migration.up && typeof migration.up === 'function') {
      try {
        await migration.up(queryInterface, Sequelize);
        logger.info(`  ✓ Consolidated master migration completed`);
      } catch (error) {
        // Ignore errors if column/index already exists
        if (error.message && error.message.includes('already exists')) {
          logger.debug(`  ℹ️  Master migration already applied`);
        } else {
          logger.warn(`  ⚠️  Master migration failed: ${error.message}`);
        }
      }
    }
  } catch (error) {
    logger.warn('Error running master migrations:', error.message);
  }
}

/**
 * Seed default master data if not exists
 * Uses masterSeeds.js helper functions (called by consolidated seeder)
 */
async function seedMasterData() {
  const masterModels = require('../models/masterModels');
  
  try {
    // Seed default account groups
    const groupCount = await masterModels.AccountGroup.count();
    if (groupCount === 0) {
      logger.info('Seeding default account groups...');
      await require('../seeders/masterSeeds').seedAccountGroups();
    }

    // Seed default voucher types
    const voucherTypeCount = await masterModels.VoucherType.count();
    if (voucherTypeCount === 0) {
      logger.info('Seeding default voucher types...');
      await require('../seeders/masterSeeds').seedVoucherTypes();
    }

    // GST rates and TDS sections removed - now using Sandbox API for live data
    logger.info('ℹ️  GST rates and TDS sections now fetched from Sandbox API instead of master database');

    // HSN/SAC master data removed - now using Sandbox API for live data
    logger.info('ℹ️  HSN/SAC data now fetched from Sandbox API instead of master database');

    logger.info('Master data seeding complete');
  } catch (error) {
    logger.warn('Error seeding master data:', error.message);
  }
}

/**
 * Run consolidated admin-master seeder for master database
 */
async function runMasterSeeder() {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const seedersPath = path.join(__dirname, '../seeders');
    if (!fs.existsSync(seedersPath)) {
      return;
    }

    // Ensure seeder_meta table exists
    await masterSequelize.query(`
      CREATE TABLE IF NOT EXISTS seeder_meta (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const seederName = '001-admin-master-seeder';
    
    // Check if seeder has already been run
    const [results] = await masterSequelize.query(
      'SELECT * FROM seeder_meta WHERE name = ?',
      { replacements: [seederName], type: masterSequelize.QueryTypes.SELECT }
    );

    if (results && results.length > 0) {
      logger.info(`  ℹ️  Master seeder '${seederName}' already executed, skipping`);
      return;
    }

    // Use consolidated admin-master seeder (for master DB parts)
    const seederFile = path.join(seedersPath, '001-admin-master-seeder.js');
    
    if (!fs.existsSync(seederFile)) {
      logger.warn('⚠️  Consolidated admin-master seeder file not found');
      return;
    }

    const queryInterface = masterSequelize.getQueryInterface();
    const { Sequelize } = require('sequelize');
    const seeder = require(seederFile);
    
    if (seeder.up && typeof seeder.up === 'function') {
      try {
        await seeder.up(queryInterface, Sequelize);
        
        // Mark seeder as executed (with duplicate protection)
        try {
          await masterSequelize.query(
            'INSERT INTO seeder_meta (name, executed_at) VALUES (?, ?)',
            { replacements: [seederName, new Date()] }
          );
        } catch (insertError) {
          // If duplicate entry error, it means another process already inserted it
          if (insertError.message.includes('Duplicate entry') || 
              insertError.message.includes('name must be unique')) {
            logger.info(`  ℹ️  Master seeder '${seederName}' already marked as executed by another process`);
          } else {
            throw insertError; // Re-throw if it's a different error
          }
        }
        
        logger.info(`  ✓ Consolidated master seeder completed`);
      } catch (error) {
        // Ignore errors if data already exists
        if (error.message && (error.message.includes('already exists') || 
                              error.message.includes('already seeded'))) {
          logger.debug(`  ℹ️  Master seeder already applied`);
        } else {
          logger.warn(`  ⚠️  Master seeder failed: ${error.message}`);
        }
      }
    }
  } catch (error) {
    logger.warn('Error running master seeder:', error.message);
  }
}

// Export both connection and init function
module.exports = masterSequelize;
