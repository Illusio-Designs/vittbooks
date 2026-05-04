const { Op, Sequelize } = require('sequelize');
const logger = require('../utils/logger');
const reportService = require('../services/reportService');

function toNum(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function openingSigned(ledger) {
  const amt = toNum(ledger?.opening_balance, 0);
  return ledger?.opening_balance_type === 'Cr' ? -amt : amt;
}

async function loadGroupMap(masterModels, ledgers) {
  const groupIds = [...new Set((ledgers || []).map((l) => l.account_group_id).filter(Boolean))];
  const groups = groupIds.length > 0 ? await masterModels.AccountGroup.findAll({ where: { id: groupIds } }) : [];
  return new Map(groups.map((g) => [g.id, g]));
}

async function movementByLedger(tenantModels, { fromDate, toDate, asOnDate, beforeDate } = {}) {
  const voucherWhere = { status: 'posted' };
  if (beforeDate) {
    voucherWhere.voucher_date = { [Op.lt]: beforeDate };
  } else if (asOnDate) {
    voucherWhere.voucher_date = { [Op.lte]: asOnDate };
  } else if (fromDate && toDate) {
    // Use DATE() function to compare only the date part, ignoring time
    voucherWhere[Op.and] = [
      Sequelize.where(Sequelize.fn('DATE', Sequelize.col('voucher.voucher_date')), '>=', fromDate),
      Sequelize.where(Sequelize.fn('DATE', Sequelize.col('voucher.voucher_date')), '<=', toDate)
    ];
  } else if (fromDate) {
    voucherWhere[Op.and] = [
      Sequelize.where(Sequelize.fn('DATE', Sequelize.col('voucher.voucher_date')), '>=', fromDate)
    ];
  } else if (toDate) {
    voucherWhere[Op.and] = [
      Sequelize.where(Sequelize.fn('DATE', Sequelize.col('voucher.voucher_date')), '<=', toDate)
    ];
  }

  // When using includes, Sequelize.col() needs the model name prefix with attribute name
  // The model has debit_amount and credit_amount columns
  const rows = await tenantModels.VoucherLedgerEntry.findAll({
    attributes: [
      'ledger_id',
      [Sequelize.fn('SUM', Sequelize.col('VoucherLedgerEntry.debit_amount')), 'total_debit'],
      [Sequelize.fn('SUM', Sequelize.col('VoucherLedgerEntry.credit_amount')), 'total_credit'],
    ],
    include: [{ model: tenantModels.Voucher, as: 'voucher', attributes: [], where: voucherWhere, required: true }],
    group: ['ledger_id'],
    raw: true,
  });

  const map = new Map();
  for (const r of rows) {
    map.set(r.ledger_id, {
      debit: toNum(r.total_debit, 0),
      credit: toNum(r.total_credit, 0),
    });
  }
  return map;
}

module.exports = {
  async getTrialBalance(req, res, next) {
      try {
        const { as_on_date, from_date } = req.query;
        const asOn = as_on_date || null;
        const from = from_date || null;
        const to = new Date().toISOString().slice(0, 10);

        console.log(`\n📊 === GENERATING TRIAL BALANCE ===`);
        console.log(`📅 As on: ${asOn || to}`);
        console.log(`🏢 Tenant: ${req.tenant_id}`);

        // Use report service for trial balance generation
        const trialBalanceData = await reportService.generateTrialBalanceReport(
          req.tenantModels,
          req.masterModels,
          {
            asOnDate: asOn,
            fromDate: !asOn && from ? from : null,
            toDate: !asOn && from ? to : null
          }
        );

        console.log(`✅ Trial Balance generated successfully`);
        console.log(`📊 Total Debit: ₹${trialBalanceData.totals.total_debit.toFixed(2)}`);
        console.log(`📊 Total Credit: ₹${trialBalanceData.totals.total_credit.toFixed(2)}`);
        console.log(`${trialBalanceData.totals.is_balanced ? '✓' : '✗'} Balanced: ${trialBalanceData.totals.is_balanced}`);

        res.json(trialBalanceData);

      } catch (err) {
        logger.error('Trial Balance generation error:', err);
        next(err);
      }
    }
,

  async getProfitLoss(req, res, next) {
      try {
        const { from_date, to_date } = req.query;
        const from = from_date || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
        const to = to_date || new Date().toISOString().slice(0, 10);

        console.log(`\n📊 === GENERATING PROFIT & LOSS ===`);
        console.log(`📅 Period: ${from} to ${to}`);
        console.log(`🏢 Tenant: ${req.tenant_id}`);

        // Use report service for P&L generation
        const profitLossData = await reportService.generateProfitLossReport(
          req.tenantModels,
          req.masterModels,
          { 
            startDate: from, 
            endDate: to 
          }
        );

        console.log(`✅ Profit & Loss generated successfully`);
        console.log(`📊 Net Profit/Loss: ₹${profitLossData.netProfit.amount.toFixed(2)}`);
        console.log(`📊 Gross Profit: ₹${profitLossData.grossProfit.amount.toFixed(2)}`);

        res.json(profitLossData);

      } catch (err) {
        logger.error('Profit & Loss generation error:', err);
        next(err);
      }
    }
,

  async getBalanceSheet(req, res, next) {
      try {
        const { as_on_date } = req.query;
        const asOn = as_on_date || new Date().toISOString().slice(0, 10);

        console.log(`\n🏛️ === GENERATING BALANCE SHEET ===`);
        console.log(`📅 As on: ${asOn}`);
        console.log(`🏢 Tenant: ${req.tenant_id}`);

        // Use report service for balance sheet generation
        const balanceSheetData = await reportService.generateBalanceSheetReport(
          req.tenantModels,
          req.masterModels,
          { asOnDate: asOn }
        );

        console.log(`✅ Balance Sheet generated successfully`);
        console.log(`📊 Total Assets: ₹${balanceSheetData.assets.total.toFixed(2)}`);
        console.log(`📊 Total Liabilities: ₹${balanceSheetData.liabilities_and_equity.total.toFixed(2)}`);
        console.log(`${balanceSheetData.balance_check.is_balanced ? '✓' : '✗'} Balanced: ${balanceSheetData.balance_check.is_balanced}`);

        res.json(balanceSheetData);

      } catch (err) {
        logger.error('Balance Sheet generation error:', err);
        next(err);
      }
    }
,

  async getLedgerStatement(req, res, next) {
    try {
      const { ledger_id, from_date, to_date } = req.query;
      
      if (!ledger_id) {
        return res.status(400).json({ message: 'ledger_id is required' });
      }

      // Default date range: current financial year to today
      const fromDate = from_date || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      const toDate = to_date || new Date().toISOString().slice(0, 10);

      // Call report service to generate ledger statement
      const result = await reportService.generateLedgerStatementReport(
        req.tenantModels,
        req.masterModels,
        {
          ledgerId: ledger_id,
          fromDate,
          toDate,
          tenant_id: req.tenant_id,
          company_id: req.company_id,
        }
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getStockSummary(req, res, next) {
    try {
      const items = await req.tenantModels.InventoryItem.findAll({
        where: { is_active: true },
        order: [['item_name', 'ASC']],
      });

      const data = items.map((i) => {
        const qty = toNum(i.quantity_on_hand, 0);
        const avg = toNum(i.avg_cost, 0);
        return {
          item_key: i.item_key,
          item_code: i.item_code,
          item_name: i.item_name,
          hsn_sac_code: i.hsn_sac_code,
          uqc: i.uqc,
          gst_rate: i.gst_rate,
          quantity_on_hand: qty,
          avg_cost: avg,
          stock_value: parseFloat((qty * avg).toFixed(2)),
        };
      });

      const totalValue = data.reduce((s, r) => s + toNum(r.stock_value, 0), 0);
      res.json({ data, totals: { stock_value: parseFloat(totalValue.toFixed(2)) } });
    } catch (err) {
      next(err);
    }
  },

  async getStockLedger(req, res, next) {
    try {
      const { item_key, from_date, to_date } = req.query;
      const where = {};

      if (from_date && to_date) where.createdAt = { [Op.between]: [new Date(from_date), new Date(to_date)] };
      else if (from_date) where.createdAt = { [Op.gte]: new Date(from_date) };
      else if (to_date) where.createdAt = { [Op.lte]: new Date(to_date) };

      const include = [{ model: req.tenantModels.InventoryItem }];
      if (item_key) include[0].where = { item_key: String(item_key).toLowerCase() };

      const rows = await req.tenantModels.StockMovement.findAll({
        where,
        include,
        order: [['createdAt', 'ASC']],
      });

      const data = rows.map((r) => ({
        date: r.createdAt,
        item_key: r.inventory_item?.item_key,
        item_name: r.inventory_item?.item_name,
        movement_type: r.movement_type,
        quantity: toNum(r.quantity, 0),
        rate: toNum(r.rate, 0),
        amount: toNum(r.amount, 0),
        voucher_id: r.voucher_id,
        narration: r.narration,
      }));

      res.json({ data, period: { from_date: from_date || null, to_date: to_date || null } });
    } catch (err) {
      next(err);
    }
  },

  async getReceivables(req, res, next) {
    try {
      const { as_on_date, include_zero_balance } = req.query;
      const asOn = as_on_date || new Date().toISOString().slice(0, 10);
      const includeZero = include_zero_balance === 'true';

      console.log(`\n💰 === GENERATING RECEIVABLES REPORT ===`);
      console.log(`📅 As on: ${asOn}`);
      console.log(`🏢 Tenant: ${req.tenant_id}`);

      const receivablesData = await reportService.generateReceivablesReport(
        req.tenantModels,
        req.masterModels,
        { 
          asOnDate: asOn,
          includeZeroBalance: includeZero
        }
      );

      console.log(`✅ Receivables Report generated successfully`);
      console.log(`📊 Total Customers: ${receivablesData.summary.total_customers}`);
      console.log(`📊 Total Receivable: ₹${receivablesData.summary.total_receivable.toFixed(2)}`);

      res.json(receivablesData);
    } catch (err) {
      logger.error('Receivables Report generation error:', err);
      next(err);
    }
  },

  async getPayables(req, res, next) {
    try {
      const { as_on_date, include_zero_balance } = req.query;
      const asOn = as_on_date || new Date().toISOString().slice(0, 10);
      const includeZero = include_zero_balance === 'true';

      console.log(`\n💸 === GENERATING PAYABLES REPORT ===`);
      console.log(`📅 As on: ${asOn}`);
      console.log(`🏢 Tenant: ${req.tenant_id}`);

      const payablesData = await reportService.generatePayablesReport(
        req.tenantModels,
        req.masterModels,
        { 
          asOnDate: asOn,
          includeZeroBalance: includeZero
        }
      );

      console.log(`✅ Payables Report generated successfully`);
      console.log(`📊 Total Suppliers: ${payablesData.summary.total_suppliers}`);
      console.log(`📊 Total Payable: ₹${payablesData.summary.total_payable.toFixed(2)}`);

      res.json(payablesData);
    } catch (err) {
      logger.error('Payables Report generation error:', err);
      next(err);
    }
  },
};
