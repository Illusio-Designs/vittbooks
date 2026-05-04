
const logger = require('../utils/logger');
const TenantMaster = require('../models/TenantMaster');
const masterModels = require('../models/masterModels');
const { SubscriptionPlan } = require('../models');

module.exports = {
  async list(req, res, next) {
    try {
      const Company = masterModels.Company;
      const companies = await Company.findAll({
        where: { tenant_id: req.tenant_id, is_active: true },
        order: [['createdAt', 'DESC']],
      });
      return res.json({ success: true, data: companies });
    } catch (err) {
      return next(err);
    }
  },

  async status(req, res, next) {
    try {
      const Company = masterModels.Company;
      const [count, provisionedCount, tenant] = await Promise.all([
        Company.count({ where: { tenant_id: req.tenant_id, is_active: true } }),
        Company.count({ where: { tenant_id: req.tenant_id, is_active: true, db_provisioned: true } }),
        TenantMaster.findByPk(req.tenant_id),
      ]);

      let maxCompanies = 1;
      let maxBranches = 0;
      let planType = 'multi-company';

      if (tenant?.subscription_plan) {
        const plan = await SubscriptionPlan.findOne({
          where: { plan_code: tenant.subscription_plan, is_active: true },
        });
        if (plan) {
          maxCompanies = parseInt(plan.max_companies, 10) || 1;
          maxBranches = parseInt(plan.max_branches, 10) || 0;
          planType = plan.plan_type || 'multi-company';
        }
      }

      return res.json({
        success: true,
        data: {
          has_company: count > 0,
          company_count: count,
          provisioned_company_count: provisionedCount,
          max_companies: maxCompanies,
          max_branches: maxBranches,
          plan_type: planType,
        },
      });
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const Company = masterModels.Company;

      const tenant = await TenantMaster.findByPk(req.tenant_id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }
      if (tenant.is_suspended) {
        return res.status(403).json({ success: false, message: 'Tenant account is suspended' });
      }

      // Get tenant's active subscription to check plan_type and limits
      const Subscription = masterModels.Subscription;
      const subscription = await Subscription.findOne({
        where: { 
          tenant_id: req.tenant_id,
          status: 'active'
        },
        order: [['createdAt', 'DESC']]
      });

      let maxCompanies = 1;
      let maxBranches = 0;
      let planType = 'multi-company';

      if (subscription) {
        maxCompanies = parseInt(subscription.max_companies, 10) || 1;
        maxBranches = parseInt(subscription.max_branches, 10) || 0;
        planType = subscription.plan_type || 'multi-company';
      } else {
        // Fallback to plan if no active subscription
        const plan = tenant.subscription_plan ? await SubscriptionPlan.findOne({
          where: { plan_code: tenant.subscription_plan, is_active: true },
        }) : null;

        if (plan) {
          maxCompanies = parseInt(plan.max_companies, 10) || 1;
          maxBranches = parseInt(plan.max_branches, 10) || 0;
        }
      }

      const existingCount = await Company.count({ where: { tenant_id: req.tenant_id, is_active: true } });
      
      // Check limits based on plan type
      if (planType === 'multi-company' && existingCount >= maxCompanies) {
        return res.status(403).json({
          success: false,
          message: `Company limit reached for your plan (max ${maxCompanies}). Please upgrade to add more companies.`,
        });
      }

      if (planType === 'multi-branch' && existingCount >= 1) {
        return res.status(403).json({
          success: false,
          message: 'Multi-branch plan allows only 1 company. Use branches instead.',
        });
      }

      const {
        branches, // Expect an array of branch objects
        company_name,
        company_type,
        business_type,
        registration_number,
        incorporation_date,
        pan,
        tan,
        gstin,
        is_composition_dealer,
        registered_address,
        state,
        pincode,
        contact_number,
        email,
        principals,
        financial_year_start,
        financial_year_end,
        currency,
        books_beginning_date,
        bank_details,
        compliance,
      } = req.body || {};

      if (!company_name || !company_type) {
        return res.status(400).json({
          success: false,
          message: 'company_name and company_type are required',
        });
      }

      // Validate business_type if provided
      if (business_type && !['trader', 'retail'].includes(business_type)) {
        return res.status(400).json({
          success: false,
          message: 'business_type must be either "trader" or "retail"',
        });
      }

      // For multi-branch plans, branches are optional during company creation
      // Users can add branches later through the branch management interface
      // Validate branch count only if branches are provided
      if (planType === 'multi-branch' && branches && branches.length > 0) {
        if (branches.length > maxBranches) {
          return res.status(403).json({
            success: false,
            message: `Branch limit reached for your plan (max ${maxBranches}).`,
          });
        }
      }

      const tenantProvisioningService = require('../services/tenantProvisioningService');

      // Single-database mode: every company shares the main database
      // and is isolated by tenant_id / company_id columns. We no longer
      // create a separate MySQL database per company.
      const dbName = process.env.DB_NAME || 'finvera_main';
      const dbUser = process.env.DB_USER || 'app';

      // De-duplicate: only one company per (tenant, name) — old code
      // used db_name to detect duplicates which is no longer meaningful.
      const existingCompany = await Company.findOne({
        where: { tenant_id: req.tenant_id, company_name },
      });

      if (existingCompany) {
        logger.info(`Company '${company_name}' already exists (ID: ${existingCompany.id}); updating it.`);
        await existingCompany.update({
          company_name,
          company_type,
          business_type: business_type || existingCompany.business_type || 'trader',
          registration_number: registration_number || existingCompany.registration_number,
          incorporation_date: incorporation_date || existingCompany.incorporation_date,
          pan: pan || existingCompany.pan,
          tan: tan || existingCompany.tan,
          gstin: gstin || existingCompany.gstin,
          is_composition_dealer: is_composition_dealer !== undefined ? is_composition_dealer : existingCompany.is_composition_dealer,
          registered_address: registered_address || existingCompany.registered_address,
          state: state || existingCompany.state,
          pincode: pincode || existingCompany.pincode,
          contact_number: contact_number || existingCompany.contact_number,
          email: email || existingCompany.email,
          principals: principals || existingCompany.principals,
          financial_year_start: financial_year_start || existingCompany.financial_year_start,
          financial_year_end: financial_year_end || existingCompany.financial_year_end,
          currency: currency || existingCompany.currency,
          books_beginning_date: books_beginning_date || existingCompany.books_beginning_date,
          bank_details: bank_details || existingCompany.bank_details,
          compliance: compliance || existingCompany.compliance,
          is_active: true,
        });

        // No DB provisioning in shared-DB mode — data already lives
        // in the main database, scoped by tenant_id / company_id.
        if (!existingCompany.db_provisioned) {
          await existingCompany.update({ db_provisioned: true, db_provisioned_at: new Date() });
        }

        return res.status(200).json({
          success: true,
          message: 'Company updated successfully',
          data: { company: existingCompany, isUpdate: true },
        });
      }

      const company = await Company.create({
        tenant_id: req.tenant_id,
        created_by_user_id: req.user_id,
        company_name,
        company_type,
        business_type: business_type || 'trader',
        registration_number: registration_number || null,
        incorporation_date: incorporation_date || null,
        pan: pan || null,
        tan: tan || null,
        gstin: gstin || null,
        is_composition_dealer: is_composition_dealer || false,
        registered_address: registered_address || null,
        state: state || null,
        pincode: pincode || null,
        contact_number: contact_number || null,
        email: email || null,
        principals: principals || null,
        financial_year_start: financial_year_start || null,
        financial_year_end: financial_year_end || null,
        currency: currency || 'INR',
        books_beginning_date: books_beginning_date || null,
        bank_details: bank_details || null,
        compliance: compliance || null,
        // Legacy DB connection columns are kept for backwards compatibility
        // but are no longer used to open per-company connections.
        db_name: dbName,
        db_host: process.env.DB_HOST || 'localhost',
        db_port: parseInt(process.env.DB_PORT) || 3306,
        db_user: dbUser,
        db_password: '',
        db_provisioned: true,
        db_provisioned_at: new Date(),
        is_active: true,
      });

      if (planType === 'multi-branch' && branches && branches.length > 0) {
        const Branch = masterModels.Branch;
        const branchData = branches.map((branch) => ({
          ...branch,
          company_id: company.id,
        }));
        await Branch.bulkCreate(branchData);
      }

      // Seed per-tenant default rows (numbering series, default ledgers,
      // etc.) into the shared DB. No DDL.
      try {
        await tenantProvisioningService.provisionDatabase(company);
      } catch (seedError) {
        logger.warn('Failed to seed defaults for new company:', seedError.message);
        // Don't roll the company creation back — the company itself is valid.
      }

      return res.status(201).json({ success: true, data: company });
    } catch (err) {
      return next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const Company = masterModels.Company;
      const company = await Company.findOne({
        where: { id: req.params.id, tenant_id: req.tenant_id, is_active: true },
        include: ['branches'],
      });
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company not found' });
      }
      return res.json({ success: true, data: company });
    } catch (err) {
      return next(err);
    }
  },

  async update(req, res, next) {
    try {
      const Company = masterModels.Company;
      const company = await Company.findOne({
        where: { id: req.params.id, tenant_id: req.tenant_id, is_active: true },
      });
      
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company not found' });
      }

      const {
        company_name,
        company_type,
        business_type,
        registration_number,
        incorporation_date,
        pan,
        tan,
        gstin,
        is_composition_dealer,
        registered_address,
        state,
        pincode,
        contact_number,
        email,
        principals,
        financial_year_start,
        financial_year_end,
        currency,
        books_beginning_date,
        bank_details,
        compliance,
        is_tds_enabled,
        is_tcs_enabled,
        tan_number,
        tds_circle,
        tds_ao_code,
        tds_deductor_type,
        tds_responsible_person,
        tds_responsible_designation,
      } = req.body || {};

      // Validate business_type if provided
      if (business_type && !['trader', 'retail'].includes(business_type)) {
        return res.status(400).json({
          success: false,
          message: 'business_type must be either "trader" or "retail"',
        });
      }

      await company.update({
        company_name: company_name || company.company_name,
        company_type: company_type || company.company_type,
        business_type: business_type !== undefined ? business_type : company.business_type,
        registration_number,
        incorporation_date,
        pan,
        tan,
        gstin,
        is_composition_dealer: is_composition_dealer !== undefined ? is_composition_dealer : company.is_composition_dealer,
        registered_address,
        state,
        pincode,
        contact_number,
        email,
        principals,
        financial_year_start,
        financial_year_end,
        currency,
        books_beginning_date,
        bank_details,
        compliance,
        is_tds_enabled: is_tds_enabled !== undefined ? is_tds_enabled : company.is_tds_enabled,
        is_tcs_enabled: is_tcs_enabled !== undefined ? is_tcs_enabled : company.is_tcs_enabled,
        tan_number: tan_number !== undefined ? tan_number : company.tan_number,
        tds_circle: tds_circle !== undefined ? tds_circle : company.tds_circle,
        tds_ao_code: tds_ao_code !== undefined ? tds_ao_code : company.tds_ao_code,
        tds_deductor_type: tds_deductor_type !== undefined ? tds_deductor_type : company.tds_deductor_type,
        tds_responsible_person: tds_responsible_person !== undefined ? tds_responsible_person : company.tds_responsible_person,
        tds_responsible_designation: tds_responsible_designation !== undefined ? tds_responsible_designation : company.tds_responsible_designation,
      });

      // Auto-create statutory ledgers when TDS/TCS is enabled
      const tdsService = require('../services/tdsService');
      
      // If TDS was just enabled, create TDS ledgers
      if (is_tds_enabled === true && !company.is_tds_enabled) {
        try {
          await tdsService.createTDSLedgers(req.tenantModels, req.masterModels, req.tenant_id);
        } catch (error) {
          logger.error('Error creating TDS ledgers:', error);
          // Don't fail the update, just log the error
        }
      }

      // If TCS was just enabled, create TCS ledgers
      if (is_tcs_enabled === true && !company.is_tcs_enabled) {
        try {
          await tdsService.createTCSLedgers(req.tenantModels, req.masterModels, req.tenant_id);
        } catch (error) {
          logger.error('Error creating TCS ledgers:', error);
          // Don't fail the update, just log the error
        }
      }

      return res.json({ success: true, data: company });
    } catch (err) {
      return next(err);
    }
  },

  async uploadLogo(req, res, next) {
    try {
      const Company = masterModels.Company;
      const company = await Company.findOne({
        where: { id: req.params.id, tenant_id: req.tenant_id, is_active: true },
      });
      
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company not found' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const logoUrl = `/uploads/company-logos/${req.file.filename}`;
      await company.update({ logo_url: logoUrl });

      return res.json({ success: true, data: { logo_url: logoUrl } });
    } catch (err) {
      return next(err);
    }
  },

  async uploadSignature(req, res, next) {
    try {
      const Company = masterModels.Company;
      const company = await Company.findOne({
        where: { id: req.params.id, tenant_id: req.tenant_id, is_active: true },
      });
      
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company not found' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const signatureUrl = `/uploads/company-signatures/${req.file.filename}`;
      
      // Store signature URL in compliance JSON field
      const compliance = company.compliance || {};
      compliance.signature_url = signatureUrl;
      await company.update({ compliance });

      return res.json({ success: true, data: { signature_url: signatureUrl } });
    } catch (err) {
      return next(err);
    }
  },

  async uploadDSCCertificate(req, res, next) {
    try {
      const Company = masterModels.Company;
      const company = await Company.findOne({
        where: { id: req.params.id, tenant_id: req.tenant_id, is_active: true },
      });
      
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company not found' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const certificateUrl = `/uploads/dsc-certificates/${req.file.filename}`;
      
      // Store certificate URL in compliance JSON field
      const compliance = company.compliance || {};
      compliance.dsc_certificate_url = certificateUrl;
      await company.update({ compliance });

      return res.json({ success: true, data: { dsc_certificate_url: certificateUrl } });
    } catch (err) {
      return next(err);
    }
  },

  async updateDSCConfig(req, res, next) {
    try {
      const Company = masterModels.Company;
      const company = await Company.findOne({
        where: { id: req.params.id, tenant_id: req.tenant_id, is_active: true },
      });
      
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company not found' });
      }

      const { dsc_enabled, dsc_password, dsc_alias } = req.body || {};

      // Store DSC config in compliance JSON field
      const compliance = company.compliance || {};
      if (dsc_enabled !== undefined) compliance.dsc_enabled = dsc_enabled;
      if (dsc_password !== undefined) compliance.dsc_password = dsc_password;
      if (dsc_alias !== undefined) compliance.dsc_alias = dsc_alias;
      
      await company.update({ compliance });

      return res.json({ success: true, data: { compliance } });
    } catch (err) {
      return next(err);
    }
  },

};
