const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { signTokens, revokeSession } = require('../utils/jwt');
const { User } = require('../models');
const { uploadDir } = require('../config/multer');
const { findByIdScoped, findOneScoped } = require('../utils/scopedQueries');

// Lazy load masterModels to avoid circular dependency issues
let masterModels;
function getMasterModels() {
  if (!masterModels) {
    try {
      // First, ensure master database is initialized
      const masterSequelize = require('../config/masterDatabase');
      
      // Check if database connection is ready
      if (!masterSequelize) {
        console.error('ERROR: masterSequelize is not available');
        throw new Error('Master database connection not initialized');
      }
      
      // Load masterModels
      masterModels = require('../models/masterModels');
      
      // Verify masterModels loaded correctly
      if (!masterModels) {
        console.error('ERROR: masterModels module is null or undefined');
        throw new Error('Master models module failed to load');
      }
      
      // Verify TenantMaster exists
      if (!masterModels.TenantMaster) {
        console.error('ERROR: masterModels.TenantMaster is not available');
        console.error('Available models:', Object.keys(masterModels));
        throw new Error('TenantMaster model not loaded');
      }
      
      // Verify TenantMaster has the create method
      if (typeof masterModels.TenantMaster.create !== 'function') {
        console.error('ERROR: TenantMaster.create is not a function');
        console.error('TenantMaster type:', typeof masterModels.TenantMaster);
        console.error('TenantMaster prototype:', masterModels.TenantMaster.constructor?.name);
        throw new Error('TenantMaster.create method not available');
      }
      
      console.log('[AUTH] MasterModels loaded successfully, TenantMaster available');
    } catch (error) {
      console.error('ERROR loading masterModels:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }
  return masterModels;
}

module.exports = {
  async register(req, res, next) {
    try {
      const { email, password, company_name, full_name, gstin } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: 'Password is required for registration' });
      }
      
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        return res.status(409).json({ message: 'User already exists' });
      }

      // Get masterModels (lazy load to avoid circular dependency issues)
      let masterModels;
      try {
        masterModels = getMasterModels();
      } catch (loadError) {
        console.error('ERROR: Failed to load masterModels:', loadError);
        console.error('Error details:', {
          message: loadError.message,
          stack: loadError.stack
        });
        return res.status(500).json({ 
          message: 'Server configuration error: Database models not available',
          error: process.env.NODE_ENV === 'development' ? loadError.message : 'Internal server error'
        });
      }
      
      // Ensure TenantMaster model is available
      if (!masterModels || !masterModels.TenantMaster) {
        console.error('ERROR: TenantMaster model not available in masterModels');
        console.error('masterModels keys:', masterModels ? Object.keys(masterModels) : 'masterModels is null/undefined');
        console.error('masterModels type:', typeof masterModels);
        return res.status(500).json({ message: 'Server configuration error: TenantMaster model not available' });
      }
      
      // Verify database connection is ready
      const masterSequelize = require('../config/masterDatabase');
      try {
        await masterSequelize.authenticate();
      } catch (dbError) {
        console.error('ERROR: Master database connection failed:', dbError.message);
        return res.status(503).json({ 
          message: 'Database connection unavailable. Please try again later.',
          error: process.env.NODE_ENV === 'development' ? dbError.message : 'Service temporarily unavailable'
        });
      }

      // Check if tenant already exists with this email
      const existingTenant = await masterModels.TenantMaster.findOne({ where: { email } });
      if (existingTenant) {
        return res.status(409).json({ message: 'Account with this email already exists' });
      }

      // Generate unique subdomain based on company name or email
      const normalizedEmail = email.toLowerCase().trim();
      const baseSubdomain = company_name 
        ? company_name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30)
        : normalizedEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      
      let subdomain = baseSubdomain;
      let subdomainExists = await masterModels.TenantMaster.findOne({ where: { subdomain } });
      let counter = 1;
      
      // Keep trying until we find a unique subdomain
      while (subdomainExists) {
        subdomain = `${baseSubdomain}${counter}`;
        subdomainExists = await masterModels.TenantMaster.findOne({ where: { subdomain } });
        counter++;
      }

      // Set trial period (30 days from now)
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);

      // Double-check TenantMaster.create is available before calling
      if (!masterModels.TenantMaster) {
        console.error('ERROR: TenantMaster is null/undefined');
        console.error('masterModels structure:', {
          hasTenantMaster: !!masterModels.TenantMaster,
          availableKeys: Object.keys(masterModels),
          masterModelsType: typeof masterModels
        });
        return res.status(500).json({ message: 'Server configuration error: TenantMaster model is not available' });
      }
      
      if (typeof masterModels.TenantMaster.create !== 'function') {
        console.error('ERROR: TenantMaster.create is not a function');
        console.error('TenantMaster details:', {
          type: typeof masterModels.TenantMaster,
          constructor: masterModels.TenantMaster.constructor?.name,
          prototype: Object.getPrototypeOf(masterModels.TenantMaster)?.constructor?.name,
          availableMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(masterModels.TenantMaster)),
          isSequelizeModel: masterModels.TenantMaster.constructor?.name === 'Model'
        });
        return res.status(500).json({ message: 'Server configuration error: TenantMaster.create is not available' });
      }

      // Log successful model access (for debugging)
      if (process.env.DEBUG_AUTH === 'true') {
        console.log('[AUTH] TenantMaster model verified, attempting to create tenant...');
      }

      // Validate GSTIN if provided
      if (gstin) {
        const cleanedGST = gstin.replace(/\s/g, '').toUpperCase();
        if (cleanedGST.length !== 15 || !/^[0-9A-Z]{15}$/.test(cleanedGST)) {
          return res.status(400).json({ 
            message: 'Invalid GSTIN format. GSTIN must be 15 alphanumeric characters.',
            field: 'gstin'
          });
        }
        
        // Check if GSTIN already exists
        const existingGSTIN = await masterModels.TenantMaster.findOne({ where: { gstin: cleanedGST } });
        if (existingGSTIN) {
          return res.status(409).json({ 
            message: 'GSTIN already exists. Please use a different GSTIN.',
            field: 'gstin'
          });
        }
      }

      // Create tenant in master database
      let tenant;
      try {
        tenant = await masterModels.TenantMaster.create({
          email: normalizedEmail,
          company_name: company_name || normalizedEmail.split('@')[0],
          subdomain: subdomain,
          gstin: gstin ? gstin.replace(/\s/g, '').toUpperCase() : null,
          is_trial: true,
          trial_ends_at: trialEnd,
          subscription_plan: 'trial',
          acquisition_category: 'organic',
          is_active: true,
          // Shared-DB mode: a fresh tenant is immediately ready to use.
          db_provisioned: true,
          db_provisioned_at: new Date(),
        });
      } catch (createError) {
        console.error('ERROR: Failed to create tenant in database:', createError);
        console.error('Error details:', {
          message: createError.message,
          name: createError.name,
          stack: createError.stack,
          original: createError.original
        });
        return res.status(500).json({ 
          message: 'Failed to create tenant account',
          error: process.env.NODE_ENV === 'development' ? createError.message : 'Internal server error'
        });
      }
      
      const password_hash = await bcrypt.hash(password, 10);
      const user = await User.create({
        email: normalizedEmail,
        password: password_hash, // Use password field as per User model
        tenant_id: tenant.id,
        role: 'tenant_admin', // First user for tenant should be admin
        name: full_name || company_name || normalizedEmail.split('@')[0], // Use full_name if provided
      });
      const tokens = await signTokens({ id: user.id, tenant_id: tenant.id, role: user.role });
      return res.status(201).json({ 
        user: { 
          id: user.id, 
          email: user.email, 
          tenant_id: tenant.id, 
          role: user.role 
        }, 
        ...tokens 
      });
    } catch (err) {
      return next(err);
    }
  },

  async authenticate(req, res, next) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }


      
      // Normalize email for search
      const normalizedEmail = email.toLowerCase().trim();
      
      // Find user (same logic as login)
      let user = await User.findOne({ 
        where: { 
          email: normalizedEmail 
        } 
      });
      
      if (!user) {
        const { Op } = require('sequelize');
        user = await User.findOne({ 
          where: { 
            email: { [Op.like]: normalizedEmail }
          } 
        });
      }
      
      // Check tenant_master if user not found
      if (!user) {
        const masterModels = getMasterModels();
        const tenant = await masterModels.TenantMaster.findOne({ where: { email } });
        
        if (tenant) {
          user = await User.findOne({ 
            where: { 
              tenant_id: tenant.id 
            } 
          });
          
          if (!user) {
            // Create user for existing tenant
            const bcrypt = require('bcryptjs');
            const password_hash = await bcrypt.hash(password, 10);
            
            user = await User.create({
              email: normalizedEmail,
              password: password_hash,
              name: tenant.company_name || normalizedEmail,
              tenant_id: tenant.id,
              role: 'tenant_admin',
            });
          }
        } else {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
      }

      // Check if user is a Google OAuth user
      if (user.google_id && !user.password) {
        return res.status(401).json({ 
          message: 'This account uses Google Sign-In. Please use Google to login.',
          use_google_login: true 
        });
      }
      
      // Verify password
      const passwordToCompare = user.password || user.password_hash || '';
      if (!passwordToCompare) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, passwordToCompare);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }



      // Get user's companies if they are a tenant user
      let companies = [];
      if (user.tenant_id && ['tenant_admin', 'user', 'accountant'].includes(user.role)) {
        const masterModels = getMasterModels();
        const companyRecords = await masterModels.Company.findAll({
          where: { tenant_id: user.tenant_id, is_active: true },
          attributes: ['id', 'company_name', 'company_type', 'db_provisioned'],
          order: [['createdAt', 'DESC']],
        });

        companies = companyRecords.map(company => ({
          id: company.id,
          company_name: company.company_name,
          company_type: company.company_type || 'private_limited',
          db_provisioned: company.db_provisioned
        }));
      }

      // Return authentication result
      return res.status(200).json({
        success: true,
        message: 'Authentication successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name || user.full_name,
          tenant_id: user.tenant_id,
          role: user.role
        },
        companies,
        requiresCompanySelection: companies.length > 1,
        needsCompanyCreation: companies.length === 0
      });

    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(500).json({ 
        message: 'Server error during authentication',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async login(req, res, next) {
    try {
      const { email, password, company_id, authenticated_user_id } = req.body;
      
      // If authenticated_user_id is provided, skip authentication and proceed with company selection
      if (authenticated_user_id && company_id) {
        const user = await User.findByPk(authenticated_user_id);
        if (!user) {
          return res.status(401).json({ message: 'Invalid user session' });
        }

        // Get the selected company
        const masterModels = getMasterModels();
        const selectedCompany = await masterModels.Company.findOne({
          where: { 
            id: company_id, 
            tenant_id: user.tenant_id, 
            is_active: true 
          }
        });

        if (!selectedCompany) {
          return res.status(403).json({ message: 'Invalid company selection' });
        }

        if (!selectedCompany.db_provisioned) {
          return res.status(503).json({
            message: 'Company database is being provisioned',
            company_id: selectedCompany.id,
          });
        }

        // Generate JWT tokens
        const tokens = await signTokens({
          id: user.id,
          tenant_id: user.tenant_id || null,
          company_id: selectedCompany.id,
          role: user.role,
        });

        return res.json({
          user: {
            id: user.id,
            email: user.email,
            tenant_id: user.tenant_id || null,
            company_id: selectedCompany.id,
            company_name: selectedCompany.company_name,
            role: user.role,
            full_name: user.name || user.full_name || null,
            profile_image: user.profile_image || null,
          },
          ...tokens,
        });
      }

      // Original login logic for backward compatibility
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }


      
      // Normalize email for search (lowercase, trim)
      const normalizedEmail = email.toLowerCase().trim();
      
      // First, try to find user in users table (master database)
      // Try exact match first, then case-insensitive
      let user = await User.findOne({ 
        where: { 
          email: normalizedEmail 
        } 
      });
      
      // If not found, try case-insensitive search (in case email was stored with different case)
      if (!user) {
        const { Op } = require('sequelize');
        user = await User.findOne({ 
          where: { 
            email: { [Op.like]: normalizedEmail }
          } 
        });
      }
      
      // If user not found, check tenant_master table
      if (!user) {
        const masterModels = getMasterModels();
        const tenant = await masterModels.TenantMaster.findOne({ where: { email } });
        
        if (tenant) {
          
          // Check if user exists by tenant_id (maybe email search failed due to case sensitivity)
          user = await User.findOne({ 
            where: { 
              tenant_id: tenant.id 
            } 
          });
          
          if (!user) {
            // User doesn't exist in users table but tenant exists
            // This means user creation failed during tenant creation
            // For existing tenants, create the user now with the provided password
            
            try {
              const bcrypt = require('bcryptjs');
              const password_hash = await bcrypt.hash(password, 10);
              
              user = await User.create({
                email: normalizedEmail,
                password: password_hash,
                name: tenant.company_name || normalizedEmail,
                tenant_id: tenant.id,
                role: 'tenant_admin',
              });
              
            } catch (createError) {
              console.error(`Failed to create user for tenant ${tenant.id}:`, createError);
              return res.status(500).json({ 
                message: 'Failed to create user account. Please contact administrator.' 
              });
            }
          } else {
            // User found by tenant_id, verify email matches
            if (user.email.toLowerCase() !== email.toLowerCase()) {
              console.error(`Email mismatch: user email ${user.email} vs login email ${email}`);
              return res.status(401).json({ message: 'Invalid credentials' });
            }
          }
        } else {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
      }


      
      // Check if user is a Google OAuth user (has google_id but no password)
      if (user.google_id && !user.password) {
        return res.status(401).json({ 
          message: 'This account uses Google Sign-In. Please use Google to login.',
          use_google_login: true 
        });
      }
      
      // Use password field (not password_hash) as per User model
      const passwordToCompare = user.password || user.password_hash || '';
      
      if (!passwordToCompare) {
        console.error(`User ${user.id} has no password stored`);
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, passwordToCompare);
      
      if (!valid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }



      // If this is a tenant-side user, require a company selection (or auto-pick if only one)
      let selectedCompany = null;
      if (user.tenant_id && ['tenant_admin', 'user', 'accountant'].includes(user.role)) {
        const masterModels = getMasterModels();
        const companies = await masterModels.Company.findAll({
          where: { tenant_id: user.tenant_id, is_active: true },
          attributes: ['id', 'company_name', 'db_provisioned'],
          order: [['createdAt', 'DESC']],
        });

        if (companies.length === 0) {
          // Still generate tokens and return user data so user can be authenticated
          // This allows them to access the company creation page
          const tokens = await signTokens({
            id: user.id,
            tenant_id: user.tenant_id || null,
            company_id: null, // No company yet
            role: user.role,
          });

          return res.status(409).json({
            message: 'No company found. Please create your company first.',
            needs_company_creation: true,
            user: {
              id: user.id,
              email: user.email,
              tenant_id: user.tenant_id || null,
              company_id: null,
              company_name: null,
              role: user.role,
              full_name: user.name || user.full_name || null,
              profile_image: user.profile_image || null,
            },
            ...tokens,
          });
        }

        if (companies.length === 1) {
          selectedCompany = companies[0];
        } else {
          if (!company_id) {
            return res.status(400).json({
              message: 'Company selection required',
              require_company: true,
              companies,
            });
          }
          selectedCompany = companies.find((c) => c.id === company_id);
          if (!selectedCompany) {
            return res.status(403).json({ message: 'Invalid company selection' });
          }
        }

        if (!selectedCompany.db_provisioned) {
          return res.status(503).json({
            message: 'Company database is being provisioned',
            company_id: selectedCompany.id,
          });
        }
      }

      const tokens = await signTokens({
        id: user.id,
        tenant_id: user.tenant_id || null,
        company_id: selectedCompany?.id || null,
        role: user.role,
      });

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          tenant_id: user.tenant_id || null,
          company_id: selectedCompany?.id || null,
          company_name: selectedCompany?.company_name || null,
          role: user.role,
          full_name: user.name || user.full_name || null,
          profile_image: user.profile_image || null,
        },
        ...tokens,
      });
    } catch (err) {
      console.error('Login error:', err);
      return next(err);
    }
  },

  async googleCallback(req, res, next) {
    try {
      const user = req.user; // User from passport strategy
      
      if (!user) {
        return res.status(401).json({ message: 'Google authentication failed' });
      }

      // Handle company selection for tenant users (similar to regular login)
      let selectedCompany = null;
      let needsCompanyCreation = false;
      
      if (user.tenant_id && ['tenant_admin', 'user', 'accountant'].includes(user.role)) {
        const masterModels = getMasterModels();
        const companies = await masterModels.Company.findAll({
          where: { tenant_id: user.tenant_id, is_active: true },
        });

        if (companies.length === 0) {
          // User has tenant but no company - needs to create company
          needsCompanyCreation = true;
        } else if (companies.length === 1) {
          // If only one company, auto-select it
          selectedCompany = companies[0];
        } else {
          // Multiple companies - check if company_id provided in query
          const { company_id } = req.query;
          if (company_id) {
            selectedCompany = companies.find((c) => c.id === company_id);
            if (!selectedCompany) {
              return res.status(400).json({ message: 'Invalid company selected' });
            }
          } else {
            // Return companies list for user to select
            return res.status(200).json({
              message: 'Multiple companies found. Please select one.',
              companies: companies.map((c) => ({
                id: c.id,
                company_name: c.company_name,
              })),
              user: {
                id: user.id,
                email: user.email,
                tenant_id: user.tenant_id,
                role: user.role,
              },
            });
          }
        }

        if (selectedCompany && !selectedCompany.db_provisioned) {
          return res.status(503).json({
            message: 'Company database is being provisioned',
            company_id: selectedCompany.id,
          });
        }
      } else if (!user.tenant_id) {
        // New Google user without a tenant - needs to create company
        needsCompanyCreation = true;
      }

      // Generate JWT tokens
      const tokens = await signTokens({
        id: user.id,
        tenant_id: user.tenant_id || null,
        company_id: selectedCompany?.id || null,
        role: user.role,
      });

      // Check if request is from mobile app (via state parameter or user agent)
      const isMobileRequest = req.query.state === 'mobile' || 
                             req.query.platform === 'mobile' ||
                             req.headers['user-agent']?.includes('Expo');

      // Determine redirect URL based on platform
      let redirectUrl;
      
      if (isMobileRequest) {
        // Mobile app redirect using custom scheme
        const mobileScheme = process.env.MOBILE_OAUTH_REDIRECT || 'fintranzact://oauth/google';
        const params = new URLSearchParams({
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          jti: tokens.jti,
          userId: user.id,
          email: user.email,
          name: user.name || user.full_name || '',
          needsCompany: needsCompanyCreation ? 'true' : 'false',
        });
        
        redirectUrl = `${mobileScheme}?${params.toString()}`;
        
        console.log('📱 Mobile OAuth redirect URL:', redirectUrl);
      } else {
        // Web frontend redirect
        const mainDomain = process.env.MAIN_DOMAIN || process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'fintranzact.com';
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
        let frontendUrl;
        
        // Always use role-based subdomain redirect for better user experience
        // This ensures users land on the correct portal (client or admin)
        if (['super_admin', 'admin'].includes(user.role)) {
          frontendUrl = process.env.NODE_ENV === 'production' 
            ? `${protocol}://admin.${mainDomain}`
            : 'http://admin.localhost:3001';
        } else if (user.tenant_id || ['tenant_admin', 'user', 'accountant'].includes(user.role)) {
          frontendUrl = process.env.NODE_ENV === 'production'
            ? `${protocol}://client.${mainDomain}`
            : 'http://client.localhost:3001';
        } else {
          // Fallback to main domain or FRONTEND_URL if explicitly set
          frontendUrl = process.env.FRONTEND_URL || (
            process.env.NODE_ENV === 'production'
              ? `${protocol}://${mainDomain}`
              : 'http://localhost:3001'
          );
        }

        // Build redirect URL based on whether user needs company creation
        if (needsCompanyCreation) {
          // User needs to create a company - redirect to company creation with tokens
          redirectUrl = `${frontendUrl}/auth/callback?token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&jti=${tokens.jti}&needsCompany=true`;
        } else {
          // User has company - redirect to normal callback
          redirectUrl = `${frontendUrl}/auth/callback?token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&jti=${tokens.jti}`;
        }
      }

      // If request expects JSON (API call), return JSON
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({
          user: {
            id: user.id,
            email: user.email,
            tenant_id: user.tenant_id || null,
            company_id: selectedCompany?.id || null,
            company_name: selectedCompany?.company_name || null,
            role: user.role,
            full_name: user.name || user.full_name || null,
            profile_image: user.profile_image || null,
          },
          needsCompanyCreation,
          ...tokens,
        });
      }

      // Otherwise redirect to appropriate platform
      return res.redirect(redirectUrl);
    } catch (err) {
      console.error('Google OAuth callback error:', err);
      return next(err);
    }
  },

  async checkCompanies(req, res, next) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }


      
      // Normalize email for search
      const normalizedEmail = email.toLowerCase().trim();
      
      // Find user (same logic as login)
      let user = await User.findOne({ 
        where: { 
          email: normalizedEmail 
        } 
      });
      
      // If not found, try case-insensitive search
      if (!user) {
        const { Op } = require('sequelize');
        user = await User.findOne({ 
          where: { 
            email: { [Op.like]: normalizedEmail }
          } 
        });
      }
      
      // If user not found, check tenant_master table
      if (!user) {
        const masterModels = getMasterModels();
        const tenant = await masterModels.TenantMaster.findOne({ where: { email } });
        
        if (tenant) {
          user = await User.findOne({ 
            where: { 
              tenant_id: tenant.id 
            } 
          });
          
          if (!user) {
            // Create user for existing tenant
            const bcrypt = require('bcryptjs');
            const password_hash = await bcrypt.hash(password, 10);
            
            user = await User.create({
              email: normalizedEmail,
              password: password_hash,
              name: tenant.company_name || normalizedEmail,
              tenant_id: tenant.id,
              role: 'tenant_admin',
            });
          }
        } else {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
      }

      // Verify password
      const passwordToCompare = user.password || user.password_hash || '';
      if (!passwordToCompare) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, passwordToCompare);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Get user's companies
      let companies = [];
      if (user.tenant_id && ['tenant_admin', 'user', 'accountant'].includes(user.role)) {
        const masterModels = getMasterModels();
        const companyRecords = await masterModels.Company.findAll({
          where: { tenant_id: user.tenant_id, is_active: true },
          attributes: ['id', 'company_name', 'company_type', 'db_provisioned'],
          order: [['createdAt', 'DESC']],
        });

        companies = companyRecords.map(company => ({
          id: company.id,
          company_name: company.company_name,
          company_type: company.company_type || 'private_limited',
          db_provisioned: company.db_provisioned
        }));
      }

      return res.status(200).json({
        success: true,
        companies,
        user: {
          id: user.id,
          email: user.email,
          tenant_id: user.tenant_id,
          role: user.role,
          name: user.name || user.full_name
        }
      });

    } catch (error) {
      console.error('Check companies error:', error);
      return res.status(500).json({ 
        message: 'Server error during company check',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async logout(req, res, next) {
    try {
      const { jti } = req.body;
      if (req.user && jti) {
        await revokeSession(req.user.sub || req.user.id, jti);
      }
      return res.json({ message: 'Logged out' });
    } catch (err) {
      return next(err);
    }
  },

  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token required' });
      }

      const { refreshAccessToken } = require('../utils/jwt');
      const tokens = await refreshAccessToken(refreshToken);

      if (!tokens) {
        return res.status(401).json({ message: 'Invalid or expired refresh token' });
      }

      return res.json(tokens);
    } catch (err) {
      return next(err);
    }
  },

  async switchCompany(req, res, next) {
    try {
      const userId = req.user_id || req.user?.id || req.user?.sub;
      const tenantId = req.tenant_id;
      const role = req.role;
      const { company_id } = req.body || {};

      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      if (!['tenant_admin', 'user', 'accountant'].includes(role)) {
        return res.status(403).json({ message: 'Company switching is only for tenant users' });
      }

      if (!company_id) {
        return res.status(400).json({ message: 'company_id is required' });
      }

      const masterModels = getMasterModels();
      const company = await masterModels.Company.findOne({
        where: { id: company_id, tenant_id: tenantId, is_active: true },
      });

      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }

      if (!company.db_provisioned) {
        return res.status(503).json({ message: 'Company database is being provisioned' });
      }

      const tokens = await signTokens({
        id: userId,
        tenant_id: tenantId,
        company_id: company.id,
        role,
      });

      return res.json({
        user: {
          id: userId,
          tenant_id: tenantId,
          company_id: company.id,
          company_name: company.company_name,
          role,
        },
        ...tokens,
      });
    } catch (err) {
      return next(err);
    }
  },

  async getProfile(req, res, next) {
    try {
      const userId = req.user_id || req.user?.id || req.user?.sub;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false,
          message: 'User not authenticated' 
        });
      }

      // Check if user is in tenant database or master database
      let user = null;
      
      try {
        if (req.tenantModels && req.tenantModels.User) {
          // Tenant user - get user only (no company info)
          user = await findByIdScoped(req, req.tenantModels.User, userId);
        } else {
          // Admin user (master database)
          user = await User.findByPk(userId);
        }
      } catch (dbError) {
        // If database query fails, log but continue with JWT data
        console.error('Database error fetching user:', dbError);
      }

      // If user not found in database, use JWT token data as fallback
      if (!user) {
        // Return user data from JWT token
        const userData = {
          id: userId,
          email: req.user?.email || req.user?.email_address || '',
          name: req.user?.name || req.user?.full_name || '',
          role: req.user?.role || req.role || '',
          phone: req.user?.phone || '',
          profile_image: req.user?.profile_image || null,
          is_active: req.user?.is_active !== undefined ? req.user.is_active : true,
          last_login: req.user?.last_login || null,
        };

        return res.json({ 
          success: true,
          data: userData 
        });
      }

      // Return user data without sensitive information and without company info
      const userData = {
        id: user.id,
        email: user.email,
        name: user.name || user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        role: user.role,
        phone: user.phone,
        profile_image: user.profile_image,
        is_active: user.is_active,
        last_login: user.last_login,
      };

      return res.json({ 
        success: true,
        data: userData 
      });
    } catch (err) {
      return next(err);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const userId = req.user_id || req.user?.id || req.user?.sub;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const { name, email, phone, password, current_password } = req.body;

      // Get user from appropriate database
      let user = null;
      
      if (req.tenantModels && req.tenantModels.User) {
        // Tenant user
        user = await findByIdScoped(req, req.tenantModels.User, userId);
      } else {
        // Admin user (master database)
        user = await User.findByPk(userId);
      }

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if email is being changed and if it's already taken
      if (email && email !== user.email) {
        let existingUser = null;
        if (req.tenantModels && req.tenantModels.User) {
          existingUser = await findOneScoped(req, req.tenantModels.User, { email });
        } else {
          existingUser = await User.findOne({ where: { email } });
        }
        
        if (existingUser && existingUser.id !== userId) {
          return res.status(409).json({ message: 'Email already in use' });
        }
      }

      // Update user profile
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;

      // Handle password change if provided
      if (password) {
        // Verify current password if provided
        if (current_password) {
          const bcrypt = require('bcryptjs');
          const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password);
          if (!isCurrentPasswordValid) {
            return res.status(400).json({ message: 'Current password is incorrect' });
          }
        }

        // Hash and update new password
        const bcrypt = require('bcryptjs');
        updateData.password = await bcrypt.hash(password, 10);
      }

      await user.update(updateData);

      // Return updated user data
      const userData = {
        id: user.id,
        email: user.email,
        name: user.name || user.full_name,
        role: user.role,
        phone: user.phone,
        profile_image: user.profile_image,
        is_active: user.is_active,
        last_login: user.last_login,
      };

      return res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: userData,
        },
      });
    } catch (err) {
      return next(err);
    }
  },

  async changePassword(req, res, next) {
    try {
      const userId = req.user_id || req.user?.id || req.user?.sub;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const { current_password, new_password } = req.body;

      // Validate input
      if (!current_password || !new_password) {
        return res.status(400).json({ 
          message: 'Current password and new password are required' 
        });
      }

      if (new_password.length < 6) {
        return res.status(400).json({ 
          message: 'New password must be at least 6 characters long' 
        });
      }

      // Get user from appropriate database
      let user = null;
      
      if (req.tenantModels && req.tenantModels.User) {
        // Tenant user
        user = await findByIdScoped(req, req.tenantModels.User, userId);
      } else {
        // Admin user (master database)
        user = await User.findByPk(userId);
      }

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if user has a password (OAuth users might not have one)
      if (!user.password) {
        return res.status(400).json({ 
          message: 'Cannot change password for OAuth users' 
        });
      }

      // Verify current password
      const bcrypt = require('bcryptjs');
      const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Hash and update new password
      const hashedNewPassword = await bcrypt.hash(new_password, 10);
      await user.update({ password: hashedNewPassword });

      return res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (err) {
      return next(err);
    }
  },

  async uploadProfileImage(req, res, next) {
    try {
      const userId = req.user_id || req.user?.id || req.user?.sub;
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Get user from appropriate database
      let user = null;
      
      if (req.tenantModels && req.tenantModels.User) {
        // Tenant user
        user = await findByIdScoped(req, req.tenantModels.User, userId);
      } else {
        // Admin user (master database)
        user = await User.findByPk(userId);
      }

      if (!user) {
        // Delete uploaded file if user not found
        if (req.file.path) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({ message: 'User not found' });
      }

      // Delete old profile image if exists
      if (user.profile_image) {
        const oldImagePath = path.isAbsolute(user.profile_image) 
          ? user.profile_image 
          : path.join(uploadDir, user.profile_image);
        
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (err) {
            // Log error but don't fail the request
            console.error('Error deleting old profile image:', err);
          }
        }
      }

      // Save relative path from upload directory
      const relativePath = path.relative(uploadDir, req.file.path);
      const profileImagePath = relativePath.replace(/\\/g, '/'); // Normalize path separators

      // Update user profile image
      try {
        const updateResult = await user.update({ profile_image: profileImagePath });

        // Verify the update
        const updatedUser = await user.reload();
      } catch (updateError) {
        throw updateError;
      }

      return res.json({
        message: 'Profile image uploaded successfully',
        profile_image: profileImagePath,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          profile_image: profileImagePath,
        },
      });
    } catch (err) {
      // Delete uploaded file on error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.error('Error deleting uploaded file:', unlinkErr);
        }
      }
      return next(err);
    }
  },

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ 
          success: false,
          error: 'Email is required' 
        });
      }

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Find user in master database
      let user = await User.findOne({ 
        where: { 
          email: normalizedEmail 
        } 
      });

      // If not found, try case-insensitive search
      if (!user) {
        const { Op } = require('sequelize');
        user = await User.findOne({ 
          where: { 
            email: { [Op.like]: normalizedEmail }
          } 
        });
      }

      // Account-existence and account-type are both secrets — never tell
      // the requester which case we're in. We return the same response
      // shape (and on the same approximate latency) regardless of:
      //   - whether the email belongs to any user,
      //   - whether the matched user is a password user or a Google user.
      // For Google-only accounts we just don't issue a token / email.
      const isGoogleOnly = !!(user && user.google_id && !user.password);

      if (user && !isGoogleOnly) {
        const crypto = require('crypto');
        // Send the *plain* token to the user via email; store only its
        // SHA-256 hash in Redis. If the Redis dataset ever leaks, an
        // attacker still cannot reuse the tokens.
        const plainToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
        const expirySeconds = 30 * 60; // 30 minutes
        const resetTokenExpiry = Date.now() + expirySeconds * 1000;

        const redisClient = require('../config/redis');
        const tokenKey = `password_reset:${tokenHash}`;
        const tokenData = JSON.stringify({
          userId: user.id,
          email: user.email,
          expiresAt: resetTokenExpiry,
        });
        await redisClient.setEx(tokenKey, expirySeconds, tokenData);
        const resetToken = plainToken; // used in the email URL below

        // Send reset email
        const emailService = require('../services/emailService');
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetUrl = `${frontendUrl}/client/reset-password?token=${resetToken}`;

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
              .content { background-color: #f9fafb; padding: 20px; margin: 20px 0; border-radius: 5px; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
              .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Reset Request</h1>
              </div>
              <div class="content">
                <p>Hello,</p>
                <p>You requested to reset your password for your Fintranzact account.</p>
                <p>Click the button below to reset your password:</p>
                <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset Password</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #6b7280; font-size: 12px;">${resetUrl}</p>
                <p><strong>This link will expire in 30 minutes and can only be used once.</strong></p>
                <p>If you didn't request this password reset, please ignore this email.</p>
              </div>
              <div class="footer">
                <p>This is an automated email from ${process.env.APP_NAME || 'Fintranzact'}</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const emailText = `
Password Reset Request

Hello,

You requested to reset your password for your Fintranzact account.

Click this link to reset your password:
${resetUrl}

This link will expire in 30 minutes.

If you didn't request this password reset, please ignore this email.

---
This is an automated email from ${process.env.APP_NAME || 'Fintranzact'}
        `.trim();

        await emailService.sendEmail({
          to: user.email,
          subject: 'Password Reset Request - Fintranzact',
          html: emailHtml,
          text: emailText,
        });
      }

      // Always return success (security best practice)
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    } catch (err) {
      console.error('Forgot password error:', err);
      return next(err);
    }
  },

  async verifyResetToken(req, res, next) {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Reset token is required'
        });
      }

      // Look up the token in Redis by its SHA-256 hash. We never store
      // the plain token, so a Redis dump can't be used to hijack resets.
      const crypto = require('crypto');
      const redisClient = require('../config/redis');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const tokenKey = `password_reset:${tokenHash}`;
      const tokenDataStr = await redisClient.get(tokenKey);

      if (!tokenDataStr) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token'
        });
      }

      const tokenData = JSON.parse(tokenDataStr);

      // Check if token is expired
      if (Date.now() > tokenData.expiresAt) {
        await redisClient.del(tokenKey);
        return res.status(400).json({
          success: false,
          error: 'Reset token has expired'
        });
      }

      return res.json({
        success: true,
        message: 'Reset token is valid',
        data: {
          email: tokenData.email,
        }
      });
    } catch (err) {
      console.error('Verify reset token error:', err);
      return next(err);
    }
  },

  async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({
          success: false,
          error: 'Token and password are required'
        });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters long'
        });
      }

      // Look up the token in Redis by its SHA-256 hash (see forgotPassword).
      const crypto = require('crypto');
      const redisClient = require('../config/redis');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const tokenKey = `password_reset:${tokenHash}`;
      const tokenDataStr = await redisClient.get(tokenKey);

      if (!tokenDataStr) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token'
        });
      }

      const tokenData = JSON.parse(tokenDataStr);

      if (Date.now() > tokenData.expiresAt) {
        await redisClient.del(tokenKey);
        return res.status(400).json({
          success: false,
          error: 'Reset token has expired'
        });
      }

      const user = await User.findByPk(tokenData.userId);
      if (!user) {
        await redisClient.del(tokenKey);
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Hash new password and persist.
      const passwordHash = await bcrypt.hash(password, 12);
      await user.update({ password: passwordHash });

      // Single-use: consume the reset token immediately.
      await redisClient.del(tokenKey);

      // Revoke every active session for this user. If the password was
      // reset because the account was compromised, any attacker still
      // logged in is kicked out and forced to re-authenticate.
      try {
        await redisClient.deletePattern(`session:${user.id}:*`);
      } catch (e) {
        console.warn('Failed to revoke existing sessions after password reset:', e.message);
      }

      return res.json({
        success: true,
        message: 'Password has been reset successfully. Please log in again.'
      });
    } catch (err) {
      console.error('Reset password error:', err);
      return next(err);
    }
  },
};
