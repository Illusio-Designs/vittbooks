const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { findByIdScoped, findOneScoped } = require('../utils/scopedQueries');

module.exports = {
  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, search, is_active } = req.query;
      const offset = (page - 1) * limit;
      const where = {};

      // Validate tenant models are available
      if (!req.tenantModels || !req.tenantModels.Warehouse) {
        logger.error('Tenant models not available in warehouse list');
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
          { warehouse_name: { [Op.like]: `%${search}%` } },
          { warehouse_code: { [Op.like]: `%${search}%` } },
          { city: { [Op.like]: `%${search}%` } },
        ];
      }

      if (is_active !== undefined) {
        where.is_active = is_active === 'true' || is_active === true;
      }

      const result = await req.tenantModels.Warehouse.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['warehouse_name', 'ASC']],
      }).catch(error => {
        logger.error('Error fetching warehouses:', error);
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
      logger.error('Error listing warehouses:', error);
      res.status(500).json({
        data: [],
        pagination: {
          page: parseInt(req.query.page || 1),
          limit: parseInt(req.query.limit || 20),
          total: 0,
          totalPages: 0,
        },
        error: 'Failed to fetch warehouses'
      });
    }
  },

  async getAll(req, res, next) {
    try {
      const { is_active } = req.query;
      const where = {};

      // Validate tenant models are available
      if (!req.tenantModels || !req.tenantModels.Warehouse) {
        logger.error('Tenant models not available in warehouse getAll');
        return res.status(500).json({
          data: [],
          error: 'Database connection not available'
        });
      }

      if (is_active !== undefined) {
        where.is_active = is_active === 'true' || is_active === true;
      }

      const warehouses = await req.tenantModels.Warehouse.findAll({
        where,
        order: [['warehouse_name', 'ASC']],
      }).catch(error => {
        logger.error('Error fetching all warehouses:', error);
        return [];
      });

      res.json({ data: Array.isArray(warehouses) ? warehouses : [] });
    } catch (error) {
      logger.error('Error getting all warehouses:', error);
      res.status(500).json({
        data: [],
        error: 'Failed to fetch warehouses'
      });
    }
  },

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const warehouse = await findByIdScoped(req, req.tenantModels.Warehouse, id);

      if (!warehouse) {
        return res.status(404).json({ error: 'Warehouse not found' });
      }

      res.json({ data: warehouse });
    } catch (error) {
      logger.error('Error getting warehouse:', error);
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      const {
        warehouse_code,
        warehouse_name,
        address,
        city,
        state,
        pincode,
        contact_person,
        contact_phone,
        contact_email,
        is_active = true,
      } = req.body;

      if (!warehouse_name) {
        return res.status(400).json({ error: 'Warehouse name is required' });
      }

      // Check if warehouse_code already exists (if provided)
      if (warehouse_code) {
        const existing = await findOneScoped(req, req.tenantModels.Warehouse, { warehouse_code });

        if (existing) {
          return res.status(400).json({
            error: 'A warehouse with this code already exists',
          });
        }
      }

      const warehouse = await req.tenantModels.Warehouse.create({
        warehouse_code: warehouse_code || null,
        warehouse_name,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        contact_person: contact_person || null,
        contact_phone: contact_phone || null,
        contact_email: contact_email || null,
        is_active: is_active !== false,
        tenant_id: req.tenant_id,
      });

      res.status(201).json({ data: warehouse });
    } catch (error) {
      logger.error('Error creating warehouse:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          error: 'A warehouse with this code already exists',
        });
      }
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const {
        warehouse_code,
        warehouse_name,
        address,
        city,
        state,
        pincode,
        contact_person,
        contact_phone,
        contact_email,
        is_active,
      } = req.body;

      const warehouse = await findByIdScoped(req, req.tenantModels.Warehouse, id);

      if (!warehouse) {
        return res.status(404).json({ error: 'Warehouse not found' });
      }

      // Check if warehouse_code conflicts with another warehouse
      if (warehouse_code !== undefined && warehouse_code !== warehouse.warehouse_code) {
        const existing = await findOneScoped(req, req.tenantModels.Warehouse, { warehouse_code, id: { [Op.ne]: id } });
        if (existing) {
          return res.status(400).json({
            error: 'A warehouse with this code already exists',
          });
        }
      }

      const updateData = {};
      if (warehouse_code !== undefined) updateData.warehouse_code = warehouse_code || null;
      if (warehouse_name !== undefined) updateData.warehouse_name = warehouse_name;
      if (address !== undefined) updateData.address = address || null;
      if (city !== undefined) updateData.city = city || null;
      if (state !== undefined) updateData.state = state || null;
      if (pincode !== undefined) updateData.pincode = pincode || null;
      if (contact_person !== undefined) updateData.contact_person = contact_person || null;
      if (contact_phone !== undefined) updateData.contact_phone = contact_phone || null;
      if (contact_email !== undefined) updateData.contact_email = contact_email || null;
      if (is_active !== undefined) updateData.is_active = is_active;

      await warehouse.update(updateData);

      res.json({ data: warehouse });
    } catch (error) {
      logger.error('Error updating warehouse:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          error: 'A warehouse with this code already exists',
        });
      }
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const warehouse = await findByIdScoped(req, req.tenantModels.Warehouse, id);

      if (!warehouse) {
        return res.status(404).json({ error: 'Warehouse not found' });
      }

      // Check if warehouse is used in any stock movements
      const stockMovements = await req.tenantModels.StockMovement.count({
        where: { warehouse_id: id },
      });

      if (stockMovements > 0) {
        // Soft delete by setting is_active to false
        await warehouse.update({ is_active: false });
        return res.json({
          data: warehouse,
          message: 'Warehouse deactivated (has stock movements)',
        });
      }

      await warehouse.destroy();
      res.json({ message: 'Warehouse deleted successfully' });
    } catch (error) {
      logger.error('Error deleting warehouse:', error);
      next(error);
    }
  },
};
