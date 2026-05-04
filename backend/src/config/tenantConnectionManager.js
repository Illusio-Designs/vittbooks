const sequelize = require('./database');
const logger = require('../utils/logger');

/**
 * Tenant Connection Manager — single shared database mode.
 *
 * Historically this module opened a separate MySQL connection per tenant
 * (and per company) and cached them. We have switched to a single shared
 * database for all tenants, so this is now a thin compatibility shim.
 * Every "tenant connection" returns the main app Sequelize instance, and
 * data isolation is enforced at the row level via `tenant_id` /
 * `company_id` columns on every transactional model.
 *
 * The class keeps its old method names (`getConnection`, `closeConnection`,
 * `closeAllConnections`, `getStats`) so existing callers keep working.
 */
class TenantConnectionManager {
  constructor() {
    this.warnedDifferentHost = new Set();
  }

  async getConnection(tenantConfig = {}) {
    const { db_host, db_name } = tenantConfig;
    if (db_host && process.env.DB_HOST && db_host !== process.env.DB_HOST) {
      const key = `${db_host}|${db_name}`;
      if (!this.warnedDifferentHost.has(key)) {
        logger.warn(
          `[TENANT-DB] Ignoring tenant-specific db_host=${db_host} (db_name=${db_name}). ` +
            'All tenants now share the main database.'
        );
        this.warnedDifferentHost.add(key);
      }
    }
    return sequelize;
  }

  async closeConnection(_tenantId) {
    // No-op: the shared main connection is owned by the app, not by any
    // single tenant, and is closed during graceful shutdown.
  }

  async closeAllConnections() {
    // No-op for the same reason as above.
  }

  getStats() {
    return {
      mode: 'shared',
      activeConnections: 1,
      maxCachedConnections: 1,
      cachedTenants: ['__shared__'],
    };
  }
}

module.exports = new TenantConnectionManager();
