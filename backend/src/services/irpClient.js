const axios = require('../utils/httpClient');
const logger = require('../utils/logger');

/**
 * IRP Portal Client
 * Handles authentication and API calls to the Government IRP Portal
 * Supports both sandbox and production environments
 */
class IRPClient {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || process.env.IRP_BASE_URL || 'https://api.sandbox.co.in',
      apiKey: config.apiKey || process.env.SANDBOX_API_KEY,
      apiSecret: config.apiSecret || process.env.SANDBOX_API_SECRET,
      environment: config.environment || process.env.SANDBOX_ENVIRONMENT || 'test',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      initialDelay: config.initialDelay || 1000,
      maxDelay: config.maxDelay || 30000,
      backoffMultiplier: config.backoffMultiplier || 2,
      // Company-specific E-Invoice credentials
      einvoiceUsername: config.einvoiceUsername,
      einvoicePassword: config.einvoicePassword,
      gstin: config.gstin,
    };
    
    this.sandboxToken = null;
    this.sandboxTokenExpiry = null;
    this.einvoiceToken = null;
    this.einvoiceTokenExpiry = null;
    this.retryCount = 0;
  }

  /**
   * Authenticate with Sandbox API to get access token
   * @returns {Promise<string>} Sandbox access token
   */
  async authenticateSandbox() {
    try {
      const response = await axios.post(`${this.config.baseUrl}/authenticate`, {}, {
        headers: {
          'x-api-key': this.config.apiKey,
          'x-api-secret': this.config.apiSecret,
          'x-api-version': '1.0',
          'Content-Type': 'application/json'
        },
        timeout: this.config.timeout
      });

      if (response.data && response.data.data && response.data.data.access_token) {
        this.sandboxToken = response.data.data.access_token;
        // Set token expiry (typically 1 hour, but we'll refresh after 50 minutes)
        this.sandboxTokenExpiry = new Date(Date.now() + 50 * 60 * 1000);
        
        logger.info('Sandbox authentication successful');
        return this.sandboxToken;
      }
      
      throw new Error('Invalid authentication response from Sandbox');
    } catch (error) {
      logger.error('Sandbox authentication failed:', error.message);
      
      if (error.response?.status === 401) {
        throw new Error(`Sandbox authentication failed: Invalid API credentials for ${this.config.environment} environment`);
      }
      
      throw new Error(`Sandbox authentication failed: ${error.message}`);
    }
  }

  /**
   * Authenticate with E-Invoice portal using company credentials
   * @returns {Promise<string>} E-Invoice access token
   */
  async authenticateEInvoice() {
    try {
      if (!this.config.einvoiceUsername || !this.config.einvoicePassword) {
        throw new Error('E-Invoice credentials not configured. Please set username and password in Settings.');
      }

      if (!this.config.gstin) {
        throw new Error('GSTIN not configured for this company');
      }

      // First get Sandbox token
      const sandboxToken = await this.getSandboxToken();

      // Then authenticate with E-Invoice portal
      const response = await axios.post(
        `${this.config.baseUrl}/gst/compliance/e-invoice/tax-payer/authenticate`,
        {
          username: this.config.einvoiceUsername,
          password: this.config.einvoicePassword,
          gstin: this.config.gstin
        },
        {
          headers: {
            'Authorization': sandboxToken,
            'x-api-key': this.config.apiKey,
            'x-api-version': '1.0',
            'Content-Type': 'application/json'
          },
          timeout: this.config.timeout
        }
      );

      if (response.data && response.data.data && response.data.data.Data) {
        const authToken = response.data.data.Data.AuthToken || response.data.data.Data.authToken;
        if (authToken) {
          this.einvoiceToken = authToken;
          // E-Invoice token expires in 6 hours
          this.einvoiceTokenExpiry = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
          
          logger.info('E-Invoice portal authentication successful');
          return this.einvoiceToken;
        }
      }
      
      // Check for error response
      if (response.data && response.data.data && response.data.data.ErrorDetails) {
        const errors = response.data.data.ErrorDetails;
        const errorMsg = errors.map(e => `${e.ErrorCode}: ${e.ErrorMessage}`).join(', ');
        throw new Error(`E-Invoice authentication failed: ${errorMsg}`);
      }
      
      throw new Error('Invalid authentication response from E-Invoice portal');
    } catch (error) {
      logger.error('E-Invoice portal authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Get valid Sandbox access token, refreshing if necessary
   * @returns {Promise<string>} Valid Sandbox access token
   */
  async getSandboxToken() {
    if (!this.sandboxToken || !this.sandboxTokenExpiry || new Date() >= this.sandboxTokenExpiry) {
      await this.authenticateSandbox();
    }
    return this.sandboxToken;
  }

  /**
   * Get valid E-Invoice access token, refreshing if necessary
   * @returns {Promise<string>} Valid E-Invoice access token
   */
  async getEInvoiceToken() {
    if (!this.einvoiceToken || !this.einvoiceTokenExpiry || new Date() >= this.einvoiceTokenExpiry) {
      await this.authenticateEInvoice();
    }
    return this.einvoiceToken;
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use getSandboxToken() or getEInvoiceToken() instead
   */
  async authenticate() {
    return this.authenticateSandbox();
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use getSandboxToken() or getEInvoiceToken() instead
   */
  async getAccessToken() {
    return this.getSandboxToken();
  }

  /**
   * Calculate exponential backoff delay
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} Delay in milliseconds
   */
  calculateBackoffDelay(attempt) {
    const delay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt),
      this.config.maxDelay
    );
    return delay;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make authenticated API request with retry logic
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} data - Request payload
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} API response
   */
  async makeRequest(endpoint, method = 'POST', data = null, options = {}) {
    let lastError;
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Get both tokens
        const sandboxToken = await this.getSandboxToken();
        const einvoiceToken = await this.getEInvoiceToken();
        
        const config = {
          method,
          url: `${this.config.baseUrl}${endpoint}`,
          headers: {
            'authorization': sandboxToken,
            'x-api-key': this.config.apiKey,
            'x-api-version': '1.0',
            'x-einvoice-token': einvoiceToken, // E-Invoice specific token
            'Content-Type': 'application/json',
            ...options.headers
          },
          timeout: this.config.timeout,
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          config.data = data;
        }

        const response = await axios(config);
        
        // Reset retry count on success
        this.retryCount = 0;
        
        return response.data;
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx) except 401 (token expiry)
        if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 401) {
          logger.error(`IRP API client error (${error.response.status}):`, error.response?.data);
          throw new Error(
            error.response?.data?.message || 
            error.response?.data?.error || 
            `IRP API client error: ${error.message}`
          );
        }
        
        // Handle token expiry
        if (error.response?.status === 401) {
          logger.warn('IRP token expired, clearing cached tokens');
          this.sandboxToken = null;
          this.sandboxTokenExpiry = null;
          this.einvoiceToken = null;
          this.einvoiceTokenExpiry = null;
          // Continue to retry with new tokens
        }
        
        // Don't retry on last attempt
        if (attempt === this.config.maxRetries - 1) {
          break;
        }
        
        // Calculate backoff delay
        const delay = this.calculateBackoffDelay(attempt);
        logger.warn(`IRP API request failed (attempt ${attempt + 1}/${this.config.maxRetries}), retrying in ${delay}ms:`, error.message);
        
        await this.sleep(delay);
      }
    }
    
    // All retries exhausted
    logger.error(`IRP API request failed after ${this.config.maxRetries} attempts:`, lastError.message);
    throw new Error(
      lastError.response?.data?.message || 
      lastError.response?.data?.error || 
      `IRP API request failed: ${lastError.message}`
    );
  }

  /**
   * Generate E-Invoice and get IRN
   * @param {Object} invoiceData - Invoice data in IRP format
   * @returns {Promise<Object>} E-Invoice response with IRN
   */
  async generateEInvoice(invoiceData) {
    try {
      logger.info('Generating E-Invoice via IRP portal', { 
        docNo: invoiceData.DocNo,
        docDt: invoiceData.DocDt 
      });
      
      const response = await this.makeRequest('/api/v1/gst/compliance/e-invoice', 'POST', invoiceData);
      
      logger.info('E-Invoice generated successfully', { 
        irn: response.Irn || response.irn,
        ackNo: response.AckNo || response.ack_no 
      });
      
      return response;
    } catch (error) {
      logger.error('E-Invoice generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Cancel E-Invoice
   * @param {string} irn - Invoice Reference Number
   * @param {string} reason - Cancellation reason
   * @param {string} remarks - Additional remarks
   * @returns {Promise<Object>} Cancellation response
   */
  async cancelEInvoice(irn, reason, remarks = '') {
    try {
      logger.info('Cancelling E-Invoice via IRP portal', { irn, reason });
      
      const payload = {
        cancel_reason: reason,
        remarks: remarks
      };
      
      const response = await this.makeRequest(`/api/v1/gst/compliance/e-invoice/${irn}/cancel`, 'POST', payload);
      
      logger.info('E-Invoice cancelled successfully', { irn });
      
      return response;
    } catch (error) {
      logger.error('E-Invoice cancellation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get E-Invoice status
   * @param {string} irn - Invoice Reference Number
   * @returns {Promise<Object>} E-Invoice status
   */
  async getEInvoiceStatus(irn) {
    try {
      logger.info('Getting E-Invoice status via IRP portal', { irn });
      
      const response = await this.makeRequest(`/api/v1/gst/compliance/e-invoice/${irn}`, 'GET');
      
      return response;
    } catch (error) {
      logger.error('E-Invoice status retrieval failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate E-Invoice data before submission
   * @param {Object} invoiceData - Invoice data to validate
   * @returns {Object} Validation result
   */
  validateEInvoiceData(invoiceData) {
    const errors = [];
    const warnings = [];

    // Mandatory fields validation
    const mandatoryFields = [
      'DocDt', 'DocNo', 'SellerGstin', 'BuyerName', 'ItemList', 'TotInvVal'
    ];

    mandatoryFields.forEach(field => {
      if (!invoiceData[field]) {
        errors.push(`Missing mandatory field: ${field}`);
      }
    });

    // Validate ItemList
    if (invoiceData.ItemList && Array.isArray(invoiceData.ItemList)) {
      invoiceData.ItemList.forEach((item, index) => {
        const itemMandatoryFields = ['SlNo', 'PrdDesc', 'HsnCd', 'Qty', 'UnitPrice', 'TotAmt'];
        itemMandatoryFields.forEach(field => {
          if (item[field] === undefined || item[field] === null) {
            errors.push(`Missing mandatory field in item ${index + 1}: ${field}`);
          }
        });

        // Validate HSN code length
        if (item.HsnCd && item.HsnCd.length < 6) {
          warnings.push(`HSN code in item ${index + 1} should be at least 6 digits: ${item.HsnCd}`);
        }
      });
    } else {
      errors.push('ItemList must be a non-empty array');
    }

    // Validate GSTIN format
    if (invoiceData.SellerGstin && !this.validateGSTIN(invoiceData.SellerGstin)) {
      errors.push(`Invalid seller GSTIN format: ${invoiceData.SellerGstin}`);
    }

    if (invoiceData.BuyerGstin && !this.validateGSTIN(invoiceData.BuyerGstin)) {
      errors.push(`Invalid buyer GSTIN format: ${invoiceData.BuyerGstin}`);
    }

    // Validate amounts
    if (invoiceData.TotInvVal && invoiceData.TotInvVal <= 0) {
      errors.push('Total invoice value must be greater than 0');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
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
}

module.exports = IRPClient;