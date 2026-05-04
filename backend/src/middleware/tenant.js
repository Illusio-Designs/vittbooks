const TenantMaster = require('../models/TenantMaster');
const sequelize = require('../config/database');
const logger = require('../utils/logger');
const masterModels = require('../models/masterModels');
const tenantModelsFactory = require('../services/tenantModels');

// Build the tenant transactional models exactly once, on the shared
// main-DB connection. Every request reuses the same Sequelize models;
// data isolation is enforced at the row level via tenant_id / company_id.
const sharedTenantModels = tenantModelsFactory(sequelize);

/**
 * Resolve the active tenant for the request.
 *
 * Single-database mode: every tenant lives in the shared main DB. We
 * still look up the tenant record (to enforce active/suspended state
 * and pick a current company) — but we no longer open a separate DB
 * connection per tenant. `req.tenantDb` and `req.tenantModels` always
 * point at the shared connection.
 */
const resolveTenant = async (req, res, next) => {
  try {
    let tenant = null;

    // Method 1: subdomain. We only trust the Host header when it matches
    // the configured main domain — otherwise an attacker could spoof it.
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

    // Method 2: tenant_id from JWT (set by auth middleware).
    if (!tenant && req.tenant_id) {
      tenant = await TenantMaster.findByPk(req.tenant_id);
    }

    // Method 3: tenant_id from query/body — only for platform admins.
    // Regular users cannot use this to point at someone else's tenant.
    if (!tenant) {
      const isPlatformAdmin = req.role === 'super_admin' || req.role === 'admin';
      const tenantId = req.query.tenant_id || (req.body && req.body.tenant_id);
      if (tenantId && isPlatformAdmin) {
        tenant = await TenantMaster.findByPk(tenantId);
      }
    }

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    if (tenant.is_suspended) {
      return res.status(403).json({
        success: false,
        message: 'Tenant account is suspended',
        reason: tenant.suspended_reason,
      });
    }

    // Resolve company context (JWT claim or header / query / body).
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

    // Single shared connection; row-level tenant_id / company_id enforces isolation.
    req.tenant = tenant;
    req.tenant_id = tenant.id;
    req.company = company;
    req.company_id = company.id;
    req.tenantDb = sequelize;
    req.tenantModels = sharedTenantModels;
    req.masterModels = masterModels;

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
 * Lightweight version: read tenant_id from JWT/query/body without
 * opening any tenant context. Used by routes that only need to know
 * "which tenant are we acting on" (e.g. reports filtering).
 */
const setTenantContext = (req, _res, next) => {
  if (!req.tenant_id) {
    req.tenant_id = req.query.tenant_id || (req.body && req.body.tenant_id);
  }
  next();
};

/**
 * Hard requirement: a tenant_id must already be set on the request.
 */
const requireTenant = (req, res, next) => {
  if (!req.tenant_id) {
    const userRole = req.role;
    const userId = req.user_id || req.user?.id || req.user?.user_id || req.user?.sub;

    if (userRole === 'super_admin' || userRole === 'admin') {
      logger.warn(
        `Platform admin (${userId}, role: ${userRole}) accessing tenant-required route without tenant_id`
      );
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required. Please select a company or tenant.',
        require_tenant_selection: true,
      });
    }

    return res.status(400).json({ success: false, message: 'Tenant ID is required' });
  }
  next();
};

module.exports = {
  resolveTenant,
  setTenantContext,
  requireTenant,
};
