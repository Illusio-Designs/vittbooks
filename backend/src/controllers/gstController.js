const { Op } = require('sequelize');
const { findByIdScoped, findOneScoped } = require('../utils/scopedQueries');

function toNum(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function fyFromPeriod(period) {
  // period: MM-YYYY
  const [mmStr, yyyyStr] = String(period || '').split('-');
  const mm = parseInt(mmStr, 10);
  const yyyy = parseInt(yyyyStr, 10);
  if (!mm || !yyyy) return null;
  if (mm >= 4) return `${yyyy}-${yyyy + 1}`;
  return `${yyyy - 1}-${yyyy}`;
}

module.exports = {
  async listGSTINs(req, res, next) {
    try {
      const gstins = await req.tenantModels.GSTIN.findAll({
        where: {},
        order: [['createdAt', 'ASC']],
      });
      res.json({ gstins });
    } catch (err) {
      next(err);
    }
  },

  async createGSTIN(req, res, next) {
    try {
      // Ensure tenant_id is set
      if (!req.body.tenant_id) {
        req.body.tenant_id = req.tenant_id;
      }

      const gstin = await req.tenantModels.GSTIN.create({ ...req.body });
      res.status(201).json({ gstin });
    } catch (err) {
      next(err);
    }
  },

  async updateGSTIN(req, res, next) {
    try {
      const { id } = req.params;
      const gstin = await findByIdScoped(req, req.tenantModels.GSTIN, id);
      if (!gstin) return res.status(404).json({ message: 'GSTIN not found' });

      await gstin.update(req.body);
      res.json({ gstin });
    } catch (err) {
      next(err);
    }
  },

  async getGSTRates(req, res, next) {
    try {
      // GST rates are now fetched from Sandbox API only
      // Use the getGSTRate endpoint with HSN code parameter
      const { hsn_code, state } = req.query;
      
      if (!hsn_code) {
        return res.status(400).json({ 
          message: 'HSN code is required. GST rates are now fetched from Sandbox API.' 
        });
      }

      const gstApiService = require('../services/gstApiService');
      const ctx = {
        company: req.company,
        tenantModels: req.tenantModels,
        masterModels: req.masterModels,
      };

      const result = await gstApiService.getGSTRate(ctx, hsn_code, state || null);
      res.json({ 
        success: true, 
        rates: [result], // Return as array for backward compatibility
        message: 'GST rate fetched from Sandbox API'
      });
    } catch (err) {
      next(err);
    }
  },

  async createGSTRate(req, res, next) {
    try {
      // GST rates are now managed by Sandbox API, not stored locally
      res.status(400).json({ 
        message: 'GST rates are now managed by Sandbox API. Use HSN code lookup instead.',
        suggestion: 'Use GET /api/gst/rate?hsn_code=<code> to fetch current GST rates'
      });
    } catch (err) {
      next(err);
    }
  },

  async listReturns(req, res, next) {
    try {
      const { return_type, return_period } = req.query;
      const where = {};
      if (return_type) where.return_type = return_type;
      if (return_period) where.return_period = return_period;

      const returns = await req.tenantModels.GSTRReturn.findAll({
        where,
        order: [['createdAt', 'DESC']],
      });

      res.json({ returns });
    } catch (err) {
      next(err);
    }
  },

  async generateGSTR1(req, res, next) {
    try {
      const { gstin, period } = req.body; // MM-YYYY
      const [month, year] = String(period).split('-').map((s) => parseInt(s, 10));
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const salesVouchers = await req.tenantModels.Voucher.findAll({
        where: {
          voucher_date: { [Op.between]: [startDate, endDate] },
          status: 'posted',
          voucher_type: 'sales_invoice',
        },
        include: [
          { model: req.tenantModels.VoucherItem, as: 'items' },
          { model: req.tenantModels.Ledger, as: 'partyLedger' },
        ],
      });

      const gstr1Data = {
        gstin,
        ret_period: period,
        b2b: [],
        b2cl: [],
        b2cs: [],
        exp: [],
        nil: [],
        hsn: {},
      };

      let totalTaxableValue = 0;
      let totalTax = 0;

      // Group B2B invoices by customer GSTIN
      const b2bMap = new Map();
      
      salesVouchers.forEach((voucher) => {
        const partyState = voucher.partyLedger?.state || '';
        const isInterstate = partyState !== voucher.place_of_supply;
        const customerGstin = voucher.partyLedger?.gstin;

        // Collect all items for this invoice
        const invoiceItems = [];
        let invoiceTotalTaxable = 0;
        
        (voucher.items || []).forEach((item, itemIndex) => {
          const taxableValue = toNum(item.taxable_amount, 0);
          const cgst = toNum(item.cgst_amount, 0);
          const sgst = toNum(item.sgst_amount, 0);
          const igst = toNum(item.igst_amount, 0);
          const tax = cgst + sgst + igst;

          totalTaxableValue += taxableValue;
          totalTax += tax;
          invoiceTotalTaxable += taxableValue;

          invoiceItems.push({
            num: itemIndex + 1,
            hsn_sc: item.hsn_sac_code || 'NA',
            qty: toNum(item.quantity, 0),
            rt: toNum(item.gst_rate, 0),
            txval: taxableValue,
            iamt: igst,
            camt: cgst,
            samt: sgst,
            csamt: toNum(item.cess_amount, 0),
          });

          // HSN summary (aggregated across all invoices)
          const code = item.hsn_sac_code || 'NA';
          if (!gstr1Data.hsn[code]) {
            gstr1Data.hsn[code] = {
              num: code,
              qty: 0,
              rt: toNum(item.gst_rate, 0),
              txval: 0,
              iamt: 0,
              camt: 0,
              samt: 0,
              csamt: 0,
            };
          }
          gstr1Data.hsn[code].qty += toNum(item.quantity, 0);
          gstr1Data.hsn[code].txval += taxableValue;
          gstr1Data.hsn[code].iamt += igst;
          gstr1Data.hsn[code].camt += cgst;
          gstr1Data.hsn[code].samt += sgst;
          gstr1Data.hsn[code].csamt += toNum(item.cess_amount, 0);
        });

        // Process invoice based on customer type
        if (customerGstin) {
          // B2B: Group by customer GSTIN
          if (!b2bMap.has(customerGstin)) {
            b2bMap.set(customerGstin, []);
          }
          b2bMap.get(customerGstin).push({
            inum: voucher.voucher_number,
            idt: String(voucher.voucher_date),
            val: toNum(voucher.total_amount, 0),
            pos: voucher.place_of_supply,
            rchrg: voucher.is_reverse_charge ? 'Y' : 'N',
            inv_typ: 'R',
            itms: invoiceItems,
          });
        } else if (isInterstate && invoiceTotalTaxable >= 250000) {
          // B2CL: Large interstate invoices (>= 2.5L) without GSTIN
          invoiceItems.forEach((item) => {
            gstr1Data.b2cl.push({
              pos: voucher.place_of_supply,
              typ: 'OE',
              etin: '',
              rt: item.rt,
              ad_amt: item.txval,
              iamt: item.iamt,
              csamt: item.csamt,
            });
          });
        } else {
          // B2CS: Small invoices or unregistered customers
          invoiceItems.forEach((item) => {
            gstr1Data.b2cs.push({
              typ: 'OE',
              pos: voucher.place_of_supply,
              rt: item.rt,
              ad_amt: item.txval,
              iamt: item.iamt,
              camt: item.camt,
              samt: item.samt,
              csamt: item.csamt,
            });
          });
        }
      });

      // Convert B2B map to array format
      b2bMap.forEach((invoices, ctin) => {
        gstr1Data.b2b.push({
          ctin,
          inv: invoices,
        });
      });

      gstr1Data.hsn = Object.values(gstr1Data.hsn);

      const gstinRow = gstin ? await findOneScoped(req, req.tenantModels.GSTIN, { gstin }) : null;
      const gstrReturn = await req.tenantModels.GSTRReturn.create({
        gstin: gstin, // Use gstin instead of gstin_id
        tenant_id: req.user.tenant_id, // Add missing tenant_id
        return_type: 'GSTR1',
        return_period: period,
        financial_year: fyFromPeriod(period),
        status: 'draft',
        return_data: {
          ...gstr1Data,
          summary: {
            totalTaxableValue: parseFloat(totalTaxableValue.toFixed(2)),
            totalTax: parseFloat(totalTax.toFixed(2)),
          },
        },
      });

      res.json({
        return: gstrReturn,
        data: gstr1Data,
        summary: {
          totalTaxableValue: parseFloat(totalTaxableValue.toFixed(2)),
          totalTax: parseFloat(totalTax.toFixed(2)),
          b2bCount: gstr1Data.b2b.length,
          b2clCount: gstr1Data.b2cl.length,
          b2csCount: gstr1Data.b2cs.length,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async generateGSTR3B(req, res, next) {
    try {
      const { gstin, period } = req.body;
      
      // Validate required fields
      if (!gstin) {
        return res.status(400).json({ 
          success: false,
          message: 'Validation error',
          errors: [{ field: 'gstin', message: 'GSTIN is required' }]
        });
      }
      
      if (!period) {
        return res.status(400).json({ 
          success: false,
          message: 'Validation error',
          errors: [{ field: 'period', message: 'Period is required' }]
        });
      }
      
      const [month, year] = String(period).split('-').map((s) => parseInt(s, 10));
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const gstinRow = await findOneScoped(req, req.tenantModels.GSTIN, { gstin });
      const gstr1 = await findOneScoped(req, req.tenantModels.GSTRReturn, { gstin: gstin, return_type: 'GSTR1', return_period: period });

      const purchaseVouchers = await req.tenantModels.Voucher.findAll({
        where: {
          voucher_date: { [Op.between]: [startDate, endDate] },
          status: 'posted',
          voucher_type: 'purchase_invoice',
        },
        include: [{ model: req.tenantModels.VoucherItem, as: 'items' }],
      });

      let totalInputCGST = 0;
      let totalInputSGST = 0;
      let totalInputIGST = 0;
      let totalInputCess = 0;

      purchaseVouchers.forEach((voucher) => {
        (voucher.items || []).forEach((item) => {
          totalInputCGST += toNum(item.cgst_amount, 0);
          totalInputSGST += toNum(item.sgst_amount, 0);
          totalInputIGST += toNum(item.igst_amount, 0);
          totalInputCess += toNum(item.cess_amount, 0);
        });
      });

      const gstr1Data = gstr1?.return_data || {};
      const totalOutputCGST = (gstr1Data.hsn || []).reduce((sum, h) => sum + toNum(h.camt, 0), 0);
      const totalOutputSGST = (gstr1Data.hsn || []).reduce((sum, h) => sum + toNum(h.samt, 0), 0);
      const totalOutputIGST = (gstr1Data.hsn || []).reduce((sum, h) => sum + toNum(h.iamt, 0), 0);
      const totalOutputCess = (gstr1Data.hsn || []).reduce((sum, h) => sum + toNum(h.csamt, 0), 0);

      const gstr3bData = {
        gstin,
        ret_period: period,
        sup_details: {
          osup_det: {
            txval: gstr1Data?.summary?.totalTaxableValue || 0,
            iamt: totalOutputIGST,
            camt: totalOutputCGST,
            samt: totalOutputSGST,
            csamt: totalOutputCess,
          },
        },
        itc_elg: {
          itc_avl: [
            {
              ty: 'ALL',
              iamt: totalInputIGST,
              camt: totalInputCGST,
              samt: totalInputSGST,
              csamt: totalInputCess,
            },
          ],
        },
      };

      const netCGST = Math.max(0, totalOutputCGST - totalInputCGST);
      const netSGST = Math.max(0, totalOutputSGST - totalInputSGST);
      const netIGST = Math.max(0, totalOutputIGST - totalInputIGST);
      const netCess = Math.max(0, totalOutputCess - totalInputCess);

      const gstrReturn = await req.tenantModels.GSTRReturn.create({
        gstin: gstin, // Use gstin instead of gstin_id
        tenant_id: req.user.tenant_id, // Add missing tenant_id
        return_type: 'GSTR3B',
        return_period: period,
        financial_year: fyFromPeriod(period),
        status: 'draft',
        return_data: {
          ...gstr3bData,
          summary: {
            totalOutput: { cgst: totalOutputCGST, sgst: totalOutputSGST, igst: totalOutputIGST, cess: totalOutputCess },
            totalInput: { cgst: totalInputCGST, sgst: totalInputSGST, igst: totalInputIGST, cess: totalInputCess },
            netPayable: { cgst: netCGST, sgst: netSGST, igst: netIGST, cess: netCess },
            totalTaxPayable: parseFloat((netCGST + netSGST + netIGST + netCess).toFixed(2)),
          },
        },
      });

      res.json({
        return: gstrReturn,
        data: gstr3bData,
        summary: gstrReturn.return_data?.summary,
      });
    } catch (err) {
      next(err);
    }
  },

  async validateGSTIN(req, res, next) {
    try {
      const { gstin } = req.body;
      if (!gstin) return res.status(400).json({ message: 'GSTIN is required' });

      const gstApiService = require('../services/gstApiService');
      const ctx = {
        company: req.company,
        tenantModels: req.tenantModels,
        masterModels: req.masterModels,
      };

      const result = await gstApiService.validateGSTIN(ctx, gstin);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getGSTINDetails(req, res, next) {
    try {
      const { gstin } = req.params;
      if (!gstin) return res.status(400).json({ message: 'GSTIN is required' });

      const gstApiService = require('../services/gstApiService');
      const ctx = {
        company: req.company,
        tenantModels: req.tenantModels,
        masterModels: req.masterModels,
      };

      const result = await gstApiService.getGSTINDetails(ctx, gstin);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getGSTRate(req, res, next) {
    try {
      const { hsn_code, state } = req.query;
      if (!hsn_code) return res.status(400).json({ message: 'HSN code is required' });

      const gstApiService = require('../services/gstApiService');
      const ctx = {
        company: req.company,
        tenantModels: req.tenantModels,
        masterModels: req.masterModels,
      };

      const result = await gstApiService.getGSTRate(ctx, hsn_code, state || null);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  // ==================== SANDBOX GST ANALYTICS APIs ====================

  /**
   * Create GSTR-2A Reconciliation Job
   */
  async createGSTR2AReconciliation(req, res, next) {
    try {
      const { gstin, year, month, reconciliation_criteria = 'strict' } = req.body;
      
      if (!gstin || !year || !month) {
        return res.status(400).json({ message: 'gstin, year, and month are required' });
      }

      const { createApiClientFromCompany } = require('../services/thirdPartyApiClient');
      const apiClient = createApiClientFromCompany(req.company);
      
      const result = await apiClient.createGSTR2AReconciliationJob({
        gstin,
        year: parseInt(year),
        month: parseInt(month),
        reconciliation_criteria
      });

      res.json({
        success: true,
        jobId: result.job_id || result.jobId,
        uploadUrl: result.upload_url || result.uploadUrl,
        ...result
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get GSTR-2A Reconciliation Job Status
   */
  async getGSTR2AReconciliationStatus(req, res, next) {
    try {
      const { job_id } = req.params;
      
      if (!job_id) {
        return res.status(400).json({ message: 'job_id is required' });
      }

      const { createApiClientFromCompany } = require('../services/thirdPartyApiClient');
      const apiClient = createApiClientFromCompany(req.company);
      
      const result = await apiClient.getGSTR2AReconciliationStatus(job_id);

      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Upload Purchase Ledger Data
   */
  async uploadPurchaseLedger(req, res, next) {
    try {
      const { upload_url, ledger_data } = req.body;
      
      if (!upload_url || !ledger_data) {
        return res.status(400).json({ message: 'upload_url and ledger_data are required' });
      }

      const { createApiClientFromCompany } = require('../services/thirdPartyApiClient');
      const apiClient = createApiClientFromCompany(req.company);
      
      const result = await apiClient.uploadPurchaseLedgerData(upload_url, ledger_data);

      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  },
};
