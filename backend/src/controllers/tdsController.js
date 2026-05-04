const { Op } = require('sequelize');
const logger = require('../utils/logger');
const tdsService = require('../services/tdsService');

module.exports = {
  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, quarter, financial_year, ledger_id, search, status } = req.query;
      const offset = (page - 1) * limit;
      const where = {};

      // Validate tenant models are available
      if (!req.tenantModels || !req.tenantModels.TDSDetail) {
        logger.error('Tenant models not available in TDS list');
        return res.status(500).json({
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            totalPages: 0,
          },
          error: 'Database connection not available'
        });
      }

      if (quarter) where.quarter = quarter;
      if (financial_year) where.financial_year = financial_year;
      if (ledger_id) where.ledger_id = ledger_id;
      if (status) where.status = status;

      // Add search functionality
      if (search) {
        where[Op.or] = [
          { deductee_name: { [Op.like]: `%${search}%` } },
          { deductee_pan: { [Op.like]: `%${search}%` } },
          { tds_section: { [Op.like]: `%${search}%` } },
          { challan_number: { [Op.like]: `%${search}%` } },
        ];
      }

      const result = await req.tenantModels.TDSDetail.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: req.tenantModels.Voucher,
            as: 'voucher',
            attributes: ['id', 'voucher_number', 'voucher_date'],
            required: false,
          },
          {
            model: req.tenantModels.Ledger,
            as: 'ledger',
            attributes: ['id', 'ledger_name'],
            required: false,
          },
        ],
      }).catch(error => {
        logger.error('Error fetching TDS details:', error);
        return { count: 0, rows: [] };
      });

      const { count, rows } = result;

      res.json({
        data: Array.isArray(rows) ? rows : [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    } catch (error) {
      logger.error('Error listing TDS details:', error);
      res.status(500).json({
        data: [],
        pagination: {
          page: parseInt(req.query.page || 1),
          limit: parseInt(req.query.limit || 20),
          total: 0,
          totalPages: 0,
        },
        error: 'Failed to fetch TDS details'
      });
    }
  },

  async calculateTDS(req, res, next) {
    try {
      const { voucher_id, tds_section, tds_rate, amount, pan_available } = req.body;

      // For testing purposes, allow calculation without voucher_id if amount is provided
      if (!voucher_id && !amount) {
        return res.status(400).json({ message: 'Either voucher_id or amount is required' });
      }

      const ctx = {
        tenantModels: req.tenantModels,
        masterModels: req.masterModels,
        company: req.company,
        tenant_id: req.tenant_id,
        company_id: req.company_id,
      };

      let result;
      if (voucher_id) {
        // Calculate TDS for existing voucher
        result = await tdsService.calculateTDS(ctx, voucher_id, tds_section, tds_rate);
      } else {
        // Calculate TDS for given amount (testing/preview mode)
        result = await tdsService.calculateTDSForAmount(ctx, amount, tds_section, tds_rate, pan_available);
      }

      res.status(201).json({
        success: true,
        tdsDetail: result.tdsDetail,
        summary: result.summary,
        apiResponse: result.apiResponse,
      });
    } catch (err) {
      next(err);
    }
  },

  async generateReturn(req, res, next) {
    try {
      const { quarter, financial_year } = req.body;

      if (!quarter || !financial_year) {
        return res.status(400).json({ message: 'quarter and financial_year are required' });
      }

      const ctx = {
        tenantModels: req.tenantModels,
        masterModels: req.masterModels,
        company: req.company,
        tenant_id: req.tenant_id,
        company_id: req.company_id,
      };

      const result = await tdsService.prepareAndFileReturn(ctx, quarter, financial_year);

      res.json({
        success: true,
        preparedReturn: result.preparedReturn,
        filedReturn: result.filedReturn,
        returnId: result.returnId,
        acknowledgmentNumber: result.acknowledgmentNumber,
        summary: result.summary,
      });
    } catch (err) {
      next(err);
    }
  },

  async generateCertificate(req, res, next) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: 'TDS detail id is required' });
      }

      const ctx = {
        tenantModels: req.tenantModels,
        masterModels: req.masterModels,
        company: req.company,
        tenant_id: req.tenant_id,
        company_id: req.company_id,
      };

      const result = await tdsService.generateForm16A(ctx, id);

      res.json({
        success: true,
        certificate: result.certificate,
        tdsDetail: result.tdsDetail,
        ledger: result.ledger,
        voucher: result.voucher,
      });
    } catch (err) {
      next(err);
    }
  },

  async getReturnStatus(req, res, next) {
    try {
      const { return_id } = req.params;
      const { form_type = '24Q' } = req.query;

      if (!return_id) {
        return res.status(400).json({ message: 'return_id is required' });
      }

      const ctx = {
        tenantModels: req.tenantModels,
        masterModels: req.masterModels,
        company: req.company,
        tenant_id: req.tenant_id,
        company_id: req.company_id,
      };

      const status = await tdsService.getReturnStatus(ctx, return_id, form_type);

      res.json({
        success: true,
        status,
      });
    } catch (err) {
      next(err);
    }
  },

  // ==================== SANDBOX TDS ANALYTICS APIs ====================

  /**
   * Create TDS Potential Notice Job
   */
  async createTDSPotentialNoticeJob(req, res, next) {
    try {
      const { quarter, tan, form, financial_year } = req.body;
      
      if (!quarter || !tan || !form || !financial_year) {
        return res.status(400).json({ message: 'quarter, tan, form, and financial_year are required' });
      }

      const { createApiClientFromCompany } = require('../services/thirdPartyApiClient');
      const apiClient = createApiClientFromCompany(req.company);
      
      const result = await apiClient.createTDSPotentialNoticeJob({
        quarter,
        tan,
        form,
        financial_year
      });

      res.json({
        success: true,
        jobId: result.job_id || result.jobId,
        ...result
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get TDS Analytics Job Status
   */
  async getTDSAnalyticsJobStatus(req, res, next) {
    try {
      const { job_id } = req.params;
      
      if (!job_id) {
        return res.status(400).json({ message: 'job_id is required' });
      }

      const { createApiClientFromCompany } = require('../services/thirdPartyApiClient');
      const apiClient = createApiClientFromCompany(req.company);
      
      const result = await apiClient.getTDSAnalyticsJobStatus(job_id);

      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  },

  // ==================== SANDBOX TDS CALCULATOR APIs ====================

  /**
   * Calculate Non-Salary TDS
   */
  async calculateNonSalaryTDS(req, res, next) {
    try {
      const calculationParams = req.body;
      
      if (!calculationParams.payment_amount || !calculationParams.section) {
        return res.status(400).json({ message: 'payment_amount and section are required' });
      }

      const { createApiClientFromCompany } = require('../services/thirdPartyApiClient');
      const apiClient = createApiClientFromCompany(req.company);
      
      const result = await apiClient.calculateNonSalaryTDS(calculationParams);

      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  },

  // ==================== SANDBOX TDS COMPLIANCE APIs ====================

  /**
   * Check Section 206AB & 206CCA Compliance
   */
  async check206ABCompliance(req, res, next) {
    try {
      const { pan, consent, reason } = req.body;
      
      if (!pan || consent === undefined) {
        return res.status(400).json({ message: 'pan and consent are required' });
      }

      const { createApiClientFromCompany } = require('../services/thirdPartyApiClient');
      const apiClient = createApiClientFromCompany(req.company);
      
      const result = await apiClient.check206ABCompliance({
        pan,
        consent,
        reason
      });

      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Generate OTP for CSI Download
   */
  async generateCSIOTP(req, res, next) {
    try {
      const otpParams = req.body;
      
      if (!otpParams.tan) {
        return res.status(400).json({ message: 'tan is required' });
      }

      const { createApiClientFromCompany } = require('../services/thirdPartyApiClient');
      const apiClient = createApiClientFromCompany(req.company);
      
      const result = await apiClient.generateCSIOTP(otpParams);

      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Download CSI with OTP
   */
  async downloadCSI(req, res, next) {
    try {
      const downloadParams = req.body;
      
      if (!downloadParams.tan || !downloadParams.otp) {
        return res.status(400).json({ message: 'tan and otp are required' });
      }

      const { createApiClientFromCompany } = require('../services/thirdPartyApiClient');
      const apiClient = createApiClientFromCompany(req.company);
      
      const result = await apiClient.downloadCSI(downloadParams);

      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  },

  // ==================== SANDBOX TDS REPORTS APIs ====================

  /**
   * Submit TCS Report Job
   */
  async submitTCSReportJob(req, res, next) {
    try {
      const reportParams = req.body;
      
      if (!reportParams.tan || !reportParams.quarter || !reportParams.financial_year) {
        return res.status(400).json({ message: 'tan, quarter, and financial_year are required' });
      }

      const { createApiClientFromCompany } = require('../services/thirdPartyApiClient');
      const apiClient = createApiClientFromCompany(req.company);
      
      const result = await apiClient.submitTCSReportJob(reportParams);

      res.json({
        success: true,
        jobId: result.job_id || result.jobId,
        ...result
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get TCS Report Job Status
   */
  async getTCSReportJobStatus(req, res, next) {
    try {
      const { job_id } = req.params;
      
      if (!job_id) {
        return res.status(400).json({ message: 'job_id is required' });
      }

      const { createApiClientFromCompany } = require('../services/thirdPartyApiClient');
      const apiClient = createApiClientFromCompany(req.company);
      
      const result = await apiClient.getTCSReportJobStatus(job_id);

      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Search TCS Report Jobs
   */
  async searchTCSReportJobs(req, res, next) {
    try {
      const searchParams = req.body || {};

      const { createApiClientFromCompany } = require('../services/thirdPartyApiClient');
      const apiClient = createApiClientFromCompany(req.company);
      
      const result = await apiClient.searchTCSReportJobs(searchParams);

      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  },

  // ==================== TDS/TCS REPORT APIs ====================

  /**
   * Generate TDS Report
   */
  async generateTDSReport(req, res, next) {
    try {
      const { from_date, to_date, section, deductee_pan } = req.query;

      if (!from_date || !to_date) {
        return res.status(400).json({
          success: false,
          message: 'from_date and to_date are required'
        });
      }

      const where = {};

      if (section) {
        where.tds_section = section;
      }

      if (deductee_pan) {
        where.deductee_pan = deductee_pan;
      }

      // Get all TDS transactions with voucher date filtering
      const transactions = await req.tenantModels.TDSDetail.findAll({
        where,
        include: [
          {
            model: req.tenantModels.Voucher,
            as: 'voucher',
            attributes: ['voucher_number', 'voucher_date', 'voucher_type'],
            where: {
              voucher_date: {
                [Op.between]: [from_date, to_date]
              }
            },
            required: true
          }
        ],
        order: [[{ model: req.tenantModels.Voucher, as: 'voucher' }, 'voucher_date', 'DESC']]
      });

      // Calculate summary
      const summary = {
        total_transactions: transactions.length,
        total_tds_amount: transactions.reduce((sum, t) => sum + parseFloat(t.tds_amount || 0), 0),
        total_payment_amount: transactions.reduce((sum, t) => sum + parseFloat(t.taxable_amount || 0), 0)
      };

      // Section-wise breakdown
      const sectionWise = {};
      transactions.forEach(t => {
        const sec = t.tds_section;
        if (!sectionWise[sec]) {
          sectionWise[sec] = {
            section: sec,
            count: 0,
            total_tds: 0
          };
        }
        sectionWise[sec].count++;
        sectionWise[sec].total_tds += parseFloat(t.tds_amount || 0);
      });

      res.json({
        success: true,
        data: {
          summary,
          section_wise: Object.values(sectionWise),
          transactions: transactions.map(t => ({
            deductee_name: t.deductee_name,
            deductee_pan: t.deductee_pan,
            tds_section: t.tds_section,
            tds_rate: t.tds_rate,
            taxable_amount: t.taxable_amount,
            tds_amount: t.tds_amount,
            deduction_date: t.voucher?.voucher_date,
            voucher_number: t.voucher?.voucher_number,
            voucher_type: t.voucher?.voucher_type
          }))
        }
      });
    } catch (error) {
      logger.error('Error generating TDS report:', error);
      next(error);
    }
  },

  /**
   * Generate TCS Report
   */
  async generateTCSReport(req, res, next) {
    try {
      const { from_date, to_date, section, buyer_pan } = req.query;

      if (!from_date || !to_date) {
        return res.status(400).json({
          success: false,
          message: 'from_date and to_date are required'
        });
      }

      // Check if TCS table exists
      if (!req.tenantModels.TCSDetail) {
        return res.json({
          success: true,
          data: {
            summary: {
              total_transactions: 0,
              total_tcs_amount: 0,
              total_sale_amount: 0
            },
            section_wise: [],
            transactions: []
          }
        });
      }

      const where = {};

      if (section) {
        where.tcs_section = section;
      }

      if (buyer_pan) {
        where.buyer_pan = buyer_pan;
      }

      // Get all TCS transactions with voucher date filtering
      const transactions = await req.tenantModels.TCSDetail.findAll({
        where,
        include: [
          {
            model: req.tenantModels.Voucher,
            as: 'voucher',
            attributes: ['voucher_number', 'voucher_date', 'voucher_type'],
            where: {
              voucher_date: {
                [Op.between]: [from_date, to_date]
              }
            },
            required: true
          }
        ],
        order: [[{ model: req.tenantModels.Voucher, as: 'voucher' }, 'voucher_date', 'DESC']]
      });

      // Calculate summary
      const summary = {
        total_transactions: transactions.length,
        total_tcs_amount: transactions.reduce((sum, t) => sum + parseFloat(t.tcs_amount || 0), 0),
        total_sale_amount: transactions.reduce((sum, t) => sum + parseFloat(t.taxable_amount || 0), 0)
      };

      // Section-wise breakdown
      const sectionWise = {};
      transactions.forEach(t => {
        const sec = t.tcs_section;
        if (!sectionWise[sec]) {
          sectionWise[sec] = {
            section: sec,
            count: 0,
            total_tcs: 0
          };
        }
        sectionWise[sec].count++;
        sectionWise[sec].total_tcs += parseFloat(t.tcs_amount || 0);
      });

      res.json({
        success: true,
        data: {
          summary,
          section_wise: Object.values(sectionWise),
          transactions: transactions.map(t => ({
            buyer_name: t.buyer_name,
            buyer_pan: t.buyer_pan,
            tcs_section: t.tcs_section,
            tcs_rate: t.tcs_rate,
            taxable_amount: t.taxable_amount,
            tcs_amount: t.tcs_amount,
            collection_date: t.voucher?.voucher_date,
            voucher_number: t.voucher?.voucher_number,
            voucher_type: t.voucher?.voucher_type
          }))
        }
      });
    } catch (error) {
      logger.error('Error generating TCS report:', error);
      next(error);
    }
  }
};
