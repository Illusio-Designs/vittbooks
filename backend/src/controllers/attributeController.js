
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { findByIdScoped } = require('../utils/scopedQueries');

// Controller for managing reusable product attributes and their values
module.exports = {
  // -- Attribute Type Methods --

  async listAttributes(req, res, next) {
    try {
      const attributes = await req.tenantModels.ProductAttribute.findAll({
        include: [{ model: req.tenantModels.ProductAttributeValue, as: 'values' }],
        order: [['name', 'ASC'], ['values', 'value', 'ASC']],
      });
      res.json({ data: attributes });
    } catch (error) {
      logger.error('Error listing product attributes:', error);
      next(error);
    }
  },

  async createAttribute(req, res, next) {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Attribute name is required' });
      }

      const attribute = await req.tenantModels.ProductAttribute.create({ 
        name,
        tenant_id: req.tenantId, // Add tenantId to the creation
      });
      res.status(201).json({ data: attribute });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: `Attribute "${req.body.name}" already exists.` });
      }
      logger.error('Error creating product attribute:', error);
      next(error);
    }
  },

  async updateAttribute(req, res, next) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Attribute name is required' });
      }

      const attribute = await findByIdScoped(req, req.tenantModels.ProductAttribute, id);
      if (!attribute) {
        return res.status(404).json({ error: 'Attribute not found' });
      }

      attribute.name = name;
      await attribute.save();
      res.json({ data: attribute });
    } catch (error) {
       if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: `Attribute "${req.body.name}" already exists.` });
      }
      logger.error('Error updating product attribute:', error);
      next(error);
    }
  },

  async deleteAttribute(req, res, next) {
    try {
      const { id } = req.params;
      const attribute = await findByIdScoped(req, req.tenantModels.ProductAttribute, id);
      if (!attribute) {
        return res.status(404).json({ error: 'Attribute not found' });
      }

      await attribute.destroy(); // This will cascade delete all associated values
      res.json({ message: 'Attribute and all its values deleted successfully' });
    } catch (error) {
      logger.error('Error deleting product attribute:', error);
      next(error);
    }
  },

  // -- Attribute Value Methods --

  async addAttributeValue(req, res, next) {
    try {
      const { attributeId } = req.params;
      const { value } = req.body;
      if (!value) {
        return res.status(400).json({ error: 'Value is required' });
      }

      const attribute = await findByIdScoped(req, req.tenantModels.ProductAttribute, attributeId);
      if (!attribute) {
        return res.status(404).json({ error: 'Attribute not found' });
      }

      const newValue = await req.tenantModels.ProductAttributeValue.create({
        product_attribute_id: attributeId,
        value,
        tenant_id: req.tenantId, // Add tenantId
      });

      res.status(201).json({ data: newValue });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: `Value "${req.body.value}" already exists for this attribute.` });
      }
      logger.error('Error adding attribute value:', error);
      next(error);
    }
  },

  async removeAttributeValue(req, res, next) {
    try {
      const { valueId } = req.params;
      const value = await findByIdScoped(req, req.tenantModels.ProductAttributeValue, valueId);
      if (!value) {
        return res.status(404).json({ error: 'Attribute value not found' });
      }

      await value.destroy();
      res.json({ message: 'Attribute value deleted successfully' });
    } catch (error) {
      logger.error('Error deleting attribute value:', error);
      next(error);
    }
  },
};
