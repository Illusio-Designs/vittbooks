const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { findByIdScoped, findOneScoped } = require('../utils/scopedQueries');

module.exports = {
  /**
   * List all units for an inventory item
   */
  async listByItem(req, res, next) {
    try {
      const { inventory_item_id } = req.params;
      const { page = 1, limit = 50, status, warehouse_id } = req.query;
      const offset = (page - 1) * limit;
      
      const where = { inventory_item_id };
      
      if (status) {
        where.status = status;
      }
      
      if (warehouse_id) {
        where.warehouse_id = warehouse_id;
      }

      const { count, rows } = await req.tenantModels.InventoryUnit.findAndCountAll({
        where,
        include: [
          {
            model: req.tenantModels.InventoryItem,
            as: 'item',
            attributes: ['id', 'item_name', 'item_code'],
          },
          {
            model: req.tenantModels.Warehouse,
            as: 'warehouse',
            attributes: ['id', 'warehouse_name'],
          },
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
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
      logger.error('Error listing inventory units:', error);
      next(error);
    }
  },

  /**
   * Get unit by barcode
   */
  async getByBarcode(req, res, next) {
    try {
      const { barcode } = req.params;

      const unit = await findOneScoped(req, req.tenantModels.InventoryUnit, { unit_barcode: barcode }, {
        include: [
          {
            model: req.tenantModels.InventoryItem,
            as: 'item',
          },
          {
            model: req.tenantModels.Warehouse,
            as: 'warehouse',
          },
        ],
      });

      if (!unit) {
        return res.status(404).json({ error: 'Unit not found' });
      }

      res.json({ data: unit });
    } catch (error) {
      logger.error('Error getting unit by barcode:', error);
      next(error);
    }
  },

  /**
   * Update unit details (serial number, IMEI, notes, etc.)
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { serial_number, imei_number, warranty_expiry, notes } = req.body;

      const unit = await findByIdScoped(req, req.tenantModels.InventoryUnit, id);
      if (!unit) {
        return res.status(404).json({ error: 'Unit not found' });
      }

      await unit.update({
        serial_number: serial_number !== undefined ? serial_number : unit.serial_number,
        imei_number: imei_number !== undefined ? imei_number : unit.imei_number,
        warranty_expiry: warranty_expiry !== undefined ? warranty_expiry : unit.warranty_expiry,
        notes: notes !== undefined ? notes : unit.notes,
      });

      res.json({ data: unit });
    } catch (error) {
      logger.error('Error updating unit:', error);
      next(error);
    }
  },

  /**
   * Mark unit as damaged
   */
  async markDamaged(req, res, next) {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const unit = await findByIdScoped(req, req.tenantModels.InventoryUnit, id);
      if (!unit) {
        return res.status(404).json({ error: 'Unit not found' });
      }

      if (unit.status === 'sold') {
        return res.status(400).json({ error: 'Cannot mark sold unit as damaged' });
      }

      await unit.update({
        status: 'damaged',
        notes: notes || unit.notes,
      });

      // Update inventory item quantity
      const inStockCount = await req.tenantModels.InventoryUnit.count({
        where: {
          inventory_item_id: unit.inventory_item_id,
          status: 'in_stock',
        },
      });

      await req.tenantModels.InventoryItem.update(
        { quantity_on_hand: inStockCount },
        { where: { id: unit.inventory_item_id } }
      );

      res.json({ data: unit, message: 'Unit marked as damaged' });
    } catch (error) {
      logger.error('Error marking unit as damaged:', error);
      next(error);
    }
  },

  /**
   * Get unit statistics for an item
   */
  async getStatistics(req, res, next) {
    try {
      const { inventory_item_id } = req.params;

      const [total, inStock, sold, damaged, returned] = await Promise.all([
        req.tenantModels.InventoryUnit.count({
          where: { inventory_item_id },
        }),
        req.tenantModels.InventoryUnit.count({
          where: { inventory_item_id, status: 'in_stock' },
        }),
        req.tenantModels.InventoryUnit.count({
          where: { inventory_item_id, status: 'sold' },
        }),
        req.tenantModels.InventoryUnit.count({
          where: { inventory_item_id, status: 'damaged' },
        }),
        req.tenantModels.InventoryUnit.count({
          where: { inventory_item_id, status: 'returned' },
        }),
      ]);

      res.json({
        data: {
          total,
          in_stock: inStock,
          sold,
          damaged,
          returned,
        },
      });
    } catch (error) {
      logger.error('Error getting unit statistics:', error);
      next(error);
    }
  },

  /**
   * Bulk print barcode labels
   */
  async getBarcodeLabels(req, res, next) {
    try {
      const { inventory_item_id } = req.params;
      const { status = 'in_stock', limit = 100 } = req.query;

      const units = await req.tenantModels.InventoryUnit.findAll({
        where: {
          inventory_item_id,
          status,
        },
        include: [
          {
            model: req.tenantModels.InventoryItem,
            as: 'item',
          },
        ],
        limit: parseInt(limit),
      });

      const labels = units.map((unit) => ({
        barcode: unit.unit_barcode,
        item_name: unit.item?.item_name,
        item_code: unit.item?.item_code,
        serial_number: unit.serial_number,
      }));

      res.json({ data: labels });
    } catch (error) {
      logger.error('Error getting barcode labels:', error);
      next(error);
    }
  },
};
