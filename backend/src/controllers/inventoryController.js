const { Op } = require('sequelize');
const logger = require('../utils/logger');
const masterModels = require('../models/masterModels');
const { findByIdScoped, findOneScoped } = require('../utils/scopedQueries');

// Helper function to get business type from company/branch
async function getBusinessType(companyId, branchId) {
  try {
    // If branchId is provided, check branch business_type first
    if (branchId) {
      const branch = await masterModels.Branch.findByPk(branchId);
      if (branch && branch.business_type) {
        return branch.business_type;
      }
      // If branch exists but business_type is null, fall through to company
      if (branch) {
        companyId = branch.company_id;
      }
    }
    
    // Check company business_type
    if (companyId) {
      const company = await masterModels.Company.findByPk(companyId);
      if (company && company.business_type) {
        return company.business_type;
      }
    }
    
    // Default to trader if nothing is set
    return 'trader';
  } catch (error) {
    logger.error('Error getting business type:', error);
    return 'trader'; // Default to trader on error
  }
}

// Helper function to check if barcode functionality is enabled for a tenant (DEPRECATED)
// Kept for backward compatibility
async function checkBarcodeEnabled(tenantId) {
  try {
    const TenantMaster = require('../models/TenantMaster');
    const tenant = await TenantMaster.findByPk(tenantId);
    
    if (!tenant || !tenant.settings) {
      return false; // Default to disabled if no settings
    }
    
    return tenant.settings.barcode_enabled === true;
  } catch (error) {
    logger.error('Error checking barcode setting:', error);
    return false; // Default to disabled on error
  }
}

module.exports = {
  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, search, is_active } = req.query;
      const offset = (page - 1) * limit;
      const where = {};

      // Validate tenant models are available
      if (!req.tenantModels || !req.tenantModels.InventoryItem) {
        logger.error('Tenant models not available in inventory list');
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

      if (search) {
        where[Op.or] = [
          { item_name: { [Op.like]: `%${search}%` } },
          { item_code: { [Op.like]: `%${search}%` } },
          { hsn_sac_code: { [Op.like]: `%${search}%` } },
        ];
      }

      if (is_active !== undefined) {
        where.is_active = is_active === 'true' || is_active === true;
      }

      const result = await req.tenantModels.InventoryItem.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['item_name', 'ASC']],
      }).catch(error => {
        logger.error('Error fetching inventory items:', error);
        return { count: 0, rows: [] };
      });

      const { count, rows } = result;

      // Calculate actual stock from stock movements for each item
      const itemsWithActualStock = await Promise.all(rows.map(async (item) => {
        try {
          // Calculate actual stock from stock movements
          const movements = await req.tenantModels.StockMovement.findAll({
            where: { inventory_item_id: item.id },
            attributes: ['movement_type', 'quantity'],
          });

          let actualStock = 0;
          movements.forEach(movement => {
            const qty = parseFloat(movement.quantity) || 0;
            if (movement.movement_type === 'IN' || movement.movement_type === 'ADJUSTMENT') {
              actualStock += Math.abs(qty);
            } else if (movement.movement_type === 'OUT') {
              actualStock -= Math.abs(qty);
            }
          });

          // Ensure actual stock is not negative
          actualStock = Math.max(0, actualStock);

          return {
            ...item.toJSON(),
            actual_stock: actualStock,
            stock_value: actualStock * (parseFloat(item.avg_cost) || 0),
          };
        } catch (error) {
          logger.error(`Error calculating actual stock for item ${item.id}:`, error);
          return {
            ...item.toJSON(),
            actual_stock: item.quantity_on_hand || 0,
            stock_value: (item.quantity_on_hand || 0) * (parseFloat(item.avg_cost) || 0),
          };
        }
      }));

      res.json({
        data: Array.isArray(itemsWithActualStock) ? itemsWithActualStock : [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    } catch (error) {
      logger.error('Error listing inventory items:', error);
      res.status(500).json({
        data: [],
        pagination: {
          page: parseInt(req.query.page || 1),
          limit: parseInt(req.query.limit || 20),
          total: 0,
          totalPages: 0,
        },
        error: 'Failed to fetch inventory items'
      });
    }
  },

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const item = await findByIdScoped(req, req.tenantModels.InventoryItem, id);

      if (!item) {
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      // Calculate actual stock from stock movements
      const movements = await req.tenantModels.StockMovement.findAll({
        where: { inventory_item_id: id },
        attributes: ['movement_type', 'quantity'],
      });

      let actualStock = 0;
      movements.forEach(movement => {
        const qty = parseFloat(movement.quantity) || 0;
        if (movement.movement_type === 'IN' || movement.movement_type === 'ADJUSTMENT') {
          actualStock += Math.abs(qty);
        } else if (movement.movement_type === 'OUT') {
          actualStock -= Math.abs(qty);
        }
      });

      // Ensure actual stock is not negative
      actualStock = Math.max(0, actualStock);

      const itemData = {
        ...item.toJSON(),
        actual_stock: actualStock,
        stock_value: actualStock * (parseFloat(item.avg_cost) || 0),
      };

      res.json({ data: itemData });
    } catch (error) {
      logger.error('Error getting inventory item:', error);
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      const {
        item_code,
        item_name,
        barcode,
        hsn_sac_code,
        uqc,
        gst_rate,
        quantity_on_hand = 0,
        avg_cost = 0,
        is_active = true,
        generate_barcode = false,
        barcode_type = 'EAN13', // EAN13, EAN8, CUSTOM
        barcode_prefix = 'PRD',
        company_id,
        branch_id,
      } = req.body;

      if (!item_name) {
        return res.status(400).json({ error: 'Item name is required' });
      }

      // Get business type from company/branch
      const businessType = await getBusinessType(company_id, branch_id);
      
      // For retail business type, barcode is mandatory
      if (businessType === 'retail' && !barcode && !generate_barcode) {
        return res.status(400).json({ 
          error: 'Barcode is required for retail business type. Please provide a barcode or enable generate_barcode.' 
        });
      }

      // Generate item_key from item_code or item_name
      const itemKey = String(item_code || item_name).trim().toLowerCase();

      // Check if item with same key already exists (per tenant)
      const existing = await findOneScoped(req, req.tenantModels.InventoryItem, {
        item_key: itemKey,
      });

      if (existing) {
        return res.status(400).json({ 
          error: 'An item with this code or name already exists' 
        });
      }

      // Check if barcode already exists (per tenant)
      if (barcode) {
        const existingBarcode = await findOneScoped(req, req.tenantModels.InventoryItem, {
          barcode,
        });
        if (existingBarcode) {
          return res.status(400).json({ 
            error: 'An item with this barcode already exists' 
          });
        }
      }

      // Generate barcode if requested
      let generatedBarcode = barcode;
      if (generate_barcode && !barcode) {
        const barcodeGenerator = require('../utils/barcodeGenerator');
        
        switch (barcode_type) {
          case 'EAN13':
            generatedBarcode = barcodeGenerator.generateEAN13('890'); // 890 is India prefix
            break;
          case 'EAN8':
            generatedBarcode = barcodeGenerator.generateEAN8();
            break;
          case 'CUSTOM':
            const nextSeq = await barcodeGenerator.getNextSequence(req.tenantModels, barcode_prefix);
            generatedBarcode = barcodeGenerator.generateCustomBarcode(barcode_prefix, nextSeq, 13);
            break;
          default:
            generatedBarcode = null;
        }

        // Ensure generated barcode is unique
        if (generatedBarcode) {
          const existingGenerated = await findOneScoped(req, req.tenantModels.InventoryItem, {
            barcode: generatedBarcode,
          });
          if (existingGenerated) {
            return res.status(400).json({ 
              error: 'Generated barcode already exists. Please try again.' 
            });
          }
        }
      }

      // For retail business type, ensure we have a barcode at this point
      if (businessType === 'retail' && !generatedBarcode) {
        return res.status(400).json({ 
          error: 'Failed to generate barcode for retail business type. Please try again or provide a barcode manually.' 
        });
      }

      const item = await req.tenantModels.InventoryItem.create({
        item_key: itemKey,
        item_code: item_code || null,
        item_name,
        barcode: generatedBarcode || null,
        hsn_sac_code: hsn_sac_code || null,
        uqc: uqc || null,
        gst_rate: gst_rate || null,
        quantity_on_hand: parseFloat(quantity_on_hand) || 0,
        avg_cost: parseFloat(avg_cost) || 0,
        is_active: is_active !== false,
        tenant_id: req.tenant_id,
        company_id: req.company_id || null,
      });

      // Create warehouse stock entry for default warehouse (always, even with 0 quantity)
      // This ensures items are properly connected to warehouses from the start
      const defaultWarehouse = await findOneScoped(req, req.tenantModels.Warehouse, {
        is_default: true,
        is_active: true,
      });

      if (defaultWarehouse) {
        await req.tenantModels.WarehouseStock.create({
          inventory_item_id: item.id,
          warehouse_id: defaultWarehouse.id,
          quantity: parseFloat(quantity_on_hand) || 0,
          avg_cost: parseFloat(avg_cost) || 0,
          tenant_id: req.tenant_id,
        });
      }

      res.status(201).json({ 
        data: item,
        business_type: businessType,
        warehouse: defaultWarehouse ? { 
          id: defaultWarehouse.id, 
          name: defaultWarehouse.warehouse_name,
          connected: true 
        } : { connected: false },
        message: businessType === 'retail' ? 'Item created with barcode (retail mode)' : 'Item created successfully'
      });
    } catch (error) {
      logger.error('Error creating inventory item:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ 
          error: 'An item with this code, name, or barcode already exists' 
        });
      }
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const {
        item_code,
        item_name,
        hsn_sac_code,
        uqc,
        gst_rate,
        quantity_on_hand,
        avg_cost,
        is_active,
      } = req.body;

      const item = await findByIdScoped(req, req.tenantModels.InventoryItem, id);

      if (!item) {
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      // If item_code or item_name is being updated, regenerate item_key
      const updateData = {};
      if (item_code !== undefined) updateData.item_code = item_code || null;
      if (item_name !== undefined) updateData.item_name = item_name;
      if (hsn_sac_code !== undefined) updateData.hsn_sac_code = hsn_sac_code || null;
      if (uqc !== undefined) updateData.uqc = uqc || null;
      if (gst_rate !== undefined) updateData.gst_rate = gst_rate || null;
      if (quantity_on_hand !== undefined) updateData.quantity_on_hand = parseFloat(quantity_on_hand) || 0;
      if (avg_cost !== undefined) updateData.avg_cost = parseFloat(avg_cost) || 0;
      if (is_active !== undefined) updateData.is_active = is_active;

      // Regenerate item_key if item_code or item_name changed
      if (item_code !== undefined || item_name !== undefined) {
        const newItemKey = String(updateData.item_code || updateData.item_name || item.item_code || item.item_name)
          .trim()
          .toLowerCase();
        
        // Check if new key conflicts with another item (in this tenant)
        if (newItemKey !== item.item_key) {
          const existing = await findOneScoped(req, req.tenantModels.InventoryItem, {
            item_key: newItemKey,
            id: { [Op.ne]: id },
          });
          if (existing) {
            return res.status(400).json({ 
              error: 'An item with this code or name already exists' 
            });
          }
        }
        updateData.item_key = newItemKey;
      }

      await item.update(updateData);

      res.json({ data: item });
    } catch (error) {
      logger.error('Error updating inventory item:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ 
          error: 'An item with this code or name already exists' 
        });
      }
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const item = await findByIdScoped(req, req.tenantModels.InventoryItem, id);

      if (!item) {
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      // Check if item is used in any stock movements
      const stockMovements = await req.tenantModels.StockMovement.count({
        where: { inventory_item_id: id },
      });

      if (stockMovements > 0) {
        // Soft delete by setting is_active to false
        await item.update({ is_active: false });
        return res.json({ 
          data: item,
          message: 'Item deactivated (has stock movements)' 
        });
      }

      await item.destroy();
      res.json({ message: 'Inventory item deleted successfully' });
    } catch (error) {
      logger.error('Error deleting inventory item:', error);
      next(error);
    }
  },

  async generateBarcode(req, res, next) {
    try {
      const { id } = req.params;
      const { barcode_type = 'EAN13', barcode_prefix = 'PRD', company_id, branch_id } = req.body;

      // Get business type from company/branch
      const businessType = await getBusinessType(company_id, branch_id);

      const item = await findByIdScoped(req, req.tenantModels.InventoryItem, id);
      if (!item) {
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      if (item.barcode) {
        return res.status(400).json({ 
          error: 'Item already has a barcode',
          current_barcode: item.barcode 
        });
      }

      const barcodeGenerator = require('../utils/barcodeGenerator');
      let generatedBarcode;

      switch (barcode_type) {
        case 'EAN13':
          generatedBarcode = barcodeGenerator.generateEAN13('890'); // 890 is India prefix
          break;
        case 'EAN8':
          generatedBarcode = barcodeGenerator.generateEAN8();
          break;
        case 'CUSTOM':
          const nextSeq = await barcodeGenerator.getNextSequence(req.tenantModels, barcode_prefix);
          generatedBarcode = barcodeGenerator.generateCustomBarcode(barcode_prefix, nextSeq, 13);
          break;
        default:
          return res.status(400).json({ error: 'Invalid barcode type' });
      }

      // Ensure generated barcode is unique within this tenant
      const existingBarcode = await findOneScoped(req, req.tenantModels.InventoryItem, {
        barcode: generatedBarcode,
      });

      if (existingBarcode) {
        return res.status(400).json({
          error: 'Generated barcode already exists. Please try again.'
        });
      }

      await item.update({ barcode: generatedBarcode });

      res.json({ 
        data: item,
        message: 'Barcode generated successfully',
        barcode: generatedBarcode,
        business_type: businessType
      });
    } catch (error) {
      logger.error('Error generating barcode:', error);
      next(error);
    }
  },

  async bulkGenerateBarcodes(req, res, next) {
    try {
      const { item_ids, barcode_type = 'EAN13', barcode_prefix = 'PRD' } = req.body;

      if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
        return res.status(400).json({ error: 'Item IDs array is required' });
      }

      const barcodeGenerator = require('../utils/barcodeGenerator');
      const results = [];
      const errors = [];

      for (const itemId of item_ids) {
        try {
          const item = await findByIdScoped(req, req.tenantModels.InventoryItem, itemId);
          
          if (!item) {
            errors.push({ item_id: itemId, error: 'Item not found' });
            continue;
          }

          if (item.barcode) {
            errors.push({ item_id: itemId, error: 'Item already has a barcode' });
            continue;
          }

          let generatedBarcode;
          switch (barcode_type) {
            case 'EAN13':
              generatedBarcode = barcodeGenerator.generateEAN13('890');
              break;
            case 'EAN8':
              generatedBarcode = barcodeGenerator.generateEAN8();
              break;
            case 'CUSTOM':
              const nextSeq = await barcodeGenerator.getNextSequence(req.tenantModels, barcode_prefix);
              generatedBarcode = barcodeGenerator.generateCustomBarcode(barcode_prefix, nextSeq, 13);
              break;
            default:
              errors.push({ item_id: itemId, error: 'Invalid barcode type' });
              continue;
          }

          // Check uniqueness within tenant
          const existingBarcode = await findOneScoped(req, req.tenantModels.InventoryItem, {
            barcode: generatedBarcode,
          });

          if (existingBarcode) {
            errors.push({ item_id: itemId, error: 'Generated barcode already exists' });
            continue;
          }

          await item.update({ barcode: generatedBarcode });
          results.push({ 
            item_id: itemId, 
            item_name: item.item_name,
            barcode: generatedBarcode 
          });
        } catch (error) {
          errors.push({ item_id: itemId, error: error.message });
        }
      }

      res.json({ 
        success: results.length,
        failed: errors.length,
        results,
        errors 
      });
    } catch (error) {
      logger.error('Error bulk generating barcodes:', error);
      next(error);
    }
  },

  async getBusinessType(req, res, next) {
    try {
      const { company_id, branch_id } = req.query;

      if (!company_id) {
        return res.status(400).json({ 
          error: 'company_id is required' 
        });
      }

      const businessType = await getBusinessType(company_id, branch_id);
      
      // Determine source
      let source = 'default';
      if (branch_id) {
        const branch = await masterModels.Branch.findByPk(branch_id);
        if (branch && branch.business_type) {
          source = 'branch';
        } else if (branch) {
          source = 'company';
        }
      } else {
        source = 'company';
      }

      res.json({ 
        business_type: businessType,
        source,
        message: businessType === 'retail' 
          ? 'Retail mode: Barcode is mandatory for inventory items' 
          : 'Trader mode: Barcode is optional for inventory items'
      });
    } catch (error) {
      logger.error('Error getting business type:', error);
      next(error);
    }
  },

  async setOpeningStockByWarehouse(req, res, next) {
    try {
      const { id } = req.params; // inventory_item_id
      const { warehouse_id, quantity, avg_cost } = req.body;

      if (!warehouse_id) {
        return res.status(400).json({ error: 'Warehouse ID is required' });
      }

      const item = await findByIdScoped(req, req.tenantModels.InventoryItem, id);
      if (!item) {
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      const warehouse = await findByIdScoped(req, req.tenantModels.Warehouse, warehouse_id);
      if (!warehouse) {
        return res.status(404).json({ error: 'Warehouse not found' });
      }

      const qty = parseFloat(quantity) || 0;
      const cost = parseFloat(avg_cost) || 0;

      // Find or create warehouse stock record
      const [warehouseStock] = await req.tenantModels.WarehouseStock.findOrCreate({
        where: {
          inventory_item_id: id,
          warehouse_id: warehouse_id,
        },
        defaults: {
          inventory_item_id: id,
          warehouse_id: warehouse_id,
          tenant_id: req.user.tenant_id, // Add missing tenant_id
          quantity: qty,
          avg_cost: cost,
        },
      });

      // Update if already exists
      if (warehouseStock.quantity !== qty || warehouseStock.avg_cost !== cost) {
        warehouseStock.quantity = qty;
        warehouseStock.avg_cost = cost;
        await warehouseStock.save();
      }

      // Create stock movement entry for opening stock
      await req.tenantModels.StockMovement.create({
        inventory_item_id: id,
        warehouse_id: warehouse_id,
        tenant_id: req.user.tenant_id, // Add missing tenant_id
        voucher_id: null,
        movement_type: 'IN',
        quantity: qty,
        rate: cost,
        amount: qty * cost,
        narration: `Opening Stock - ${warehouse.warehouse_name}`,
      });

      // Recalculate aggregate quantity_on_hand and avg_cost for the item
      const allWarehouseStocks = await req.tenantModels.WarehouseStock.findAll({
        where: { inventory_item_id: id },
      });

      let totalQty = 0;
      let totalValue = 0;
      allWarehouseStocks.forEach((ws) => {
        totalQty += parseFloat(ws.quantity) || 0;
        totalValue += (parseFloat(ws.quantity) || 0) * (parseFloat(ws.avg_cost) || 0);
      });

      const aggregateAvgCost = totalQty > 0 ? totalValue / totalQty : 0;
      await item.update({
        quantity_on_hand: totalQty,
        avg_cost: aggregateAvgCost,
      });

      res.json({
        data: warehouseStock,
        message: 'Opening stock set successfully',
      });
    } catch (error) {
      logger.error('Error setting opening stock by warehouse:', error);
      next(error);
    }
  },

  async getStockByWarehouse(req, res, next) {
    try {
      const { id } = req.params; // inventory_item_id
      const { warehouse_id } = req.query;

      const item = await findByIdScoped(req, req.tenantModels.InventoryItem, id);
      if (!item) {
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      const where = { inventory_item_id: id };
      if (warehouse_id) {
        where.warehouse_id = warehouse_id;
      }

      const warehouseStocks = await req.tenantModels.WarehouseStock.findAll({
        where,
        include: [
          {
            model: req.tenantModels.Warehouse,
            as: 'warehouse', // Use the alias defined in the association
            attributes: ['id', 'warehouse_name', 'warehouse_code'],
            required: false, // Left join - don't fail if warehouse doesn't exist
          },
        ],
      });

      const data = warehouseStocks.map((ws) => ({
        warehouse_id: ws.warehouse_id,
        warehouse_name: ws.warehouse?.warehouse_name,
        warehouse_code: ws.warehouse?.warehouse_code,
        quantity: parseFloat(ws.quantity) || 0,
        avg_cost: parseFloat(ws.avg_cost) || 0,
        stock_value: (parseFloat(ws.quantity) || 0) * (parseFloat(ws.avg_cost) || 0),
      }));

      // If warehouse_id is specified, return single object or null if not found; otherwise return array
      if (warehouse_id) {
        if (data.length === 1) {
          res.json({ data: data[0] });
        } else {
          // No warehouse stock found for this warehouse - return default structure
          res.json({ 
            data: {
              warehouse_id: warehouse_id,
              warehouse_name: null,
              warehouse_code: null,
              quantity: 0,
              avg_cost: 0,
              stock_value: 0,
            }
          });
        }
      } else {
        res.json({ data });
      }
    } catch (error) {
      logger.error('Error getting stock by warehouse:', error);
      next(error);
    }
  },
};
