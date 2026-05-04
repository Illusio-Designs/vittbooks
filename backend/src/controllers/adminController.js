const { User, Distributor, Salesman, Commission, Payout, Target, SubscriptionPlan } = require('../models');
const { TenantMaster } = require('../models/masterModels');
const { Op } = require('sequelize');
const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

module.exports = {
  async dashboard(req, res, next) {
    try {
      // Calculate date ranges for revenue
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentYearStart = new Date(now.getFullYear(), 0, 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const [
        totalTenants,
        totalDistributors,
        totalSalesmen,
        activeTenants,
        totalCommissions,
        totalPayouts,
        categoryStats,
        distributorCommissions,
        salesmanCommissions,
        allTenants,
        monthlyRevenue,
        yearlyRevenue,
        lastMonthRevenue,
      ] = await Promise.all([
        TenantMaster.count(),
        Distributor.count(),
        Salesman.count(),
        TenantMaster.count({ where: { is_active: true } }),
        Commission.sum('amount'),
        Payout.sum('total_amount'),
        TenantMaster.findAll({
          attributes: [
            'acquisition_category',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
          ],
          group: ['acquisition_category'],
          raw: true,
        }),
        Commission.sum('amount', { where: { distributor_id: { [Op.ne]: null } } }),
        Commission.sum('amount', { where: { salesman_id: { [Op.ne]: null } } }),
        TenantMaster.findAll({
          attributes: ['id', 'subscription_plan', 'subscription_start', 'createdAt'],
          where: { is_active: true },
        }),
        // Revenue for current month
        TenantMaster.findAll({
          attributes: ['subscription_plan'],
          where: {
            is_active: true,
            createdAt: { [Op.gte]: currentMonthStart },
          },
        }),
        // Revenue for current year
        TenantMaster.findAll({
          attributes: ['subscription_plan'],
          where: {
            is_active: true,
            createdAt: { [Op.gte]: currentYearStart },
          },
        }),
        // Revenue for last month
        TenantMaster.findAll({
          attributes: ['subscription_plan'],
          where: {
            is_active: true,
            createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
          },
        }),
      ]);

      // Process category statistics
      const categoryBreakdown = {
        distributor: 0,
        salesman: 0,
        referral: 0,
        organic: 0,
      };

      categoryStats.forEach((stat) => {
        const category = stat.acquisition_category || 'organic';
        categoryBreakdown[category] = parseInt(stat.count || 0);
      });

      const totalByCategory = Object.values(categoryBreakdown).reduce((sum, val) => sum + val, 0);
      const categoryRatios = {};
      Object.keys(categoryBreakdown).forEach((category) => {
        categoryRatios[category] = totalByCategory > 0 
          ? parseFloat(((categoryBreakdown[category] / totalByCategory) * 100).toFixed(2))
          : 0;
      });

      // Get all active plans once for efficient lookup
      const allPlans = await SubscriptionPlan.findAll({
        where: { is_active: true },
        attributes: ['plan_code', 'plan_name', 'base_price', 'discounted_price'],
      });
      const planMap = {};
      allPlans.forEach(plan => {
        planMap[plan.plan_code] = {
          plan_name: plan.plan_name,
          price: parseFloat(plan.discounted_price || plan.base_price || 0),
        };
      });

      // Calculate revenue from subscriptions (optimized)
      const calculateRevenue = (tenants) => {
        let totalRevenue = 0;
        const planRevenue = {};

        tenants.forEach(tenant => {
          if (tenant.subscription_plan && planMap[tenant.subscription_plan]) {
            const plan = planMap[tenant.subscription_plan];
            const planPrice = plan.price;
            totalRevenue += planPrice;
            
            if (!planRevenue[tenant.subscription_plan]) {
              planRevenue[tenant.subscription_plan] = {
                plan_name: plan.plan_name,
                count: 0,
                revenue: 0,
              };
            }
            planRevenue[tenant.subscription_plan].count += 1;
            planRevenue[tenant.subscription_plan].revenue += planPrice;
          }
        });

        return { totalRevenue, planRevenue };
      };

      const totalRevenueData = calculateRevenue(allTenants);
      const monthlyRevenueData = calculateRevenue(monthlyRevenue);
      const yearlyRevenueData = calculateRevenue(yearlyRevenue);
      const lastMonthRevenueData = calculateRevenue(lastMonthRevenue);

      // Calculate net revenue (total revenue - commissions paid)
      const netRevenue = totalRevenueData.totalRevenue - parseFloat(totalCommissions || 0);
      const revenueGrowth = lastMonthRevenueData.totalRevenue > 0
        ? parseFloat((((monthlyRevenueData.totalRevenue - lastMonthRevenueData.totalRevenue) / lastMonthRevenueData.totalRevenue) * 100).toFixed(2))
        : 0;

      res.json({
        data: {
          total_tenants: totalTenants,
          active_tenants: activeTenants,
          total_distributors: totalDistributors,
          total_salesmen: totalSalesmen,
          total_commissions: parseFloat(totalCommissions || 0),
          total_payouts: parseFloat(totalPayouts || 0),
          commissions: {
            total: parseFloat(totalCommissions || 0),
            distributor: parseFloat(distributorCommissions || 0),
            salesman: parseFloat(salesmanCommissions || 0),
          },
          revenue: {
            total: parseFloat(totalRevenueData.totalRevenue.toFixed(2)),
            monthly: parseFloat(monthlyRevenueData.totalRevenue.toFixed(2)),
            yearly: parseFloat(yearlyRevenueData.totalRevenue.toFixed(2)),
            last_month: parseFloat(lastMonthRevenueData.totalRevenue.toFixed(2)),
            growth: revenueGrowth,
            net: parseFloat(netRevenue.toFixed(2)),
            by_plan: Object.values(totalRevenueData.planRevenue).map(plan => ({
              plan_name: plan.plan_name,
              count: plan.count,
              revenue: parseFloat(plan.revenue.toFixed(2)),
            })),
          },
          tenant_categories: {
            breakdown: categoryBreakdown,
            ratios: categoryRatios,
          },
        },
      });
    } catch (error) {
      logger.error('Admin dashboard error:', error);
      next(error);
    }
  },

  async listTenants(req, res, next) {
    try {
      const { page = 1, limit = 20, search, is_active } = req.query;
      const offset = (page - 1) * limit;
      const where = {};

      if (search) {
        where[Op.or] = [
          { company_name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ];
      }

      if (is_active !== undefined) {
        where.is_active = is_active === 'true';
      }

      const { count, rows } = await TenantMaster.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
        attributes: [
          'id',
          'company_name',
          'subdomain',
          'email',
          'gstin',
          'pan',
          'address',
          'city',
          'state',
          'pincode',
          'phone',
          'subscription_plan',
          'referral_code',
          'is_active',
          'is_suspended',
          'db_provisioned',
          'subscription_start',
          'subscription_end',
          'createdAt',
          'updatedAt'
        ],
      });

      // Enrich with subscription plan names
      const planCodes = [...new Set(rows.map(r => r.subscription_plan).filter(Boolean))];
      const plans = planCodes.length > 0 
        ? await SubscriptionPlan.findAll({
            where: { plan_code: { [Op.in]: planCodes }, is_active: true },
            attributes: ['plan_code', 'plan_name']
          })
        : [];
      
      const planMap = {};
      plans.forEach(plan => {
        planMap[plan.plan_code] = plan.plan_name;
      });

      // Add plan names to tenant data
      const enrichedRows = rows.map(row => {
        const tenantData = row.toJSON();
        if (tenantData.subscription_plan && planMap[tenantData.subscription_plan]) {
          tenantData.subscription_plan_name = planMap[tenantData.subscription_plan];
        }
        return tenantData;
      });

      res.json({
        success: true,
        data: enrichedRows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (error) {
      logger.error('Admin listTenants error:', error);
      next(error);
    }
  },

  async getTenant(req, res, next) {
    try {
      const { id } = req.params;
      const tenant = await TenantMaster.findByPk(id);

      if (!tenant) {
        return res.status(404).json({ 
          success: false,
          message: 'Tenant not found' 
        });
      }

      // Get associated user if exists
      let user = null;
      try {
        user = await User.findOne({ 
          where: { tenant_id: tenant.id },
          attributes: ['id', 'email', 'name', 'role', 'is_active']
        });
      } catch (userError) {
        logger.warn(`Could not fetch user for tenant ${tenant.id}:`, userError.message);
      }

      // Get subscription plan details if subscription_plan exists
      let subscriptionPlanDetails = null;
      if (tenant.subscription_plan) {
        try {
          subscriptionPlanDetails = await SubscriptionPlan.findOne({
            where: { plan_code: tenant.subscription_plan, is_active: true },
            attributes: ['id', 'plan_code', 'plan_name', 'base_price', 'discounted_price', 'billing_cycle']
          });
        } catch (planError) {
          logger.warn(`Could not fetch subscription plan for tenant ${tenant.id}:`, planError.message);
        }
      }

      // Convert tenant to plain object and add user info
      const tenantData = tenant.toJSON();
      if (user) {
        tenantData.user = user.toJSON();
      }
      if (subscriptionPlanDetails) {
        tenantData.subscription_plan_details = subscriptionPlanDetails.toJSON();
        tenantData.subscription_plan_name = subscriptionPlanDetails.plan_name;
      }

      res.json({ 
        success: true,
        data: tenantData 
      });
    } catch (error) {
      logger.error('Admin getTenant error:', error);
      next(error);
    }
  },

  async createTenant(req, res, next) {
    try {
      const {
        company_name,
        email,
        password,
        gstin,
        pan,
        address,
        city,
        state,
        pincode,
        phone,
        subscription_plan,
        distributor_id,
        salesman_id,
      } = req.body;

      // Get distributor_id or salesman_id from logged-in user if not provided
      let finalDistributorId = distributor_id;
      let finalSalesmanId = salesman_id;
      const userId = req.user_id;
      const userRole = req.role;

      // Determine acquisition category and get distributor_id/salesman_id
      let acquisitionCategory = 'organic'; // Default: direct from website
      
      // If logged-in user is a distributor or salesman, get their ID
      if (!finalDistributorId && !finalSalesmanId && userId) {
        if (userRole === 'distributor') {
          const distributor = await Distributor.findOne({ where: { user_id: userId } });
          if (distributor) {
            finalDistributorId = distributor.id;
            acquisitionCategory = 'distributor';
          }
        } else if (userRole === 'salesman') {
          const salesman = await Salesman.findOne({ where: { user_id: userId } });
          if (salesman) {
            finalSalesmanId = salesman.id;
            acquisitionCategory = 'salesman';
            // Also get distributor_id from salesman
            if (salesman.distributor_id) {
              finalDistributorId = salesman.distributor_id;
            }
          }
        }
      }

      // Check if tenant came from referral code
      const { referral_code } = req.body;
      let finalPrice = null;
      let discountApplied = null;

      if (referral_code && !finalDistributorId && !finalSalesmanId) {
        acquisitionCategory = 'referral';
        
        // Apply referral discount if subscription plan is provided
        if (subscription_plan) {
          try {
            const SubscriptionPlan = require('../models').SubscriptionPlan;
            const plan = await SubscriptionPlan.findOne({
              where: { plan_code: subscription_plan, is_active: true },
            });
            
            if (plan) {
              const referralDiscountService = require('../services/referralDiscountService');
              const basePrice = parseFloat(plan.base_price || 0);
              
              // Apply discount (reward will be created after tenant is created)
              const discountResult = await referralDiscountService.applyReferralDiscount(
                referral_code,
                basePrice
              );
              
              if (discountResult.discountAmount > 0) {
                finalPrice = discountResult.discountedPrice;
                discountApplied = discountResult.discountPercentage;
                logger.info(`Referral discount applied: ${discountResult.discountPercentage}% (${discountResult.discountAmount})`);
              }
            }
          } catch (error) {
            logger.warn('Failed to apply referral discount:', error.message);
            // Continue with tenant creation even if discount fails
          }
        }
      }

      // If distributor_id or salesman_id is provided in body, set category accordingly
      if (distributor_id && !acquisitionCategory) {
        acquisitionCategory = 'distributor';
      } else if (salesman_id && !acquisitionCategory) {
        acquisitionCategory = 'salesman';
      }

      // Application-level uniqueness validation (since we removed unique constraints to avoid MySQL limit)
      if (email) {
        const existingTenantEmail = await TenantMaster.findOne({ where: { email } });
        if (existingTenantEmail) {
          return res.status(409).json({ message: 'Email already exists in tenant records' });
        }
        
        // Also check if email exists in users table (if password is provided)
        if (password) {
          const existingUserEmail = await User.findOne({ where: { email } });
          if (existingUserEmail) {
            return res.status(409).json({ message: 'Email already exists. Please use a different email address.' });
          }
        }
      }

      // Check GSTIN uniqueness if provided
      if (gstin) {
        const existingGSTIN = await TenantMaster.findOne({ where: { gstin } });
        if (existingGSTIN) {
          return res.status(409).json({ message: 'GSTIN already exists. Please use a different GSTIN.' });
        }
      }

      // Generate subdomain from company name or email
      const generateSubdomain = async (name, email) => {
        const base = name 
          ? name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 30)
          : email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 30);
        
        // Ensure uniqueness by appending counter if needed
        let subdomain = base;
        let counter = 1;
        while (true) {
          const existing = await TenantMaster.findOne({ where: { subdomain } });
          if (!existing) break;
          subdomain = `${base}-${counter}`;
          counter++;
          if (counter > 1000) {
            // Fallback to timestamp if too many conflicts
            subdomain = `${base}-${Date.now()}`;
            break;
          }
        }
        return subdomain;
      };

      const subdomain = await generateSubdomain(company_name, email);

      // DB provisioning is moved to COMPANY creation.
      // Keep tenant db fields null for new tenants.

      const tenant = await TenantMaster.create({
        company_name,
        subdomain: subdomain.toLowerCase(),
        email,
        gstin,
        pan,
        address,
        city,
        state,
        pincode,
        phone,
        subscription_plan,
        distributor_id: finalDistributorId,
        salesman_id: finalSalesmanId,
        referral_code,
        acquisition_category: acquisitionCategory,
        db_name: null,
        db_host: process.env.DB_HOST || 'localhost',
        db_port: parseInt(process.env.DB_PORT) || 3306,
        db_user: null,
        db_password: null,
        db_provisioned: false,
      });

      // IMPORTANT:
      // Database provisioning is moved to COMPANY creation (tenant-side).
      // Tenant creation should only create the tenant metadata + credentials.

      // Create referral reward if referral code was used (after tenant is created so we have tenant.id)
      if (referral_code && subscription_plan && finalPrice !== null) {
        try {
          const ReferralCode = require('../models').ReferralCode;
          const ReferralReward = require('../models').ReferralReward;
          
          // Find the referral code that was used
          const usedCode = await ReferralCode.findOne({
            where: {
              code: referral_code,
              is_active: true,
            },
          });
          
          if (usedCode && usedCode.owner_type && usedCode.owner_id) {
            const SubscriptionPlan = require('../models').SubscriptionPlan;
            const plan = await SubscriptionPlan.findOne({
              where: { plan_code: subscription_plan, is_active: true },
            });
            
            if (plan) {
              const basePrice = parseFloat(plan.base_price || 0);
              const rewardPercentage = 10.00; // Code owner gets 10% reward
              const rewardAmount = (basePrice * rewardPercentage) / 100;
              
              await ReferralReward.create({
                referrer_type: usedCode.owner_type,
                referrer_id: usedCode.owner_id,
                referee_tenant_id: tenant.id, // The new tenant who used the code
                referral_code_id: usedCode.id,
                reward_type: 'percentage',
                reward_amount: parseFloat(rewardAmount.toFixed(2)),
                reward_status: 'pending',
                subscription_plan: subscription_plan,
                reward_date: new Date(),
                notes: `Reward for referral code ${referral_code} usage. New tenant subscription.`,
              });
              
              logger.info(`Created referral reward for code owner: ${rewardAmount} (10% of ${basePrice})`);
            }
          }
        } catch (rewardError) {
          logger.error('Failed to create referral reward:', rewardError);
          // Don't fail tenant creation if reward creation fails
        }
      }

      // Auto-generate referral code for the new tenant
      try {
        const ReferralCode = require('../models').ReferralCode;
        const crypto = require('crypto');
        const generateReferralCode = (ownerType) => {
          const prefix = ownerType === 'salesman' ? 'SM' : ownerType === 'distributor' ? 'DS' : 'CU';
          const random = crypto.randomBytes(4).toString('hex').toUpperCase();
          return `${prefix}${random}`;
        };

        // Check if referral code already exists for this tenant
        const existingCode = await ReferralCode.findOne({
          where: { owner_type: 'customer', owner_id: tenant.id, is_active: true },
        });

        if (!existingCode) {
          // Get current discount percentage from config
          const ReferralDiscountConfig = require('../models').ReferralDiscountConfig;
          const currentConfig = await ReferralDiscountConfig.findOne({
            where: {
              is_active: true,
              effective_from: { [require('sequelize').Op.lte]: new Date() },
              [require('sequelize').Op.or]: [
                { effective_until: null },
                { effective_until: { [require('sequelize').Op.gte]: new Date() } },
              ],
            },
            order: [['effective_from', 'DESC']],
          });

          // Use 10% as the standard discount percentage
          const discountPercentage = 10.00;

          // Generate unique code with retry mechanism
          let code;
          let attempts = 0;
          const maxAttempts = 10;
          while (attempts < maxAttempts) {
            code = generateReferralCode('customer');
            const existing = await ReferralCode.findOne({ where: { code } });
            if (!existing) break;
            attempts++;
          }

          if (attempts < maxAttempts) {
            await ReferralCode.create({
              code,
              owner_type: 'customer',
              owner_id: tenant.id,
              discount_type: 'percentage',
              discount_value: discountPercentage,
              is_active: true,
            });
            logger.info(`Referral code auto-generated for tenant ${tenant.id}: ${code}`);
          } else {
            logger.warn(`Failed to generate unique referral code for tenant ${tenant.id} after ${maxAttempts} attempts`);
          }
        }
      } catch (error) {
        logger.warn('Failed to auto-generate referral code for tenant:', error.message);
        // Don't fail tenant creation if referral code generation fails
      }

      // Create admin user if email and password provided
      if (email && password) {
        try {
          // Double-check email doesn't exist (race condition protection)
          const existingUser = await User.findOne({ where: { email } });
          if (existingUser) {
            // If user already exists, don't fail - just log a warning
            logger.warn(`User with email ${email} already exists. Skipping user creation for tenant ${tenant.id}`);
          } else {
            const bcrypt = require('bcryptjs');
            const password_hash = await bcrypt.hash(password, 10);
            
            logger.info(`Creating user for tenant ${tenant.id} with email: ${email}`);
            
            const newUser = await User.create({
              email: email.toLowerCase().trim(), // Normalize email
              password: password_hash,
              name: company_name || email,
              tenant_id: tenant.id,
              role: 'tenant_admin',
            });
            
            logger.info(`Admin user created successfully for tenant ${tenant.id}:`, {
              userId: newUser.id,
              email: newUser.email,
              role: newUser.role,
              tenant_id: newUser.tenant_id,
              hasPassword: !!newUser.password
            });
            
            // Verify user was actually created
            const verifyUser = await User.findByPk(newUser.id);
            if (!verifyUser) {
              logger.error(`User creation verification failed - user ${newUser.id} not found after creation`);
            } else {
              logger.info(`User creation verified - user ${verifyUser.id} exists with email ${verifyUser.email}`);
            }
          }
        } catch (userError) {
          // If user creation fails due to duplicate email, log but don't fail tenant creation
          if (userError.name === 'SequelizeUniqueConstraintError' && userError.errors?.[0]?.path === 'email') {
            logger.warn(`User with email ${email} already exists. Tenant created but user creation skipped.`);
          } else {
            // For other errors, log but don't fail tenant creation
            logger.error(`Failed to create admin user for tenant ${tenant.id}:`, {
              message: userError.message,
              stack: userError.stack,
              error: userError
            });
          }
        }
      } else {
        logger.warn(`Tenant ${tenant.id} created without admin user (email or password not provided)`);
      }

      // Automatically create commissions if subscription plan is provided
      if (subscription_plan && (finalDistributorId || finalSalesmanId)) {
        try {
          const commissionService = require('../services/commissionService');
          await commissionService.calculateAndCreateCommissions(
            tenant.id,
            subscription_plan,
            'subscription'
          );
          logger.info(`Commissions created for tenant ${tenant.id}`);
        } catch (error) {
          logger.warn('Failed to create commission for tenant:', error.message);
          // Don't fail tenant creation if commission creation fails
        }
      }

      // Automatically update achieved targets after tenant creation
      await module.exports.updateTargetAchievement(finalDistributorId, finalSalesmanId, tenant);

      res.status(201).json({ 
        success: true,
        message: 'Tenant created successfully',
        data: tenant 
      });
    } catch (error) {
      logger.error('Admin createTenant error:', error);
      
      // Handle specific validation errors
      if (error.name === 'SequelizeUniqueConstraintError') {
        const field = error.errors?.[0]?.path || 'unknown';
        const value = error.errors?.[0]?.value || '';
        
        let message = 'A record with this information already exists.';
        if (field === 'email') {
          message = 'Email already exists. Please use a different email address.';
        } else if (field === 'gstin') {
          message = 'GSTIN already exists. Please use a different GSTIN.';
        } else if (field === 'subdomain') {
          message = 'Subdomain already exists. Please try again.';
        }
        
        return res.status(409).json({ 
          success: false,
          message,
          field,
          value 
        });
      }
      
      // Handle other errors
      next(error);
    }
  },

  async createTenantUser(req, res, next) {
    try {
      const { tenant_id } = req.params;
      const { email, password, name } = req.body;

      if (!email || !password) {
        return res.status(400).json({ 
          success: false,
          message: 'Email and password are required' 
        });
      }

      // Find tenant
      const tenant = await TenantMaster.findByPk(tenant_id);
      if (!tenant) {
        return res.status(404).json({ 
          success: false,
          message: 'Tenant not found' 
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email: email.toLowerCase().trim() } });
      if (existingUser) {
        return res.status(409).json({ 
          success: false,
          message: 'User with this email already exists' 
        });
      }

      // Check if user exists for this tenant
      const existingTenantUser = await User.findOne({ where: { tenant_id: tenant.id } });
      if (existingTenantUser) {
        return res.status(409).json({ 
          success: false,
          message: 'User already exists for this tenant' 
        });
      }

      // Create user
      const bcrypt = require('bcryptjs');
      const password_hash = await bcrypt.hash(password, 10);
      
      const newUser = await User.create({
        email: email.toLowerCase().trim(),
        password: password_hash,
        name: name || tenant.company_name || email,
        tenant_id: tenant.id,
        role: 'tenant_admin',
      });

      logger.info(`User created for existing tenant ${tenant.id}:`, {
        userId: newUser.id,
        email: newUser.email,
        tenant_id: newUser.tenant_id
      });

      res.status(201).json({ 
        success: true,
        message: 'User created successfully',
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            tenant_id: newUser.tenant_id
          }
        }
      });
    } catch (error) {
      logger.error('Admin createTenantUser error:', error);
      next(error);
    }
  },

  async provisionTenantDatabase(req, res, next) {
    try {
      const { id } = req.params;

      const tenant = await TenantMaster.findByPk(id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }

      // Single-database mode: there is no per-tenant MySQL database to
      // create. We just (re-)seed the per-tenant default rows in the
      // shared DB and mark the tenant as provisioned.
      const tenantProvisioningService = require('../services/tenantProvisioningService');
      await tenantProvisioningService.provisionDatabase(tenant);
      await tenant.reload();

      logger.info(`Tenant ${tenant.id} marked as provisioned (shared-DB mode)`);

      res.json({
        success: true,
        message: 'Tenant ready (all tenants share the main database)',
        data: {
          tenant: {
            id: tenant.id,
            company_name: tenant.company_name,
            db_name: tenant.db_name,
            db_provisioned: tenant.db_provisioned,
            db_provisioned_at: tenant.db_provisioned_at,
          },
        },
      });
    } catch (error) {
      logger.error('Admin provisionTenantDatabase error:', error);
      next(error);
    }
  },

  async updateTenant(req, res, next) {
    try {
      const { id } = req.params;
      const {
        company_name,
        gstin,
        pan,
        address,
        city,
        state,
        pincode,
        phone,
        email,
        subscription_plan,
        referral_code,
        is_active,
      } = req.body;

      const tenant = await TenantMaster.findByPk(id);

      if (!tenant) {
        return res.status(404).json({ 
          success: false,
          message: 'Tenant not found' 
        });
      }

      // Validate subscription plan if provided
      if (subscription_plan) {
        const plan = await SubscriptionPlan.findOne({
          where: { plan_code: subscription_plan, is_active: true }
        });
        if (!plan) {
          return res.status(400).json({
            success: false,
            message: 'Invalid subscription plan'
          });
        }
      }

      // Check email uniqueness if email is being changed
      if (email && email !== tenant.email) {
        const existingTenant = await TenantMaster.findOne({ where: { email } });
        if (existingTenant) {
          return res.status(409).json({ 
            success: false,
            message: 'Email already exists. Please use a different email address.',
            field: 'email'
          });
        }
      }

      // Check GSTIN uniqueness if GSTIN is being changed
      if (gstin && gstin !== tenant.gstin) {
        const existingTenant = await TenantMaster.findOne({ where: { gstin } });
        if (existingTenant) {
          return res.status(409).json({ 
            success: false,
            message: 'GSTIN already exists. Please use a different GSTIN.',
            field: 'gstin'
          });
        }
      }

      const updateData = {};
      if (company_name !== undefined) updateData.company_name = company_name;
      if (gstin !== undefined) updateData.gstin = gstin;
      if (pan !== undefined) updateData.pan = pan;
      if (address !== undefined) updateData.address = address;
      if (city !== undefined) updateData.city = city;
      if (state !== undefined) updateData.state = state;
      if (pincode !== undefined) updateData.pincode = pincode;
      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      if (subscription_plan !== undefined) updateData.subscription_plan = subscription_plan;
      if (referral_code !== undefined) updateData.referral_code = referral_code;
      if (is_active !== undefined) updateData.is_active = is_active;

      await tenant.update(updateData);

      // Reload to get updated data
      await tenant.reload();

      // Get subscription plan details if subscription_plan exists
      let subscriptionPlanDetails = null;
      if (tenant.subscription_plan) {
        try {
          subscriptionPlanDetails = await SubscriptionPlan.findOne({
            where: { plan_code: tenant.subscription_plan, is_active: true },
            attributes: ['id', 'plan_code', 'plan_name', 'base_price', 'discounted_price', 'billing_cycle']
          });
        } catch (planError) {
          logger.warn(`Could not fetch subscription plan for tenant ${tenant.id}:`, planError.message);
        }
      }

      const tenantData = tenant.toJSON();
      if (subscriptionPlanDetails) {
        tenantData.subscription_plan_details = subscriptionPlanDetails.toJSON();
        tenantData.subscription_plan_name = subscriptionPlanDetails.plan_name;
      }

      res.json({ 
        success: true,
        message: 'Tenant updated successfully',
        data: tenantData 
      });
    } catch (error) {
      logger.error('Admin updateTenant error:', error);
      
      // Handle specific validation errors
      if (error.name === 'SequelizeUniqueConstraintError') {
        const field = error.errors?.[0]?.path || 'unknown';
        let message = 'A record with this information already exists.';
        if (field === 'email') {
          message = 'Email already exists. Please use a different email address.';
        } else if (field === 'gstin') {
          message = 'GSTIN already exists. Please use a different GSTIN.';
        }
        
        return res.status(409).json({ 
          success: false,
          message,
          field
        });
      }
      
      next(error);
    }
  },

  async deleteTenant(req, res, next) {
    try {
      const { id } = req.params;
      const tenant = await TenantMaster.findByPk(id);

      if (!tenant) {
        return res.status(404).json({ 
          success: false,
          message: 'Tenant not found' 
        });
      }

      await tenant.destroy();

      res.json({ 
        success: true,
        message: 'Tenant deleted successfully' 
      });
    } catch (error) {
      logger.error('Admin deleteTenant error:', error);
      next(error);
    }
  },

  /**
   * Update target achievement when tenant is created or commission is generated
   * This function is called automatically after tenant creation
   * Can also be used by other controllers (e.g., commissionController)
   */
  updateTargetAchievement: async function(distributorId, salesmanId, tenant) {
    try {
      const now = new Date();
      const where = {
        [Op.or]: [
          { end_date: { [Op.gte]: now } },
          { end_date: null },
        ],
      };

      // Find targets for distributor or salesman
      if (distributorId) {
        where.distributor_id = distributorId;
      } else if (salesmanId) {
        where.salesman_id = salesmanId;
      } else {
        return; // No distributor or salesman, skip target update
      }

      // Get all active targets
      const targets = await Target.findAll({ where });

      for (const target of targets) {
        const startDate = target.start_date ? new Date(target.start_date) : null;
        const endDate = target.end_date ? new Date(target.end_date) : null;
        
        let achievedValue = 0;

        if (target.target_type === 'subscription') {
          // Count tenants created within target period
          const tenantWhere = {};
          if (distributorId) {
            tenantWhere.distributor_id = distributorId;
          } else if (salesmanId) {
            tenantWhere.salesman_id = salesmanId;
          }

          if (startDate && endDate) {
            tenantWhere.createdAt = { [Op.between]: [startDate, endDate] };
          }

          achievedValue = await TenantMaster.count({ where: tenantWhere });

        } else if (target.target_type === 'revenue') {
          // Sum commission amounts within target period
          const commissionWhere = {};
          if (distributorId) {
            commissionWhere.distributor_id = distributorId;
          } else if (salesmanId) {
            commissionWhere.salesman_id = salesmanId;
          }

          if (startDate && endDate) {
            commissionWhere[Op.or] = [
              { commission_date: { [Op.between]: [startDate, endDate] } },
              { createdAt: { [Op.between]: [startDate, endDate] } },
            ];
          }

          const commissions = await Commission.findAll({ where: commissionWhere });
          achievedValue = commissions.reduce((sum, c) => {
            return sum + parseFloat(c.amount || 0);
          }, 0);
        }

        // Update target with calculated achieved value
        await target.update({ achieved_value: parseFloat(achievedValue.toFixed(2)) });
      }

      logger.info(`Updated target achievement for ${targets.length} targets`);
    } catch (error) {
      logger.error('Error updating target achievement:', error);
      // Don't throw error - target update failure shouldn't block tenant creation
    }
  },

  // ============================================
  // USER MANAGEMENT
  // ============================================

  /**
   * List all system users (excluding distributors and salesmen)
   */
  async listUsers(req, res, next) {
    try {
      const { page = 1, limit = 20, role, search, is_active } = req.query;
      const offset = (page - 1) * limit;
      const where = {};

      // Exclude distributor and salesman roles
      where.role = {
        [Op.notIn]: ['distributor', 'salesman'],
      };

      if (role) {
        where.role = role;
      }

      if (is_active !== undefined) {
        where.is_active = is_active === 'true';
      }

      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ];
      }

      const { count, rows } = await User.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
        attributes: { exclude: ['password'] },
      });

      res.json({
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (error) {
      logger.error('List users error:', error);
      next(error);
    }
  },

  /**
   * Get user by ID
   */
  async getUser(req, res, next) {
    try {
      const { id } = req.params;
      const user = await User.findByPk(id, {
        attributes: { exclude: ['password'] },
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Don't allow viewing distributor/salesman users
      if (user.role === 'distributor' || user.role === 'salesman') {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json({ data: user });
    } catch (error) {
      logger.error('Get user error:', error);
      next(error);
    }
  },

  /**
   * Create new user
   */
  async createUser(req, res, next) {
    try {
      const { email, password, name, role, phone, is_active } = req.body;

      // Validate role (cannot create distributor or salesman here)
      if (role === 'distributor' || role === 'salesman') {
        return res.status(400).json({ message: 'Cannot create distributor or salesman users here' });
      }

      // Check if email already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ message: 'Email already exists' });
      }

      // Hash password
      const bcrypt = require('bcryptjs');
      const password_hash = await bcrypt.hash(password, 10);

      const user = await User.create({
        email,
        password: password_hash,
        name,
        role: role || 'admin',
        phone,
        is_active: is_active !== undefined ? is_active : true,
      });

      // Return user without password
      const userResponse = user.toJSON();
      delete userResponse.password;

      res.status(201).json({ data: userResponse });
    } catch (error) {
      logger.error('Create user error:', error);
      next(error);
    }
  },

  /**
   * Update user
   */
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const { email, password, name, role, phone, is_active, profile_image } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Don't allow updating distributor/salesman users
      if (user.role === 'distributor' || user.role === 'salesman') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Validate role if provided
      if (role && (role === 'distributor' || role === 'salesman')) {
        return res.status(400).json({ message: 'Cannot change role to distributor or salesman' });
      }

      // Check email uniqueness if email is being changed
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
          return res.status(409).json({ message: 'Email already exists' });
        }
      }

      // Update fields
      const updateData = {};
      if (email) updateData.email = email;
      if (name) updateData.name = name;
      if (role) updateData.role = role;
      if (phone !== undefined) updateData.phone = phone;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (profile_image !== undefined) updateData.profile_image = profile_image;

      // Hash password if provided
      if (password) {
        const bcrypt = require('bcryptjs');
        updateData.password = await bcrypt.hash(password, 10);
      }

      await user.update(updateData);

      // Return user without password
      const userResponse = user.toJSON();
      delete userResponse.password;

      res.json({ data: userResponse });
    } catch (error) {
      logger.error('Update user error:', error);
      next(error);
    }
  },

  /**
   * Delete user
   */
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Don't allow deleting distributor/salesman users
      if (user.role === 'distributor' || user.role === 'salesman') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Don't allow deleting yourself
      const currentUserId = req.user_id || req.user?.id || req.user?.user_id || req.user?.sub;
      if (user.id === currentUserId) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      await user.destroy();
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      logger.error('Delete user error:', error);
      next(error);
    }
  },
};


