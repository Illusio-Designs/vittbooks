const { Op } = require('sequelize');
const { findByIdScoped } = require('../utils/scopedQueries');

module.exports = {
  async getOutstanding(req, res, next) {
    try {
      const { ledger_id, as_on_date } = req.query;
      const where = {
        is_fully_paid: false,
        pending_amount: { [Op.gt]: 0 },
      };

      if (ledger_id) where.ledger_id = ledger_id;
      if (as_on_date) {
        where.bill_date = { [Op.lte]: as_on_date };
      }

      const bills = await req.tenantModels.BillWiseDetail.findAll({
        where,
        include: [
          { model: req.tenantModels.Voucher, as: 'voucher', attributes: ['voucher_number', 'voucher_date'] },
          { model: req.tenantModels.Ledger, as: 'ledger', attributes: ['ledger_name', 'ledger_code'] },
        ],
        order: [['due_date', 'ASC']],
      });

      // Calculate overdue days
      const today = new Date();
      bills.forEach((bill) => {
        if (bill.due_date && bill.due_date < today) {
          const diffTime = today - bill.due_date;
          bill.overdue_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      });

      const totalOutstanding = bills.reduce((sum, bill) => sum + parseFloat(bill.pending_amount), 0);

      res.json({
        bills,
        totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
        count: bills.length,
      });
    } catch (err) {
      next(err);
    }
  },

  async allocatePayment(req, res, next) {
    const transaction = await req.tenantDb.transaction();
    try {
      const { payment_voucher_id, allocations } = req.body;

      // Validate payment voucher exists
      const paymentVoucher = await findByIdScoped(req, req.tenantModels.Voucher, payment_voucher_id, { transaction });

      if (!paymentVoucher) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Payment voucher not found' });
      }

      const totalAllocated = allocations.reduce((sum, a) => sum + parseFloat(a.allocated_amount), 0);

      if (Math.abs(totalAllocated - parseFloat(paymentVoucher.total_amount)) > 0.01) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'Total allocated amount must match payment voucher amount',
          payment_amount: paymentVoucher.total_amount,
          allocated_amount: totalAllocated,
        });
      }

      // Create allocations and update bills
      const createdAllocations = [];
      for (const allocation of allocations) {
        const bill = await findByIdScoped(req, req.tenantModels.BillWiseDetail, allocation.bill_id, { transaction });

        if (!bill) {
          await transaction.rollback();
          return res.status(404).json({ message: `Bill ${allocation.bill_id} not found` });
        }

        const allocatedAmount = parseFloat(allocation.allocated_amount);
        if (allocatedAmount > parseFloat(bill.pending_amount)) {
          await transaction.rollback();
          return res.status(400).json({
            message: `Allocated amount exceeds pending amount for bill ${bill.bill_number}`,
            pending: bill.pending_amount,
            allocated: allocatedAmount,
          });
        }

        // Create allocation
        const allocationRecord = await req.tenantModels.BillAllocation.create(
          {
            payment_voucher_id,
            bill_id: allocation.bill_id,
            allocated_amount: allocatedAmount,
          },
          { transaction }
        );

        // Update bill pending amount
        const newPendingAmount = parseFloat(bill.pending_amount) - allocatedAmount;
        await bill.update(
          {
            pending_amount: newPendingAmount,
            is_fully_paid: newPendingAmount <= 0,
            is_open: newPendingAmount > 0,
          },
          { transaction }
        );

        createdAllocations.push(allocationRecord);
      }

      await transaction.commit();
      res.status(201).json({ allocations: createdAllocations });
    } catch (err) {
      await transaction.rollback();
      next(err);
    }
  },

  async getAgingReport(req, res, next) {
    try {
      const { ledger_id, as_on_date } = req.query;
      const where = {
        is_fully_paid: false,
        pending_amount: { [Op.gt]: 0 },
      };

      if (ledger_id) where.ledger_id = ledger_id;

      const bills = await req.tenantModels.BillWiseDetail.findAll({
        where,
        include: [{ model: req.tenantModels.Ledger, as: 'ledger', attributes: ['ledger_name'] }],
      });

      const today = as_on_date ? new Date(as_on_date) : new Date();
      const aging = {
        current: 0, // 0-30 days
        days31to60: 0, // 31-60 days
        days61to90: 0, // 61-90 days
        over90: 0, // Over 90 days
        total: 0,
      };

      bills.forEach((bill) => {
        const days = bill.due_date
          ? Math.ceil((today - bill.due_date) / (1000 * 60 * 60 * 24))
          : 0;
        const amount = parseFloat(bill.pending_amount);

        if (days <= 30) {
          aging.current += amount;
        } else if (days <= 60) {
          aging.days31to60 += amount;
        } else if (days <= 90) {
          aging.days61to90 += amount;
        } else {
          aging.over90 += amount;
        }

        aging.total += amount;
      });

      res.json({
        aging: {
          current: parseFloat(aging.current.toFixed(2)),
          days31to60: parseFloat(aging.days31to60.toFixed(2)),
          days61to90: parseFloat(aging.days61to90.toFixed(2)),
          over90: parseFloat(aging.over90.toFixed(2)),
          total: parseFloat(aging.total.toFixed(2)),
        },
        bills: bills.map((bill) => ({
          bill_number: bill.bill_number,
          bill_date: bill.bill_date,
          due_date: bill.due_date,
          ledger_name: bill.ledger?.ledger_name,
          pending_amount: bill.pending_amount,
          overdue_days: bill.due_date
            ? Math.ceil((today - bill.due_date) / (1000 * 60 * 60 * 24))
            : 0,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
};

