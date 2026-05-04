const axios = require('../utils/httpClient');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Third-Party API Client
 * Handles integration with Sandbox API for HSN, GST, E-Invoice, E-Way Bill, and TDS
 * Uses Sandbox as the only provider for all tax compliance services
 * 
 * Provider: Sandbox (https://api.sandbox.co.in)
 * - Comprehensive tax compliance platform
 * - Single API key for all services
 * - E-Invoice, E-Way Bill, HSN, GST, TDS APIs
 * - AWS Signature V4 authentication for premium endpoints
 */
class ThirdPartyApiClient {
  constructor(config = {}) {
    this.config = config;
    this.providers = {
      einvoice: config.einvoice || {},
      ewaybill: config.ewaybill || {},
      hsn: config.hsn || {},
      gst: config.gst || {},
      tds: config.tds || {},
      income_tax: config.income_tax || {},
      finbox: config.finbox || {},
    };
  }

  /**
   * Get authentication token for a service
   */
  async getAuthToken(service, provider = 'default') {
    const serviceConfig = this.providers[service]?.[provider];
    if (!serviceConfig) {
      throw new Error(`No configuration found for ${service} service`);
    }

    const { base_url, username, password, client_id, client_secret, api_key, auth_endpoint } = serviceConfig;

    try {
      // For API key based services (HSN, GST)
      if (api_key) {
        return api_key;
      }

      // Different providers may have different auth mechanisms
      if (auth_endpoint) {
        const authPayload = {
          username,
          password,
          ...(client_id && client_secret ? { client_id, client_secret } : {}),
        };

        const response = await axios.post(`${base_url}${auth_endpoint}`, authPayload, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        });

        return response.data?.access_token || response.data?.token || response.data;
      }

      // Fallback: return basic auth credentials
      return { username, password, client_id, client_secret };
    } catch (error) {
      logger.error(`Failed to get auth token for ${service}:`, error);
      throw new Error(`Authentication failed for ${service}: ${error.message}`);
    }
  }

  /**
   * Get Sandbox authentication token
   */
  async getSandboxAuthToken(serviceConfig) {
    const { base_url, api_key, api_secret } = serviceConfig;
    
    try {
      const response = await axios.post(`${base_url}/authenticate`, {}, {
        headers: {
          'x-api-key': api_key,
          'x-api-secret': api_secret,
          'x-api-version': '1.0',
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data && response.data.data && response.data.data.access_token) {
        return response.data.data.access_token;
      }
      
      throw new Error('Invalid authentication response');
    } catch (error) {
      logger.error('Sandbox authentication failed:', error.message);
      
      // Check if it's an API key issue
      if (error.response?.status === 401) {
        throw new Error(`Sandbox authentication failed: Invalid API credentials. Please check your API key and secret for ${process.env.SANDBOX_ENVIRONMENT || 'live'} environment.`);
      }
      
      throw new Error(`Sandbox authentication failed: ${error.message}`);
    }
  }

  /**
   * AWS Signature V4 Helper Functions for Sandbox Premium Endpoints
   */
  createSignatureKey(key, dateStamp, regionName, serviceName) {
    const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    return kSigning;
  }

  createCanonicalRequest(method, uri, queryString, headers, payload) {
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key]}\n`)
      .join('');
    
    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');
    
    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
    
    return [
      method,
      uri,
      queryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
  }

  createStringToSign(timestamp, credentialScope, canonicalRequest) {
    const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    return [
      'AWS4-HMAC-SHA256',
      timestamp,
      credentialScope,
      hashedCanonicalRequest
    ].join('\n');
  }

  createAWSSignature(method, url, headers = {}, payload = '', region = 'us-east-1', service = 'execute-api', serviceConfig) {
    const { api_key, api_secret } = serviceConfig;
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    const uri = urlObj.pathname;
    const queryString = urlObj.search.slice(1); // Remove the '?' prefix
    
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    
    // Add required headers
    const allHeaders = {
      'host': host,
      'x-amz-date': amzDate,
      'x-api-key': api_key,
      'x-api-version': '1.0',
      'content-type': 'application/json',
      ...headers
    };
    
    const canonicalRequest = this.createCanonicalRequest(method, uri, queryString, allHeaders, payload);
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = this.createStringToSign(amzDate, credentialScope, canonicalRequest);
    
    const signingKey = this.createSignatureKey(api_secret, dateStamp, region, service);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    
    const signedHeaders = Object.keys(allHeaders)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');
    
    const authorizationHeader = [
      'AWS4-HMAC-SHA256',
      `Credential=${api_key}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`
    ].join(', ');
    
    return {
      ...allHeaders,
      'authorization': authorizationHeader
    };
  }

  /**
   * Make authenticated API request with AWS Signature V4 support
   */
  async makeRequest(service, endpoint, method = 'GET', data = null, provider = 'default', queryParams = null, useAWSSignature = false) {
    const serviceConfig = this.providers[service]?.[provider];
    if (!serviceConfig) {
      throw new Error(`No configuration found for ${service} service`);
    }

    const { base_url, api_key, api_secret } = serviceConfig;
    
    // Sandbox uses JWT authentication
    const isSandbox = base_url?.includes('sandbox.co.in') || base_url?.includes('api.sandbox.co.in');
    // FinBox uses x-api-key header
    const isFinBox = base_url?.includes('finbox.in') || service === 'finbox';
    
    // Build URL with query parameters
    let url = `${base_url}${endpoint}`;
    if (queryParams) {
      const searchParams = new URLSearchParams(queryParams);
      url += `?${searchParams.toString()}`;
    }
    
    let headers = {
      'Content-Type': 'application/json',
    };

    // Check if we should use AWS Signature V4 authentication (for premium endpoints)
    if (useAWSSignature && isSandbox && api_key && api_secret) {
      const payload = data ? JSON.stringify(data) : '';
      headers = this.createAWSSignature(method, url, {}, payload, 'us-east-1', 'execute-api', serviceConfig);
      logger.info(`Using AWS Signature V4 authentication for ${service} ${endpoint}`);
    } else if (isSandbox && api_key && api_secret) {
      // Get JWT token for Sandbox (standard endpoints)
      const accessToken = await this.getSandboxAuthToken(serviceConfig);
      headers = {
        ...headers,
        'authorization': accessToken,
        'x-api-key': api_key,
        'x-api-version': '1.0'
      };
    } else if (isFinBox && api_key) {
      headers['x-api-key'] = api_key;
    } else if (api_key) {
      headers['Authorization'] = `Bearer ${api_key}`;
    }
    
    const config = {
      method,
      url,
      headers,
      timeout: 30000,
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      logger.error(`API request failed for ${service} ${endpoint}:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        `API request failed: ${error.message}`
      );
    }
  }

  /**
   * E-Invoice API Methods
   * Provider: Sandbox only
   */
  async generateIRN(invoiceData, provider = 'sandbox') {
    const endpoint = '/api/v1/gst/compliance/e-invoice';
    return this.makeRequest('einvoice', endpoint, 'POST', invoiceData, provider);
  }

  async cancelIRN(irn, reason, provider = 'sandbox') {
    const endpoint = `/api/v1/gst/compliance/e-invoice/${irn}/cancel`;
    const payload = { cancel_reason: reason };
    return this.makeRequest('einvoice', endpoint, 'POST', payload, provider);
  }

  async getIRNStatus(irn, provider = 'sandbox') {
    const endpoint = `/api/v1/gst/compliance/e-invoice/${irn}`;
    return this.makeRequest('einvoice', endpoint, 'GET', null, provider);
  }

  /**
   * E-Way Bill API Methods
   * Provider: Sandbox only
   */
  async generateEWayBill(ewayBillData, provider = 'sandbox') {
    const endpoint = '/api/v1/gst/compliance/e-way-bill';
    return this.makeRequest('ewaybill', endpoint, 'POST', ewayBillData, provider);
  }

  async cancelEWayBill(ewayBillNo, reason, provider = 'sandbox') {
    const endpoint = `/api/v1/gst/compliance/e-way-bill/${ewayBillNo}/cancel`;
    const payload = { cancel_reason: reason };
    return this.makeRequest('ewaybill', endpoint, 'POST', payload, provider);
  }

  async getEWayBillStatus(ewayBillNo, provider = 'sandbox') {
    const endpoint = `/api/v1/gst/compliance/e-way-bill/${ewayBillNo}`;
    return this.makeRequest('ewaybill', endpoint, 'GET', null, provider);
  }

  async updateEWayBill(ewayBillNo, updateData, provider = 'sandbox') {
    const endpoint = `/api/v1/gst/compliance/e-way-bill/${ewayBillNo}`;
    return this.makeRequest('ewaybill', endpoint, 'PUT', updateData, provider);
  }

  async extendEWayBill(ewayBillNo, extendData, provider = 'sandbox') {
    const endpoint = `/api/v1/gst/compliance/e-way-bill/${ewayBillNo}/extend`;
    return this.makeRequest('ewaybill', endpoint, 'POST', extendData, provider);
  }

  /**
   * HSN API Methods
   * Provider: Sandbox only
   */
  async searchHSN(query, filters = {}, provider = 'sandbox') {
    const endpoint = '/api/v1/gst/tax-lookup/hsn/search';
    return this.makeRequest('hsn', endpoint, 'POST', { query, ...filters }, provider);
  }

  async getHSNByCode(code, provider = 'sandbox') {
    // Try standard authentication first
    try {
      const endpoint = `/api/v1/gst/tax-lookup/hsn/${code}`;
      return await this.makeRequest('hsn', endpoint, 'GET', null, provider);
    } catch (error) {
      // If standard auth fails with 400/403, try AWS Signature V4
      if (error.message.includes('Authorization header requires') || error.message.includes('Insufficient privilege')) {
        logger.info('Retrying HSN lookup with AWS Signature V4 authentication');
        const endpoint = `/gst/public/hsn/${code}`;
        return await this.makeRequest('hsn', endpoint, 'GET', null, provider, null, true);
      }
      throw error;
    }
  }

  async validateHSN(code, provider = 'sandbox') {
    const endpoint = `/api/v1/gst/tax-lookup/hsn/${code}/validate`;
    return this.makeRequest('hsn', endpoint, 'GET', null, provider);
  }

  /**
   * GST API Methods
   * Provider: Sandbox only
   */
  async validateGSTIN(gstin, provider = 'sandbox') {
    const endpoint = '/gst/compliance/public/gstin/search';
    return this.makeRequest('gst', endpoint, 'POST', { gstin }, provider);
  }

  async getGSTINDetails(gstin, provider = 'sandbox') {
    const endpoint = '/gst/compliance/public/gstin/search';
    return this.makeRequest('gst', endpoint, 'POST', { gstin }, provider);
  }

  async getGSTRate(hsnCode, state, provider = 'sandbox') {
    const endpoint = '/gst/compliance/public/hsn/rates';
    return this.makeRequest('gst', endpoint, 'POST', { hsn_code: hsnCode, state }, provider);
  }

  async generateGSTR1(gstr1Data, provider = 'sandbox') {
    const endpoint = '/gst/compliance/returns/gstr1';
    return this.makeRequest('gst', endpoint, 'POST', gstr1Data, provider);
  }

  async generateGSTR3B(gstr3bData, provider = 'sandbox') {
    const endpoint = '/gst/compliance/returns/gstr3b';
    return this.makeRequest('gst', endpoint, 'POST', gstr3bData, provider);
  }

  // ==================== GST ANALYTICS APIs ====================

  /**
   * Create GSTR-2A Reconciliation Job
   */
  async createGSTR2AReconciliationJob(params, provider = 'sandbox') {
    const { gstin, year, month, reconciliation_criteria = 'strict' } = params;
    
    const requestData = {
      '@entity': 'in.co.sandbox.gst.analytics.gstr-2a_reconciliation.request',
      gstin,
      year,
      month,
      reconciliation_criteria
    };

    const endpoint = '/gst/analytics/gstr-2a-reconciliation';
    return this.makeRequest('gst', endpoint, 'POST', requestData, provider);
  }

  /**
   * Get GSTR-2A Reconciliation Job Status
   */
  async getGSTR2AReconciliationStatus(jobId, provider = 'sandbox') {
    const endpoint = `/gst/analytics/gstr-2a-reconciliation/${jobId}`;
    return this.makeRequest('gst', endpoint, 'GET', null, provider);
  }

  /**
   * Upload Purchase Ledger Data to S3
   */
  async uploadPurchaseLedgerData(uploadUrl, ledgerData, provider = 'sandbox') {
    const workbookData = {
      name: 'purchase_ledger_workbook',
      '@entity': 'workbook',
      sheets: [
        {
          name: 'invoice_sheet',
          '@entity': 'sheet',
          blocks: [
            {
              name: 'purchase_invoice_table',
              '@entity': 'table',
              header: [
                'supplier_name', 'supplier_gstin', 'invoice_number', 'invoice_date_epoch',
                'irn', 'place_of_supply', 'sub_total', 'gst_rate', 'cgst', 'sgst', 'igst', 'cess', 'total'
              ],
              rows: ledgerData.invoices || []
            }
          ]
        },
        {
          name: 'note_sheet',
          '@entity': 'sheet',
          blocks: [
            {
              name: 'debit_note_table',
              '@entity': 'table',
              header: [
                'supplier_name', 'supplier_gstin', 'note_number', 'note_date_epoch',
                'irn', 'place_of_supply', 'sub_total', 'gst_rate', 'cgst', 'sgst', 'igst', 'cess', 'total'
              ],
              rows: ledgerData.debitNotes || []
            }
          ]
        }
      ]
    };

    // Direct upload to S3 URL
    const response = await axios.put(uploadUrl, workbookData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    return { success: true, status: response.status };
  }

  /**
   * TDS API Methods
   * Provider: Sandbox only
   */
  async prepareTDSReturn(returnData, formType = '24Q', provider = 'sandbox') {
    const endpoint = `/tds/returns/${formType}/prepare`;
    return this.makeRequest('tds', endpoint, 'POST', returnData, provider);
  }

  async fileTDSReturn(returnData, formType = '24Q', provider = 'sandbox') {
    const endpoint = `/tds/returns/${formType}/file`;
    return this.makeRequest('tds', endpoint, 'POST', returnData, provider);
  }

  async generateForm16A(tdsDetailId, provider = 'sandbox') {
    const endpoint = `/tds/certificates/form16a/${tdsDetailId}`;
    return this.makeRequest('tds', endpoint, 'GET', null, provider);
  }

  async getTDSReturnStatus(returnId, formType = '24Q', provider = 'sandbox') {
    const endpoint = `/tds/returns/${formType}/${returnId}/status`;
    return this.makeRequest('tds', endpoint, 'GET', null, provider);
  }

  async calculateTDS(paymentData, provider = 'sandbox') {
    // Try standard authentication first
    try {
      const endpoint = '/tds/calculator/non-salary';
      return await this.makeRequest('tds', endpoint, 'POST', paymentData, provider);
    } catch (error) {
      // If standard auth fails, try AWS Signature V4
      if (error.message.includes('Authorization header requires') || error.message.includes('Insufficient privilege')) {
        logger.info('Retrying TDS calculation with AWS Signature V4 authentication');
        return await this.makeRequest('tds', endpoint, 'POST', paymentData, provider, null, true);
      }
      throw error;
    }
  }

  // ==================== TDS CALCULATOR APIs ====================

  /**
   * Calculate TDS for Non-Salary Payments with AWS Signature V4 fallback
   */
  async calculateNonSalaryTDS(params, provider = 'sandbox') {
    const requestData = {
      '@entity': 'in.co.sandbox.tds.calculator.non_salary.request',
      payment_amount: params.payment_amount,
      credit_amount: params.credit_amount || params.payment_amount,
      nature_of_payment: params.nature_of_payment,
      deductee_pan: params.deductee_pan,
      pan_available: 'yes',
      section: params.section,
      residential_status: params.residential_status || 'resident',
      financial_year: params.financial_year || '2024-25',
      ...params
    };

    // Try standard authentication first
    try {
      const endpoint = '/tds/calculator/non-salary';
      return await this.makeRequest('tds', endpoint, 'POST', requestData, provider);
    } catch (error) {
      // If standard auth fails, try AWS Signature V4
      if (error.message.includes('Authorization header requires') || error.message.includes('Insufficient privilege')) {
        logger.info('Retrying TDS calculation with AWS Signature V4 authentication');
        return await this.makeRequest('tds', endpoint, 'POST', requestData, provider, null, true);
      }
      throw error;
    }
  }

  // ==================== TDS ANALYTICS APIs ====================

  /**
   * Create TDS Potential Notice Job
   */
  async createTDSPotentialNoticeJob(params, provider = 'sandbox') {
    const { quarter, tan, form, financial_year } = params;
    
    const requestData = {
      '@entity': 'in.co.sandbox.tds.analytics.potential_notice.request',
      quarter,
      tan,
      form,
      financial_year
    };

    const endpoint = '/tds/analytics/potential-notices';
    return this.makeRequest('tds', endpoint, 'POST', requestData, provider);
  }

  /**
   * Get TDS Analytics Job Status
   */
  async getTDSAnalyticsJobStatus(jobId, provider = 'sandbox') {
    const endpoint = `/tds/analytics/potential-notices/${jobId}`;
    return this.makeRequest('tds', endpoint, 'GET', null, provider);
  }

  // ==================== TDS COMPLIANCE APIs ====================

  /**
   * Check Section 206AB & 206CCA Compliance
   */
  async check206ABCompliance(params, provider = 'sandbox') {
    const { pan, consent, reason } = params;
    
    const requestData = {
      '@entity': 'in.co.sandbox.tds.compliance.206ab_check.request',
      pan,
      consent,
      reason
    };

    const endpoint = '/tds/compliance/206ab/check';
    return this.makeRequest('tds', endpoint, 'POST', requestData, provider);
  }

  /**
   * Generate OTP for CSI Download
   */
  async generateCSIOTP(params, provider = 'sandbox') {
    const requestData = {
      '@entity': 'in.co.sandbox.tds.compliance.deductors.otp.request',
      ...params
    };

    const endpoint = '/tds/compliance/csi/otp';
    return this.makeRequest('tds', endpoint, 'POST', requestData, provider);
  }

  /**
   * Download CSI with OTP
   */
  async downloadCSI(params, provider = 'sandbox') {
    const endpoint = '/tds/compliance/csi/download';
    return this.makeRequest('tds', endpoint, 'POST', params, provider);
  }

  // ==================== TDS REPORTS APIs ====================

  /**
   * Submit TCS Report Job
   */
  async submitTCSReportJob(params, provider = 'sandbox') {
    const requestData = {
      '@entity': 'in.co.sandbox.tcs.reports.request',
      ...params
    };

    const endpoint = '/tcs/reports/collectors/tcsrs';
    return this.makeRequest('tds', endpoint, 'POST', requestData, provider);
  }

  /**
   * Get TCS Report Job Status
   */
  async getTCSReportJobStatus(jobId, provider = 'sandbox') {
    const endpoint = '/tcs/reports/collectors/tcsrs';
    return this.makeRequest('tds', endpoint, 'GET', null, provider, { job_id: jobId });
  }

  /**
   * Search TCS Report Jobs
   */
  async searchTCSReportJobs(params = {}, provider = 'sandbox') {
    const requestData = {
      '@entity': 'in.co.sandbox.tcs.reports.jobs.search',
      ...params
    };

    const endpoint = '/tcs/reports/collectors/tcsrs/search';
    return this.makeRequest('tds', endpoint, 'POST', requestData, provider);
  }

  /**
   * Income Tax (ITR) API Methods
   * Provider: Sandbox only
   */
  async calculateIncomeTax(taxData, provider = 'sandbox') {
    const endpoint = '/it/calculator/income-tax';
    return this.makeRequest('income_tax', endpoint, 'POST', taxData, provider);
  }

  async prepareITR(itrData, formType = 'ITR-1', provider = 'sandbox') {
    const endpoint = `/it/itr/${formType}/prepare`;
    return this.makeRequest('income_tax', endpoint, 'POST', itrData, provider);
  }

  async fileITR(itrData, formType = 'ITR-1', provider = 'sandbox') {
    const endpoint = `/it/itr/${formType}/file`;
    return this.makeRequest('income_tax', endpoint, 'POST', itrData, provider);
  }

  async getITRStatus(returnId, formType = 'ITR-1', provider = 'sandbox') {
    const endpoint = `/it/itr/${formType}/${returnId}/status`;
    return this.makeRequest('income_tax', endpoint, 'GET', null, provider);
  }

  async getForm26AS(pan, financialYear, provider = 'sandbox') {
    const endpoint = `/it/form26as/${pan}`;
    return this.makeRequest('income_tax', endpoint, 'POST', { financial_year: financialYear }, provider);
  }

  async parseForm16(form16Data, provider = 'sandbox') {
    const endpoint = '/it/form16/parse';
    return this.makeRequest('income_tax', endpoint, 'POST', form16Data, provider);
  }

  // ==================== INCOME TAX CALCULATOR APIs ====================

  /**
   * Submit Tax P&L Job for Securities
   */
  async submitTaxPnLJob(params, provider = 'sandbox') {
    const { input, from, output, to } = params;
    
    const endpoint = `/it/calculator/securities/domestic/tax-pnl?input=${input}&from=${from}&output=${output}&to=${to}`;
    return this.makeRequest('income_tax', endpoint, 'POST', {}, provider);
  }

  /**
   * Get Tax P&L Job Status
   */
  async getTaxPnLJobStatus(jobId, provider = 'sandbox') {
    const endpoint = `/it/calculator/securities/domestic/tax-pnl?job_id=${jobId}`;
    return this.makeRequest('income_tax', endpoint, 'GET', null, provider);
  }

  /**
   * Upload Trading Data for Tax Calculation
   */
  async uploadTradingData(uploadUrl, tradingData, provider = 'sandbox') {
    // Format trading data according to expected structure
    const formattedData = {
      trades: tradingData.map(trade => ({
        trade_date: trade.trade_date,
        settlement_date: trade.settlement_date,
        stock_symbol: trade.stock_symbol,
        isin: trade.isin,
        company_name: trade.company_name,
        trade_type: trade.trade_type, // BUY/SELL
        quantity: trade.quantity,
        price: trade.price,
        brokerage: trade.brokerage || 0,
        stt: trade.stt || 0,
        exchange_charges: trade.exchange_charges || 0,
        gst: trade.gst || 0,
        sebi_charges: trade.sebi_charges || 0,
        stamp_duty: trade.stamp_duty || 0,
        total_charges: trade.total_charges || 0,
        net_amount: trade.net_amount
      }))
    };

    // Direct upload to S3 URL
    const response = await axios.put(uploadUrl, formattedData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    return { success: true, status: response.status };
  }

  /**
   * Calculate Capital Gains Tax
   */
  async calculateCapitalGainsTax(params, provider = 'sandbox') {
    const requestData = {
      '@entity': 'in.co.sandbox.it.calculator.capital_gains.request',
      ...params
    };

    const endpoint = '/it/calculator/capital-gains';
    return this.makeRequest('income_tax', endpoint, 'POST', requestData, provider);
  }

  /**
   * Calculate Advance Tax
   */
  async calculateAdvanceTax(params, provider = 'sandbox') {
    const requestData = {
      '@entity': 'in.co.sandbox.it.calculator.advance_tax.request',
      ...params
    };

    const endpoint = '/it/calculator/advance-tax';
    return this.makeRequest('income_tax', endpoint, 'POST', requestData, provider);
  }

  /**
   * Generate Form 16
   */
  async generateForm16(params, provider = 'sandbox') {
    const requestData = {
      '@entity': 'in.co.sandbox.it.form16.request',
      ...params
    };

    const endpoint = '/it/form16/generate';
    return this.makeRequest('income_tax', endpoint, 'POST', requestData, provider);
  }

  /**
   * FinBox API Methods
   * Provider: FinBox (https://insights.finbox.in, https://api.finbox.in)
   * - Credit scoring and loan eligibility
   * - Bank statement analysis
   * - Device intelligence
   */
  
  /**
   * DeviceConnect: Get device insights for credit assessment
   * Uses insights.finbox.in as base URL (different from main API)
   */
  async getDeviceInsights(customerId, version, salt, provider = 'finbox') {
    const serviceConfig = this.providers.finbox?.[provider];
    if (!serviceConfig) {
      throw new Error('No configuration found for finbox service');
    }

    // DeviceConnect uses insights.finbox.in, not api.finbox.in
    const insightsBaseUrl = serviceConfig.insights_base_url || 
                           serviceConfig.base_url?.replace('api.finbox.in', 'insights.finbox.in') ||
                           'https://insights.finbox.in';
    
    const endpoint = '/v2/risk/predictors';
    const payload = {
      customer_id: customerId,
      version: version,
      salt: salt,
    };

    const { api_key } = serviceConfig;
    const config = {
      method: 'POST',
      url: `${insightsBaseUrl}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(api_key ? { 'x-api-key': api_key } : {}),
      },
      data: payload,
      timeout: 30000,
    };

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      logger.error(`DeviceConnect API request failed:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        `DeviceConnect API request failed: ${error.message}`
      );
    }
  }

  /**
   * BankConnect: Initiate bank statement collection
   */
  async initiateBankConnect(customerId, bankData, provider = 'finbox') {
    const endpoint = '/v1/bank-connect/initiate';
    const payload = {
      customer_id: customerId,
      ...bankData,
    };
    return this.makeRequest('finbox', endpoint, 'POST', payload, provider);
  }

  /**
   * BankConnect: Get bank statement status
   */
  async getBankConnectStatus(customerId, provider = 'finbox') {
    const endpoint = `/v1/bank-connect/${customerId}/status`;
    return this.makeRequest('finbox', endpoint, 'GET', null, provider);
  }

  /**
   * BankConnect: Get analyzed bank statement data
   */
  async getBankStatementAnalysis(customerId, provider = 'finbox') {
    const endpoint = `/v1/bank-connect/${customerId}/analysis`;
    return this.makeRequest('finbox', endpoint, 'GET', null, provider);
  }

  /**
   * Sourcing API: Create user in FinBox system
   */
  async createFinBoxUser(customerId, userData, provider = 'finbox') {
    const endpoint = '/v1/user';
    const payload = {
      customer_id: customerId,
      ...userData,
    };
    return this.makeRequest('finbox', endpoint, 'POST', payload, provider);
  }

  /**
   * Sourcing API: Get loan eligibility
   */
  async getLoanEligibility(customerId, loanData = {}, provider = 'finbox') {
    const endpoint = `/v1/user/${customerId}/eligibility`;
    return this.makeRequest('finbox', endpoint, 'POST', loanData, provider);
  }

  /**
   * Sourcing API: Generate session token for SDK
   */
  async generateSessionToken(customerId, sessionData = {}, provider = 'finbox') {
    const endpoint = `/v1/user/${customerId}/session`;
    return this.makeRequest('finbox', endpoint, 'POST', sessionData, provider);
  }

  /**
   * Credit Score: Get credit score from bureau
   */
  async getCreditScore(customerId, pan, provider = 'finbox') {
    const endpoint = '/v1/credit-score';
    const payload = {
      customer_id: customerId,
      pan: pan,
    };
    return this.makeRequest('finbox', endpoint, 'POST', payload, provider);
  }

  /**
   * Credit Score: Get FinBox Inclusion Score (FIS)
   */
  async getFinBoxInclusionScore(customerId, provider = 'finbox') {
    const endpoint = `/v1/credit-score/${customerId}/fis`;
    return this.makeRequest('finbox', endpoint, 'GET', null, provider);
  }
}

/**
 * Factory function to create API client from company compliance config
 * 
 * Provider: Sandbox only (https://api.sandbox.co.in)
 * - All services use Sandbox as the only provider
 * - Single API key and secret for all tax compliance services
 * - E-Invoice, E-Way Bill, HSN, GST, TDS, Income Tax (ITR) APIs
 * - Always falls back to environment variables if company config not available
 */
function createApiClientFromCompany(company) {
  const compliance = company?.compliance || {};
  
  // Force Sandbox provider for all services
  const provider = 'sandbox';
  const sandboxBaseUrl = process.env.SANDBOX_BASE_URL || 'https://api.sandbox.co.in';
  const testSandboxBaseUrl = process.env.SANDBOX_TEST_URL || 'https://test-api.sandbox.co.in';
  
  // Use test environment if specified
  const environment = process.env.SANDBOX_ENVIRONMENT || 'test';
  const baseUrl = environment === 'live' ? sandboxBaseUrl : testSandboxBaseUrl;
  
  // Check if environment variables are available for fallback
  const hasEnvCredentials = process.env.SANDBOX_API_KEY && process.env.SANDBOX_API_SECRET;
  
  const config = {
    einvoice: {
      [provider]: (compliance.e_invoice?.applicable || hasEnvCredentials) ? {
        base_url: compliance.e_invoice?.base_url || baseUrl,
        api_key: compliance.e_invoice?.api_key || process.env.SANDBOX_API_KEY,
        api_secret: compliance.e_invoice?.api_secret || process.env.SANDBOX_API_SECRET,
        provider: provider,
      } : null,
    },
    ewaybill: {
      [provider]: (compliance.e_way_bill?.applicable || hasEnvCredentials) ? {
        base_url: compliance.e_way_bill?.base_url || baseUrl,
        api_key: compliance.e_way_bill?.api_key || process.env.SANDBOX_API_KEY,
        api_secret: compliance.e_way_bill?.api_secret || process.env.SANDBOX_API_SECRET,
        provider: provider,
      } : null,
    },
    hsn: {
      [provider]: (compliance.hsn_api?.applicable || hasEnvCredentials) ? {
        base_url: compliance.hsn_api?.base_url || baseUrl,
        api_key: compliance.hsn_api?.api_key || process.env.SANDBOX_API_KEY,
        api_secret: compliance.hsn_api?.api_secret || process.env.SANDBOX_API_SECRET,
        provider: provider,
      } : null,
    },
    gst: {
      [provider]: (compliance.gst_api?.applicable || hasEnvCredentials) ? {
        base_url: compliance.gst_api?.base_url || baseUrl,
        api_key: compliance.gst_api?.api_key || process.env.SANDBOX_API_KEY,
        api_secret: compliance.gst_api?.api_secret || process.env.SANDBOX_API_SECRET,
        provider: provider,
      } : null,
    },
    tds: {
      [provider]: (compliance.tds_api?.applicable || hasEnvCredentials) ? {
        base_url: compliance.tds_api?.base_url || baseUrl,
        api_key: compliance.tds_api?.api_key || process.env.SANDBOX_API_KEY,
        api_secret: compliance.tds_api?.api_secret || process.env.SANDBOX_API_SECRET,
        provider: provider,
      } : null,
    },
    income_tax: {
      [provider]: (compliance.income_tax_api?.applicable || hasEnvCredentials) ? {
        base_url: compliance.income_tax_api?.base_url || baseUrl,
        api_key: compliance.income_tax_api?.api_key || process.env.SANDBOX_API_KEY,
        api_secret: compliance.income_tax_api?.api_secret || process.env.SANDBOX_API_SECRET,
        provider: provider,
      } : null,
    },
    finbox: {
      [provider]: compliance.finbox_api?.applicable && compliance.finbox_api?.api_key ? {
        base_url: compliance.finbox_api.base_url || process.env.FINBOX_API_URL || 'https://api.finbox.in',
        insights_base_url: compliance.finbox_api.insights_base_url || process.env.FINBOX_INSIGHTS_API_URL || 'https://insights.finbox.in',
        api_key: compliance.finbox_api.api_key,
        server_hash: compliance.finbox_api.server_hash || null,
        provider: provider,
      } : null,
    },
  };

  return new ThirdPartyApiClient(config);
}

module.exports = {
  ThirdPartyApiClient,
  createApiClientFromCompany,
};
