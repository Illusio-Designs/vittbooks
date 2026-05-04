/**
 * TDS/TCS Controller
 * Phase 1: Foundation Layer - Section Management
 */

const logger = require('../utils/logger');
const tdsService = require('../services/tdsService');

module.exports = {
  /**
   * Get TDS sections list
   */
  async getTDSSections(req, res, next) {
    try {
      const sections = await tdsService.getTDSSectionsFromDB(req.masterModels);
      res.json({ success: true, data: sections });
    } catch (error) {
      logger.error('Get TDS sections error:', error);
      next(error);
    }
  },

  /**
   * Get TCS sections list
   */
  async getTCSSections(req, res, next) {
    try {
      const sections = await tdsService.getTCSSectionsFromDB(req.masterModels);
      res.json({ success: true, data: sections });
    } catch (error) {
      logger.error('Get TCS sections error:', error);
      next(error);
    }
  },

  /**
   * Get company TDS/TCS configuration
   */
  async getCompanyConfig(req, res, next) {
    try {
      let { companyId } = req.params;
      
      // If companyId is 'current', use the company from request context
      if (companyId === 'current' || !companyId) {
        companyId = req.company?.id;
      }
      
      if (!companyId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Company ID is required' 
        });
      }
      
      const config = await tdsService.getCompanyTDSTCSConfig(req.masterModels, companyId, req.tenant_id);
      res.json({ success: true, data: config });
    } catch (error) {
      logger.error('Get company TDS/TCS config error:', error);
      next(error);
    }
  },

  /**
   * Manually trigger TDS ledger creation (admin only)
   */
  async createTDSLedgers(req, res, next) {
    try {
      const ledgers = await tdsService.createTDSLedgers(
        req.tenantModels,
        req.masterModels,
        req.tenant_id
      );
      res.json({
        success: true,
        message: 'TDS ledgers created successfully',
        data: ledgers,
      });
    } catch (error) {
      logger.error('Create TDS ledgers error:', error);
      next(error);
    }
  },

  /**
   * Manually trigger TCS ledger creation (admin only)
   */
  async createTCSLedgers(req, res, next) {
    try {
      const ledgers = await tdsService.createTCSLedgers(
        req.tenantModels,
        req.masterModels,
        req.tenant_id
      );
      res.json({
        success: true,
        message: 'TCS ledgers created successfully',
        data: ledgers,
      });
    } catch (error) {
      logger.error('Create TCS ledgers error:', error);
      next(error);
    }
  },
};
