const logger = require('../utils/logger');
const { Sequelize, Op } = require('sequelize');

/**
 * Report Service
 * Handles generation of financial reports (P&L, Balance Sheet, Trial Balance, etc.)
 * Uses enhanced account group metadata (nature, bs_category, affects_pl, is_tax_group)
 */

// Helper function to safely parse numbers
function toNum(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Generate Profit & Loss Report
 * @param {Object} tenantModels - Tenant database models
 * @param {Object} masterModels - Master database models
 * @param {Object} options - Report options (startDate, endDate, etc.)
 * @returns {Object} - P&L report data
 */
async function generateProfitLossReport(tenantModels, masterModels, options = {}) {
  try {
    const { startDate, endDate } = options;
    
    logger.info(`Generating P&L Report for period: ${startDate} to ${endDate}`);
    
    // Get all account groups with new metadata
    const accountGroups = await masterModels.AccountGroup.findAll();
    
    // Create a map of group_id to group
    const groupMap = new Map();
    accountGroups.forEach(g => groupMap.set(g.id, g));
    
    // Get all active ledgers
    const ledgers = await tenantModels.Ledger.findAll({ 
      where: { is_active: true }
    });
    
    // Build voucher where clause for date range
    const voucherWhere = { status: 'posted' };
    if (startDate && endDate) {
      // Ensure we include the entire end date by adding time
      const endDateTime = endDate + ' 23:59:59';
      voucherWhere.voucher_date = { [Op.between]: [startDate, endDateTime] };
      logger.debug(`Date range: ${startDate} to ${endDateTime}`);
    }
    
    // STEP 1: Get posted voucher IDs for the period
    const postedVouchers = await tenantModels.Voucher.findAll({
      where: voucherWhere,
      attributes: ['id', 'voucher_date', 'voucher_number'],
      raw: true
    });
    
    const voucherIds = postedVouchers.map(v => v.id);
    
    if (postedVouchers.length > 0) {
      logger.info(`Found ${postedVouchers.length} posted vouchers in period`);
      logger.debug(`First voucher: ${postedVouchers[0].voucher_number} on ${postedVouchers[0].voucher_date}`);
    } else {
      logger.warn(`No posted vouchers found for period ${startDate} to ${endDate}`);
    }
    
    // STEP 2: Get ledger movements for these vouchers
    let ledgerEntries = [];
    if (voucherIds.length > 0) {
      ledgerEntries = await tenantModels.VoucherLedgerEntry.findAll({
        attributes: [
          'ledger_id',
          [Sequelize.fn('SUM', Sequelize.col('debit_amount')), 'total_debit'],
          [Sequelize.fn('SUM', Sequelize.col('credit_amount')), 'total_credit'],
        ],
        where: {
          voucher_id: { [Op.in]: voucherIds }
        },
        group: ['ledger_id'],
        raw: true,
      });
    }
    
    // Create movement map
    const moveMap = new Map();
    ledgerEntries.forEach(entry => {
      moveMap.set(entry.ledger_id, {
        debit: toNum(entry.total_debit, 0),
        credit: toNum(entry.total_credit, 0)
      });
    });
    
    // Get stock information (INV group)
    const stockLedgers = ledgers.filter(l => {
      const group = groupMap.get(l.account_group_id);
      return group && group.group_code === 'INV';
    });
    
    let openingStock = 0;
    let closingStock = 0;
    
    // Calculate stock values from ledger balances
    stockLedgers.forEach(ledger => {
      openingStock += toNum(ledger.opening_balance, 0);
      closingStock += toNum(ledger.current_balance, 0);
    });
    
    // Initialize totals for Trading Account (Direct Expenses = COGS in Perpetual System)
    let totalSales = 0;
    let totalSalesReturns = 0;
    let totalDirectExpenses = 0; // This includes COGS ledger
    let totalDirectIncomes = 0;
    
    // Initialize totals for P&L Account
    let totalIndirectExpenses = 0;
    let totalIndirectIncomes = 0;
    
    // Process each ledger - USE affects_pl flag (PERPETUAL SYSTEM - NO PURCHASE ACCOUNT)
    ledgers.forEach(ledger => {
      const group = groupMap.get(ledger.account_group_id);
      if (!group || !group.affects_pl) return;
      
      const move = moveMap.get(ledger.id) || { debit: 0, credit: 0 };
      const movementSigned = move.debit - move.credit;
      
      // INCOME ACCOUNTS
      if (group.nature === 'income') {
        const amt = -movementSigned; // income increases on credit
        if (amt <= 0.009) return;
        
        // Check if this affects gross profit (Trading Account)
        if (group.affects_gross_profit) {
          // Sales
          if (['SAL', 'SALES'].includes(group.group_code)) {
            totalSales += amt;
          }
          // Sales Returns
          else if (['SAL_RET', 'SALES_RETURNS'].includes(group.group_code)) {
            totalSalesReturns += amt;
          }
          // Direct Income
          else {
            totalDirectIncomes += amt;
          }
        } else {
          // Indirect Income (P&L Account)
          totalIndirectIncomes += amt;
        }
      }
      // EXPENSE ACCOUNTS
      else if (group.nature === 'expense') {
        const amt = movementSigned; // expense increases on debit
        if (amt <= 0.009) return;
        
        // Check if this affects gross profit (Trading Account)
        if (group.affects_gross_profit) {
          // Direct Expenses (includes COGS in Perpetual System)
          // NOTE: In Perpetual System, Purchase account is NOT used
          // COGS is posted directly when goods are sold
          totalDirectExpenses += amt;
        } else {
          // Indirect Expenses (P&L Account)
          totalIndirectExpenses += amt;
        }
      }
    });
    
    // Calculate P&L components using PERPETUAL SYSTEM
    const netSales = totalSales - totalSalesReturns;
    
    // In Perpetual System: COGS comes directly from COGS ledger (Direct Expenses)
    // NO formula needed: Opening + Purchase - Closing
    const cogs = totalDirectExpenses;
    
    // Gross Profit = Net Sales + Direct Income - COGS
    const grossProfit = netSales + totalDirectIncomes - cogs;
    
    // Net Profit = Gross Profit + Indirect Income - Indirect Expenses
    const netProfit = grossProfit + totalIndirectIncomes - totalIndirectExpenses;
    
    // Calculate margins
    const grossProfitMargin = netSales > 0 ? (grossProfit / netSales * 100) : 0;
    const netProfitMargin = netSales > 0 ? (netProfit / netSales * 100) : 0;
    const cogsPercentage = netSales > 0 ? (cogs / netSales * 100) : 0;
    
    // PERPETUAL SYSTEM: Totals for Tally-style format
    // Left side (Debit): COGS + Indirect Expenses + Net Profit (if profit)
    const totalLeftSide = cogs + totalIndirectExpenses + (netProfit > 0 ? netProfit : 0);
    
    // Right side (Credit): Sales + Direct Income + Indirect Income + Net Loss (if loss)
    const totalRightSide = netSales + totalDirectIncomes + totalIndirectIncomes + (netProfit < 0 ? Math.abs(netProfit) : 0);
    
    return {
      period: {
        from: startDate,
        to: endDate
      },
      trading_account: {
        opening_stock: {
          amount: openingStock,
          description: 'Stock at the beginning of period (for reference only)'
        },
        purchases: {
          gross_purchases: 0,
          purchase_returns: 0,
          net_purchases: 0,
          note: 'Perpetual System: Purchase account not used, stock updated directly'
        },
        direct_expenses: {
          total: totalDirectExpenses,
          description: 'COGS (Cost of Goods Sold) - Posted automatically on sales'
        },
        direct_incomes: {
          total: totalDirectIncomes,
          description: 'Direct income related to trading operations'
        },
        closing_stock: {
          amount: closingStock,
          description: 'Current stock balance (Balance Sheet item, not P&L)'
        },
        cost_of_goods_sold: {
          amount: cogs,
          formula: 'COGS Ledger Balance (Perpetual System)'
        },
        gross_profit: {
          amount: grossProfit,
          formula: 'Net Sales + Direct Income - COGS'
        }
      },
      sales_revenue: {
        gross_sales: totalSales,
        sales_returns: totalSalesReturns,
        net_sales: netSales
      },
      profit_loss_account: {
        gross_profit_brought_forward: grossProfit,
        indirect_incomes: {
          total: totalIndirectIncomes,
          description: 'Other income sources not related to core operations'
        },
        indirect_expenses: {
          total: totalIndirectExpenses,
          description: 'Operating and administrative expenses'
        },
        net_profit: {
          amount: netProfit,
          type: netProfit >= 0 ? 'profit' : 'loss'
        }
      },
      totals: {
        gross_profit: grossProfit,
        net_profit: netProfit,
        gross_profit_margin: grossProfitMargin,
        net_profit_margin: netProfitMargin,
        total_left_side: totalLeftSide,
        total_right_side: totalRightSide,
        is_balanced: Math.abs(totalLeftSide - totalRightSide) < 1.0
      },
      // Backward compatibility structure (PERPETUAL SYSTEM)
      revenue: {
        sales: netSales,
        direct_income: totalDirectIncomes,
        total: netSales + totalDirectIncomes
      },
      costOfGoodsSold: {
        openingStock,
        purchases: 0, // Not used in Perpetual System
        directExpenses: totalDirectExpenses,
        goodsAvailable: 0, // Not applicable in Perpetual System
        closingStock,
        total: cogs,
        note: 'Perpetual System: COGS from ledger balance, not calculated from formula'
      },
      grossProfit: {
        amount: grossProfit,
        margin: grossProfitMargin
      },
      expenses: {
        indirect: totalIndirectExpenses,
        total: totalIndirectExpenses
      },
      otherIncomes: {
        indirect: totalIndirectIncomes,
        total: totalIndirectIncomes
      },
      netProfit: {
        amount: netProfit,
        margin: netProfitMargin
      },
      metrics: {
        grossProfitMargin,
        netProfitMargin,
        cogsPercentage
      }
    };
  } catch (error) {
    logger.error('Error generating P&L report:', error);
    throw error;
  }
}

/**
 * Generate Balance Sheet Report
 * @param {Object} tenantModels - Tenant database models
 * @param {Object} masterModels - Master database models
 * @param {Object} options - Report options (asOnDate, etc.)
 * @returns {Object} - Balance sheet data
 */
async function generateBalanceSheetReport(tenantModels, masterModels, options = {}) {
  try {
    const { asOnDate } = options;
    const asOn = asOnDate || new Date().toISOString().slice(0, 10);
    
    logger.info(`Generating Balance Sheet as on: ${asOn}`);
    
    // Get all account groups with new metadata
    const accountGroups = await masterModels.AccountGroup.findAll();
    const groupMap = new Map();
    accountGroups.forEach(g => groupMap.set(g.id, g));
    
    // Get all active ledgers
    const ledgers = await tenantModels.Ledger.findAll({ 
      where: { is_active: true }
    });
    
    // Calculate P&L for the financial year (to add to equity)
    // Financial year start: April 1st of current or previous year
    const asOnYear = new Date(asOn).getFullYear();
    const asOnMonth = new Date(asOn).getMonth(); // 0-11
    const financialYearStart = asOnMonth >= 3 ? // April (3) or later
      `${asOnYear}-04-01` : 
      `${asOnYear - 1}-04-01`;
    
    const plReport = await generateProfitLossReport(tenantModels, masterModels, {
      startDate: financialYearStart,
      endDate: asOn
    });
    
    const netProfitLoss = plReport.netProfit.amount;
    
    logger.info(`Financial Year: ${financialYearStart} to ${asOn}, Net Profit: ₹${netProfitLoss.toFixed(2)}`);
    
    // Categorize assets and liabilities using bs_category
    const assets = {
      fixed_assets: [],
      current_assets: [],
      investments: [],
      other_assets: []
    };
    
    const liabilities = {
      capital: [],
      reserves: [],
      current_liabilities: [],
      noncurrent_liabilities: [],
      other_liabilities: []
    };
    
    let totalAssets = 0;
    let totalLiabilities = netProfitLoss; // Start with P&L

    ledgers.forEach(ledger => {
      const group = groupMap.get(ledger.account_group_id);
      if (!group) return;

      // Skip P&L accounts (they don't appear in Balance Sheet)
      if (group.affects_pl) return;

      const rawBalance = toNum(ledger.current_balance, 0);
      const balanceType = (ledger.balance_type || 'debit').toLowerCase();
      
      let signedBalance = 0;
      
      // Special handling for tax groups - they can be either asset or liability
      if (group.is_tax_group) {
        // Tax ledgers with debit balance are assets (tax credit receivable)
        // Tax ledgers with credit balance are liabilities (tax payable)
        signedBalance = balanceType === 'debit' ? rawBalance : -rawBalance;
        // We'll skip individual tax ledgers and calculate net GST later
        // So don't add them to any category here
        return;
      }
      // Determine signed balance based on group nature
      else if (group.nature === 'asset') {
        signedBalance = balanceType === 'debit' ? rawBalance : -rawBalance;
      } else if (group.nature === 'liability' || group.nature === 'equity') {
        signedBalance = balanceType === 'credit' ? rawBalance : -rawBalance;
      } else {
        return; // Skip if nature is not recognized
      }
      
      if (Math.abs(signedBalance) < 0.01) return;

      const ledgerInfo = {
        name: ledger.ledger_name,
        code: ledger.ledger_code,
        balance: signedBalance,
        balance_type: balanceType,
        group: group.name,
        bs_category: group.bs_category
      };

      // ASSETS - Use bs_category
      if (group.nature === 'asset') {
        // Check if this is a GST/TDS ledger that should be netted
        const ledgerIdentifier = (ledger.ledger_code || ledger.ledger_name || '').toUpperCase();
        const isGSTorTDS = ledgerIdentifier.includes('GST') || ledgerIdentifier.includes('TDS');
        
        if (!isGSTorTDS) {
          totalAssets += signedBalance;
        }

        if (group.bs_category === 'fixed_asset' && !isGSTorTDS) {
          assets.fixed_assets.push(ledgerInfo);
        } else if (group.bs_category === 'current_asset' && !isGSTorTDS) {
          assets.current_assets.push(ledgerInfo);
        } else if (group.bs_category === 'investment' && !isGSTorTDS) {
          assets.investments.push(ledgerInfo);
        } else if (!isGSTorTDS) {
          assets.other_assets.push(ledgerInfo);
        }
      }
      // LIABILITIES & EQUITY - Use bs_category and is_tax_group
      else if (group.nature === 'liability' || group.nature === 'equity') {
        // Skip tax groups here - we'll handle them separately for netting
        if (!group.is_tax_group) {
          totalLiabilities += signedBalance;
        }

        if (group.nature === 'equity' || group.bs_category === 'equity') {
          // Capital and Reserves
          if (group.group_code === 'CAP') {
            liabilities.capital.push(ledgerInfo);
          } else {
            liabilities.reserves.push(ledgerInfo);
          }
        } else if (group.bs_category === 'current_liability' && !group.is_tax_group) {
          liabilities.current_liabilities.push(ledgerInfo);
        } else if (group.bs_category === 'noncurrent_liability' && !group.is_tax_group) {
          liabilities.noncurrent_liabilities.push(ledgerInfo);
        } else if (group.is_tax_group) {
          // GST/Tax ledgers - DO NOT add individually
          // We'll calculate Net GST Payable and TDS separately
          // Skip adding to any category here
        } else if (!group.is_tax_group) {
          liabilities.other_liabilities.push(ledgerInfo);
        }
      }
    });

    // Calculate Net GST Payable (Output GST - Input GST)
    let totalInputGST = 0;
    let totalOutputGST = 0;
    let totalTDSPayable = 0;
    let totalTDSReceivable = 0;
    const gstDetails = {
      input: [],
      output: []
    };
    const tdsDetails = {
      payable: [],
      receivable: []
    };

    ledgers.forEach(ledger => {
      const group = groupMap.get(ledger.account_group_id);
      if (!group) return;

      const rawBalance = toNum(ledger.current_balance, 0);
      const balanceType = (ledger.balance_type || 'debit').toLowerCase();
      
      // Determine if it's Input or Output GST based on ledger code or name
      const ledgerIdentifier = (ledger.ledger_code || ledger.ledger_name || '').toUpperCase();
      const isInputGST = ledgerIdentifier.includes('INPUT') && ledgerIdentifier.includes('GST');
      const isOutputGST = ledgerIdentifier.includes('OUTPUT') && ledgerIdentifier.includes('GST');
      const isTDSPayable = ledgerIdentifier.includes('TDS') && ledgerIdentifier.includes('PAYABLE');
      const isTDSReceivable = ledgerIdentifier.includes('TDS') && ledgerIdentifier.includes('RECEIVABLE');
      
      // Skip if not a GST/TDS ledger
      if (!isInputGST && !isOutputGST && !isTDSPayable && !isTDSReceivable) return;

      if (isInputGST && balanceType === 'debit' && rawBalance > 0) {
        // Input GST with Debit balance (Asset - Tax Credit Available)
        totalInputGST += rawBalance;
        gstDetails.input.push({
          name: ledger.ledger_name,
          code: ledger.ledger_code,
          balance: rawBalance
        });
      } else if (isOutputGST && balanceType === 'credit' && rawBalance > 0) {
        // Output GST with Credit balance (Liability - Tax Collected)
        totalOutputGST += rawBalance;
        gstDetails.output.push({
          name: ledger.ledger_name,
          code: ledger.ledger_code,
          balance: rawBalance
        });
      } else if (isTDSPayable && balanceType === 'credit' && rawBalance > 0) {
        // TDS Payable (Liability - Tax deducted to be paid to govt)
        totalTDSPayable += rawBalance;
        tdsDetails.payable.push({
          name: ledger.ledger_name,
          code: ledger.ledger_code,
          balance: rawBalance
        });
      } else if (isTDSReceivable && balanceType === 'debit' && rawBalance > 0) {
        // TDS Receivable (Asset - Tax deducted by others)
        totalTDSReceivable += rawBalance;
        tdsDetails.receivable.push({
          name: ledger.ledger_name,
          code: ledger.ledger_code,
          balance: rawBalance
        });
      }
    });

    // Net GST Payable = Output GST - Input GST
    const netGSTPayable = totalOutputGST - totalInputGST;
    
    // Add Net GST to appropriate side
    if (Math.abs(netGSTPayable) >= 0.01) {
      if (netGSTPayable > 0) {
        // Net Payable - add to Current Liabilities
        liabilities.current_liabilities.push({
          name: 'Net GST Payable',
          code: 'GST-NET',
          balance: netGSTPayable,
          balance_type: 'credit',
          group: 'Duties & Taxes',
          bs_category: 'current_liability',
          gst_details: {
            output_gst: totalOutputGST,
            input_gst: totalInputGST,
            net: netGSTPayable,
            breakdown: gstDetails
          }
        });
        totalLiabilities += netGSTPayable;
      } else {
        // Net Receivable - add to Current Assets
        assets.current_assets.push({
          name: 'Net GST Receivable',
          code: 'GST-NET',
          balance: Math.abs(netGSTPayable),
          balance_type: 'debit',
          group: 'Duties & Taxes',
          bs_category: 'current_asset',
          gst_details: {
            output_gst: totalOutputGST,
            input_gst: totalInputGST,
            net: netGSTPayable,
            breakdown: gstDetails
          }
        });
        totalAssets += Math.abs(netGSTPayable);
      }
    }

    // Add TDS Payable to Current Liabilities
    if (totalTDSPayable >= 0.01) {
      liabilities.current_liabilities.push({
        name: 'TDS Payable',
        code: 'TDS-PAYABLE',
        balance: totalTDSPayable,
        balance_type: 'credit',
        group: 'Duties & Taxes',
        bs_category: 'current_liability',
        tds_details: {
          total: totalTDSPayable,
          breakdown: tdsDetails.payable
        }
      });
      totalLiabilities += totalTDSPayable;
    }

    // Add TDS Receivable to Current Assets
    if (totalTDSReceivable >= 0.01) {
      assets.current_assets.push({
        name: 'TDS Receivable',
        code: 'TDS-RECEIVABLE',
        balance: totalTDSReceivable,
        balance_type: 'debit',
        group: 'Duties & Taxes',
        bs_category: 'current_asset',
        tds_details: {
          total: totalTDSReceivable,
          breakdown: tdsDetails.receivable
        }
      });
      totalAssets += totalTDSReceivable;
    }

    // Calculate totals
    const fixedAssetsTotal = assets.fixed_assets.reduce((sum, a) => sum + a.balance, 0);
    const currentAssetsTotal = assets.current_assets.reduce((sum, a) => sum + a.balance, 0);
    const investmentsTotal = assets.investments.reduce((sum, a) => sum + a.balance, 0);
    const otherAssetsTotal = assets.other_assets.reduce((sum, a) => sum + a.balance, 0);

    const capitalTotal = liabilities.capital.reduce((sum, l) => sum + l.balance, 0);
    const reservesTotal = liabilities.reserves.reduce((sum, l) => sum + l.balance, 0);
    const currentLiabilitiesTotal = liabilities.current_liabilities.reduce((sum, l) => sum + l.balance, 0);
    const noncurrentLiabilitiesTotal = liabilities.noncurrent_liabilities.reduce((sum, l) => sum + l.balance, 0);
    const otherLiabilitiesTotal = liabilities.other_liabilities.reduce((sum, l) => sum + l.balance, 0);

    const difference = totalAssets - totalLiabilities;
    const isBalanced = Math.abs(difference) < 1.0;
    
    // Validation: Balance Sheet MUST balance
    if (!isBalanced) {
      logger.error(`Balance Sheet NOT BALANCED! Difference: ₹${difference.toFixed(2)}`);
      logger.error(`Total Assets: ₹${totalAssets.toFixed(2)}`);
      logger.error(`Total Liabilities + Equity: ₹${totalLiabilities.toFixed(2)}`);
      // Don't throw error in production, but log it prominently
      // throw new Error(`Balance Sheet does not balance. Difference: ₹${difference.toFixed(2)}`);
    } else {
      logger.info(`✓ Balance Sheet is balanced (difference: ₹${difference.toFixed(2)})`);
    }

    // Key ratios
    const currentRatio = currentLiabilitiesTotal > 0 ? (currentAssetsTotal / currentLiabilitiesTotal) : 0;
    const debtToEquity = (capitalTotal + reservesTotal) > 0 ? (noncurrentLiabilitiesTotal / (capitalTotal + reservesTotal)) : 0;
    const workingCapital = currentAssetsTotal - currentLiabilitiesTotal;

    return {
      liabilities_and_equity: {
        capital: {
          total: capitalTotal,
          accounts: liabilities.capital
        },
        reserves_and_surplus: {
          total: reservesTotal,
          accounts: liabilities.reserves
        },
        profit_and_loss: {
          amount: netProfitLoss,
          type: netProfitLoss >= 0 ? 'profit' : 'loss',
          as_of_date: asOn
        },
        noncurrent_liabilities: {
          total: noncurrentLiabilitiesTotal,
          accounts: liabilities.noncurrent_liabilities
        },
        current_liabilities: {
          total: currentLiabilitiesTotal,
          accounts: liabilities.current_liabilities
        },
        other_liabilities: {
          total: otherLiabilitiesTotal,
          accounts: liabilities.other_liabilities
        },
        total: totalLiabilities
      },
      assets: {
        fixed_assets: {
          total: fixedAssetsTotal,
          accounts: assets.fixed_assets
        },
        investments: {
          total: investmentsTotal,
          accounts: assets.investments
        },
        current_assets: {
          total: currentAssetsTotal,
          accounts: assets.current_assets
        },
        other_assets: {
          total: otherAssetsTotal,
          accounts: assets.other_assets
        },
        total: totalAssets
      },
      balance_check: {
        total_assets: totalAssets,
        total_liabilities_and_equity: totalLiabilities,
        difference: difference,
        is_balanced: isBalanced
      },
      financial_ratios: {
        current_ratio: currentRatio,
        debt_to_equity_ratio: debtToEquity,
        working_capital: workingCapital
      },
      as_on_date: asOn,
      format: "balance_sheet"
    };
  } catch (error) {
    logger.error('Error generating balance sheet:', error);
    throw error;
  }
}

/**
 * Generate Trial Balance Report
 * @param {Object} tenantModels - Tenant database models
 * @param {Object} masterModels - Master database models
 * @param {Object} options - Report options
 * @returns {Object} - Trial balance data
 */
async function generateTrialBalanceReport(tenantModels, masterModels, options = {}) {
  try {
    const { asOnDate } = options;
    const asOn = asOnDate || new Date().toISOString().slice(0, 10);
    
    logger.info(`Generating Trial Balance as on: ${asOn}`);
    
    // Get all account groups
    const accountGroups = await masterModels.AccountGroup.findAll();
    const groupMap = new Map();
    accountGroups.forEach(g => groupMap.set(g.id, g));
    
    // Get all active ledgers
    const ledgers = await tenantModels.Ledger.findAll({
      where: { is_active: true }
    });
    
    // Get movements up to asOnDate
    const voucherWhere = { 
      status: 'posted',
      voucher_date: { [Op.lte]: asOn + ' 23:59:59' }
    };
    
    // STEP 1: Get posted voucher IDs up to the date
    const postedVouchers = await tenantModels.Voucher.findAll({
      where: voucherWhere,
      attributes: ['id'],
      raw: true
    });
    
    const voucherIds = postedVouchers.map(v => v.id);
    
    // STEP 2: Get ledger movements for these vouchers
    let ledgerEntries = [];
    if (voucherIds.length > 0) {
      ledgerEntries = await tenantModels.VoucherLedgerEntry.findAll({
        attributes: [
          'ledger_id',
          [Sequelize.fn('SUM', Sequelize.col('debit_amount')), 'total_debit'],
          [Sequelize.fn('SUM', Sequelize.col('credit_amount')), 'total_credit'],
        ],
        where: {
          voucher_id: { [Op.in]: voucherIds }
        },
        group: ['ledger_id'],
        raw: true,
      });
    }
    
    const moveMap = new Map();
    ledgerEntries.forEach(entry => {
      moveMap.set(entry.ledger_id, {
        debit: toNum(entry.total_debit, 0),
        credit: toNum(entry.total_credit, 0)
      });
    });
    
    const trialBalance = [];
    let totalDebits = 0;
    let totalCredits = 0;
    
    ledgers.forEach(ledger => {
      const group = groupMap.get(ledger.account_group_id);
      const opening = toNum(ledger.opening_balance, 0);
      const move = moveMap.get(ledger.id) || { debit: 0, credit: 0 };
      
      const debitTotal = opening + move.debit;
      const creditTotal = move.credit;
      
      if (debitTotal > 0.01 || creditTotal > 0.01) {
        trialBalance.push({
          ledgerName: ledger.ledger_name,
          ledgerCode: ledger.ledger_code,
          groupName: group?.name || 'Unknown',
          nature: group?.nature || 'unknown',
          debit: debitTotal,
          credit: creditTotal,
          balance: debitTotal - creditTotal
        });
        
        totalDebits += debitTotal;
        totalCredits += creditTotal;
      }
    });
    
    return {
      ledgers: trialBalance,
      totals: {
        debit: totalDebits,
        credit: totalCredits,
        difference: Math.abs(totalDebits - totalCredits),
        isBalanced: Math.abs(totalDebits - totalCredits) < 1.0
      },
      as_on_date: asOn
    };
  } catch (error) {
    logger.error('Error generating trial balance:', error);
    throw error;
  }
}

/**
 * Get detailed voucher analysis for reports
 * @param {Object} tenantModels - Tenant database models
 * @param {String} voucherType - Type of voucher (sales_invoice, purchase_invoice)
 * @returns {Array} - Voucher details
 */
async function getVoucherAnalysis(tenantModels, voucherType) {
  try {
    const vouchers = await tenantModels.Voucher.findAll({
      where: {
        voucher_type: voucherType
      },
      include: [{
        model: tenantModels.VoucherItem,
        as: 'items',
        attributes: ['item_name', 'quantity', 'rate', 'amount', 'cgst_amount', 'sgst_amount', 'igst_amount']
      }],
      order: [['voucher_date', 'DESC']]
    });
    
    return vouchers.map(v => {
      const items = v.items || [];
      const subtotal = items.reduce((sum, item) => sum + toNum(item.amount, 0), 0);
      const tax = items.reduce((sum, item) => 
        sum + toNum(item.cgst_amount, 0) + 
        toNum(item.sgst_amount, 0) + 
        toNum(item.igst_amount, 0), 0
      );
      
      return {
        voucherNumber: v.voucher_number,
        voucherDate: v.voucher_date,
        subtotal,
        tax,
        total: toNum(v.total_amount, 0),
        items: items.map(item => ({
          name: item.item_name,
          quantity: toNum(item.quantity, 0),
          rate: toNum(item.rate, 0),
          amount: toNum(item.amount, 0)
        }))
      };
    });
  } catch (error) {
    logger.error('Error getting voucher analysis:', error);
    throw error;
  }
}

/**
 * Get COGS analysis for sold items
 * @param {Object} tenantModels - Tenant database models
 * @returns {Array} - COGS details
 */
async function getCOGSAnalysis(tenantModels) {
  try {
    const salesVouchers = await tenantModels.Voucher.findAll({
      where: {
        voucher_type: 'sales_invoice'
      },
      include: [{
        model: tenantModels.VoucherItem,
        as: 'items',
        include: [{
          model: tenantModels.InventoryItem,
          as: 'inventoryItem',
          attributes: ['avg_cost', 'purchase_price']
        }]
      }]
    });
    
    const cogsDetails = [];
    
    salesVouchers.forEach(voucher => {
      voucher.items?.forEach(item => {
        if (item.inventoryItem) {
          const cost = toNum(item.inventoryItem.avg_cost || item.inventoryItem.purchase_price, 0);
          const quantity = toNum(item.quantity, 0);
          const cogs = cost * quantity;
          
          cogsDetails.push({
            voucherNumber: voucher.voucher_number,
            itemName: item.item_name,
            quantity,
            costPerUnit: cost,
            totalCOGS: cogs
          });
        }
      });
    });
    
    return cogsDetails;
  } catch (error) {
    logger.error('Error getting COGS analysis:', error);
    throw error;
  }
}

/**
 * Generate Ledger Statement Report
 * @param {Object} tenantModels - Tenant database models
 * @param {Object} masterModels - Master database models
 * @param {Object} options - Report options (ledgerId, fromDate, toDate)
 * @returns {Object} - Ledger statement data
 */
async function generateLedgerStatementReport(tenantModels, masterModels, options = {}) {
  try {
    const { ledgerId, fromDate, toDate, tenant_id, company_id } = options;

    if (!ledgerId) {
      throw new Error('ledger_id is required for ledger statement');
    }

    logger.info(`Generating Ledger Statement for ledger ${ledgerId} from ${fromDate} to ${toDate}`);

    // Tenant-scoped lookup so a caller cannot read another tenant's ledger
    // by guessing its UUID.
    const { findByIdScoped } = require('../utils/scopedQueries');
    const ledger = await findByIdScoped(
      { tenant_id, company_id: company_id || null },
      tenantModels.Ledger,
      ledgerId
    );
    if (!ledger) {
      throw new Error('Ledger not found');
    }
    
    // Determine if this is a debit or credit ledger
    const isDebitLedger = ledger.balance_type === 'debit' || ledger.opening_balance_type === 'Dr';
    const openingBalanceUnsigned = toNum(ledger.opening_balance, 0);
    
    // STEP 1: Calculate opening balance (transactions before fromDate)
    const [beforeMovements] = await tenantModels.sequelize.query(`
      SELECT 
        COALESCE(SUM(vle.debit_amount), 0) as total_debit,
        COALESCE(SUM(vle.credit_amount), 0) as total_credit
      FROM voucher_ledger_entries vle
      JOIN vouchers v ON vle.voucher_id = v.id
      WHERE vle.ledger_id = :ledgerId 
        AND v.status = 'posted'
        AND v.voucher_date < :fromDate
    `, { 
      replacements: { ledgerId, fromDate },
      type: Sequelize.QueryTypes.SELECT
    });
    
    const beforeDebit = toNum(beforeMovements[0]?.total_debit, 0);
    const beforeCredit = toNum(beforeMovements[0]?.total_credit, 0);
    
    // Calculate opening balance
    let openingBalSigned;
    if (isDebitLedger) {
      openingBalSigned = openingBalanceUnsigned + beforeDebit - beforeCredit;
    } else {
      openingBalSigned = -(openingBalanceUnsigned + beforeCredit - beforeDebit);
    }
    
    // STEP 2: Get all transactions in the period
    const entries = await tenantModels.VoucherLedgerEntry.findAll({
      where: { ledger_id: ledgerId },
      include: [
        {
          model: tenantModels.Voucher,
          as: 'voucher',
          where: { 
            status: 'posted',
            voucher_date: {
              [Op.gte]: fromDate,
              [Op.lte]: toDate,
            },
          },
          required: true,
          attributes: ['id', 'voucher_date', 'voucher_number', 'voucher_type', 'narration'],
        },
      ],
      order: [
        [{ model: tenantModels.Voucher, as: 'voucher' }, 'voucher_date', 'ASC'],
        [{ model: tenantModels.Voucher, as: 'voucher' }, 'voucher_number', 'ASC'],
        ['createdAt', 'ASC']
      ],
    });
    
    // STEP 3: Build statement with running balance
    let runningBalance = openingBalSigned;
    const transactions = [];
    let periodTotalDebit = 0;
    let periodTotalCredit = 0;
    
    for (const entry of entries) {
      if (!entry.voucher) continue;
      
      const debit = toNum(entry.debit_amount, 0);
      const credit = toNum(entry.credit_amount, 0);
      
      periodTotalDebit += debit;
      periodTotalCredit += credit;
      
      // Update running balance
      if (isDebitLedger) {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }
      
      transactions.push({
        date: entry.voucher.voucher_date,
        voucher_number: entry.voucher.voucher_number,
        voucher_type: entry.voucher.voucher_type,
        particulars: entry.narration || entry.voucher.narration || entry.voucher.voucher_type,
        debit: debit,
        credit: credit,
        balance: Math.abs(runningBalance),
        balance_type: runningBalance >= 0 ? 'Dr' : 'Cr',
        narration: entry.narration || entry.voucher.narration
      });
    }
    
    // STEP 4: Calculate closing balance
    const closingBalSigned = runningBalance;
    
    return {
      ledger: {
        id: ledger.id,
        ledger_code: ledger.ledger_code,
        ledger_name: ledger.ledger_name,
        ledger_type: isDebitLedger ? 'debit' : 'credit'
      },
      period: {
        from_date: fromDate,
        to_date: toDate
      },
      opening_balance: {
        amount: Math.abs(openingBalSigned),
        type: openingBalSigned >= 0 ? 'Dr' : 'Cr'
      },
      transactions: transactions,
      closing_balance: {
        amount: Math.abs(closingBalSigned),
        type: closingBalSigned >= 0 ? 'Dr' : 'Cr'
      },
      summary: {
        opening_balance: Math.abs(openingBalSigned),
        opening_balance_type: openingBalSigned >= 0 ? 'Dr' : 'Cr',
        total_debit: periodTotalDebit,
        total_credit: periodTotalCredit,
        closing_balance: Math.abs(closingBalSigned),
        closing_balance_type: closingBalSigned >= 0 ? 'Dr' : 'Cr',
        transaction_count: transactions.length
      }
    };
  } catch (error) {
    logger.error('Error generating ledger statement:', error);
    throw error;
  }
}

/**
 * Generate Receivables Report (Accounts Receivable / Sundry Debtors)
 * @param {Object} tenantModels - Tenant database models
 * @param {Object} masterModels - Master database models
 * @param {Object} options - Report options (asOnDate, includeZeroBalance)
 * @returns {Object} - Receivables report data
 */
async function generateReceivablesReport(tenantModels, masterModels, options = {}) {
  try {
    const { asOnDate, includeZeroBalance = false } = options;
    const asOn = asOnDate || new Date().toISOString().slice(0, 10);
    
    logger.info(`Generating Receivables Report as on: ${asOn}`);
    
    // Get all account groups
    const accountGroups = await masterModels.AccountGroup.findAll();
    const groupMap = new Map();
    accountGroups.forEach(g => groupMap.set(g.id, g));
    
    // Find Sundry Debtors group (customers/receivables)
    const debtorsGroup = accountGroups.find(g => 
      g.group_code === 'SDEB' || g.name.toLowerCase().includes('sundry debtor') || 
      g.name.toLowerCase().includes('accounts receivable')
    );
    
    if (!debtorsGroup) {
      throw new Error('Sundry Debtors account group not found');
    }
    
    // Get all active ledgers under Sundry Debtors
    const debtorLedgers = await tenantModels.Ledger.findAll({
      where: { 
        account_group_id: debtorsGroup.id,
        is_active: true
      }
    });
    
    // Get movements up to asOnDate for each ledger
    const voucherWhere = { 
      status: 'posted',
      voucher_date: { [Op.lte]: asOn + ' 23:59:59' }
    };
    
    const postedVouchers = await tenantModels.Voucher.findAll({
      where: voucherWhere,
      attributes: ['id'],
      raw: true
    });
    
    const voucherIds = postedVouchers.map(v => v.id);
    
    let ledgerEntries = [];
    if (voucherIds.length > 0) {
      ledgerEntries = await tenantModels.VoucherLedgerEntry.findAll({
        attributes: [
          'ledger_id',
          [Sequelize.fn('SUM', Sequelize.col('debit_amount')), 'total_debit'],
          [Sequelize.fn('SUM', Sequelize.col('credit_amount')), 'total_credit'],
        ],
        where: {
          voucher_id: { [Op.in]: voucherIds },
          ledger_id: { [Op.in]: debtorLedgers.map(l => l.id) }
        },
        group: ['ledger_id'],
        raw: true,
      });
    }
    
    const moveMap = new Map();
    ledgerEntries.forEach(entry => {
      moveMap.set(entry.ledger_id, {
        debit: toNum(entry.total_debit, 0),
        credit: toNum(entry.total_credit, 0)
      });
    });
    
    const receivables = [];
    let totalReceivable = 0;
    
    debtorLedgers.forEach(ledger => {
      const opening = toNum(ledger.opening_balance, 0);
      const move = moveMap.get(ledger.id) || { debit: 0, credit: 0 };
      
      // Receivables are debit balances (customers owe us)
      const balance = opening + move.debit - move.credit;
      
      if (balance > 0.01 || (includeZeroBalance && Math.abs(balance) < 0.01)) {
        receivables.push({
          ledger_id: ledger.id,
          ledger_code: ledger.ledger_code,
          ledger_name: ledger.ledger_name,
          opening_balance: opening,
          debit: move.debit,
          credit: move.credit,
          closing_balance: balance,
          contact_person: ledger.contact_person,
          phone: ledger.phone,
          email: ledger.email,
          address: ledger.address
        });
        
        totalReceivable += balance;
      }
    });
    
    // Sort by balance descending
    receivables.sort((a, b) => b.closing_balance - a.closing_balance);
    
    return {
      report_type: 'receivables',
      as_on_date: asOn,
      summary: {
        total_customers: receivables.length,
        total_receivable: totalReceivable,
        average_receivable: receivables.length > 0 ? totalReceivable / receivables.length : 0
      },
      receivables: receivables,
      aging_analysis: calculateAgingAnalysis(receivables, 'receivable')
    };
  } catch (error) {
    logger.error('Error generating receivables report:', error);
    throw error;
  }
}

/**
 * Generate Payables Report (Accounts Payable / Sundry Creditors)
 * @param {Object} tenantModels - Tenant database models
 * @param {Object} masterModels - Master database models
 * @param {Object} options - Report options (asOnDate, includeZeroBalance)
 * @returns {Object} - Payables report data
 */
async function generatePayablesReport(tenantModels, masterModels, options = {}) {
  try {
    const { asOnDate, includeZeroBalance = false } = options;
    const asOn = asOnDate || new Date().toISOString().slice(0, 10);
    
    logger.info(`Generating Payables Report as on: ${asOn}`);
    
    // Get all account groups
    const accountGroups = await masterModels.AccountGroup.findAll();
    const groupMap = new Map();
    accountGroups.forEach(g => groupMap.set(g.id, g));
    
    // Find Sundry Creditors group (suppliers/payables)
    const creditorsGroup = accountGroups.find(g => 
      g.group_code === 'SCRE' || g.name.toLowerCase().includes('sundry creditor') || 
      g.name.toLowerCase().includes('accounts payable')
    );
    
    if (!creditorsGroup) {
      throw new Error('Sundry Creditors account group not found');
    }
    
    // Get all active ledgers under Sundry Creditors
    const creditorLedgers = await tenantModels.Ledger.findAll({
      where: { 
        account_group_id: creditorsGroup.id,
        is_active: true
      }
    });
    
    // Get movements up to asOnDate for each ledger
    const voucherWhere = { 
      status: 'posted',
      voucher_date: { [Op.lte]: asOn + ' 23:59:59' }
    };
    
    const postedVouchers = await tenantModels.Voucher.findAll({
      where: voucherWhere,
      attributes: ['id'],
      raw: true
    });
    
    const voucherIds = postedVouchers.map(v => v.id);
    
    let ledgerEntries = [];
    if (voucherIds.length > 0) {
      ledgerEntries = await tenantModels.VoucherLedgerEntry.findAll({
        attributes: [
          'ledger_id',
          [Sequelize.fn('SUM', Sequelize.col('debit_amount')), 'total_debit'],
          [Sequelize.fn('SUM', Sequelize.col('credit_amount')), 'total_credit'],
        ],
        where: {
          voucher_id: { [Op.in]: voucherIds },
          ledger_id: { [Op.in]: creditorLedgers.map(l => l.id) }
        },
        group: ['ledger_id'],
        raw: true,
      });
    }
    
    const moveMap = new Map();
    ledgerEntries.forEach(entry => {
      moveMap.set(entry.ledger_id, {
        debit: toNum(entry.total_debit, 0),
        credit: toNum(entry.total_credit, 0)
      });
    });
    
    const payables = [];
    let totalPayable = 0;
    
    creditorLedgers.forEach(ledger => {
      const opening = toNum(ledger.opening_balance, 0);
      const move = moveMap.get(ledger.id) || { debit: 0, credit: 0 };
      
      // Payables are credit balances (we owe suppliers)
      const balance = opening + move.credit - move.debit;
      
      if (balance > 0.01 || (includeZeroBalance && Math.abs(balance) < 0.01)) {
        payables.push({
          ledger_id: ledger.id,
          ledger_code: ledger.ledger_code,
          ledger_name: ledger.ledger_name,
          opening_balance: opening,
          debit: move.debit,
          credit: move.credit,
          closing_balance: balance,
          contact_person: ledger.contact_person,
          phone: ledger.phone,
          email: ledger.email,
          address: ledger.address
        });
        
        totalPayable += balance;
      }
    });
    
    // Sort by balance descending
    payables.sort((a, b) => b.closing_balance - a.closing_balance);
    
    return {
      report_type: 'payables',
      as_on_date: asOn,
      summary: {
        total_suppliers: payables.length,
        total_payable: totalPayable,
        average_payable: payables.length > 0 ? totalPayable / payables.length : 0
      },
      payables: payables,
      aging_analysis: calculateAgingAnalysis(payables, 'payable')
    };
  } catch (error) {
    logger.error('Error generating payables report:', error);
    throw error;
  }
}

/**
 * Helper function to calculate aging analysis
 * @param {Array} items - Receivables or payables items
 * @param {String} type - 'receivable' or 'payable'
 * @returns {Object} - Aging analysis data
 */
function calculateAgingAnalysis(items, type) {
  // Simple aging buckets: 0-30, 31-60, 61-90, 90+ days
  const aging = {
    current: { count: 0, amount: 0 },        // 0-30 days
    days_31_60: { count: 0, amount: 0 },     // 31-60 days
    days_61_90: { count: 0, amount: 0 },     // 61-90 days
    over_90: { count: 0, amount: 0 }         // 90+ days
  };
  
  // Note: For proper aging analysis, we would need invoice dates
  // This is a simplified version that categorizes based on balance amount
  // In a real implementation, you'd query vouchers with due dates
  
  items.forEach(item => {
    const amount = item.closing_balance;
    
    // Simplified categorization (in real app, use actual aging from invoice dates)
    if (amount > 0) {
      // For now, put all in current bucket
      // TODO: Implement proper aging based on invoice/voucher dates
      aging.current.count++;
      aging.current.amount += amount;
    }
  });
  
  return aging;
}

module.exports = {
  generateProfitLossReport,
  generateBalanceSheetReport,
  generateTrialBalanceReport,
  generateLedgerStatementReport,
  generateReceivablesReport,
  generatePayablesReport,
  getVoucherAnalysis,
  getCOGSAnalysis
};
