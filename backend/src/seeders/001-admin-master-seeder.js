/**
 * Consolidated Seeder for Admin and Master Databases
 * 
 * This file contains all seeders for:
 * - Master Database: System tenant, master seeds (account groups, voucher types, GST rates, TDS sections)
 * - Admin/Main Database: Admin user, subscription plans
 * 
 * IMPORTANT: This seeder should be run on BOTH master and main databases separately
 * Each database tracks its own execution in its seeder_meta table
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const uuid = require('uuid');

// Encryption helper (delegates to the canonical implementation so that
// the seeder always uses the same on-disk format as the running app).
function encrypt(text) {
  const tenantProvisioningService = require('../services/tenantProvisioningService');
  return tenantProvisioningService.encryptPassword(text);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    
    // ============================================
    // DATABASE TYPE DETECTION (same as migrations)
    // ============================================
    const detectDatabaseType = async () => {
      try {
        const [dbNameResult] = await queryInterface.sequelize.query("SELECT DATABASE() as db_name");
        const databaseName = (dbNameResult[0]?.db_name || '').toLowerCase();
        
        console.log(`🔍 Detected database: ${databaseName}`);
        
        // Exact matches for known databases
        if (databaseName === 'fintranzact_master') return 'master';
        if (databaseName === 'fintranzact_db' || databaseName === 'fintranzact_main') return 'admin';
        
        // Any other fintranzact_* database is a TENANT database
        if (databaseName.startsWith('fintranzact_')) return 'tenant';
        
        return 'unknown';
      } catch (error) {
        console.warn('Could not detect database type:', error.message);
        return 'unknown';
      }
    };

    const dbType = await detectDatabaseType();
    const isMasterDb = dbType === 'master';
    const isMainDb = dbType === 'admin';

    console.log(`🔄 Running seeder on database (Type: ${dbType}, Master: ${isMasterDb}, Admin: ${isMainDb})`);
    
    // Skip if unknown database
    if (dbType === 'unknown') {
      console.log('⚠️  Unknown database type, skipping seeder for safety');
      return;
    }
    
    // Skip tenant databases - they have their own seeder
    if (dbType === 'tenant') {
      console.log('⚠️  SKIPPING: This is a tenant database. Use tenant seeder instead.');
      return;
    }

    // ============================================
    // MASTER DATABASE SEEDERS (only run on master DB)
    // ============================================
    
    if (isMasterDb) {
      console.log('📊 Seeding Master Database...');

      // 1. CREATE SYSTEM TENANT
      try {
        const existingTenants = await queryInterface.sequelize.query(
          `SELECT id FROM tenant_master WHERE subdomain = 'system' LIMIT 1`,
          { type: Sequelize.QueryTypes.SELECT }
        );

        if (existingTenants.length === 0) {
          const tenantId = uuid.v4();
          const dbPassword = encrypt(process.env.DB_PASSWORD || '');

          await queryInterface.sequelize.query(
            `INSERT INTO tenant_master 
             (id, company_name, subdomain, subscription_plan, email, db_name, db_host, db_user, db_password, is_active, acquisition_category, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            {
              replacements: [
                tenantId,
                'System',
                'system',
                'STARTER',
                'system@fintranzact.com',
                `fintranzact_tenant_${tenantId.replace(/-/g, '_')}`,
                process.env.DB_HOST || 'localhost',
                process.env.DB_USER || 'root',
                dbPassword,
                true,
                'organic',
                now,
                now,
              ],
              type: Sequelize.QueryTypes.INSERT,
            }
          );

          console.log('✓ System tenant created in master database');
        } else {
          console.log('ℹ️  System tenant already exists');
        }
      } catch (error) {
        console.log('⚠️  Could not create system tenant:', error.message);
      }

      // 2. SEED MASTER DATA (Account Groups, Voucher Types, GST Rates, TDS Sections)
      try {
        const masterModels = require('../models/masterModels');
        
        // Seed Account Groups
        const accountGroups = [
          // Assets
          { group_code: 'CA', name: 'Current Assets', parent_id: null, nature: 'asset', is_system: true },
          { group_code: 'CASH', name: 'Cash-in-Hand', parent_id: null, nature: 'asset', is_system: true },
          { group_code: 'BANK', name: 'Bank Accounts', parent_id: null, nature: 'asset', is_system: true },
          { group_code: 'SD', name: 'Sundry Debtors', parent_id: null, nature: 'asset', is_system: true },
          { group_code: 'FA', name: 'Fixed Assets', parent_id: null, nature: 'asset', is_system: true },
          { group_code: 'INV', name: 'Stock-in-Hand', parent_id: null, nature: 'asset', is_system: true },
          { group_code: 'LA', name: 'Loans & Advances (Asset)', parent_id: null, nature: 'asset', is_system: true },
          
          // Liabilities
          { group_code: 'CL', name: 'Current Liabilities', parent_id: null, nature: 'liability', is_system: true },
          { group_code: 'SC', name: 'Sundry Creditors', parent_id: null, nature: 'liability', is_system: true },
          { group_code: 'DT', name: 'Duties & Taxes', parent_id: null, nature: 'liability', is_system: true },
          { group_code: 'CAP', name: 'Capital Account', parent_id: null, nature: 'liability', is_system: true },
          { group_code: 'RES', name: 'Reserves & Surplus', parent_id: null, nature: 'liability', is_system: true },
          { group_code: 'LOAN', name: 'Loans (Liability)', parent_id: null, nature: 'liability', is_system: true },
          
          // Income
          { group_code: 'SAL', name: 'Sales Accounts', parent_id: null, nature: 'income', affects_gross_profit: true, is_system: true },
          { group_code: 'DIR_INC', name: 'Direct Income', parent_id: null, nature: 'income', affects_gross_profit: true, is_system: true },
          { group_code: 'IND_INC', name: 'Indirect Income', parent_id: null, nature: 'income', affects_gross_profit: false, is_system: true },
          
          // Expenses
          { group_code: 'PUR', name: 'Purchase Accounts', parent_id: null, nature: 'expense', affects_gross_profit: true, is_system: true },
          { group_code: 'DIR_EXP', name: 'Direct Expenses', parent_id: null, nature: 'expense', affects_gross_profit: true, is_system: true },
          { group_code: 'IND_EXP', name: 'Indirect Expenses', parent_id: null, nature: 'expense', affects_gross_profit: false, is_system: true },
        ];

        await masterModels.AccountGroup.bulkCreate(accountGroups, { ignoreDuplicates: true });
        console.log(`✓ Seeded ${accountGroups.length} account groups`);

        // Seed Voucher Types
        const voucherTypes = [
          { name: 'Sales', type_category: 'sales', numbering_prefix: 'INV', is_system: true, description: 'Sales invoice' },
          { name: 'Purchase', type_category: 'purchase', numbering_prefix: 'PUR', is_system: true, description: 'Purchase invoice' },
          { name: 'Payment', type_category: 'payment', numbering_prefix: 'PAY', is_system: true, description: 'Payment voucher' },
          { name: 'Receipt', type_category: 'receipt', numbering_prefix: 'REC', is_system: true, description: 'Receipt voucher' },
          { name: 'Journal', type_category: 'journal', numbering_prefix: 'JV', is_system: true, description: 'Journal voucher' },
          { name: 'Contra', type_category: 'contra', numbering_prefix: 'CNT', is_system: true, description: 'Contra voucher' },
          { name: 'Debit Note', type_category: 'debit_note', numbering_prefix: 'DN', is_system: true, description: 'Debit note' },
          { name: 'Credit Note', type_category: 'credit_note', numbering_prefix: 'CN', is_system: true, description: 'Credit note' },
        ];

        await masterModels.VoucherType.bulkCreate(voucherTypes, { ignoreDuplicates: true });
        console.log(`✓ Seeded ${voucherTypes.length} voucher types`);

        // GST Rates and TDS Sections removed - now using Sandbox API for live data
        console.log('ℹ️  GST rates and TDS sections now fetched from Sandbox API instead of master database');

        console.log('✅ Master database seeding completed');
      } catch (error) {
        console.log('⚠️  Could not seed master data:', error.message);
      }
    } // End of master DB section

    // ============================================
    // ADMIN/MAIN DATABASE SEEDERS (only run on main DB)
    // ============================================
    
    if (isMainDb) {
      console.log('👤 Seeding Main Database...');

      // 3. CREATE ADMIN USER (only rishi@finvera.com)
      try {
        // Check for existing admin user
        const existingRishi = await queryInterface.sequelize.query(
          `SELECT id FROM users WHERE email = 'rishi@fintranzact.com'`,
          { type: Sequelize.QueryTypes.SELECT }
        );

        const usersToCreate = [];

        // Create or update Rishi admin user
        if (existingRishi.length === 0) {
          const rishiPasswordHash = await bcrypt.hash('Rishi@1995', 10);
          usersToCreate.push({
            id: uuid.v4(),
            tenant_id: null, // Platform admin doesn't need tenant_id
            email: 'rishi@fintranzact.com',
            password: rishiPasswordHash,
            name: 'Rishi Kumar',
            role: 'super_admin',
            phone: null,
            is_active: true,
            last_login: null,
            createdAt: now,
            updatedAt: now,
          });
        } else {
          // User exists, but update password to ensure it's correct
          const rishiPasswordHash = await bcrypt.hash('Rishi@1995', 10);
          await queryInterface.sequelize.query(
            `UPDATE users SET password = ?, updatedAt = ? WHERE email = 'rishi@fintranzact.com'`,
            {
              replacements: [rishiPasswordHash, now],
              type: Sequelize.QueryTypes.UPDATE,
            }
          );
          console.log('✓ Updated password for rishi@fintranzact.com');
        }

        if (usersToCreate.length > 0) {
          await queryInterface.bulkInsert('users', usersToCreate);
          
          console.log('✓ Platform Admin User Created:');
          console.log(`  - Email: rishi@fintranzact.com`);
          console.log(`  - Password: Rishi@1995`);
          console.log(`  - Role: super_admin (platform-wide)`);
        }
        
        // Log password updates if user was updated
        if (existingRishi.length > 0 && usersToCreate.length === 0) {
          console.log('ℹ️  Admin user already exists (password updated)');
        }
      } catch (error) {
        console.log('⚠️  Could not create admin users:', error.message);
        console.error('Error details:', error);
      }

      // 4. CREATE SUBSCRIPTION PLANS
      try {
        const existingPlans = await queryInterface.sequelize.query(
          "SELECT id FROM subscription_plans WHERE plan_code IN ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE')",
          { type: Sequelize.QueryTypes.SELECT }
        );

        if (existingPlans.length === 0) {
          await queryInterface.bulkInsert('subscription_plans', [
            {
              id: uuid.v4(),
              plan_code: 'FREE',
              plan_name: 'Free',
              description: 'Free tier',
              billing_cycle: 'monthly',
              base_price: 0,
              currency: 'INR',
              trial_days: 0,
              max_users: 1,
              max_invoices_per_month: 50,
              max_companies: 1,
              max_branches: 0,
              features: JSON.stringify({ gst_filing: false, e_invoicing: false }),
              is_active: true,
              is_visible: true,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: uuid.v4(),
              plan_code: 'STARTER',
              plan_name: 'Starter',
              description: 'Starter plan',
              billing_cycle: 'monthly',
              base_price: 999,
              currency: 'INR',
              trial_days: 30,
              max_users: 3,
              max_invoices_per_month: 200,
              max_companies: 2,
              max_branches: 2,
              features: JSON.stringify({ gst_filing: true, e_invoicing: false }),
              salesman_commission_rate: 15,
              distributor_commission_rate: 5,
              is_active: true,
              is_visible: true,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: uuid.v4(),
              plan_code: 'PROFESSIONAL',
              plan_name: 'Professional',
              description: 'Most popular for growing businesses',
              billing_cycle: 'monthly',
              base_price: 1999,
              discounted_price: 1660,
              currency: 'INR',
              trial_days: 30,
              max_users: 15,
              max_invoices_per_month: 2000,
              max_companies: 5,
              max_branches: 10,
              storage_limit_gb: 50,
              features: JSON.stringify({ 
                gst_filing: true, 
                e_invoicing: true,
                advanced_reports: true,
                multi_branch: true,
                priority_support: true
              }),
              salesman_commission_rate: 20,
              distributor_commission_rate: 8,
              renewal_commission_rate: 5,
              is_active: true,
              is_visible: true,
              is_featured: true,
              display_order: 2,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: uuid.v4(),
              plan_code: 'ENTERPRISE',
              plan_name: 'Enterprise',
              description: 'For large businesses with advanced needs',
              billing_cycle: 'monthly',
              base_price: 3999,
              discounted_price: 3320,
              currency: 'INR',
              trial_days: 30,
              max_users: -1, // unlimited
              max_invoices_per_month: -1, // unlimited
              max_companies: -1, // unlimited
              max_branches: -1, // unlimited
              storage_limit_gb: 500,
              features: JSON.stringify({ 
                gst_filing: true, 
                e_invoicing: true,
                advanced_reports: true,
                multi_branch: true,
                priority_support: true,
                api_access: true,
                custom_integrations: true,
                dedicated_support: true,
                white_label: true,
                advanced_analytics: true
              }),
              salesman_commission_rate: 25,
              distributor_commission_rate: 10,
              renewal_commission_rate: 8,
              is_active: true,
              is_visible: true,
              is_featured: false,
              display_order: 3,
              createdAt: now,
              updatedAt: now,
            },
          ]);

          console.log('✓ Subscription plans: FREE, STARTER, PROFESSIONAL, ENTERPRISE');
        } else {
          console.log('ℹ️  Subscription plans already exist');
        }
      } catch (error) {
        console.log('⚠️  Could not create subscription plans:', error.message);
      }

      console.log('✅ Main database seeding completed');

      // 5. CREATE TEST SUBSCRIPTION FOR DEVELOPMENT
      try {
        // Get the system tenant
        const systemTenant = await queryInterface.sequelize.query(
          "SELECT id FROM tenant_master WHERE subdomain = 'system' LIMIT 1",
          { type: Sequelize.QueryTypes.SELECT }
        );

        if (systemTenant.length > 0) {
          const tenantId = systemTenant[0].id;
          
          // Check if subscription already exists
          const existingSubscription = await queryInterface.sequelize.query(
            "SELECT id FROM subscriptions WHERE tenant_id = ? LIMIT 1",
            { 
              replacements: [tenantId],
              type: Sequelize.QueryTypes.SELECT 
            }
          );

          if (existingSubscription.length === 0) {
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 1);

            await queryInterface.bulkInsert('subscriptions', [
              {
                id: uuid.v4(),
                tenant_id: tenantId,
                subscription_plan_id: null, // Don't use FK - plan is in different database
                razorpay_subscription_id: `local_sub_dev_${Date.now()}`,
                razorpay_plan_id: null,
                status: 'active',
                plan_code: 'STARTER',
                plan_name: 'Starter',
                description: 'Starter plan',
                plan_type: 'multi-company',
                billing_cycle: 'monthly',
                base_price: 999,
                discounted_price: null,
                amount: 999,
                currency: 'INR',
                trial_days: 30,
                max_users: 3,
                max_invoices_per_month: 200,
                max_companies: 2,
                max_branches: 2,
                storage_limit_gb: null,
                features: JSON.stringify({ gst_filing: true, e_invoicing: false }),
                salesman_commission_rate: 15,
                distributor_commission_rate: 5,
                renewal_commission_rate: null,
                is_active: true,
                is_visible: true,
                is_featured: false,
                display_order: null,
                valid_from: null,
                valid_until: null,
                start_date: startDate,
                end_date: endDate,
                current_period_start: startDate,
                current_period_end: endDate,
                cancelled_at: null,
                notes: 'Development test subscription',
                metadata: JSON.stringify({ mode: 'local', created_by: 'seeder' }),
                createdAt: now,
                updatedAt: now,
              },
            ]);

            console.log('✓ Test subscription created for system tenant (STARTER plan with 2 companies)');
          } else {
            console.log('ℹ️  Test subscription already exists');
          }
        }
      } catch (error) {
        console.log('⚠️  Could not create test subscription:', error.message);
      }
    } // End of main DB section

    // If neither master nor main DB, skip seeding
    if (!isMasterDb && !isMainDb) {
      console.log(`ℹ️  Skipping seeding for database: ${currentDbName} (not master or main DB)`);
    }
  },

  async down(queryInterface, Sequelize) {
    const masterDbName = process.env.MASTER_DB_NAME || 'fintranzact_master';
    const currentDbName = queryInterface.sequelize.config.database;
    const isMasterDb = currentDbName === masterDbName;
    const isMainDb = currentDbName === (process.env.DB_NAME || 'fintranzact_main');
    const { Op } = Sequelize;
    
    if (isMainDb) {
      // Remove test subscriptions
      await queryInterface.bulkDelete('subscriptions', {
        notes: 'Development test subscription'
      }, {});
      
      // Remove subscription plans
      await queryInterface.bulkDelete('subscription_plans', null, {});
      
      // Remove admin users
      await queryInterface.bulkDelete('users', {
        email: {
          [Op.in]: ['rishi@fintranzact.com']
        }
      }, {});
    }
    
    if (isMasterDb) {
      // Remove system tenant
      try {
        await queryInterface.sequelize.query(
          `DELETE FROM tenant_master WHERE subdomain = 'system'`
        );
      } catch (error) {
        // Ignore if table doesn't exist
      }
    }

    // Note: Master seeds (account groups, voucher types, etc.) are not deleted in down migration
    // as they are shared reference data that should persist
  },
};
