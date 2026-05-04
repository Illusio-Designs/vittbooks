const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

/**
 * Run database migrations and seeders on server start
 * Only syncs/alters tables if needed
 */
async function syncDatabase() {
  try {
    logger.info('🔄 Initializing main database...');

    // First, authenticate the connection
    await sequelize.authenticate();

    // Run migrations for main database (admin/main DB tables)
    await runMainMigrations();

    // Single-database mode: register the tenant transactional models on
    // the main connection so that sync() creates / updates their tables.
    // Data is isolated at the row level via tenant_id / company_id.
    try {
      require('../services/tenantModels')(sequelize);
      logger.info('  ✓ Tenant transactional models registered on shared connection');
    } catch (regErr) {
      logger.warn('  ⚠️  Failed to register tenant models on shared connection: ' + regErr.message);
    }

    // Sync models with alter: true (will alter existing tables to match models)
    // This is safer than force: true which drops tables
    // Use alter: false in production to avoid memory issues during startup
    try {
      const syncOptions = process.env.NODE_ENV === 'production'
        ? { alter: false } // Skip alter in production to save memory
        : { alter: true };

      await sequelize.sync(syncOptions);
    } catch (syncError) {
      // Handle specific MySQL errors that shouldn't block startup
      if (syncError.original && syncError.original.code === 'ER_TOO_MANY_KEYS') {
        logger.warn('⚠️  Some tables have too many indexes (MySQL limit: 64)');
        logger.warn('   This is usually safe to ignore if tables already exist.');
        logger.warn('   Consider removing unnecessary indexes via migration.');
        // Continue with seeders even if sync fails due to index limit
      } else {
        // Re-throw other errors
        throw syncError;
      }
    }

    // Run seeders
    await runSeeders();

    logger.info('✅ Main database ready');
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Run consolidated migration for main database (admin/main DB)
 */
async function runMainMigrations() {
  try {
    const migrationsPath = path.join(__dirname, '../migrations');
    if (!fs.existsSync(migrationsPath)) {
      return;
    }

    // Use consolidated admin-master migration (for main DB part)
    const migrationFile = path.join(migrationsPath, '001-admin-master-migration.js');
    
    if (!fs.existsSync(migrationFile)) {
      logger.warn('⚠️  Consolidated admin-master migration file not found');
      return;
    }

    const queryInterface = sequelize.getQueryInterface();
    const { Sequelize } = require('sequelize');
    const migration = require(migrationFile);
    
    if (migration.up && typeof migration.up === 'function') {
      try {
        await migration.up(queryInterface, Sequelize);
        logger.info(`  ✓ Consolidated main database migration completed`);
      } catch (error) {
        // Ignore errors if column/index already exists
        if (error.message && error.message.includes('already exists')) {
          logger.debug(`  ℹ️  Main database migration already applied`);
        } else {
          logger.warn(`  ⚠️  Main database migration failed: ${error.message}`);
        }
      }
    }
  } catch (error) {
    logger.warn('Error running main database migrations:', error.message);
  }
}

/**
 * Run consolidated seeder file
 */
async function runSeeders() {
  try {
    const seedersPath = path.join(__dirname, '../seeders');
    
    if (!fs.existsSync(seedersPath)) {
      return;
    }

    // Create a table to track which seeders have been run
    await ensureSeederTable();

    const seederName = '001-admin-master-seeder';
    const seederFile = path.join(seedersPath, `${seederName}.js`);

    if (!fs.existsSync(seederFile)) {
      logger.warn('⚠️  Consolidated admin-master seeder file not found');
      return;
    }
      
      try {
        // Check if seeder has already been run
        const [results] = await sequelize.query(
          'SELECT * FROM seeder_meta WHERE name = ?',
          { replacements: [seederName], type: Sequelize.QueryTypes.SELECT }
        );

        if (results && results.length > 0) {
        logger.info(`ℹ️  Seeder '${seederName}' already executed, skipping`);
        return;
        }

      // Run the consolidated seeder
      logger.info(`  → Running consolidated seeder: ${seederName}`);
      const seeder = require(seederFile);
        
        if (typeof seeder.up === 'function') {
          await seeder.up(sequelize.getQueryInterface(), Sequelize);
          
          // Mark seeder as executed (with duplicate protection)
          try {
            await sequelize.query(
              'INSERT INTO seeder_meta (name, executed_at) VALUES (?, ?)',
              { replacements: [seederName, new Date()] }
            );
          } catch (insertError) {
            // If duplicate entry error, it means another process already inserted it
            if (insertError.message.includes('Duplicate entry') || 
                insertError.message.includes('name must be unique')) {
              logger.info(`ℹ️  Seeder '${seederName}' already marked as executed by another process`);
            } else {
              throw insertError; // Re-throw if it's a different error
            }
          }
          
        logger.info(`✅ Consolidated seeder completed successfully`);
        }
      } catch (seederError) {
      logger.error(`❌ Seeder '${seederName}' failed:`);
        logger.error(`   Error: ${seederError.message}`);
        
        if (seederError.errors && Array.isArray(seederError.errors)) {
          seederError.errors.forEach(err => {
            logger.error(`   - ${err.message || err.type}: ${err.path || ''} (value: ${err.value})`);
          });
        }
        
        if (seederError.sql) {
          logger.error(`   SQL: ${seederError.sql.substring(0, 200)}...`);
        }
        
        if (seederError.original) {
          logger.error(`   Original: ${seederError.original.sqlMessage || seederError.original.message}`);
        }
    }
  } catch (error) {
    logger.error('❌ Seeding system error:', error.message);
    logger.error(error.stack);
  }
}

/**
 * Ensure the seeder_meta table exists to track executed seeders
 */
async function ensureSeederTable() {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS seeder_meta (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at DATETIME NOT NULL,
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (error) {
    logger.error('Error creating seeder_meta table:', error);
    throw error;
  }
}

module.exports = { syncDatabase, runSeeders, runMainMigrations };
