const TenantMaster = require('../models/TenantMaster');
const tenantConnectionManager = require('../config/tenantConnectionManager');
const logger = require('../utils/logger');
const masterModels = require('../models/masterModels');

/**
 * Resolve tenant from subdomain or tenant_id
 * Attaches tenant database connection to request
 */
const resolveTenant = async (req, res, next) => {
  try {
    let tenant = null;

    // Method 1: Get tenant from subdomain. We only trust the Host header if
    // it ends with our configured main domain — otherwise an attacker could
    // craft a Host header to swap tenants. Unknown hosts simply fall through
    // to JWT-based resolution below.
    const host = (req.get('host') || '').split(':')[0];
    const mainDomain =
      process.env.MAIN_DOMAIN || process.env.NEXT_PUBLIC_MAIN_DOMAIN || '';
    const hostIsTrusted =
      host && mainDomain && (host === mainDomain || host.endsWith('.' + mainDomain));
    if (hostIsTrusted) {
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'api' && host !== mainDomain) {
        tenant = await TenantMaster.findOne({
          where: { subdomain, is_active: true },
        });
      }
    }

    // Method 2: Get tenant from JWT (set by auth middleware)
    if (!tenant && req.tenant_id) {
      tenant = await TenantMaster.findByPk(req.tenant_id);
    }

    // Method 3: tenant id from query/body — ONLY honoured for platform
    // admins. Regular users must come in via subdomain or via their JWT;
    // accepting tenant_id from the request body for them would let any
    // authenticated user point at any tenant they like.
    if (!tenant) {
      const isPlatformAdmin = req.role === 'super_admin' || req.role === 'admin';
      const tenantId = req.query.tenant_id || (req.body && req.body.tenant_id);
      if (tenantId && isPlatformAdmin) {
        tenant = await TenantMaster.findByPk(tenantId);
      }
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
    }

    // Check if tenant is suspended
    if (tenant.is_suspended) {
      return res.status(403).json({
        success: false,
        message: 'Tenant account is suspended',
        reason: tenant.suspended_reason,
      });
    }

    // Resolve company context (JWT claim or header)
    let companyId =
      req.company_id ||
      req.headers['x-company-id'] ||
      req.headers['x-companyid'] ||
      (req.query && req.query.company_id) ||
      (req.body && req.body.company_id);

    if (!companyId) {
      const companies = await masterModels.Company.findAll({
        where: { tenant_id: tenant.id, is_active: true },
        attributes: ['id', 'company_name'],
        order: [['createdAt', 'DESC']],
      });

      if (companies.length === 0) {
        return res.status(409).json({
          success: false,
          message: 'No company found. Please create your company first.',
        });
      }
      if (companies.length === 1) {
        companyId = companies[0].id;
        req.company_id = companies[0].id;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Company selection required',
          require_company: true,
          companies,
        });
      }
    } else {
      req.company_id = companyId;
    }

    const company = await masterModels.Company.findOne({
      where: { id: companyId, tenant_id: tenant.id, is_active: true },
    });
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    // Tenant rows carry their own DB host/port. To prevent a corrupted or
    // attacker-influenced row from making the backend connect to an
    // arbitrary MySQL server (and leak the configured backend creds),
    // we validate the requested host against an allowlist.
    const allowedHosts = (process.env.ALLOWED_DB_HOSTS || process.env.DB_HOST || 'localhost')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);

    function ensureHostAllowed(host) {
      if (!host) return;
      if (!allowedHosts.includes(host)) {
        const err = new Error(`Refusing to connect to disallowed DB host: ${host}`);
        err.statusCode = 500;
        throw err;
      }
    }

    let tenantConnection;
    if (company.db_provisioned && company.db_name && company.db_password) {
      const tenantProvisioningService = require('../services/tenantProvisioningService');
      const dbPassword = tenantProvisioningService.decryptPassword(company.db_password);
      const host = company.db_host || process.env.DB_HOST;
      ensureHostAllowed(host);
      tenantConnection = await tenantConnectionManager.getConnection({
        id: company.id,
        db_name: company.db_name,
        db_host: host,
        db_port: company.db_port || parseInt(process.env.DB_PORT) || 3306,
        db_user: process.env.USE_SEPARATE_DB_USERS === 'true' ? company.db_user : process.env.DB_USER,
        db_password: process.env.USE_SEPARATE_DB_USERS === 'true' ? dbPassword : process.env.DB_PASSWORD,
      });
    } else {
      const sharedDbName = tenant.db_name || process.env.DB_NAME || 'finvera_master';
      const host = tenant.db_host || process.env.DB_HOST;
      ensureHostAllowed(host);
      tenantConnection = await tenantConnectionManager.getConnection({
        id: tenant.id,
        db_name: sharedDbName,
        db_host: host,
        db_port: tenant.db_port || parseInt(process.env.DB_PORT) || 3306,
        db_user: tenant.db_user || process.env.DB_USER,
        db_password: tenant.db_password
          ? (() => {
              try {
                const tenantProvisioningService = require('../services/tenantProvisioningService');
                return tenantProvisioningService.decryptPassword(tenant.db_password);
              } catch (_e) {
                return process.env.DB_PASSWORD;
              }
            })()
          : process.env.DB_PASSWORD,
      });
    }

    // Load tenant models (transactional data)
    const tenantModels = require('../services/tenantModels')(tenantConnection);

    // Attach to request
    req.tenant = tenant;
    req.tenant_id = tenant.id;
    req.company = company;
    req.company_id = company.id;
    req.tenantDb = tenantConnection;
    req.tenantModels = tenantModels; // Transactional data (ledgers, vouchers, etc.)
    req.masterModels = masterModels; // Shared structure (account groups, voucher types, etc.)

    next();
  } catch (error) {
    logger.error('Tenant resolution error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resolve tenant',
      error: error.message,
    });
  }
};

/**
 * Set tenant context from JWT or request params
 * Lightweight version - just sets tenant_id without database connection
 */
const setTenantContext = (req, res, next) => {
  // tenant_id should already be set by auth middleware from JWT
  // But we can also get it from query params or body for admin operations
  if (!req.tenant_id) {
    req.tenant_id = req.query.tenant_id || req.body.tenant_id;
  }
  next();
};

/**
 * Require tenant context - fails if tenant_id is not available
 */
const requireTenant = (req, res, next) => {
  if (!req.tenant_id) {
    // Check if user is a platform admin (super_admin) without tenant
    const userRole = req.role;
    const userId = req.user_id || req.user?.id || req.user?.user_id || req.user?.sub;
    
    if (userRole === 'super_admin' || userRole === 'admin') {
      // Platform admins might not have tenant_id - allow but log
      logger.warn(`Platform admin (${userId}, role: ${userRole}) accessing tenant-required route without tenant_id`);
      // Still require tenant for accounting routes - they need to select a tenant/company
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required. Please select a company or tenant.',
        require_tenant_selection: true,
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'Tenant ID is required',
    });
  }
  next();
};

// Local DB-password decryption is delegated to tenantProvisioningService
// (which knows about both legacy and v2 ciphertext formats). No insecure
// fallback for the encryption key here.

module.exports = {
  resolveTenant,
  setTenantContext,
  requireTenant,
};
