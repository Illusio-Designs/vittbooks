const crypto = require('crypto');
const IRPClient = require('./irpClient');
const { createApiClientFromCompany } = require('./thirdPartyApiClient');
const logger = require('../utils/logger');
const { findByIdScoped, findOneScoped } = require('../utils/scopedQueries');

function nowIso() {
  return new Date().toISOString();
}

function fakeIrn() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

/**
 * E-Invoice Service
 * Handles E-Invoice generation, cancellation, and management
 * Integrates with IRP Portal for government compliance
 */
class EInvoiceService {
  constructor() {
    this.irpClient = null;
    this.eInvoiceThreshold = parseFloat(process.env.E_INVOICE_THRESHOLD) || 50000; // ₹50,000 default
    
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
      throw new Error('IRP Portal service is currently unavailable (circuit breaker open)');
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
   * Retry E-Invoice generation for failed attempts
   * @param {string} eInvoiceId - E-Invoice ID
   * @param {Object} ctx - Context with tenant models and company
   * @returns {Promise<Object>} Retry response
   */
  async retryEInvoiceGeneration(eInvoiceId, ctx) {
    const { tenantModels, company, tenant_id, company_id } = ctx;
    const scopeCtx = { tenant_id: tenant_id || null, company_id: company_id || null };

    const eInvoice = await findByIdScoped(scopeCtx, tenantModels.EInvoice, eInvoiceId, {
      include: [{
        model: tenantModels.Voucher,
        as: 'voucher',
        include: [
          { model: tenantModels.VoucherItem, as: 'voucher_items' },
          { model: tenantModels.Ledger, as: 'partyLedger' },
        ]
      }]
    });

    if (!eInvoice) {
      throw new Error('E-Invoice not found');
    }

    if (eInvoice.status === 'generated') {
      return {
        id: eInvoice.id,
        voucher_id: eInvoice.voucher_id,
        irn: eInvoice.irn,
        ack_no: eInvoice.ack_number,
        ack_date: eInvoice.ack_date,
        status: 'generated',
        message: 'E-Invoice already generated successfully'
      };
    }

    if (eInvoice.status !== 'pending') {
      throw new Error('E-Invoice must be in pending status to retry');
    }

    // Check retry limits
    const maxRetries = 5;
    if (eInvoice.retry_count >= maxRetries) {
      throw new Error(`Maximum retry attempts (${maxRetries}) exceeded for E-Invoice generation`);
    }

    // Check if enough time has passed since last retry (exponential backoff)
    if (eInvoice.last_retry_at) {
      const timeSinceLastRetry = Date.now() - new Date(eInvoice.last_retry_at).getTime();
      const minRetryInterval = Math.pow(2, eInvoice.retry_count) * 60000; // Exponential backoff in minutes
      
      if (timeSinceLastRetry < minRetryInterval) {
        const waitTime = Math.ceil((minRetryInterval - timeSinceLastRetry) / 60000);
        throw new Error(`Please wait ${waitTime} minutes before retrying E-Invoice generation`);
      }
    }

    // Update retry count and timestamp
    await eInvoice.update({
      retry_count: eInvoice.retry_count + 1,
      last_retry_at: new Date()
    });

    const voucher = eInvoice.voucher;
    if (!voucher) {
      throw new Error('Associated voucher not found');
    }

    // Add company data to voucher
    voucher.company = company;

    try {
      // Execute with circuit breaker protection
      const result = await this.executeWithCircuitBreaker(async () => {
        // Validate mandatory fields
        const validation = this.validateEInvoiceFields(voucher);
        if (!validation.isValid) {
          throw new Error(`E-Invoice validation failed: ${validation.errors.join(', ')}`);
        }

        // Transform voucher data to IRP format
        const invoiceData = this.transformToIRPFormat(voucher);
        
        // Get IRP client and generate E-Invoice
        const irpClient = this.getIRPClient(company);
        return await irpClient.generateEInvoice(invoiceData);
      });

      // Update E-Invoice with successful response
      await eInvoice.update({
        irn: result.Irn || result.irn,
        ack_number: result.AckNo || result.ack_no,
        ack_date: result.AckDt ? new Date(result.AckDt) : new Date(),
        signed_invoice: result.SignedInvoice || result.signed_invoice,
        signed_qr_code: result.QrCode || result.qr_code,
        status: 'generated',
        error_message: null,
      });

      logger.info('E-Invoice retry successful', { 
        eInvoiceId, 
        voucherId: voucher.id,
        retryCount: eInvoice.retry_count,
        irn: eInvoice.irn 
      });

      return {
        id: eInvoice.id,
        voucher_id: eInvoice.voucher_id,
        irn: eInvoice.irn,
        ack_no: eInvoice.ack_number,
        ack_date: eInvoice.ack_date,
        status: 'generated',
        retry_count: eInvoice.retry_count,
        message: 'E-Invoice generated successfully on retry'
      };
    } catch (error) {
      logger.error('E-Invoice retry failed:', { 
        eInvoiceId, 
        retryCount: eInvoice.retry_count,
        error: error.message 
      });
      
      // Update error message
      await eInvoice.update({
        error_message: error.message
      });
      
      throw error;
    }
  }

  /**
   * Get E-Invoice details
   * @param {string} eInvoiceId - E-Invoice ID
   * @param {Object} ctx - Context with tenant models
   * @returns {Promise<Object>} E-Invoice details
   */
  async getEInvoice(eInvoiceId, ctx) {
    const { tenantModels, tenant_id, company_id } = ctx;
    const scopeCtx = { tenant_id: tenant_id || null, company_id: company_id || null };

    const eInvoice = await findByIdScoped(scopeCtx, tenantModels.EInvoice, eInvoiceId, {
      include: [{
        model: tenantModels.Voucher,
        as: 'voucher',
        attributes: ['id', 'voucher_number', 'voucher_date', 'voucher_type', 'total_amount']
      }]
    });

    if (!eInvoice) {
      throw new Error('E-Invoice not found');
    }

    return {
      id: eInvoice.id,
      voucher_id: eInvoice.voucher_id,
      irn: eInvoice.irn,
      ack_no: eInvoice.ack_number,
      ack_date: eInvoice.ack_date,
      signed_invoice: eInvoice.signed_invoice,
      signed_qr_code: eInvoice.signed_qr_code,
      status: eInvoice.status,
      error_message: eInvoice.error_message,
      retry_count: eInvoice.retry_count,
      last_retry_at: eInvoice.last_retry_at,
      created_at: eInvoice.createdAt,
      updated_at: eInvoice.updatedAt,
      voucher: eInvoice.voucher
    };
  }

  /**
   * Get or create IRP client instance
   * @param {Object} company - Company configuration
   * @returns {IRPClient} IRP client instance
   */
  getIRPClient(company) {
    if (!this.irpClient) {
      const settings = company?.settings || {};
      const config = {
        baseUrl: process.env.IRP_BASE_URL || 'https://api.sandbox.co.in',
        apiKey: process.env.SANDBOX_API_KEY,
        apiSecret: process.env.SANDBOX_API_SECRET,
        environment: process.env.SANDBOX_ENVIRONMENT || 'test',
        // Company-specific E-Invoice credentials
        einvoiceUsername: settings.einvoice_username,
        einvoicePassword: settings.einvoice_password,
        gstin: company.gstin,
      };
      
      this.irpClient = new IRPClient(config);
    }
    return this.irpClient;
  }

  /**
   * Check if E-Invoice is required for the voucher
   * @param {Object} voucher - Voucher object
   * @returns {boolean} True if E-Invoice is required
   */
  isEInvoiceRequired(voucher) {
    // E-Invoice is required for sales invoices above threshold
    const salesInvoiceTypes = ['Sales Invoice', 'Tax Invoice'];
    if (!salesInvoiceTypes.includes(voucher.voucher_type)) {
      return false;
    }
    
    const totalAmount = parseFloat(voucher.total_amount || 0);
    return totalAmount > this.eInvoiceThreshold;
  }

  /**
   * Validate E-Invoice mandatory fields
   * @param {Object} voucher - Voucher with related data
   * @returns {Object} Validation result
   */
  validateEInvoiceFields(voucher) {
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

    // Check company GSTIN (seller)
    if (!voucher.company?.gstin) {
      errors.push('Seller GSTIN is required');
    } else if (!this.validateGSTIN(voucher.company.gstin)) {
      errors.push(`Invalid seller GSTIN format: ${voucher.company.gstin}`);
    }

    // Check party details (buyer)
    if (!voucher.partyLedger?.ledger_name && !voucher.partyLedger?.name) {
      errors.push('Buyer name is required');
    }

    // For B2B transactions, buyer GSTIN is mandatory
    if (voucher.partyLedger?.gstin) {
      if (!this.validateGSTIN(voucher.partyLedger.gstin)) {
        errors.push(`Invalid buyer GSTIN format: ${voucher.partyLedger.gstin}`);
      }
    } else {
      // B2C transaction - buyer GSTIN not required but address details needed
      warnings.push('Buyer GSTIN not provided - this will be treated as B2C transaction');
    }

    // Check items
    if (!voucher.voucher_items || voucher.voucher_items.length === 0) {
      errors.push('At least one item is required');
    } else {
      voucher.voucher_items.forEach((item, index) => {
        if (!item.item_description) {
          errors.push(`Item ${index + 1}: Description is required`);
        }
        
        if (!item.hsn_sac_code) {
          errors.push(`Item ${index + 1}: HSN/SAC code is required`);
        } else if (item.hsn_sac_code.length < 6) {
          warnings.push(`Item ${index + 1}: HSN code should be at least 6 digits: ${item.hsn_sac_code}`);
        }
        
        if (!item.quantity || parseFloat(item.quantity) <= 0) {
          errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
        }
        
        if (!item.rate || parseFloat(item.rate) <= 0) {
          errors.push(`Item ${index + 1}: Rate must be greater than 0`);
        }
        
        if (item.gst_rate === undefined || item.gst_rate === null) {
          errors.push(`Item ${index + 1}: GST rate is required`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Transform voucher data to IRP JSON format
   * @param {Object} voucher - Voucher with related data
   * @returns {Object} IRP format invoice data
   */
  transformToIRPFormat(voucher) {
    const company = voucher.company || {};
    const partyLedger = voucher.partyLedger || {};
    const items = voucher.voucher_items || [];

    // Calculate totals
    let totalTaxableValue = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalCess = 0;

    const itemList = items.map((item, index) => {
      const taxableAmount = parseFloat(item.amount || 0);
      const cgstAmount = parseFloat(item.cgst_amount || 0);
      const sgstAmount = parseFloat(item.sgst_amount || 0);
      const igstAmount = parseFloat(item.igst_amount || 0);
      const cessAmount = parseFloat(item.cess_amount || 0);
      
      totalTaxableValue += taxableAmount;
      totalCGST += cgstAmount;
      totalSGST += sgstAmount;
      totalIGST += igstAmount;
      totalCess += cessAmount;

      return {
        SlNo: index + 1,
        PrdDesc: item.item_description || '',
        IsServc: item.is_service ? 'Y' : 'N',
        HsnCd: item.hsn_sac_code || '',
        Qty: parseFloat(item.quantity || 0),
        FreeQty: 0,
        Unit: item.unit || 'NOS',
        UnitPrice: parseFloat(item.rate || 0),
        TotAmt: taxableAmount,
        Discount: parseFloat(item.discount_amount || 0),
        PreTaxVal: taxableAmount,
        AssAmt: taxableAmount,
        GstRt: parseFloat(item.gst_rate || 0),
        IgstAmt: igstAmount,
        CgstAmt: cgstAmount,
        SgstAmt: sgstAmount,
        CesRt: parseFloat(item.cess_rate || 0),
        CesAmt: cessAmount,
        CesNonAdvlAmt: 0,
        StateCesRt: 0,
        StateCesAmt: 0,
        StateCesNonAdvlAmt: 0,
        OthChrg: 0,
        TotItemVal: taxableAmount + cgstAmount + sgstAmount + igstAmount + cessAmount,
        OrdLineRef: item.order_line_ref || '',
        OrgCntry: 'IN',
        PrdSlNo: item.product_serial_no || '',
        BchDtls: item.batch_details ? {
          Nm: item.batch_details.name || '',
          ExpDt: item.batch_details.expiry_date || '',
          WrDt: item.batch_details.warranty_date || ''
        } : undefined,
        AttribDtls: item.attributes ? item.attributes.map(attr => ({
          Nm: attr.name || '',
          Val: attr.value || ''
        })) : undefined
      };
    });

    // Format date as DD/MM/YYYY
    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    const invoiceData = {
      Version: '1.1',
      TranDtls: {
        TaxSch: 'GST',
        SupTyp: partyLedger.gstin ? 'B2B' : 'B2C',
        RegRev: 'N',
        EcmGstin: null,
        IgstOnIntra: 'N'
      },
      DocDtls: {
        Typ: 'INV',
        No: voucher.voucher_number,
        Dt: formatDate(voucher.voucher_date)
      },
      SellerDtls: {
        Gstin: company.gstin || '',
        LglNm: company.company_name || company.name || '',
        TrdNm: company.trade_name || company.company_name || company.name || '',
        Addr1: company.address_line_1 || company.address || '',
        Addr2: company.address_line_2 || '',
        Loc: company.city || '',
        Pin: parseInt(company.pincode || 0) || undefined,
        Stcd: company.state_code || '',
        Ph: company.phone || '',
        Em: company.email || ''
      },
      BuyerDtls: {
        Gstin: partyLedger.gstin || undefined,
        LglNm: partyLedger.ledger_name || partyLedger.name || '',
        TrdNm: partyLedger.trade_name || partyLedger.ledger_name || partyLedger.name || '',
        Pos: partyLedger.state_code || company.state_code || '',
        Addr1: partyLedger.address_line_1 || partyLedger.address || '',
        Addr2: partyLedger.address_line_2 || '',
        Loc: partyLedger.city || '',
        Pin: parseInt(partyLedger.pincode || 0) || undefined,
        Stcd: partyLedger.state_code || '',
        Ph: partyLedger.phone || '',
        Em: partyLedger.email || ''
      },
      DispDtls: voucher.dispatch_details ? {
        Nm: voucher.dispatch_details.name || '',
        Addr1: voucher.dispatch_details.address_line_1 || '',
        Addr2: voucher.dispatch_details.address_line_2 || '',
        Loc: voucher.dispatch_details.city || '',
        Pin: parseInt(voucher.dispatch_details.pincode || 0) || undefined,
        Stcd: voucher.dispatch_details.state_code || ''
      } : undefined,
      ShipDtls: voucher.shipping_details ? {
        Gstin: voucher.shipping_details.gstin || undefined,
        LglNm: voucher.shipping_details.name || '',
        TrdNm: voucher.shipping_details.trade_name || '',
        Addr1: voucher.shipping_details.address_line_1 || '',
        Addr2: voucher.shipping_details.address_line_2 || '',
        Loc: voucher.shipping_details.city || '',
        Pin: parseInt(voucher.shipping_details.pincode || 0) || undefined,
        Stcd: voucher.shipping_details.state_code || ''
      } : undefined,
      ItemList: itemList,
      ValDtls: {
        AssVal: totalTaxableValue,
        CgstVal: totalCGST,
        SgstVal: totalSGST,
        IgstVal: totalIGST,
        CesVal: totalCess,
        StCesVal: 0,
        Discount: parseFloat(voucher.discount_amount || 0),
        OthChrg: parseFloat(voucher.other_charges || 0),
        RndOffAmt: parseFloat(voucher.round_off || 0),
        TotInvVal: parseFloat(voucher.total_amount || 0),
        TotInvValFc: voucher.foreign_currency ? parseFloat(voucher.foreign_currency_amount || 0) : undefined
      },
      PayDtls: voucher.payment_details ? {
        Nm: voucher.payment_details.payee_name || '',
        AccDet: voucher.payment_details.account_details || '',
        Mode: voucher.payment_details.mode || '',
        FinInsBr: voucher.payment_details.bank_branch || '',
        PayTerm: voucher.payment_details.terms || '',
        PayInstr: voucher.payment_details.instructions || '',
        CrTrn: voucher.payment_details.credit_transfer || '',
        DirDr: voucher.payment_details.direct_debit || '',
        CrDay: parseInt(voucher.payment_details.credit_days || 0) || undefined,
        PaidAmt: parseFloat(voucher.payment_details.paid_amount || 0),
        PaymtDue: parseFloat(voucher.payment_details.due_amount || 0)
      } : undefined,
      RefDtls: voucher.reference_details ? {
        InvRm: voucher.reference_details.remarks || voucher.narration || '',
        DocPerdDtls: voucher.reference_details.document_period ? {
          InvStDt: formatDate(voucher.reference_details.document_period.start_date),
          InvEndDt: formatDate(voucher.reference_details.document_period.end_date)
        } : undefined,
        PrecDocDtls: voucher.reference_details.preceding_documents ? voucher.reference_details.preceding_documents.map(doc => ({
          InvNo: doc.invoice_number || '',
          InvDt: formatDate(doc.invoice_date),
          OthRefNo: doc.other_reference || ''
        })) : undefined,
        ContrDtls: voucher.reference_details.contract_details ? voucher.reference_details.contract_details.map(contract => ({
          RecAdvRefr: contract.receipt_advice_reference || '',
          RecAdvDt: formatDate(contract.receipt_advice_date),
          TendRefr: contract.tender_reference || '',
          ContrRefr: contract.contract_reference || '',
          ExtRefr: contract.external_reference || '',
          ProjRefr: contract.project_reference || '',
          PORefr: contract.po_reference || '',
          PORefDt: formatDate(contract.po_date)
        })) : undefined
      } : undefined,
      AddlDocDtls: voucher.additional_documents ? voucher.additional_documents.map(doc => ({
        Url: doc.url || '',
        Docs: doc.document_type || '',
        Info: doc.additional_info || ''
      })) : undefined,
      ExpDtls: voucher.export_details ? {
        ShipBNo: voucher.export_details.shipping_bill_number || '',
        ShipBDt: formatDate(voucher.export_details.shipping_bill_date),
        Port: voucher.export_details.port_code || '',
        RefClm: voucher.export_details.refund_claim || 'N',
        ForCur: voucher.export_details.foreign_currency || '',
        CntCode: voucher.export_details.country_code || '',
        ExpDuty: parseFloat(voucher.export_details.export_duty || 0)
      } : undefined,
      EwbDtls: voucher.ewaybill_details ? {
        TransId: voucher.ewaybill_details.transporter_id || '',
        TransName: voucher.ewaybill_details.transporter_name || '',
        Distance: parseInt(voucher.ewaybill_details.distance || 0) || undefined,
        TransDocNo: voucher.ewaybill_details.transport_document_number || '',
        TransDocDt: formatDate(voucher.ewaybill_details.transport_document_date),
        VehNo: voucher.ewaybill_details.vehicle_number || '',
        VehType: voucher.ewaybill_details.vehicle_type || 'R',
        TransMode: voucher.ewaybill_details.transport_mode || '1'
      } : undefined
    };

    return invoiceData;
  }

  /**
   * Generate E-Invoice and get IRN
   * @param {string} voucherId - Voucher ID
   * @param {Object} ctx - Context with tenant models and company
   * @returns {Promise<Object>} E-Invoice response
   */
  async generateEInvoice(voucherId, ctx) {
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
      throw new Error('Voucher must be posted before generating E-Invoice');
    }

    // Check if E-Invoice already exists
    const existing = await findOneScoped(scopeCtx, tenantModels.EInvoice, {
      voucher_id: voucherId,
      status: 'generated',
    });
    if (existing) {
      return {
        id: existing.id,
        voucher_id: voucherId,
        irn: existing.irn,
        ack_no: existing.ack_number,
        ack_date: existing.ack_date,
        status: 'generated',
        signed_invoice: existing.signed_invoice,
        signed_qr_code: existing.signed_qr_code,
      };
    }

    // Check if E-Invoice is required
    if (!this.isEInvoiceRequired(voucher)) {
      throw new Error(`E-Invoice not required for voucher type '${voucher.voucher_type}' or amount below threshold`);
    }

    // Add company data to voucher for validation and transformation
    voucher.company = company;

    // Validate mandatory fields
    const validation = this.validateEInvoiceFields(voucher);
    if (!validation.isValid) {
      const errorMessage = `E-Invoice validation failed: ${validation.errors.join(', ')}`;
      
      // Store failed attempt
      await tenantModels.EInvoice.create({
        voucher_id: voucherId,
        status: 'pending',
        error_message: errorMessage,
        tenant_id: voucher.tenant_id,
      });
      
      throw new Error(errorMessage);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      logger.warn('E-Invoice validation warnings:', validation.warnings);
    }

    try {
      // Transform voucher data to IRP format
      const invoiceData = this.transformToIRPFormat(voucher);
      
      // Get IRP client and generate E-Invoice
      const irpClient = this.getIRPClient(company);
      const apiResponse = await irpClient.generateEInvoice(invoiceData);
      
      // Store successful response
      const eInvoice = await tenantModels.EInvoice.create({
        voucher_id: voucherId,
        irn: apiResponse.Irn || apiResponse.irn,
        ack_number: apiResponse.AckNo || apiResponse.ack_no,
        ack_date: apiResponse.AckDt ? new Date(apiResponse.AckDt) : new Date(),
        signed_invoice: apiResponse.SignedInvoice || apiResponse.signed_invoice,
        signed_qr_code: apiResponse.QrCode || apiResponse.qr_code,
        status: 'generated',
        error_message: null,
        tenant_id: voucher.tenant_id,
      });

      logger.info('E-Invoice generated successfully', { 
        voucherId, 
        irn: eInvoice.irn,
        ackNo: eInvoice.ack_number 
      });

      return {
        id: eInvoice.id,
        voucher_id: voucherId,
        irn: eInvoice.irn,
        ack_no: eInvoice.ack_number,
        ack_date: eInvoice.ack_date,
        status: 'generated',
        signed_invoice: eInvoice.signed_invoice,
        signed_qr_code: eInvoice.signed_qr_code,
      };
    } catch (error) {
      logger.error('E-Invoice generation failed:', error.message);
      
      // Store failed attempt
      await tenantModels.EInvoice.create({
        voucher_id: voucherId,
        status: 'pending',
        error_message: error.message,
        tenant_id: voucher.tenant_id,
      });
      
      throw error;
    }
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
   * Legacy method for backward compatibility
   * Generate IRN (Invoice Reference Number) for e-invoice
   */
  async generateIRN(ctx, voucherId) {
    return this.generateEInvoice(voucherId, ctx);
  }

  /**
   * Cancel E-Invoice with enhanced validation and error handling
   * @param {string} eInvoiceId - E-Invoice ID
   * @param {string} reason - Cancellation reason
   * @param {string} remarks - Additional remarks
   * @param {Object} ctx - Context with tenant models and company
   * @returns {Promise<Object>} Cancellation response
   */
  async cancelEInvoiceById(eInvoiceId, reason, remarks = '', ctx) {
    const { tenantModels, company, tenant_id, company_id } = ctx;
    const scopeCtx = { tenant_id: tenant_id || null, company_id: company_id || null };

    const eInvoice = await findByIdScoped(scopeCtx, tenantModels.EInvoice, eInvoiceId);
    if (!eInvoice) {
      throw new Error('E-Invoice not found');
    }

    if (eInvoice.status === 'cancelled') {
      return {
        id: eInvoice.id,
        voucher_id: eInvoice.voucher_id,
        irn: eInvoice.irn,
        status: 'cancelled',
        cancellation_reason: eInvoice.error_message,
        cancellation_date: eInvoice.updatedAt,
      };
    }

    if (eInvoice.status !== 'generated') {
      throw new Error('E-Invoice must be generated before it can be cancelled');
    }

    if (!eInvoice.irn) {
      throw new Error('IRN not found for this E-Invoice');
    }

    // Validate reason code and remarks
    if (!reason || reason.trim() === '') {
      throw new Error('Cancellation reason code is required');
    }

    if (!remarks || remarks.trim() === '') {
      throw new Error('Cancellation remarks are required');
    }

    // Check 24-hour cancellation window
    const ackDate = new Date(eInvoice.ack_date);
    const currentTime = new Date();
    const hoursDiff = (currentTime - ackDate) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      throw new Error('E-Invoice can only be cancelled within 24 hours of generation');
    }

    try {
      // Call IRP portal to cancel E-Invoice
      const irpClient = this.getIRPClient(company);
      await irpClient.cancelEInvoice(eInvoice.irn, reason, remarks);
      
      // Update local record
      await eInvoice.update({ 
        status: 'cancelled', 
        error_message: `${reason}: ${remarks}` 
      });

      logger.info('E-Invoice cancelled successfully', { 
        eInvoiceId, 
        irn: eInvoice.irn,
        reason,
        remarks 
      });

      return {
        id: eInvoice.id,
        voucher_id: eInvoice.voucher_id,
        irn: eInvoice.irn,
        status: 'cancelled',
        cancellation_reason: reason,
        cancellation_remarks: remarks,
        cancellation_date: nowIso(),
      };
    } catch (error) {
      logger.error('E-Invoice cancellation failed:', error.message);
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility
   * Cancel E-Invoice
   */
  async cancelEInvoice(ctx, voucherId, reason) {
    const { tenantModels, company, tenant_id, company_id } = ctx;
    const scopeCtx = { tenant_id: tenant_id || null, company_id: company_id || null };

    const eInvoice = await findOneScoped(scopeCtx, tenantModels.EInvoice, { voucher_id: voucherId });
    if (!eInvoice) {
      throw new Error('E-Invoice not found');
    }

    if (eInvoice.status === 'cancelled') {
      return {
        id: eInvoice.id,
        voucher_id: voucherId,
        irn: eInvoice.irn,
        status: 'cancelled',
        cancellation_reason: eInvoice.error_message,
        cancellation_date: eInvoice.updatedAt,
      };
    }

    if (eInvoice.status !== 'generated') {
      throw new Error('E-Invoice must be generated before it can be cancelled');
    }

    if (!eInvoice.irn) {
      throw new Error('IRN not found for this E-Invoice');
    }

    // Check 24-hour cancellation window
    const ackDate = new Date(eInvoice.ack_date);
    const currentTime = new Date();
    const hoursDiff = (currentTime - ackDate) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      throw new Error('E-Invoice can only be cancelled within 24 hours of generation');
    }

    if (!reason || reason.trim() === '') {
      throw new Error('Cancellation reason is required');
    }

    try {
      // Call IRP portal to cancel E-Invoice
      const irpClient = this.getIRPClient(company);
      await irpClient.cancelEInvoice(eInvoice.irn, reason);
      
      // Update local record
      await eInvoice.update({ 
        status: 'cancelled', 
        error_message: reason 
      });

      logger.info('E-Invoice cancelled successfully', { 
        voucherId, 
        irn: eInvoice.irn,
        reason 
      });

      return {
        id: eInvoice.id,
        voucher_id: voucherId,
        irn: eInvoice.irn,
        status: 'cancelled',
        cancellation_reason: reason,
        cancellation_date: nowIso(),
      };
    } catch (error) {
      logger.error('E-Invoice cancellation failed:', error.message);
      throw error;
    }
  }
}

module.exports = new EInvoiceService();
