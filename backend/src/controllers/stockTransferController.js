const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { findByIdScoped } = require('../utils/scopedQueries');

module.exports = {
  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, search, from_warehouse_id, to_warehouse_id, inventory_item_id } = req.query;
      const offset = (page - 1) * limit;

      // Validate tenant models are available
      if (!req.tenantModels || !req.tenantModels.StockMovement) {
        logger.error('Tenant models not available in stock transfer list');
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

      // Find stock movements that represent transfers (same item, different warehouses, same timestamp)
      const where = {};
      if (inventory_item_id) {
        where.inventory_item_id = inventory_item_id;
      }

      // Get all stock movements and group them by timestamp to find transfers
      const movements = await req.tenantModels.StockMovement.findAll({
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
            as: 'warehouse', // Use the correct alias defined in the association
            attributes: ['id', 'warehouse_name', 'warehouse_code'],
            required: false,
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: 1000, // Get a reasonable number to find transfers
      }).catch(error => {
        logger.error('Error fetching stock movements:', error);
        return [];
      });

      // Group movements by item and timestamp to identify transfers
      const transferMap = new Map();
      if (Array.isArray(movements)) {
        movements.forEach((movement) => {
          if (!movement || !movement.warehouse_id) return; // Skip aggregate movements or null movements
          
          const key = `${movement.inventory_item_id}_${movement.createdAt.toISOString()}`;
          if (!transferMap.has(key)) {
            transferMap.set(key, []);
          }
          transferMap.get(key).push(movement);
        });
      }

      // Filter to find pairs (OUT from one warehouse, IN to another)
      const transfers = [];
      transferMap.forEach((movementGroup) => {
        if (movementGroup.length === 2) {
          const outMovement = movementGroup.find((m) => parseFloat(m.quantity) < 0);
          const inMovement = movementGroup.find((m) => parseFloat(m.quantity) > 0);
          
          if (outMovement && inMovement && 
              outMovement.warehouse_id !== inMovement.warehouse_id &&
              Math.abs(Math.abs(parseFloat(outMovement.quantity)) - parseFloat(inMovement.quantity)) < 0.01) {
            
            // Apply filters
            if (from_warehouse_id && outMovement.warehouse_id !== from_warehouse_id) return;
            if (to_warehouse_id && inMovement.warehouse_id !== to_warehouse_id) return;

            transfers.push({
              id: outMovement.id, // Use out movement ID
              date: outMovement.createdAt,
              item_name: outMovement.item?.item_name || 'Unknown Item',
              item_code: outMovement.item?.item_code || '',
              from_warehouse_id: outMovement.warehouse_id,
              from_warehouse_name: outMovement.warehouse?.warehouse_name || 'Unknown Warehouse',
              to_warehouse_id: inMovement.warehouse_id,
              to_warehouse_name: inMovement.warehouse?.warehouse_name || 'Unknown Warehouse',
              quantity: Math.abs(parseFloat(outMovement.quantity)),
              rate: parseFloat(outMovement.rate) || 0,
              narration: outMovement.narration || '',
            });
          }
        }
      });

      // Paginate
      const total = transfers.length;
      const paginatedTransfers = transfers.slice(offset, offset + parseInt(limit));

      res.json({
        data: paginatedTransfers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Error listing stock transfers:', error);
      next(error);
    }
  },

  async create(req, res, next) {
    const t = await req.tenantDb.transaction();
    try {
      const { inventory_item_id, from_warehouse_id, to_warehouse_id, quantity, reason } = req.body;

      if (!inventory_item_id) {
        return res.status(400).json({ error: 'Inventory item ID is required' });
      }

      if (!from_warehouse_id || !to_warehouse_id) {
        await t.rollback();
        return res.status(400).json({ error: 'Both from warehouse and to warehouse are required' });
      }

      if (from_warehouse_id === to_warehouse_id) {
        await t.rollback();
        return res.status(400).json({ error: 'From warehouse and to warehouse cannot be the same' });
      }

      const qty = parseFloat(quantity) || 0;
      if (qty <= 0) {
        await t.rollback();
        return res.status(400).json({ error: 'Quantity must be greater than zero' });
      }

      const item = await findByIdScoped(req, req.tenantModels.InventoryItem, inventory_item_id, { transaction: t });
      if (!item) {
        await t.rollback();
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      const fromWarehouse = await findByIdScoped(req, req.tenantModels.Warehouse, from_warehouse_id, { transaction: t });
      if (!fromWarehouse) {
        await t.rollback();
        return res.status(404).json({ error: 'From warehouse not found' });
      }

      const toWarehouse = await findByIdScoped(req, req.tenantModels.Warehouse, to_warehouse_id, { transaction: t });
      if (!toWarehouse) {
        await t.rollback();
        return res.status(404).json({ error: 'To warehouse not found' });
      }

      // Get from warehouse stock
      const [fromWarehouseStock] = await req.tenantModels.WarehouseStock.findOrCreate({
        where: {
          inventory_item_id,
          warehouse_id: from_warehouse_id,
        },
        defaults: {
          inventory_item_id,
          warehouse_id: from_warehouse_id,
          quantity: 0,
          avg_cost: parseFloat(item.avg_cost) || 0,
        },
        transaction: t,
      });

      // Check if sufficient stock available
      const fromQty = parseFloat(fromWarehouseStock.quantity) || 0;
      if (fromQty < qty) {
        await t.rollback();
        return res.status(400).json({
          error: 'Insufficient stock in from warehouse',
          available_quantity: fromQty,
          requested_quantity: qty,
        });
      }

      // Get or create to warehouse stock
      const [toWarehouseStock] = await req.tenantModels.WarehouseStock.findOrCreate({
        where: {
          inventory_item_id,
          warehouse_id: to_warehouse_id,
        },
        defaults: {
          inventory_item_id,
          warehouse_id: to_warehouse_id,
          quantity: 0,
          avg_cost: parseFloat(fromWarehouseStock.avg_cost) || parseFloat(item.avg_cost) || 0,
        },
        transaction: t,
      });

      // Calculate transfer cost using from warehouse's average cost
      const transferRate = parseFloat(fromWarehouseStock.avg_cost) || parseFloat(item.avg_cost) || 0;
      const transferAmount = qty * transferRate;

      // Update from warehouse stock (decrease)
      fromWarehouseStock.quantity = fromQty - qty;
      await fromWarehouseStock.save({ transaction: t });

      // Update to warehouse stock (increase)
      const toQty = parseFloat(toWarehouseStock.quantity) || 0;
      const toAvgCost = parseFloat(toWarehouseStock.avg_cost) || 0;
      const newToQty = toQty + qty;
      
      // Calculate new average cost for to warehouse (weighted average)
      const newToAvgCost = newToQty > 0
        ? ((toQty * toAvgCost) + (qty * transferRate)) / newToQty
        : transferRate;

      toWarehouseStock.quantity = newToQty;
      toWarehouseStock.avg_cost = newToAvgCost;
      await toWarehouseStock.save({ transaction: t });

      const timestamp = new Date();
      const narration = reason || `Transfer from ${fromWarehouse.warehouse_name} to ${toWarehouse.warehouse_name}`;

      // Create OUT movement from source warehouse
      await req.tenantModels.StockMovement.create(
        {
          inventory_item_id,
          warehouse_id: from_warehouse_id,
          voucher_id: null,
          movement_type: 'OUT',
          quantity: -qty, // Negative for OUT
          rate: transferRate,
          amount: transferAmount,
          narration: `Transfer OUT: ${narration}`,
          createdAt: timestamp,
        },
        { transaction: t }
      );

      // Create IN movement to destination warehouse
      await req.tenantModels.StockMovement.create(
        {
          inventory_item_id,
          warehouse_id: to_warehouse_id,
          voucher_id: null,
          movement_type: 'IN',
          quantity: qty,
          rate: transferRate,
          amount: transferAmount,
          narration: `Transfer IN: ${narration}`,
          createdAt: timestamp,
        },
        { transaction: t }
      );

      // Update aggregate inventory item quantity
      await updateAggregateStock(req.tenantModels, inventory_item_id, t);

      await t.commit();
      res.status(201).json({ message: 'Stock transfer created successfully' });
    } catch (error) {
      await t.rollback();
      logger.error('Error creating stock transfer:', error);
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
