const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { findByIdScoped } = require('../utils/scopedQueries');

module.exports = {
  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, search, warehouse_id, inventory_item_id } = req.query;
      const offset = (page - 1) * limit;
      const where = {
        movement_type: 'ADJ',
      };

      if (warehouse_id) {
        where.warehouse_id = warehouse_id;
      }

      if (inventory_item_id) {
        where.inventory_item_id = inventory_item_id;
      }

      const { count, rows } = await req.tenantModels.StockMovement.findAndCountAll({
        where,
        include: [
          {
            model: req.tenantModels.InventoryItem,
            as: 'item', // Use the correct alias defined in the association
            attributes: ['id', 'item_name', 'item_code'],
            required: false,
          },
          {
            model: req.tenantModels.Warehouse,
            as: 'warehouse', // Use the alias defined in the association
            attributes: ['id', 'warehouse_name', 'warehouse_code'],
            required: false,
          },
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
      });

      const data = rows.map((movement) => ({
        id: movement.id,
        date: movement.createdAt,
        item_name: movement.item?.item_name,
        item_code: movement.item?.item_code,
        warehouse_name: movement.warehouse?.warehouse_name,
        warehouse_code: movement.warehouse?.warehouse_code,
        quantity: parseFloat(movement.quantity) || 0,
        rate: parseFloat(movement.rate) || 0,
        amount: parseFloat(movement.amount) || 0,
        narration: movement.narration,
        adjustment_type: movement.quantity > 0 ? 'Increase' : 'Decrease',
      }));

      res.json({
        data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (error) {
      logger.error('Error listing stock adjustments:', error);
      next(error);
    }
  },

  async create(req, res, next) {
    const t = await req.tenantDb.transaction();
    try {
      const { inventory_item_id, warehouse_id, quantity, reason, adjustment_date } = req.body;

      if (!inventory_item_id) {
        return res.status(400).json({ error: 'Inventory item ID is required' });
      }

      const item = await findByIdScoped(req, req.tenantModels.InventoryItem, inventory_item_id, { transaction: t });
      if (!item) {
        await t.rollback();
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      const qty = parseFloat(quantity) || 0;
      if (qty === 0) {
        await t.rollback();
        return res.status(400).json({ error: 'Quantity cannot be zero' });
      }

      // If warehouse_id is provided, adjust warehouse stock
      if (warehouse_id) {
        const warehouse = await findByIdScoped(req, req.tenantModels.Warehouse, warehouse_id, { transaction: t });
        if (!warehouse) {
          await t.rollback();
          return res.status(404).json({ error: 'Warehouse not found' });
        }

        // Get or create warehouse stock
        const [warehouseStock] = await req.tenantModels.WarehouseStock.findOrCreate({
          where: {
            inventory_item_id,
            warehouse_id,
          },
          defaults: {
            inventory_item_id,
            warehouse_id,
            quantity: 0,
            avg_cost: parseFloat(item.avg_cost) || 0,
          },
          transaction: t,
        });

        const currentQty = parseFloat(warehouseStock.quantity) || 0;
        const newQty = currentQty + qty;

        if (newQty < 0) {
          await t.rollback();
          return res.status(400).json({ 
            error: 'Adjustment would result in negative stock quantity',
            current_quantity: currentQty,
            adjustment_quantity: qty,
          });
        }

        warehouseStock.quantity = newQty;
        await warehouseStock.save({ transaction: t });

        // Calculate adjustment amount using current average cost
        const avgCost = parseFloat(warehouseStock.avg_cost) || parseFloat(item.avg_cost) || 0;
        const adjustmentAmount = Math.abs(qty) * avgCost;

        // Create stock movement
        await req.tenantModels.StockMovement.create(
          {
            inventory_item_id,
            warehouse_id,
            voucher_id: null,
            movement_type: 'ADJ',
            quantity: qty,
            rate: avgCost,
            amount: adjustmentAmount,
            narration: reason || `Stock adjustment - ${qty > 0 ? 'Increase' : 'Decrease'}`,
          },
          { transaction: t }
        );

        // Update aggregate inventory item quantity
        await updateAggregateStock(req.tenantModels, inventory_item_id, t);
      } else {
        // Adjust aggregate stock (no warehouse specified)
        const currentQty = parseFloat(item.quantity_on_hand) || 0;
        const newQty = currentQty + qty;

        if (newQty < 0) {
          await t.rollback();
          return res.status(400).json({ 
            error: 'Adjustment would result in negative stock quantity',
            current_quantity: currentQty,
            adjustment_quantity: qty,
          });
        }

        const avgCost = parseFloat(item.avg_cost) || 0;
        const adjustmentAmount = Math.abs(qty) * avgCost;

        item.quantity_on_hand = newQty;
        await item.save({ transaction: t });

        // Create stock movement
        await req.tenantModels.StockMovement.create(
          {
            inventory_item_id,
            warehouse_id: null,
            voucher_id: null,
            movement_type: 'ADJ',
            quantity: qty,
            rate: avgCost,
            amount: adjustmentAmount,
            narration: reason || `Stock adjustment - ${qty > 0 ? 'Increase' : 'Decrease'}`,
          },
          { transaction: t }
        );
      }

      await t.commit();
      res.status(201).json({ message: 'Stock adjustment created successfully' });
    } catch (error) {
      await t.rollback();
      logger.error('Error creating stock adjustment:', error);
      next(error);
    }
  },
};

// Helper function for updating aggregate stock
async function updateAggregateStock(tenantModels, inventory_item_id, transaction) {
  // Recalculate aggregate quantity from all warehouse stocks
  const allWarehouseStocks = await tenantModels.WarehouseStock.findAll({
    where: { inventory_item_id },
    transaction,
  });

  let totalQty = 0;
  let totalValue = 0;
  allWarehouseStocks.forEach((ws) => {
    totalQty += parseFloat(ws.quantity) || 0;
    totalValue += (parseFloat(ws.quantity) || 0) * (parseFloat(ws.avg_cost) || 0);
  });

  const aggregateAvgCost = totalQty > 0 ? totalValue / totalQty : 0;
  await tenantModels.InventoryItem.update(
    {
      quantity_on_hand: totalQty,
      avg_cost: aggregateAvgCost,
    },
    {
      where: { id: inventory_item_id },
      transaction,
    }
  );
}
