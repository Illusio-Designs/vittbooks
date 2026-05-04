const crypto = require('crypto');
const EWayBillClient = require('./eWayBillClient');
const { createApiClientFromCompany } = require('./thirdPartyApiClient');
const logger = require('../utils/logger');
const { findByIdScoped, findOneScoped } = require('../utils/scopedQueries');

function nowIso() {
  return new Date().toISOString();
}

function fakeEWayBillNo() {
  // 12 digits-like
  const n = crypto.randomInt(100000000000, 999999999999);
  return String(n);
}

/**
 * E-Way Bill Service
 * Handles E-Way Bill generation, cancellation, and management
 * Integrates with E-Way Bill Portal for government compliance
 */
class EWayBillService {
  constructor() {
    this.eWayBillClient = null;
    this.eWayBillThreshold = parseFloat(process.env.EWAY_BILL_THRESHOLD) || 50000; // ₹50,000 default
    
    // Circuit breaker configuration
    this.circuitBreaker = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      halfOpenRequests: 1,
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      failures: 0,
      successes: 0,
      nextAttempt: null,
      halfOpenAttempts: 0
    };
  }

  /**
   * Check circuit breaker state
   * @returns {boolean} True if requests are allowed
   */
  isCircuitBreakerOpen() {
    const now = Date.now();
    
    switch (this.circuitBreaker.state) {
      case 'CLOSED':
        return false;
        
      case 'OPEN':
        if (now >= this.circuitBreaker.nextAttempt) {
          this.circuitBreaker.state = 'HALF_OPEN';
          this.circuitBreaker.halfOpenAttempts = 0;
          logger.info('Circuit breaker transitioning to HALF_OPEN state');
          return false;
        }
        return true;
        
      case 'HALF_OPEN':
        return this.circuitBreaker.halfOpenAttempts >= this.circuitBreaker.halfOpenRequests;
        
      default:
        return false;
    }
  }

  /**
   * Record circuit breaker success
   */
  recordCircuitBreakerSuccess() {
    this.circuitBreaker.failures = 0;
    
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.successes++;
      if (this.circuitBreaker.successes >= this.circuitBreaker.successThreshold) {
        this.circuitBreaker.state = 'CLOSED';
        this.circuitBreaker.successes = 0;
        logger.info('Circuit breaker closed - service recovered');
      }
    }
  }

  /**
   * Record circuit breaker failure
   */
  recordCircuitBreakerFailure() {
    this.circuitBreaker.failures++;
    
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.nextAttempt = Date.now() + this.circuitBreaker.timeout;
      logger.warn('Circuit breaker opened - service failing');
    } else if (this.circuitBreaker.failures >= this.circuitBreaker.failureThreshold) {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.nextAttempt = Date.now() + this.circuitBreaker.timeout;
      logger.warn(`Circuit breaker opened after ${this.circuitBreaker.failures} failures`);
    }
  }

  /**
   * Execute operation with circuit breaker protection
   * @param {Function} operation - Operation to execute
   * @returns {Promise<any>} Operation result
   */
  async executeWithCircuitBreaker(operation) {
    if (this.isCircuitBreakerOpen()) {
      throw new Error('E-Way Bill Portal service is currently unavailable (circuit breaker open)');
    }

    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.halfOpenAttempts++;
    }

    try {
      const result = await operation();
      this.recordCircuitBreakerSuccess();
      return result;
    } catch (error) {
      this.recordCircuitBreakerFailure();
      throw error;
    }
  }

  /**
   * Get or create E-Way Bill client instance
   * @param {Object} company - Company configuration
   * @returns {EWayBillClient} E-Way Bill client instance
   */
  getEWayBillClient(company) {
    if (!this.eWayBillClient) {
      const settings = company?.settings || {};
      const config = {
        baseUrl: process.env.EWAY_BILL_BASE_URL || 'https://api.sandbox.co.in',
        apiKey: process.env.SANDBOX_API_KEY,
        apiSecret: process.env.SANDBOX_API_SECRET,
        environment: process.env.SANDBOX_ENVIRONMENT || 'test',
        // Company-specific E-Way Bill credentials
        ewaybillUsername: settings.ewaybill_username,
        ewaybillPassword: settings.ewaybill_password,
        gstin: company.gstin,
      };
      
      this.eWayBillClient = new EWayBillClient(config);
    }
    return this.eWayBillClient;
  }

  /**
   * Check if E-Way Bill is required for the voucher
   * @param {Object} voucher - Voucher object
   * @returns {boolean} True if E-Way Bill is required
   */
  isEWayBillRequired(voucher) {
    // E-Way Bill is required for sales invoices with goods above threshold
    const salesInvoiceTypes = ['Sales Invoice', 'Sales', 'Tax Invoice'];
    if (!salesInvoiceTypes.includes(voucher.voucher_type)) {
      return false;
    }
    
    const totalAmount = parseFloat(voucher.total_amount || 0);
    return totalAmount > this.eWayBillThreshold;
  }

  /**
   * Validate E-Way Bill mandatory fields
   * @param {Object} voucher - Voucher with related data
   * @param {Object} transportDetails - Transport details
   * @returns {Object} Validation result
   */
  validateEWayBillFields(voucher, transportDetails) {
    const errors = [];
    const warnings = [];

    // Check voucher basic fields
    if (!voucher.voucher_number) {
      errors.push('Voucher number is required');
    }
    
    if (!voucher.voucher_date) {
      errors.push('Voucher date is required');
    }
    
    if (!voucher.total_amount || parseFloat(voucher.total_amount) <= 0) {
      errors.push('Total amount must be greater than 0');
    }

    // Check transport details
    if (!transportDetails) {
      errors.push('Transport details are required');
      return { isValid: false, errors, warnings };
    }

    // Validate transporter GSTIN if provided
    if (transportDetails.transporter_id) {
      if (!this.validateGSTIN(transportDetails.transporter_id)) {
        errors.push(`Invalid transporter GSTIN format: ${transportDetails.transporter_id}`);
      }
    }

    // Validate vehicle number
    if (!transportDetails.vehicle_no || transportDetails.vehicle_no.trim() === '') {
      errors.push('Vehicle number is required');
    }

    // Validate transport mode
    const validModes = ['road', 'rail', 'air', 'ship'];
    if (!transportDetails.transport_mode || !validModes.includes(transportDetails.transport_mode.toLowerCase())) {
      errors.push(`Transport mode must be one of: ${validModes.join(', ')}`);
    }

    // Validate distance
    if (!transportDetails.distance || parseFloat(transportDetails.distance) <= 0) {
      errors.push('Distance must be greater than 0');
    }

    // Check items
    if (!voucher.voucher_items || voucher.voucher_items.length === 0) {
      errors.push('At least one item is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calculate E-Way Bill validity period based on distance
   * @param {number} distance - Distance in kilometers
   * @param {string} goodsType - Type of goods (normal, over-dimensional, etc.)
   * @returns {Date} Validity date
   */
  calculateValidityPeriod(distance, goodsType = 'normal') {
    // 1 day per 200 KM for normal goods
    // For over-dimensional cargo or multi-modal transport, 1 day per 20 KM
    const kmPerDay = goodsType === 'over-dimensional' ? 20 : 200;
    const validityDays = Math.ceil(distance / kmPerDay);
    
    const validityDate = new Date();
    validityDate.setDate(validityDate.getDate() + validityDays);
    
    return validityDate;
  }

  /**
   * Validate GSTIN format
   * @param {string} gstin - GSTIN to validate
   * @returns {boolean} True if valid
   */
  validateGSTIN(gstin) {
    if (!gstin || typeof gstin !== 'string') return false;
    
    // GSTIN format: 2 digits (state) + 10 chars (PAN) + 1 digit (entity) + 1 char (Z) + 1 check digit
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin);
  }

  /**
   * Generate E-Way Bill
   * @param {string} voucherId - Voucher ID
   * @param {Object} transportDetails - Transport details
   * @param {Object} ctx - Context with tenant models and company
   * @returns {Promise<Object>} E-Way Bill response
   */
  async generateEWayBill(voucherId, transportDetails, ctx) {
    const { tenantModels, company, tenant_id, company_id } = ctx;
    const scopeCtx = { tenant_id: tenant_id || null, company_id: company_id || null };

    // Fetch voucher with all related data
    const voucher = await findByIdScoped(scopeCtx, tenantModels.Voucher, voucherId, {
      include: [
        { model: tenantModels.VoucherItem, as: 'voucher_items' },
        { model: tenantModels.Ledger, as: 'partyLedger' },
      ],
    });

    if (!voucher) {
      throw new Error('Voucher not found');
    }

    if (voucher.status !== 'posted') {
      throw new Error('Voucher must be posted before generating E-Way Bill');
    }

    // Check if E-Way Bill already exists
    const existing = await findOneScoped(scopeCtx, tenantModels.EWayBill, {
      voucher_id: voucherId,
      status: 'active',
    });
    if (existing) {
      return {
        id: existing.id,
        voucher_id: voucherId,
        ewb_no: existing.ewb_number,
        ewb_date: existing.ewb_date,
        valid_upto: existing.valid_upto,
        status: 'active',
        vehicle_no: existing.vehicle_no,
        transporter_id: existing.transporter_id,
        transport_mode: existing.transport_mode,
        distance: existing.distance,
      };
    }

    // Check if E-Way Bill is required (threshold check)
    if (!this.isEWayBillRequired(voucher)) {
      throw new Error(`E-Way Bill not required for voucher type '${voucher.voucher_type}' or amount below threshold (₹${this.eWayBillThreshold})`);
    }

    // Validate mandatory fields
    const validation = this.validateEWayBillFields(voucher, transportDetails);
    if (!validation.isValid) {
      const errorMessage = `E-Way Bill validation failed: ${validation.errors.join(', ')}`;
      throw new Error(errorMessage);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      logger.warn('E-Way Bill validation warnings:', validation.warnings);
    }

    // Calculate validity period based on distance
    const distance = parseFloat(transportDetails.distance);
    const validityDate = this.calculateValidityPeriod(distance, transportDetails.goods_type);

    try {
      // Transform voucher data to E-Way Bill format
      const eWayBillData = this.transformToEWayBillFormat(voucher, transportDetails, company);
      
      // Execute with circuit breaker protection
      const result = await this.executeWithCircuitBreaker(async () => {
        const eWayBillClient = this.getEWayBillClient(company);
        return await eWayBillClient.generateEWayBill(eWayBillData);
      });

      // Store successful response
      const eWayBill = await tenantModels.EWayBill.create({
        voucher_id: voucherId,
        ewb_number: result.ewbNo || result.EwbNo || result.eway_bill_no,
        ewb_date: result.ewbDate ? new Date(result.ewbDate) : new Date(),
        valid_upto: result.validUpto ? new Date(result.validUpto) : validityDate,
        status: 'active',
        vehicle_no: transportDetails.vehicle_no,
        transporter_id: transportDetails.transporter_id || null,
        transporter_name: transportDetails.transporter_name || null,
        transport_mode: transportDetails.transport_mode.toLowerCase(),
        distance: distance,
        tenant_id: voucher.tenant_id,
      });

      logger.info('E-Way Bill generated successfully', { 
        voucherId, 
        ewbNo: eWayBill.ewb_number,
        validUpto: eWayBill.valid_upto 
      });

      return {
        id: eWayBill.id,
        voucher_id: voucherId,
        ewb_no: eWayBill.ewb_number,
        ewb_date: eWayBill.ewb_date,
        valid_upto: eWayBill.valid_upto,
        status: 'active',
        vehicle_no: eWayBill.vehicle_no,
        transporter_id: eWayBill.transporter_id,
        transporter_name: eWayBill.transporter_name,
        transport_mode: eWayBill.transport_mode,
        distance: eWayBill.distance,
      };
    } catch (error) {
      logger.error('E-Way Bill generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Transform voucher data to E-Way Bill format
   * @param {Object} voucher - Voucher with related data
   * @param {Object} transportDetails - Transport details
   * @param {Object} company - Company configuration
   * @returns {Object} E-Way Bill format data
   */
  transformToEWayBillFormat(voucher, transportDetails, company) {
    const partyLedger = voucher.partyLedger || {};
    const items = voucher.voucher_items || [];

    // Format date as DD/MM/YYYY
    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    // Map transport mode to API code
    const transportModeMap = {
      'road': '1',
      'rail': '2',
      'air': '3',
      'ship': '4'
    };

    const eWayBillData = {
      supplyType: 'O', // Outward
      subSupplyType: '1', // Supply
      docType: 'INV',
      docNo: voucher.voucher_number,
      docDate: formatDate(voucher.voucher_date),
      fromGstin: company.gstin || '',
      fromTrdName: company.company_name || company.name || '',
      fromAddr1: company.address_line_1 || company.address || '',
      fromAddr2: company.address_line_2 || '',
      fromPlace: company.city || '',
      fromPincode: parseInt(company.pincode || 0) || undefined,
      fromStateCode: company.state_code || '',
      toGstin: partyLedger.gstin || undefined,
      toTrdName: partyLedger.ledger_name || partyLedger.name || '',
      toAddr1: partyLedger.address_line_1 || partyLedger.address || '',
      toAddr2: partyLedger.address_line_2 || '',
      toPlace: partyLedger.city || '',
      toPincode: parseInt(partyLedger.pincode || 0) || undefined,
      toStateCode: partyLedger.state_code || '',
      transactionType: '1', // Regular
      totalValue: parseFloat(voucher.total_amount || 0),
      cgstValue: parseFloat(voucher.cgst_amount || 0),
      sgstValue: parseFloat(voucher.sgst_amount || 0),
      igstValue: parseFloat(voucher.igst_amount || 0),
      cessValue: parseFloat(voucher.cess_amount || 0),
      transporterId: transportDetails.transporter_id || '',
      transporterName: transportDetails.transporter_name || '',
      transMode: transportModeMap[transportDetails.transport_mode.toLowerCase()] || '1',
      transDistance: parseInt(transportDetails.distance) || 0,
      vehicleNo: transportDetails.vehicle_no.replace(/\s/g, '').toUpperCase(),
      vehicleType: 'R', // Regular
      itemList: items.map((item, index) => ({
        itemNo: index + 1,
        productName: item.item_description || '',
        productDesc: item.item_description || '',
        hsnCode: item.hsn_sac_code || '',
        quantity: parseFloat(item.quantity || 0),
        qtyUnit: item.unit || 'NOS',
        taxableAmount: parseFloat(item.amount || 0),
        cgstRate: parseFloat(item.gst_rate || 0) / 2,
        sgstRate: parseFloat(item.gst_rate || 0) / 2,
        igstRate: parseFloat(item.gst_rate || 0),
        cessRate: parseFloat(item.cess_rate || 0),
      }))
    };

    return eWayBillData;
  }

  /**
   * Cancel E-Way Bill
   * @param {string} eWayBillId - E-Way Bill ID
   * @param {string} reason - Cancellation reason code
   * @param {string} remarks - Additional remarks
   * @param {Object} ctx - Context with tenant models and company
   * @returns {Promise<Object>} Cancellation response
   */
  async cancelEWayBill(eWayBillId, reason, remarks = '', ctx) {
    const { tenantModels, company, tenant_id, company_id } = ctx;
    const scopeCtx = { tenant_id: tenant_id || null, company_id: company_id || null };

    const eWayBill = await findByIdScoped(scopeCtx, tenantModels.EWayBill, eWayBillId);
    if (!eWayBill) {
      throw new Error('E-Way Bill not found');
    }

    if (eWayBill.status === 'cancelled') {
      return {
        id: eWayBill.id,
        voucher_id: eWayBill.voucher_id,
        ewb_no: eWayBill.ewb_number,
        status: 'cancelled',
        cancellation_reason: reason,
        cancellation_date: eWayBill.updatedAt,
      };
    }

    if (eWayBill.status !== 'active') {
      throw new Error('E-Way Bill must be active to be cancelled');
    }

    if (!eWayBill.ewb_number) {
      throw new Error('E-Way Bill number not found');
    }

    // Validate reason code
    if (!reason || reason.trim() === '') {
      throw new Error('Cancellation reason code is required');
    }

    try {
      // Call E-Way Bill portal to cancel
      const eWayBillClient = this.getEWayBillClient(company);
      await eWayBillClient.cancelEWayBill(eWayBill.ewb_number, reason, remarks);
      
      // Update local record
      await eWayBill.update({ 
        status: 'cancelled'
      });

      logger.info('E-Way Bill cancelled successfully', { 
        eWayBillId, 
        ewbNo: eWayBill.ewb_number,
        reason,
        remarks 
      });

      return {
        id: eWayBill.id,
        voucher_id: eWayBill.voucher_id,
        ewb_no: eWayBill.ewb_number,
        status: 'cancelled',
        cancellation_reason: reason,
        cancellation_remarks: remarks,
        cancellation_date: nowIso(),
      };
    } catch (error) {
      logger.error('E-Way Bill cancellation failed:', error.message);
      throw error;
    }
  }

  /**
   * Update vehicle details for E-Way Bill
   * @param {string} eWayBillId - E-Way Bill ID
   * @param {string} vehicleNo - New vehicle number
   * @param {string} reasonCode - Reason for vehicle change
   * @param {string} remarks - Additional remarks
   * @param {Object} ctx - Context with tenant models and company
   * @returns {Promise<Object>} Update response
   */
  async updateVehicleDetails(eWayBillId, vehicleNo, reasonCode, remarks = '', ctx) {
    const { tenantModels, company, tenant_id, company_id } = ctx;
    const scopeCtx = { tenant_id: tenant_id || null, company_id: company_id || null };

    const eWayBill = await findByIdScoped(scopeCtx, tenantModels.EWayBill, eWayBillId);
    if (!eWayBill) {
      throw new Error('E-Way Bill not found');
    }

    // Only allow updates for active E-Way Bills
    if (eWayBill.status !== 'active') {
      throw new Error('Vehicle details can only be updated for active E-Way Bills');
    }

    if (!eWayBill.ewb_number) {
      throw new Error('E-Way Bill number not found');
    }

    // Validate vehicle number
    if (!vehicleNo || vehicleNo.trim() === '') {
      throw new Error('Vehicle number is required');
    }

    // Validate reason code
    if (!reasonCode || reasonCode.trim() === '') {
      throw new Error('Reason code is required');
    }

    try {
      // Call E-Way Bill portal to update vehicle details
      const eWayBillClient = this.getEWayBillClient(company);
      await eWayBillClient.updateVehicleDetails(eWayBill.ewb_number, vehicleNo, reasonCode, remarks);
      
      // Update local record
      await eWayBill.update({ 
        vehicle_no: vehicleNo
      });

      logger.info('E-Way Bill vehicle details updated successfully', { 
        eWayBillId, 
        ewbNo: eWayBill.ewb_number,
        oldVehicleNo: eWayBill.vehicle_no,
        newVehicleNo: vehicleNo 
      });

      return {
        id: eWayBill.id,
        voucher_id: eWayBill.voucher_id,
        ewb_no: eWayBill.ewb_number,
        vehicle_no: vehicleNo,
        status: 'active',
        updated_at: nowIso(),
      };
    } catch (error) {
      logger.error('E-Way Bill vehicle update failed:', error.message);
      throw error;
    }
  }

  /**
   * Get E-Way Bill details
   * @param {string} eWayBillId - E-Way Bill ID
   * @param {Object} ctx - Context with tenant models
   * @returns {Promise<Object>} E-Way Bill details
   */
  async getEWayBill(eWayBillId, ctx) {
    const { tenantModels, tenant_id, company_id } = ctx;
    const scopeCtx = { tenant_id: tenant_id || null, company_id: company_id || null };

    const eWayBill = await findByIdScoped(scopeCtx, tenantModels.EWayBill, eWayBillId, {
      include: [{
        model: tenantModels.Voucher,
        as: 'voucher',
        attributes: ['id', 'voucher_number', 'voucher_date', 'voucher_type', 'total_amount']
      }]
    });

    if (!eWayBill) {
      throw new Error('E-Way Bill not found');
    }

    return {
      id: eWayBill.id,
      voucher_id: eWayBill.voucher_id,
      ewb_no: eWayBill.ewb_number,
      ewb_date: eWayBill.ewb_date,
      valid_upto: eWayBill.valid_upto,
      status: eWayBill.status,
      vehicle_no: eWayBill.vehicle_no,
      transporter_id: eWayBill.transporter_id,
      transporter_name: eWayBill.transporter_name,
      transport_mode: eWayBill.transport_mode,
      distance: eWayBill.distance,
      created_at: eWayBill.createdAt,
      updated_at: eWayBill.updatedAt,
      voucher: eWayBill.voucher
    };
  }

  /**
   * Legacy method for backward compatibility
   * Generate E-Way Bill
   */
  async generate(ctx, voucherId, details = {}) {
    // Transform old details format to new transportDetails format
    const transportDetails = {
      transporter_id: details.transporter_id || null,
      transporter_name: details.transporter_name || null,
      transport_mode: details.transport_mode || 'road',
      vehicle_no: details.vehicle_no || '',
      distance: details.distance_km || details.distance || 0,
      goods_type: details.goods_type || 'normal'
    };

    return this.generateEWayBill(voucherId, transportDetails, ctx);
  }

  /**
   * Legacy method for backward compatibility
   * Cancel E-Way Bill by voucher ID
   */
  async cancel(ctx, voucherId, reason) {
    const { tenantModels, tenant_id, company_id } = ctx;
    const scopeCtx = { tenant_id: tenant_id || null, company_id: company_id || null };
    const eWayBill = await findOneScoped(scopeCtx, tenantModels.EWayBill, { voucher_id: voucherId });
    if (!eWayBill) {
      throw new Error('E-Way Bill not found');
    }

    return this.cancelEWayBill(eWayBill.id, reason, '', ctx);
  }
}

module.exports = new EWayBillService();
