#!/usr/bin/env node

/**
 * Initialize Main Database
 * Creates the main database (fintranzact_main)
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Initialize main database
 * Creates database if it doesn't exist
 */
async function initDatabase() {
  const sequelize = require('../config/database');
  const dbName = process.env.DB_NAME || 'fintranzact_main';
  
  try {
    logger.info(`[INIT] Starting main database initialization for: ${dbName}`);
    
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

    // Create main database if it doesn't exist
    logger.info(`[INIT] Creating database: ${dbName}`);
    await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    logger.info(`[INIT] ✓ Database ${dbName} ready`);
    await rootConnection.close();
    
    // Allow memory to be freed
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    
    logger.info(`Main database '${dbName}' ready`);

    // Test connection
    await sequelize.authenticate();
    logger.info('Main database connection established');

  } catch (err) {
    logger.error('Failed to initialize main database:', err);
    throw err;
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase()
    .then(() => {
      logger.info('\n✅ Main database initialization complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { initDatabase };
