const eWayBillService = require('../services/eWayBillService');
const { findOneScoped } = require('../utils/scopedQueries');

module.exports = {
  async generate(req, res, next) {
    try {
      const { voucher_id, ...details } = req.body || {};
      if (!voucher_id) return res.status(400).json({ message: 'voucher_id is required' });

      const eWayBill = await eWayBillService.generate(
        { tenantModels: req.tenantModels, masterModels: req.masterModels, company: req.company, tenant_id: req.tenant_id, company_id: req.company_id },
        voucher_id,
        details
      );

      res.status(201).json({ success: true, eWayBill });
    } catch (err) {
      next(err);
    }
  },

  async cancel(req, res, next) {
    try {
      const { voucher_id } = req.params;
      const { reason } = req.body || {};
      const eWayBill = await eWayBillService.cancel(
        { tenantModels: req.tenantModels, masterModels: req.masterModels, company: req.company, tenant_id: req.tenant_id, company_id: req.company_id },
        voucher_id,
        reason
      );
      res.json({ success: true, eWayBill });
    } catch (err) {
      next(err);
    }
  },

  async getByVoucher(req, res, next) {
    try {
      const { voucher_id } = req.params;
      const eWayBill = await findOneScoped(req, req.tenantModels.EWayBill, { voucher_id });
      if (!eWayBill) return res.status(404).json({ message: 'E-way bill not found' });
      res.json({ eWayBill });
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, status, from_date, to_date } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const where = {};
      
      if (status) where.status = status;
      
      if (from_date || to_date) {
        where.ewb_date = {};
        if (from_date) where.ewb_date[req.tenantModels.Sequelize.Op.gte] = from_date;
        if (to_date) where.ewb_date[req.tenantModels.Sequelize.Op.lte] = to_date;
      }

      const rows = await req.tenantModels.EWayBill.findAndCountAll({
        where,
        limit: parseInt(limit, 10),
        offset,
        order: [['createdAt', 'DESC']],
        attributes: [
          'id',
          'voucher_id',
          'ewb_number',
          'ewb_date',
          'status',
          'vehicle_no',
          'transporter_id',
          'transporter_name',
          'transport_mode',
          'distance',
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
        total: rows.count,
        active: await req.tenantModels.EWayBill.count({ where: { ...where, status: 'active' } }),
        cancelled: await req.tenantModels.EWayBill.count({ where: { ...where, status: 'cancelled' } }),
        expired: await req.tenantModels.EWayBill.count({ where: { ...where, status: 'expired' } }),
      };

      res.json({
        data: rows.rows,
        summary,
        pagination: {
          total: rows.count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(rows.count / parseInt(limit, 10)),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async updateVehicle(req, res, next) {
    try {
      const { id } = req.params;
      const { vehicle_no, reason_code, remarks } = req.body;

      if (!vehicle_no) {
        return res.status(400).json({ message: 'vehicle_no is required' });
      }

      if (!reason_code) {
        return res.status(400).json({ message: 'reason_code is required' });
      }

      const eWayBill = await eWayBillService.updateVehicleDetails(
        id,
        vehicle_no,
        reason_code,
        remarks || '',
        { tenantModels: req.tenantModels, masterModels: req.masterModels, company: req.company, tenant_id: req.tenant_id, company_id: req.company_id }
      );

      res.json({
        success: true,
        message: 'Vehicle details updated successfully',
        eWayBill,
      });
    } catch (err) {
      next(err);
    }
  },
};

