const eInvoiceService = require('../services/eInvoiceService');
const { findOneScoped } = require('../utils/scopedQueries');

module.exports = {
  async generateIRN(req, res, next) {
    try {
      const { voucher_id } = req.body;
      if (!voucher_id) return res.status(400).json({ message: 'voucher_id is required' });

      const eInvoice = await eInvoiceService.generateIRN(
        { tenantModels: req.tenantModels, masterModels: req.masterModels, company: req.company, tenant_id: req.tenant_id, company_id: req.company_id },
        voucher_id
      );

      res.status(201).json({
        success: true,
        eInvoice,
      });
    } catch (err) {
      next(err);
    }
  },

  async cancelIRN(req, res, next) {
    try {
      const { voucher_id } = req.params;
      const { reason } = req.body;

      const eInvoice = await eInvoiceService.cancelEInvoice(
        { tenantModels: req.tenantModels, masterModels: req.masterModels, company: req.company, tenant_id: req.tenant_id, company_id: req.company_id },
        voucher_id,
        reason
      );

      res.json({ success: true, message: 'E-invoice cancelled successfully', eInvoice });
    } catch (err) {
      next(err);
    }
  },

  async getEInvoice(req, res, next) {
    try {
      const { voucher_id } = req.params;
      const eInvoice = await findOneScoped(req, req.tenantModels.EInvoice, { voucher_id });

      if (!eInvoice) return res.status(404).json({ message: 'E-invoice not found' });
      res.json({ eInvoice });
    } catch (err) {
      next(err);
    }
  },

  async listEInvoices(req, res, next) {
    try {
      const { page = 1, limit = 20, status, from_date, to_date } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

      const where = {};
      if (status) where.status = status;
      
      if (from_date || to_date) {
        where.createdAt = {};
        if (from_date) where.createdAt[req.tenantModels.Sequelize.Op.gte] = from_date;
        if (to_date) where.createdAt[req.tenantModels.Sequelize.Op.lte] = to_date;
      }

      const eInvoices = await req.tenantModels.EInvoice.findAndCountAll({
        where,
        limit: parseInt(limit, 10),
        offset,
        order: [['createdAt', 'DESC']],
        attributes: [
          'id',
          'voucher_id',
          'irn',
          'ack_number',
          'ack_date',
          'status',
          'qr_code',
          'signed_invoice',
          'error_message',
          'tenant_id',
          'createdAt',
          'updatedAt'
        ],
        include: [
          {
            model: req.tenantModels.Voucher,
            as: 'voucher',
            attributes: ['id', 'voucher_number', 'voucher_date', 'total_amount'],
            required: false,
          },
        ],
      });

      // Calculate summary statistics
      const summary = {
        total: eInvoices.count,
        generated: await req.tenantModels.EInvoice.count({ where: { ...where, status: 'generated' } }),
        pending: await req.tenantModels.EInvoice.count({ where: { ...where, status: 'pending' } }),
        cancelled: await req.tenantModels.EInvoice.count({ where: { ...where, status: 'cancelled' } }),
        failed: await req.tenantModels.EInvoice.count({ where: { ...where, status: 'failed' } }),
      };

      res.json({
        data: eInvoices.rows,
        summary,
        pagination: {
          total: eInvoices.count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(eInvoices.count / parseInt(limit, 10)),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async retryGeneration(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = await eInvoiceService.retryEInvoiceGeneration(
        id,
        { tenantModels: req.tenantModels, masterModels: req.masterModels, company: req.company, tenant_id: req.tenant_id, company_id: req.company_id }
      );

      res.json({
        success: true,
        message: result.message || 'E-Invoice retry initiated',
        eInvoice: result,
      });
    } catch (err) {
      next(err);
    }
  },
};
