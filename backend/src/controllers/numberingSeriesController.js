/**
 * Numbering Series Controller
 * 
 * Handles API endpoints for managing numbering series configurations
 * for different voucher types including Bill of Supply.
 * 
 * Requirements: 11.1, 11.2, 11.3
 */

const NumberingService = require('../services/numberingService');
const logger = require('../utils/logger');
const { findByIdScoped } = require('../utils/scopedQueries');

/**
 * List all numbering series for the tenant
 * GET /accounting/numbering-series
 */
exports.list = async (req, res) => {
  try {
    const { tenant_id } = req;
    const { voucher_type, is_active, is_default } = req.query;

    // Set context for NumberingService
    NumberingService.setContext({ tenantModels: req.tenantModels });

    // Build filters
    const filters = {};
    if (voucher_type) filters.voucher_type = voucher_type;
    if (is_active !== undefined) filters.is_active = is_active === 'true';
    if (is_default !== undefined) filters.is_default = is_default === 'true';

    const series = await NumberingService.getNumberingSeries(tenant_id, filters);

    res.json({
      success: true,
      data: series,
      count: series.length
    });
  } catch (error) {
    logger.error('Error listing numbering series:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list numbering series',
      error: error.message
    });
  }
};

/**
 * Get a specific numbering series by ID
 * GET /accounting/numbering-series/:id
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req;

    const series = await findByIdScoped(req, req.tenantModels.NumberingSeries, id);

    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Numbering series not found'
      });
    }

    res.json({
      success: true,
      data: series
    });
  } catch (error) {
    logger.error('Error getting numbering series:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get numbering series',
      error: error.message
    });
  }
};

/**
 * Create a new numbering series
 * POST /accounting/numbering-series
 */
exports.create = async (req, res) => {
  try {
    const { tenant_id } = req;
    const seriesConfig = req.body;

    // Set context for NumberingService
    NumberingService.setContext({ tenantModels: req.tenantModels });

    // Validate required fields
    const requiredFields = ['voucher_type', 'series_name', 'prefix', 'format'];
    const missingFields = requiredFields.filter(field => !seriesConfig[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missingFields
      });
    }

    // Create the series
    const series = await NumberingService.createNumberingSeries(tenant_id, seriesConfig);

    logger.info(`Created numbering series: ${series.series_name} for tenant ${tenant_id}`);

    res.status(201).json({
      success: true,
      message: 'Numbering series created successfully',
      data: series
    });
  } catch (error) {
    logger.error('Error creating numbering series:', error);
    
    // Handle validation errors
    if (error.message.includes('must contain') || error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create numbering series',
      error: error.message
    });
  }
};

/**
 * Update an existing numbering series
 * PUT /accounting/numbering-series/:id
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req;
    const updates = req.body;

    // Set context for NumberingService
    NumberingService.setContext({ tenantModels: req.tenantModels });

    // Verify series belongs to tenant
    const existingSeries = await findByIdScoped(req, req.tenantModels.NumberingSeries, id);

    if (!existingSeries) {
      return res.status(404).json({
        success: false,
        message: 'Numbering series not found'
      });
    }

    // Update the series
    const updatedSeries = await NumberingService.updateNumberingSeries(id, updates);

    logger.info(`Updated numbering series: ${updatedSeries.series_name} for tenant ${tenant_id}`);

    res.json({
      success: true,
      message: 'Numbering series updated successfully',
      data: updatedSeries
    });
  } catch (error) {
    logger.error('Error updating numbering series:', error);
    
    // Handle validation errors
    if (error.message.includes('must contain') || error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update numbering series',
      error: error.message
    });
  }
};

/**
 * Set a numbering series as default for its voucher type
 * POST /accounting/numbering-series/:id/set-default
 */
exports.setDefault = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req;

    // Set context for NumberingService
    NumberingService.setContext({ tenantModels: req.tenantModels });

    // Verify series belongs to tenant
    const existingSeries = await findByIdScoped(req, req.tenantModels.NumberingSeries, id);

    if (!existingSeries) {
      return res.status(404).json({
        success: false,
        message: 'Numbering series not found'
      });
    }

    // Set as default
    const updatedSeries = await NumberingService.setDefaultSeries(id);

    logger.info(`Set numbering series as default: ${updatedSeries.series_name} for tenant ${tenant_id}`);

    res.json({
      success: true,
      message: 'Numbering series set as default successfully',
      data: updatedSeries
    });
  } catch (error) {
    logger.error('Error setting default numbering series:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set default numbering series',
      error: error.message
    });
  }
};

/**
 * Preview the next voucher number for a series
 * GET /accounting/numbering-series/:id/preview
 */
exports.preview = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req;

    // Set context for NumberingService
    NumberingService.setContext({ tenantModels: req.tenantModels });

    // Verify series belongs to tenant
    const existingSeries = await findByIdScoped(req, req.tenantModels.NumberingSeries, id);

    if (!existingSeries) {
      return res.status(404).json({
        success: false,
        message: 'Numbering series not found'
      });
    }

    // Preview next number
    const nextNumber = await NumberingService.previewNextNumber(id);

    res.json({
      success: true,
      data: {
        series_id: id,
        series_name: existingSeries.series_name,
        next_number: nextNumber
      }
    });
  } catch (error) {
    logger.error('Error previewing next number:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preview next number',
      error: error.message
    });
  }
};

/**
 * Delete/deactivate a numbering series
 * DELETE /accounting/numbering-series/:id
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req;

    // Verify series belongs to tenant
    const series = await findByIdScoped(req, req.tenantModels.NumberingSeries, id);

    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Numbering series not found'
      });
    }

    // Check if series has been used
    const historyCount = await req.tenantModels.NumberingHistory.count({
      where: {
        series_id: id
      }
    });

    if (historyCount > 0) {
      // Soft delete - deactivate instead of deleting
      await series.update({ is_active: false });
      
      logger.info(`Deactivated numbering series: ${series.series_name} for tenant ${tenant_id}`);
      
      return res.json({
        success: true,
        message: 'Numbering series deactivated successfully (has been used)',
        data: series
      });
    }

    // Hard delete if never used
    await series.destroy();
    
    logger.info(`Deleted numbering series: ${series.series_name} for tenant ${tenant_id}`);

    res.json({
      success: true,
      message: 'Numbering series deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting numbering series:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete numbering series',
      error: error.message
    });
  }
};
