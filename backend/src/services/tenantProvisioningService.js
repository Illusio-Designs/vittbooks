const { Sequelize } = require('sequelize');
const crypto = require('crypto');
const TenantMaster = require('../models/TenantMaster');
const tenantConnectionManager = require('../config/tenantConnectionManager');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Tenant Provisioning Service
 * Handles creation of new tenant databases and initialization
 */
class TenantProvisioningService {
  /**
   * Create a new tenant with separate database
   * @param {Object} tenantData - Tenant information
   * @returns {Promise<Object>} - Created tenant with database info
   */
  async createTenant(tenantData) {
    const {
      company_name,
      subdomain,
      email,
      gstin,
      pan,
      tan,
      subscription_plan,
      phone,
      address,
      city,
      state,
      pincode,
      salesman_id,
      distributor_id,
      referred_by,
      referral_type,
    } = tenantData;

    try {
      // Generate unique database name
      const dbName = this.generateDatabaseName(subdomain);
      
      // Generate database credentials
      const dbUser = this.generateDatabaseUser(subdomain);
      const dbPassword = this.generateSecurePassword();
      
      // Determine acquisition category
      let acquisitionCategory = 'organic'; // Default: direct from website
      if (distributor_id) {
        acquisitionCategory = 'distributor';
      } else if (salesman_id) {
        acquisitionCategory = 'salesman';
      } else if (referred_by || referral_type) {
        acquisitionCategory = 'referral';
      }

      // Create tenant record in master database
      const tenant = await TenantMaster.create({
        company_name,
        subdomain: subdomain.toLowerCase(),
        email,
        gstin,
        pan,
        tan,
        subscription_plan,
        subscription_start: new Date(),
        phone,
        address,
        city,
        state,
        pincode,
        salesman_id,
        distributor_id,
        referred_by,
        referral_type,
        acquisition_category: acquisitionCategory,
        db_name: dbName,
        db_host: process.env.DB_HOST || 'localhost',
        db_port: parseInt(process.env.DB_PORT) || 3306,
        db_user: dbUser,
        db_password: this.encryptPassword(dbPassword),
        db_provisioned: false,
        is_trial: true,
        trial_ends_at: this.calculateTrialEnd(),
      });

      // Provision the database
      await this.provisionDatabase(tenant, dbPassword);

      logger.info(`Tenant created successfully: ${tenant.id} (${subdomain})`);

      return {
        tenant,
        credentials: {
          dbName,
          dbUser,
          dbPassword, // Return plain password only during creation
        },
      };
    } catch (error) {
      logger.error('Failed to create tenant:', error);
      throw new Error(`Tenant creation failed: ${error.message}`);
    }
  }

  /**
   * Provision database for a tenant
   * @param {Object} tenant - Tenant master record
   * @param {string} plainPassword - Plain text database password
   */
  async provisionDatabase(tenant, plainPassword) {
    // Get database credentials from environment
    // DB_USER on server is 'informative_fintranzact' (already exists, created by default)
    const dbUser = process.env.DB_USER || 'informative_fintranzact';
    const dbPassword = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : null;
    
    // Use root/admin user for database creation (needs CREATE DATABASE privilege)
    // If DB_ROOT_USER is not set, try using DB_USER (informative_fintranzact) - it might have CREATE privilege
    const rootUser = process.env.DB_ROOT_USER || dbUser;
    const rootPassword = process.env.DB_ROOT_PASSWORD !== undefined ? process.env.DB_ROOT_PASSWORD : dbPassword;
    
    if (!dbUser || dbPassword === null) {
      throw new Error('DB_USER and DB_PASSWORD environment variables must be set (DB_PASSWORD can be empty string for no password)');
    }

    logger.info(`[PROVISION] Using user for database creation: ${rootUser}`);
    logger.info(`[PROVISION] Will grant privileges to: ${dbUser} for tenant connections`);
    logger.info(`[PROVISION] Root user source: ${process.env.DB_ROOT_USER ? 'DB_ROOT_USER env var' : 'DB_USER (fallback)'}`);
    logger.info(`[PROVISION] Password provided: ${dbPassword === '' ? 'NO (empty string)' : 'YES'}`);

    // Use root/admin user for database creation (has CREATE DATABASE privilege)
    const rootConnection = new Sequelize('', rootUser, rootPassword, {
      host: tenant.db_host || process.env.DB_HOST || 'localhost',
      port: tenant.db_port || parseInt(process.env.DB_PORT) || 3306,
      dialect: 'mysql',
      logging: false,
    });

    try {
      logger.info(`[PROVISION] Attempting to authenticate with user: ${rootUser}...`);
      await rootConnection.authenticate();
      logger.info(`[PROVISION] ✓ Authentication successful with ${rootUser}`);
      
      // Check if database already exists
      const databaseExists = await this.checkDatabaseExists(rootConnection, tenant.db_name);
      
      if (databaseExists) {
        logger.info(`[PROVISION] ℹ️  Database '${tenant.db_name}' already exists, skipping creation`);
      } else {
        logger.info(`[PROVISION] Creating database: ${tenant.db_name}...`);
        // Create database
        try {
          await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${tenant.db_name}\``);
          logger.info(`[PROVISION] ✓ Database created: ${tenant.db_name}`);
        } catch (createDbError) {
          if (createDbError.original && createDbError.original.code === 'ER_DBACCESS_DENIED_ERROR') {
            logger.error(`[PROVISION] ✗ CREATE DATABASE failed: User '${rootUser}' does not have CREATE DATABASE privilege`);
            logger.error(`[PROVISION] SOLUTION: Run the following SQL commands as MySQL root/admin:`);
            logger.error(`[PROVISION] GRANT CREATE DATABASE ON *.* TO '${rootUser}'@'localhost';`);
            logger.error(`[PROVISION] GRANT CREATE DATABASE ON *.* TO '${rootUser}'@'%';`);
            logger.error(`[PROVISION] FLUSH PRIVILEGES;`);
            throw new Error(`User '${rootUser}' does not have CREATE DATABASE privilege. Please grant it using: GRANT CREATE DATABASE ON *.* TO '${rootUser}'@'localhost'; GRANT CREATE DATABASE ON *.* TO '${rootUser}'@'%'; FLUSH PRIVILEGES;`);
          }
          throw createDbError;
        }
      }
      
      // Check if this is RDS (AWS RDS doesn't allow GRANT with 'localhost')
      const dbHost = tenant.db_host || process.env.DB_HOST || 'localhost';
      const isRDS = dbHost.includes('rds.amazonaws.com') || dbHost.includes('rds.') || process.env.DB_HOST?.includes('rds');
      
      // Grant privileges to existing user
      // For RDS: Only use '%' (wildcard) - RDS doesn't allow 'localhost' GRANT
      // For local MySQL: Use both '%' and 'localhost'
      logger.info(`[PROVISION] Granting privileges to ${dbUser}@'%' on ${tenant.db_name}...`);
      try {
        await rootConnection.query(`GRANT ALL PRIVILEGES ON \`${tenant.db_name}\`.* TO '${dbUser}'@'%'`);
        logger.info(`[PROVISION] ✓ Privileges granted to ${dbUser}@'%'`);
      } catch (grantError) {
        // If user doesn't exist, we might need to create it first (but RDS usually has the user)
        if (grantError.original && grantError.original.code === 'ER_CANT_CREATE_USER_WITH_GRANT') {
          logger.warn(`[PROVISION] ⚠️  Cannot GRANT to '${dbUser}'@'%': ${grantError.original.message}`);
          logger.warn(`[PROVISION] This is normal for RDS if the user already has privileges or if GRANT is restricted`);
          // Continue - the user might already have privileges
        } else {
          throw grantError;
        }
      }
      
      // Only grant to 'localhost' if NOT RDS (RDS doesn't allow this)
      if (!isRDS) {
        logger.info(`[PROVISION] Granting privileges to ${dbUser}@'localhost' on ${tenant.db_name}...`);
        try {
          await rootConnection.query(`GRANT ALL PRIVILEGES ON \`${tenant.db_name}\`.* TO '${dbUser}'@'localhost'`);
          logger.info(`[PROVISION] ✓ Privileges granted to ${dbUser}@'localhost'`);
        } catch (grantError) {
          if (grantError.original && grantError.original.code === 'ER_CANT_CREATE_USER_WITH_GRANT') {
            logger.warn(`[PROVISION] ⚠️  Cannot GRANT to '${dbUser}'@'localhost': ${grantError.original.message}`);
            logger.warn(`[PROVISION] This is normal if the user already has privileges`);
            // Continue - the user might already have privileges
          } else {
            throw grantError;
          }
        }
      } else {
        logger.info(`[PROVISION] Skipping 'localhost' GRANT (RDS detected: ${dbHost})`);
        logger.info(`[PROVISION] RDS only requires '%' wildcard for remote connections`);
      }
      
      logger.info(`[PROVISION] Flushing privileges...`);
      try {
        await rootConnection.query('FLUSH PRIVILEGES');
        logger.info(`[PROVISION] ✓ Privileges flushed`);
      } catch (flushError) {
        // FLUSH PRIVILEGES might not be needed or allowed on RDS
        logger.warn(`[PROVISION] ⚠️  Could not FLUSH PRIVILEGES: ${flushError.message}`);
        logger.warn(`[PROVISION] This is normal for RDS - privileges are applied immediately`);
      }
      
      // Verify privileges were granted
      logger.info(`[PROVISION] Verifying privileges...`);
      try {
        const [grants] = await rootConnection.query(
          `SELECT * FROM mysql.db WHERE User = '${dbUser}' AND Db = '${tenant.db_name.replace(/_/g, '\\_')}'`
        );
        logger.info(`[PROVISION] Found ${grants.length} privilege grant(s) for ${dbUser} on ${tenant.db_name}`);
        if (grants.length === 0) {
          logger.error(`[PROVISION] ⚠️  WARNING: No privileges found in mysql.db table!`);
        } else {
          grants.forEach(grant => {
            logger.info(`[PROVISION] Grant: User=${grant.User}, Host=${grant.Host}, Db=${grant.Db}`);
          });
        }
      } catch (verifyError) {
        logger.warn(`[PROVISION] Could not verify privileges: ${verifyError.message}`);
      }
      
      // Test connection with informative_fintranzact before closing root connection
      logger.info(`[PROVISION] Testing connection with ${dbUser}...`);
      try {
        const testConnection = new Sequelize(tenant.db_name, dbUser, dbPassword, {
          host: tenant.db_host || process.env.DB_HOST || 'localhost',
          port: tenant.db_port || parseInt(process.env.DB_PORT) || 3306,
          dialect: 'mysql',
          logging: false,
        });
        await testConnection.authenticate();
        logger.info(`[PROVISION] ✓ Connection test successful with ${dbUser}`);
        await testConnection.close();
      } catch (testError) {
        logger.error(`[PROVISION] ✗ Connection test FAILED with ${dbUser}: ${testError.message}`);
        logger.error(`[PROVISION] Error code: ${testError.code || 'N/A'}`);
        logger.error(`[PROVISION] Error errno: ${testError.errno || 'N/A'}`);
        throw new Error(`Connection test failed: ${testError.message}. User ${dbUser} cannot access database ${tenant.db_name}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      await rootConnection.close();
      logger.info(`[PROVISION] Connection closed`);

      // Initialize schema using informative_fintranzact
      await this.initializeTenantSchema(tenant, plainPassword);
      
      await tenant.update({
        db_provisioned: true,
        db_provisioned_at: new Date(),
      });

      logger.info(`[PROVISION] Database ${tenant.db_name} provisioned successfully. Privileges granted to ${dbUser}`);
    } catch (error) {
      logger.error(`[PROVISION] ==========================================`);
      logger.error(`[PROVISION] PROVISIONING FAILED`);
      logger.error(`[PROVISION] ==========================================`);
      logger.error(`[PROVISION] Error message: ${error.message}`);
      logger.error(`[PROVISION] Error code: ${error.code || 'N/A'}`);
      logger.error(`[PROVISION] Error errno: ${error.errno || 'N/A'}`);
      logger.error(`[PROVISION] Error SQL: ${error.sql || 'N/A'}`);
      logger.error(`[PROVISION] Error SQL State: ${error.sqlState || 'N/A'}`);
      
      if (error.original) {
        logger.error(`[PROVISION] Original error message: ${error.original.message || 'N/A'}`);
        logger.error(`[PROVISION] Original error code: ${error.original.code || 'N/A'}`);
        logger.error(`[PROVISION] Original error errno: ${error.original.errno || 'N/A'}`);
        logger.error(`[PROVISION] Original error SQL: ${error.original.sql || 'N/A'}`);
        logger.error(`[PROVISION] Original error SQL State: ${error.original.sqlState || 'N/A'}`);
      }
      
      logger.error(`[PROVISION] Database: ${tenant.db_name}`);
      logger.error(`[PROVISION] Root user used: ${rootUser}`);
      logger.error(`[PROVISION] Tenant user: ${dbUser}`);
      logger.error(`[PROVISION] Host: ${tenant.db_host || process.env.DB_HOST || 'localhost'}`);
      
      // Provide helpful error message based on error type
      if (error.original && error.original.code === 'ER_ACCESS_DENIED_ERROR') {
        logger.error(`[PROVISION] ⚠️  AUTHENTICATION FAILED`);
        logger.error(`[PROVISION] The user '${rootUser}' cannot authenticate.`);
        logger.error(`[PROVISION] Please check:`);
        logger.error(`[PROVISION] 1. DB_ROOT_USER and DB_ROOT_PASSWORD are set correctly`);
        logger.error(`[PROVISION] 2. The root user exists and password is correct`);
        logger.error(`[PROVISION] 3. Or grant CREATE DATABASE privilege to '${dbUser}' user`);
      } else if (error.original && error.original.code === 'ER_DBACCESS_DENIED_ERROR') {
        logger.error(`[PROVISION] ⚠️  CREATE DATABASE PRIVILEGE MISSING`);
        logger.error(`[PROVISION] The user '${rootUser}' cannot create databases.`);
        logger.error(`[PROVISION] Please grant CREATE DATABASE privilege to '${rootUser}'`);
        logger.error(`[PROVISION] Or set DB_ROOT_USER to a user with CREATE DATABASE privilege`);
      }
      
      logger.error(`[PROVISION] ==========================================`);
      
      // Cleanup
      try {
        await rootConnection.query(`DROP DATABASE IF EXISTS \`${tenant.db_name}\``);
        logger.info(`[PROVISION] Cleaned up database: ${tenant.db_name}`);
      } catch (cleanupError) {
        logger.error(`[PROVISION] Cleanup failed: ${cleanupError.message}`);
      }
      
      try {
        await rootConnection.close();
      } catch (closeError) {
        logger.error(`[PROVISION] Failed to close connection: ${closeError.message}`);
      }
      
      // Create enhanced error with all details
      const enhancedError = new Error(error.message);
      enhancedError.code = error.code;
      enhancedError.errno = error.errno;
      enhancedError.sql = error.sql;
      enhancedError.sqlState = error.sqlState;
      enhancedError.original = error.original;
      enhancedError.stack = error.stack;
      throw enhancedError;
    }
  }

  /**
   * Initialize tenant database schema
   * @param {Object} tenant - Tenant master record
   * @param {string} plainPassword - Plain text database password
   */
  async initializeTenantSchema(tenant, plainPassword) {
    const dbPassword = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : null;
    const dbUser = process.env.DB_USER || 'informative_fintranzact';
    
    if (dbPassword === null) {
      throw new Error('DB_PASSWORD environment variable must be set (can be empty string for no password)');
    }

    try {
      const tenantConnection = await tenantConnectionManager.getConnection({
        id: tenant.id,
        db_name: tenant.db_name,
        db_host: tenant.db_host,
        db_port: tenant.db_port,
        db_user: dbUser,
        db_password: dbPassword,
      });

      await this.runTenantMigrations(tenantConnection);
      await this.seedDefaultData(tenantConnection, tenant);
      logger.info(`[SCHEMA] Schema initialized for ${tenant.db_name}`);
    } catch (error) {
      logger.error(`[SCHEMA] ==========================================`);
      logger.error(`[SCHEMA] SCHEMA INITIALIZATION FAILED`);
      logger.error(`[SCHEMA] ==========================================`);
      logger.error(`[SCHEMA] Error message: ${error.message}`);
      logger.error(`[SCHEMA] Error code: ${error.code || 'N/A'}`);
      logger.error(`[SCHEMA] Error errno: ${error.errno || 'N/A'}`);
      logger.error(`[SCHEMA] Error SQL: ${error.sql || 'N/A'}`);
      logger.error(`[SCHEMA] Error SQL State: ${error.sqlState || 'N/A'}`);
      logger.error(`[SCHEMA] Database: ${tenant.db_name}`);
      logger.error(`[SCHEMA] User: ${dbUser}`);
      logger.error(`[SCHEMA] ==========================================`);
      
      // Create enhanced error with all details
      const enhancedError = new Error(error.message);
      enhancedError.code = error.code;
      enhancedError.errno = error.errno;
      enhancedError.sql = error.sql;
      enhancedError.sqlState = error.sqlState;
      enhancedError.original = error.original;
      enhancedError.stack = error.stack;
      throw enhancedError;
    }
  }

  /**
   * Run migrations on tenant database
   * @param {Sequelize} connection - Tenant database connection
   */
  async runTenantMigrations(connection) {
    const path = require('path');
    const fs = require('fs');
    
    try {
      const migrationsPath = path.join(__dirname, '../migrations');
      const queryInterface = connection.getQueryInterface();
      const { Sequelize } = require('sequelize');
      
      // Get all migration files that start with a number (e.g., 001-, 002-, etc.)
      // Exclude admin-master migrations (those are for master DB only)
      const migrationFiles = fs.readdirSync(migrationsPath)
        .filter(file => file.match(/^\d{3}-.*\.js$/) && !file.includes('admin-master'))
        .sort(); // Sort to ensure migrations run in order
      
      logger.info(`[MIGRATIONS] Found ${migrationFiles.length} tenant migration files`);
      
      if (migrationFiles.length === 0) {
        logger.warn('⚠️  No tenant migration files found, falling back to sync');
        const tenantModels = require('./tenantModels')(connection);
        await connection.sync({ force: false });
        return;
      }
      
      // Run each migration file in order
      for (const file of migrationFiles) {
        const migrationFile = path.join(migrationsPath, file);
        logger.info(`[MIGRATIONS] Running migration: ${file}`);
        
        try {
          // Clear require cache to ensure fresh load
          delete require.cache[require.resolve(migrationFile)];
          
          const migration = require(migrationFile);
          if (migration.up && typeof migration.up === 'function') {
            await migration.up(queryInterface, Sequelize);
            logger.info(`[MIGRATIONS] ✅ Migration completed: ${file}`);
          } else {
            logger.warn(`[MIGRATIONS] ⚠️  Migration ${file} has no 'up' function`);
          }
        } catch (error) {
          if (error.message && (error.message.includes('already exists') || 
                                error.message.includes('Duplicate') ||
                                error.message.includes('Table') && error.message.includes('already exists'))) {
            logger.info(`[MIGRATIONS] ℹ️  Migration ${file} already applied (tables exist)`);
          } else {
            logger.error(`[MIGRATIONS] ❌ Migration ${file} failed: ${error.message}`);
            // Don't throw - continue with next migration
            // This allows partial migrations to succeed
          }
        }
      }
      
      logger.info('[MIGRATIONS] ✅ All tenant migrations completed successfully');
      
    } catch (error) {
      logger.error('[MIGRATIONS] Error running tenant migrations:', error.message);
      logger.warn('[MIGRATIONS] Falling back to sync...');
      // Fallback to sync
      try {
        const tenantModels = require('./tenantModels')(connection);
        await connection.sync({ force: false });
        logger.info('[MIGRATIONS] ✅ Sync completed successfully');
      } catch (syncError) {
        logger.error('[MIGRATIONS] ❌ Sync also failed:', syncError.message);
        throw syncError;
      }
    }
  }

  /**
   * Seed default data for new tenant/company
   * @param {Sequelize} connection - Tenant database connection
   * @param {Object} tenantOrCompany - Tenant master record or Company record
   */
  async seedDefaultData(connection, tenantOrCompany) {
    // Load tenant models
    const models = require('./tenantModels')(connection);
    const masterModels = require('../models/masterModels');

    // NOTE: Account groups and voucher types are in Master DB (shared)
    // No need to seed them per tenant

    // Run tenant seeder (consolidated)
    try {
      const path = require('path');
      const fs = require('fs');
      const seedersPath = path.join(__dirname, '../seeders');
      const seederFile = path.join(seedersPath, '001-tenant-seeder.js');
      
      if (fs.existsSync(seederFile)) {
        const seeder = require(seederFile);
      const queryInterface = connection.getQueryInterface();
        const { Sequelize } = require('sequelize');
        
        if (seeder.up && typeof seeder.up === 'function') {
          await seeder.up(queryInterface, Sequelize);
          logger.info('Tenant seeder completed');
        }
      }
    } catch (error) {
      // If seeder fails, that's okay - continue with default data creation
      logger.debug('Tenant seeder not available or failed (non-critical):', error.message);
    }

    // Get email and company name (works for both tenant and company objects)
    const email = tenantOrCompany.email;
    const companyName = tenantOrCompany.company_name || tenantOrCompany.name;
    const gstin = tenantOrCompany.gstin;
    const state = tenantOrCompany.state;
    const address = tenantOrCompany.address || tenantOrCompany.registered_address;

    // Get tenant_id from tenantOrCompany (could be tenant.id or company.tenant_id)
    const tenantId = tenantOrCompany.id || tenantOrCompany.tenant_id;

    // Create default admin user for the tenant/company
    const bcrypt = require('bcryptjs');
    if (email) {
      // Check if user already exists
      const existingUser = await models.User.findOne({ where: { email } });
      if (!existingUser) {
        await models.User.create({
          first_name: 'Admin',
          last_name: 'User',
          email: email,
          role: 'tenant_admin',
          is_active: true,
          password: bcrypt.hashSync('ChangeMe@123', 10),
          tenant_id: tenantId,
        });
        logger.info('Default admin user created');
      } else {
        logger.info('Default admin user already exists, skipping');
      }
    }

    // Create default GSTIN if provided
    if (gstin) {
      try {
        // Check if GSTIN table exists
        const [tables] = await connection.query("SHOW TABLES LIKE 'gstins'");
        if (tables.length === 0) {
          logger.warn('[PROVISION] GSTIN table does not exist yet, skipping GSTIN creation');
        } else {
          const existingGSTIN = await models.GSTIN.findOne({ where: { gstin } });
          if (!existingGSTIN) {
            // Extract state code from GSTIN (first 2 digits)
            // GSTIN format: [2-digit state code][10-digit PAN][1-digit entity number][1-digit Z][1-digit check digit]
            const stateCode = gstin && gstin.length >= 2 ? gstin.substring(0, 2) : null;
            
            await models.GSTIN.create({
              tenant_id: tenantId,
              gstin: gstin,
              legal_name: companyName,
              trade_name: companyName,
              state: state,
              state_code: stateCode || '00', // Default to '00' if can't extract from GSTIN
              address: address,
              gstin_status: 'active',
              is_primary: true,
            });
            logger.info('Default GSTIN created');
          } else {
            logger.info('Default GSTIN already exists, skipping');
          }
        }
      } catch (gstinError) {
        logger.warn('[PROVISION] Could not create GSTIN:', gstinError.message);
        // Continue - GSTIN creation is optional
      }
    }

    // Create default ledgers (if not already created by seeder)
    const existingLedgers = await models.Ledger.count();
    if (existingLedgers === 0) {
      await this.createDefaultLedgers(models, masterModels, tenantId);
    } else {
      logger.info(`[PROVISION] Ledgers already exist (${existingLedgers} found), skipping default ledger creation`);
    }

    // Create default numbering series for invoice types (if not already created by seeder)
    const existingSeries = await models.NumberingSeries ? await models.NumberingSeries.count() : 0;
    if (existingSeries === 0) {
      await this.createDefaultNumberingSeries(models, tenantId);
    } else {
      logger.info(`[PROVISION] Numbering series already exist (${existingSeries} found), skipping default series creation`);
    }

    logger.info('Default data seeded (admin user, GSTIN, default ledgers, and numbering series)');
  }

  /**
   * Create default ledgers for a new company
   * @param {Object} tenantModels - Tenant database models
   * @param {Object} masterModels - Master database models
   * @param {string} tenantId - Tenant ID for the ledgers
   */
  async createDefaultLedgers(tenantModels, masterModels, tenantId) {
    try {
      logger.info('[LEDGER] Starting default ledger creation...');
      
      // Verify models are available
      if (!tenantModels || !tenantModels.Ledger) {
        throw new Error('Tenant Ledger model is not available');
      }
      if (!masterModels || !masterModels.AccountGroup) {
        throw new Error('Master AccountGroup model is not available');
      }
      
      // Get account groups from master DB
      logger.info('[LEDGER] Fetching account groups from master database...');
      const accountGroups = await masterModels.AccountGroup.findAll({
        where: { is_system: true },
      });
      
      logger.info(`[LEDGER] Found ${accountGroups.length} system account groups`);

      // Create a map of group codes to IDs
      const groupMap = new Map();
      accountGroups.forEach((group) => {
        groupMap.set(group.group_code, group.id);
        logger.debug(`[LEDGER] Account group: ${group.group_code} -> ${group.id}`);
      });

      // Default ledgers to create
      const defaultLedgers = [
        // GST Input Tax Credit (Asset - Debit balance)
        {
          ledger_name: 'CGST Input',
          ledger_code: 'CGST-INPUT-001',
          account_group_code: 'GST_INPUT', // GST Input Tax Credit
          balance_type: 'debit',
          opening_balance: 0,
        },
        {
          ledger_name: 'SGST Input',
          ledger_code: 'SGST-INPUT-001',
          account_group_code: 'GST_INPUT', // GST Input Tax Credit
          balance_type: 'debit',
          opening_balance: 0,
        },
        {
          ledger_name: 'IGST Input',
          ledger_code: 'IGST-INPUT-001',
          account_group_code: 'GST_INPUT', // GST Input Tax Credit
          balance_type: 'debit',
          opening_balance: 0,
        },
        // GST Output Tax Payable (Liability - Credit balance)
        {
          ledger_name: 'CGST Output',
          ledger_code: 'CGST-OUTPUT-001',
          account_group_code: 'DT', // Duties & Taxes
          balance_type: 'credit',
          opening_balance: 0,
        },
        {
          ledger_name: 'SGST Output',
          ledger_code: 'SGST-OUTPUT-001',
          account_group_code: 'DT', // Duties & Taxes
          balance_type: 'credit',
          opening_balance: 0,
        },
        {
          ledger_name: 'IGST Output',
          ledger_code: 'IGST-OUTPUT-001',
          account_group_code: 'DT', // Duties & Taxes
          balance_type: 'credit',
          opening_balance: 0,
        },
        // Other default ledgers
        {
          ledger_name: 'Cash on Hand',
          ledger_code: 'CASH-001',
          account_group_code: 'CASH', // Cash-in-Hand
          balance_type: 'debit',
          opening_balance: 0,
        },
        {
          ledger_name: 'Stock in Hand',
          ledger_code: 'INV-001',
          account_group_code: 'INV', // Stock-in-Hand
          balance_type: 'debit',
          opening_balance: 0,
        },
        {
          ledger_name: 'Sales',
          ledger_code: 'SAL-001',
          account_group_code: 'SAL', // Sales Accounts
          balance_type: 'credit',
          opening_balance: 0,
        },
        // Note: Purchase account not created in perpetual inventory system
        // Purchases go directly to Stock in Hand
      ];

      // Create each default ledger
      let createdCount = 0;
      let skippedCount = 0;
      
      for (const ledgerData of defaultLedgers) {
        try {
          const groupId = groupMap.get(ledgerData.account_group_code);
          if (!groupId) {
            logger.warn(`[LEDGER] Account group '${ledgerData.account_group_code}' not found, skipping ledger '${ledgerData.ledger_name}'`);
            skippedCount++;
            continue;
          }

          // Check if ledger already exists (check by both code and name to catch duplicates)
          const { Op } = require('sequelize');
          const existing = await tenantModels.Ledger.findOne({
            where: {
              [Op.or]: [
                { ledger_code: ledgerData.ledger_code },
                { ledger_name: ledgerData.ledger_name }
              ]
            },
          });

          if (!existing) {
            await tenantModels.Ledger.create({
              ledger_name: ledgerData.ledger_name,
              ledger_code: ledgerData.ledger_code,
              account_group_id: groupId,
              opening_balance: ledgerData.opening_balance,
              opening_balance_type: ledgerData.balance_type === 'debit' ? 'Dr' : 'Cr',
              balance_type: ledgerData.balance_type,
              is_active: true,
              tenant_id: tenantId,
            });
            logger.info(`[LEDGER] ✓ Created default ledger: ${ledgerData.ledger_name} (${ledgerData.ledger_code})`);
            createdCount++;
          } else {
            logger.info(`[LEDGER] ℹ️  Ledger '${ledgerData.ledger_name}' already exists, skipping`);
            skippedCount++;
          }
        } catch (ledgerError) {
          logger.error(`[LEDGER] ✗ Failed to create ledger '${ledgerData.ledger_name}':`, ledgerError);
          logger.error(`[LEDGER] Error details:`, {
            message: ledgerError.message,
            stack: ledgerError.stack,
            ledgerData: ledgerData,
          });
          // Continue with next ledger instead of failing completely
        }
      }

      logger.info(`[LEDGER] Default ledger creation completed: ${createdCount} created, ${skippedCount} skipped`);
      
      if (createdCount === 0 && skippedCount === 0) {
        logger.warn(`[LEDGER] ⚠️  No ledgers were created or skipped. This might indicate an issue.`);
      }
    } catch (error) {
      logger.error('[LEDGER] ✗ Critical error creating default ledgers:', error);
      logger.error('[LEDGER] Error details:', {
        message: error.message,
        stack: error.stack,
        tenantModelsAvailable: !!tenantModels,
        masterModelsAvailable: !!masterModels,
      });
      // Don't throw - allow tenant creation to continue even if default ledgers fail
      // But log it prominently so it's noticed
      logger.error('[LEDGER] ⚠️  WARNING: Default ledgers were not created. Tenant provisioning will continue, but ledgers need to be created manually.');
    }
  }

  /**
   * Delete a tenant and their database
   * @param {string} tenantId - Tenant ID
   */
  async deleteTenant(tenantId) {
    const tenant = await TenantMaster.findByPk(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const rootConnection = new Sequelize('', process.env.DB_USER, process.env.DB_PASSWORD, {
      host: tenant.db_host,
      port: tenant.db_port,
      dialect: 'mysql',
      logging: false,
    });

    try {
      // Close tenant connection if cached
      await tenantConnectionManager.closeConnection(tenantId);

      // Drop database
      await rootConnection.query(`DROP DATABASE IF EXISTS \`${tenant.db_name}\``);
      
      // Drop user if using separate credentials
      if (process.env.USE_SEPARATE_DB_USERS === 'true') {
        await rootConnection.query(`DROP USER IF EXISTS '${tenant.db_user}'@'%'`);
      }

      // Delete from master database
      await tenant.destroy();

      logger.info(`Tenant deleted successfully: ${tenantId}`);
    } catch (error) {
      logger.error(`Failed to delete tenant ${tenantId}:`, error);
      throw error;
    } finally {
      await rootConnection.close();
    }
  }

  /**
   * Suspend a tenant
   * @param {string} tenantId - Tenant ID
   * @param {string} reason - Suspension reason
   */
  async suspendTenant(tenantId, reason) {
    const tenant = await TenantMaster.findByPk(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    await tenant.update({
      is_suspended: true,
      suspended_reason: reason,
    });

    // Close connection
    await tenantConnectionManager.closeConnection(tenantId);

    logger.info(`Tenant suspended: ${tenantId}`);
  }

  /**
   * Reactivate a suspended tenant
   * @param {string} tenantId - Tenant ID
   */
  async reactivateTenant(tenantId) {
    const tenant = await TenantMaster.findByPk(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    await tenant.update({
      is_suspended: false,
      suspended_reason: null,
    });

    logger.info(`Tenant reactivated: ${tenantId}`);
  }

  // Helper methods

  /**
   * Check if a database already exists
   * @param {Sequelize} connection - Database connection
   * @param {string} databaseName - Name of the database to check
   * @returns {Promise<boolean>} - True if database exists
   */
  async checkDatabaseExists(connection, databaseName) {
    try {
      const [results] = await connection.query(
        `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
        { replacements: [databaseName] }
      );
      return results.length > 0;
    } catch (error) {
      logger.warn(`[PROVISION] Could not check if database exists: ${error.message}`);
      return false;
    }
  }

  generateDatabaseName(subdomain) {
    const sanitized = subdomain.toLowerCase().replace(/[^a-z0-9]/g, '_');
    // MySQL database name limit is 64 characters
    // Format: fintranzact_<company_name> (no timestamp, no "informative" prefix)
    const prefix = 'fintranzact_';
    const maxNameLength = 64 - prefix.length;
    const truncatedName = sanitized.substring(0, maxNameLength);
    const dbName = `${prefix}${truncatedName}`;
    return dbName;
  }

  generateDatabaseUser(subdomain) {
    const sanitized = subdomain.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `fv_${sanitized}`.substring(0, 32); // MySQL username limit
  }

  generateSecurePassword(length = 20) {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
  }

  /**
   * Encrypt a tenant DB password.
   *
   * v2 format: "v2:<saltHex>:<ivHex>:<authTagHex>:<cipherHex>"
   *   - AES-256-GCM (authenticated; tampering is detected on decrypt)
   *   - Random per-record salt -> scrypt key derivation
   *   - Random IV per record
   *
   * Old "<ivHex>:<cipherHex>" rows (AES-256-CBC, fixed salt) keep working
   * via decryptPassword(); new writes always use v2.
   */
  encryptPassword(password) {
    const { ENCRYPTION_KEY } = require('../config/env');
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [
      'v2',
      salt.toString('hex'),
      iv.toString('hex'),
      authTag.toString('hex'),
      ciphertext.toString('hex'),
    ].join(':');
  }

  decryptPassword(encryptedPassword) {
    const { ENCRYPTION_KEY } = require('../config/env');
    const parts = encryptedPassword.split(':');
    if (parts[0] === 'v2' && parts.length === 5) {
      const [, saltHex, ivHex, tagHex, cipherHex] = parts;
      const key = crypto.scryptSync(ENCRYPTION_KEY, Buffer.from(saltHex, 'hex'), 32);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      const plain = Buffer.concat([
        decipher.update(Buffer.from(cipherHex, 'hex')),
        decipher.final(),
      ]);
      return plain.toString('utf8');
    }
    // Legacy v1: "<ivHex>:<cipherHex>" — AES-256-CBC with fixed salt 'salt'.
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Create default numbering series for invoice types
   * @param {Object} tenantModels - Tenant database models
   * @param {string} tenantId - Tenant ID
   */
  async createDefaultNumberingSeries(tenantModels, tenantId) {
    try {
      logger.info('[NUMBERING] Starting default numbering series creation...');
      
      if (!tenantModels || !tenantModels.NumberingSeries) {
        throw new Error('Tenant NumberingSeries model is not available');
      }

      // Default numbering series configurations
      const defaultSeries = [
        {
          voucher_type: 'sales_invoice',
          series_name: 'Sales Invoice Series',
          prefix: 'SI',
          format: 'PREFIXSEPARATORYEARSEPARATORSEQUENCE',
          separator: '-',
          sequence_length: 3,
          start_number: 1,
          end_number: null,
          reset_frequency: 'yearly',
          is_default: true,
          branch_id: null,
        },
        {
          voucher_type: 'tax_invoice',
          series_name: 'Tax Invoice Series',
          prefix: 'TI',
          format: 'PREFIXSEPARATORYEARSEPARATORSEQUENCE',
          separator: '-',
          sequence_length: 3,
          start_number: 1,
          end_number: null,
          reset_frequency: 'yearly',
          is_default: true,
          branch_id: null,
        },
        {
          voucher_type: 'bill_of_supply',
          series_name: 'Bill of Supply Series',
          prefix: 'BS',
          format: 'PREFIXSEPARATORYEARSEPARATORSEQUENCE',
          separator: '-',
          sequence_length: 3,
          start_number: 1,
          end_number: null,
          reset_frequency: 'yearly',
          is_default: true,
          branch_id: null,
        },
        {
          voucher_type: 'retail_invoice',
          series_name: 'Retail Invoice Series',
          prefix: 'RI',
          format: 'PREFIXSEPARATORYEARSEPARATORSEQUENCE',
          separator: '-',
          sequence_length: 3,
          start_number: 1,
          end_number: null,
          reset_frequency: 'yearly',
          is_default: true,
          branch_id: null,
        },
        {
          voucher_type: 'export_invoice',
          series_name: 'Export Invoice Series',
          prefix: 'EI',
          format: 'PREFIXSEPARATORYEARSEPARATORSEQUENCE',
          separator: '-',
          sequence_length: 3,
          start_number: 1,
          end_number: null,
          reset_frequency: 'yearly',
          is_default: true,
          branch_id: null,
        },
        {
          voucher_type: 'delivery_challan',
          series_name: 'Delivery Challan Series',
          prefix: 'DC',
          format: 'PREFIXSEPARATORYEARSEPARATORSEQUENCE',
          separator: '-',
          sequence_length: 3,
          start_number: 1,
          end_number: null,
          reset_frequency: 'yearly',
          is_default: true,
          branch_id: null,
        },
        {
          voucher_type: 'proforma_invoice',
          series_name: 'Proforma Invoice Series',
          prefix: 'PI',
          format: 'PREFIXSEPARATORYEARSEPARATORSEQUENCE',
          separator: '-',
          sequence_length: 3,
          start_number: 1,
          end_number: null,
          reset_frequency: 'yearly',
          is_default: true,
          branch_id: null,
        },
      ];

      let createdCount = 0;
      let skippedCount = 0;

      for (const seriesConfig of defaultSeries) {
        try {
          // Check if series already exists (check by voucher_type and prefix to catch duplicates)
          const existing = await tenantModels.NumberingSeries.findOne({
            where: {
              tenant_id: tenantId,
              [tenantModels.Sequelize.Op.or]: [
                { voucher_type: seriesConfig.voucher_type, is_default: true },
                { voucher_type: seriesConfig.voucher_type, prefix: seriesConfig.prefix }
              ]
            },
          });

          if (!existing) {
            await tenantModels.NumberingSeries.create({
              ...seriesConfig,
              tenant_id: tenantId,
              current_number: seriesConfig.start_number,
            });
            logger.info(`[NUMBERING] ✓ Created ${seriesConfig.series_name} (${seriesConfig.prefix})`);
            createdCount++;
          } else {
            logger.info(`[NUMBERING] ℹ️  ${seriesConfig.series_name} already exists, skipping`);
            skippedCount++;
          }
        } catch (seriesError) {
          logger.error(`[NUMBERING] ✗ Failed to create ${seriesConfig.series_name}:`, seriesError);
          // Continue with next series instead of failing completely
        }
      }

      logger.info(`[NUMBERING] Default numbering series creation completed: ${createdCount} created, ${skippedCount} skipped`);
    } catch (error) {
      logger.error('[NUMBERING] ✗ Critical error creating default numbering series:', error);
      logger.error('[NUMBERING] Error details:', {
        message: error.message,
        stack: error.stack,
      });
      // Don't throw - allow tenant creation to continue even if numbering series fail
      logger.error('[NUMBERING] ⚠️  WARNING: Default numbering series were not created. Tenant provisioning will continue, but series need to be created manually.');
    }
  }

  calculateTrialEnd(days = 30) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  // Removed: getDefaultAccountGroups() - Now in Master DB
}

module.exports = new TenantProvisioningService();
