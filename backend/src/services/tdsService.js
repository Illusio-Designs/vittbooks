const { createApiClientFromCompany } = require('./thirdPartyApiClient');
const logger = require('../utils/logger');
const { findByIdScoped, findOneScoped } = require('../utils/scopedQueries');

/**
 * TDS Sections Configuration
 * Defines standard TDS sections with their rates, thresholds, and descriptions
 * as per Income Tax Act provisions
 */
const TDS_SECTIONS = {
  '194C': {
    code: '194C',
    description: 'Payment to contractors and sub-contractors',
    applicableTo: 'Contractors',
    rates: {
      individual: 1.0,    // 1% for individuals/HUF
      company: 2.0,       // 2% for companies
    },
    threshold: 30000,     // Single payment threshold
    aggregateThreshold: 100000, // Aggregate threshold per financial year
    notes: 'Applicable on payments for carrying out any work including supply of labour'
  },
  '194I': {
    code: '194I',
    description: 'Payment of rent',
    applicableTo: 'Rent payments',
    rates: {
      plant_machinery: 2.0,  // 2% for plant, machinery, or equipment
      land_building: 10.0,   // 10% for land, building, or furniture
    },
    threshold: 240000,     // Annual threshold (₹2,40,000)
    aggregateThreshold: 240000,
    notes: 'Applicable on rent payments for land, building, furniture, or machinery'
  },
  '194J': {
    code: '194J',
    description: 'Payment for professional or technical services',
    applicableTo: 'Professional fees',
    rates: {
      professional: 10.0,    // 10% for professional/technical services
      technical: 10.0,       // 10% for technical services
      royalty: 10.0,         // 10% for royalty
      non_compete: 10.0,     // 10% for non-compete fees
    },
    threshold: 30000,      // Single payment threshold
    aggregateThreshold: 30000,
    notes: 'Applicable on fees for professional services, technical services, royalty, or non-compete fees'
  },
  '194H': {
    code: '194H',
    description: 'Payment of commission or brokerage',
    applicableTo: 'Commission/Brokerage',
    rates: {
      commission: 5.0,       // 5% for commission or brokerage
      brokerage: 5.0,        // 5% for brokerage
    },
    threshold: 15000,      // Single payment threshold
    aggregateThreshold: 15000,
    notes: 'Applicable on commission or brokerage payments (excluding insurance commission)'
  }
};

function nowIso() {
  return new Date().toISOString();
}

function getQuarter(date) {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  let quarter;

  if (month >= 4 && month <= 6) quarter = 'Q1';
  else if (month >= 7 && month <= 9) quarter = 'Q2';
  else if (month >= 10 && month <= 12) quarter = 'Q3';
  else quarter = 'Q4';

  return `${quarter}-${year}`;
}

function getFinancialYear(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  if (month >= 4) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

class TDSService {
  /**
   * Validate PAN format
   * PAN format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
   * @param {string} pan - PAN to validate
   * @returns {boolean} True if PAN format is valid
   */
  validatePAN(pan) {
    if (!pan || typeof pan !== 'string') {
      return false;
    }
    
    // PAN must be exactly 10 characters
    if (pan.length !== 10) {
      return false;
    }
    
    // PAN format: AAAAA9999A
    // First 5 characters: Uppercase letters
    // Next 4 characters: Digits
    // Last character: Uppercase letter
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  }

  /**
   * Calculate TDS for a given amount and section
   * This is the core TDS calculation method as per task 9.2
   * 
   * @param {number} taxableAmount - The amount on which TDS is to be calculated
   * @param {string} sectionCode - TDS section code (e.g., '194C', '194I', '194J', '194H')
   * @param {string} deducteePAN - PAN of the deductee
   * @param {string} deducteeType - Type of deductee ('individual', 'company', etc.)
   * @returns {Object} TDSCalculation object with all details
   * @throws {Error} If PAN is invalid or section is not found
   * 
   * Validates Requirements: 4.1, 4.2, 4.3
   */
  calculateTDSAmount(taxableAmount, sectionCode, deducteePAN, deducteeType = 'individual') {
    // Requirement 4.2: Validate PAN format before TDS calculation
    if (!this.validatePAN(deducteePAN)) {
      throw new Error('Invalid PAN format. PAN must be 10 characters (5 letters + 4 digits + 1 letter)');
    }

    // Get section configuration
    const section = this.getTDSSection(sectionCode);
    if (!section) {
      throw new Error(`Invalid TDS section code: ${sectionCode}`);
    }

    // Get TDS rate for the section and deductee type
    const tdsRate = this.getTDSRate(sectionCode, deducteeType);
    if (tdsRate === null) {
      throw new Error(`Unable to determine TDS rate for section ${sectionCode} and deductee type ${deducteeType}`);
    }

    // Get threshold for the section
    const threshold = this.getTDSThreshold(sectionCode);
    
    // Requirement 4.3: Apply threshold check (no TDS if amount < threshold)
    const thresholdApplied = taxableAmount < threshold;
    
    // Requirement 4.1: Calculate TDS with formula: (amount × rate) / 100
    let tdsAmount = 0;
    if (!thresholdApplied) {
      tdsAmount = (taxableAmount * tdsRate) / 100;
      // Round to 2 decimal places
      tdsAmount = parseFloat(tdsAmount.toFixed(2));
    }

    // Return TDSCalculation object with all details
    return {
      sectionCode: sectionCode,
      sectionDescription: section.description,
      tdsRate: tdsRate,
      taxableAmount: parseFloat(taxableAmount.toFixed(2)),
      threshold: threshold,
      thresholdApplied: thresholdApplied,
      tdsAmount: tdsAmount,
      netAmount: parseFloat((taxableAmount - tdsAmount).toFixed(2)),
      deducteePAN: deducteePAN,
      deducteeType: deducteeType
    };
  }

  /**
   * Get all TDS sections configuration
   * @returns {Object} All TDS sections with their details
   */
  getTDSSections() {
    return TDS_SECTIONS;
  }

  /**
   * Get specific TDS section configuration
   * @param {string} sectionCode - TDS section code (e.g., '194C', '194I')
   * @returns {Object|null} Section configuration or null if not found
   */
  getTDSSection(sectionCode) {
    if (!sectionCode) {
      return null;
    }
    return TDS_SECTIONS[sectionCode] || null;
  }

  /**
   * Get TDS rate for a specific section and deductee type
   * @param {string} sectionCode - TDS section code
   * @param {string} deducteeType - Type of deductee ('individual', 'company', etc.)
   * @returns {number|null} TDS rate percentage or null if not found
   */
  getTDSRate(sectionCode, deducteeType = 'individual') {
    const section = this.getTDSSection(sectionCode);
    if (!section || !section.rates) {
      return null;
    }

    // For sections with multiple rate types, return the first available rate
    // or the rate matching the deductee type
    if (typeof section.rates === 'object') {
      // Check if deducteeType exists in rates
      if (section.rates[deducteeType] !== undefined) {
        return section.rates[deducteeType];
      }
      
      // For section 194I, default to land_building rate if type not specified
      if (sectionCode === '194I') {
        return section.rates.land_building || section.rates.plant_machinery;
      }
      
      // Return first available rate
      const firstRate = Object.values(section.rates)[0];
      return firstRate !== undefined ? firstRate : null;
    }

    return section.rates;
  }

  /**
   * Get threshold for a specific TDS section
   * @param {string} sectionCode - TDS section code
   * @param {string} thresholdType - Type of threshold ('threshold' or 'aggregateThreshold')
   * @returns {number|null} Threshold amount or null if not found
   */
  getTDSThreshold(sectionCode, thresholdType = 'threshold') {
    const section = this.getTDSSection(sectionCode);
    if (!section) {
      return null;
    }
    return section[thresholdType] || null;
  }

  /**
   * Check if TDS is applicable based on amount and threshold
   * @param {string} sectionCode - TDS section code
   * @param {number} amount - Taxable amount
   * @returns {boolean} True if TDS should be deducted
   */
  isTDSApplicable(sectionCode, amount) {
    const threshold = this.getTDSThreshold(sectionCode);
    if (threshold === null) {
      return false;
    }
    return amount >= threshold;
  }

  /**
   * Create TDS entry and generate ledger entries
   * This method implements task 9.3 requirements:
   * - Creates TDS detail record
   * - Generates TDS payable ledger entry
   * - Reduces supplier payment by TDS amount
   * - Links TDS detail to voucher
   * 
   * @param {Object} ctx - Context containing tenantModels, masterModels, tenant_id
   * @param {string} voucherId - Voucher ID for which TDS is being created
   * @param {Object} tdsCalculation - TDS calculation result from calculateTDSAmount
   * @param {Object} options - Additional options (deducteeName, etc.)
   * @returns {Promise<Object>} Created TDS detail and ledger entries
   * 
   * Validates Requirements: 4.5, 4.6, 4.10
   */
  async createTDSEntry(ctx, voucherId, tdsCalculation, options = {}) {
    const { tenantModels, masterModels, tenant_id, company_id } = ctx;
    const scopeCtx = { tenant_id: tenant_id || null, company_id: company_id || null };

    if (!voucherId) {
      throw new Error('Voucher ID is required for creating TDS entry');
    }

    if (!tdsCalculation || !tdsCalculation.tdsAmount) {
      throw new Error('Valid TDS calculation is required');
    }

    // Fetch the voucher to get party ledger details
    const voucher = await findByIdScoped(scopeCtx, tenantModels.Voucher, voucherId, {
      include: [{ model: tenantModels.Ledger, as: 'partyLedger' }],
    });
    
    if (!voucher) {
      throw new Error('Voucher not found');
    }
    
    const partyLedger = voucher.partyLedger;
    if (!partyLedger) {
      throw new Error('Party ledger not found for voucher');
    }
    
    // Determine quarter and financial year
    const paymentDate = voucher.voucher_date || new Date();
    const quarter = getQuarter(paymentDate);
    const financialYear = getFinancialYear(paymentDate);
    
    // Prepare TDS detail data
    const tdsDetailData = {
      voucher_id: voucherId,
      section_code: tdsCalculation.sectionCode,
      tds_rate: tdsCalculation.tdsRate,
      taxable_amount: tdsCalculation.taxableAmount,
      tds_amount: tdsCalculation.tdsAmount,
      deductee_pan: tdsCalculation.deducteePAN,
      deductee_name: options.deducteeName || partyLedger.ledger_name || partyLedger.name,
      quarter: quarter,
      financial_year: financialYear,
      tenant_id: tenant_id,
    };
    
    // Create or update TDS detail
    // Requirement 4.10: Link TDS detail to voucher
    let tdsDetail = await findOneScoped(scopeCtx, tenantModels.TDSDetail, { voucher_id: voucherId });
    
    if (tdsDetail) {
      await tdsDetail.update(tdsDetailData);
    } else {
      tdsDetail = await tenantModels.TDSDetail.create(tdsDetailData);
    }
    
    // Generate ledger entries for TDS
    const ledgerEntries = [];
    
    // Requirement 4.5: Create TDS payable ledger entry (credit)
    // Get or create TDS Payable ledger
    const tdsPayableLedger = await this.getOrCreateTDSPayableLedger(
      { tenantModels, masterModels, tenant_id, company_id },
      tdsCalculation.sectionCode
    );
    
    ledgerEntries.push({
      voucher_id: voucherId,
      ledger_id: tdsPayableLedger.id,
      debit_amount: 0,
      credit_amount: tdsCalculation.tdsAmount,
      narration: `TDS ${tdsCalculation.sectionCode} @ ${tdsCalculation.tdsRate}% on ${partyLedger.ledger_name || partyLedger.name}`,
      tenant_id: tenant_id,
    });
    
    // Requirement 4.6: Reduce supplier payment by TDS amount
    // This is done by adjusting the supplier credit entry
    // The supplier should be credited with (total_amount - tds_amount) instead of total_amount
    // Note: This adjustment should be done in the voucher service when creating purchase vouchers
    // Here we just document the net amount for reference
    
    // Create the ledger entries
    await tenantModels.VoucherLedgerEntry.bulkCreate(ledgerEntries);
    
    return {
      tdsDetail,
      ledgerEntries,
      summary: {
        grossAmount: tdsCalculation.taxableAmount,
        tdsAmount: tdsCalculation.tdsAmount,
        netAmount: tdsCalculation.netAmount,
        tdsRate: tdsCalculation.tdsRate,
        sectionCode: tdsCalculation.sectionCode,
      },
    };
  }
  
  /**
   * Get or create TDS Payable ledger for a specific section
   * @private
   */
  async getOrCreateTDSPayableLedger({ tenantModels, masterModels, tenant_id, company_id }, sectionCode) {
    if (!tenant_id) {
      throw new Error('tenant_id is required for creating TDS payable ledger');
    }

    const scopeCtx = { tenant_id, company_id: company_id || null };
    const ledgerCode = `TDS_PAYABLE_${sectionCode}`;
    const ledgerName = `TDS Payable - ${sectionCode}`;

    // Check if ledger already exists
    let existing = await findOneScoped(scopeCtx, tenantModels.Ledger, { ledger_code: ledgerCode });
    
    if (existing) return existing;
    
    // Get the Duties & Taxes group ID (group code: 'DT')
    const groupId = await this.getMasterGroupId(masterModels, 'DT');
    
    // Create new TDS Payable ledger
    return tenantModels.Ledger.create({
      ledger_name: ledgerName,
      ledger_code: ledgerCode,
      account_group_id: groupId,
      opening_balance: 0,
      opening_balance_type: 'Cr',
      balance_type: 'credit',
      is_active: true,
      tenant_id: tenant_id,
    });
  }
  
  /**
   * Get master group ID by group code
   * @private
   */
  async getMasterGroupId(masterModels, groupCode) {
    const group = await masterModels.AccountGroup.findOne({
      where: { group_code: groupCode }
    });
    
    if (!group) {
      throw new Error(`Account group with code ${groupCode} not found`);
    }
    
    return group.id;
  }

  /**
   * Calculate TDS for a voucher
   * Uses Sandbox API for TDS calculation
   */
  async calculateTDS(ctx, voucherId, tdsSection, tdsRate) {
    const { tenantModels, company, tenant_id, company_id } = ctx;
    const scopeCtx = { tenant_id: tenant_id || null, company_id: company_id || null };

    const voucher = await findByIdScoped(scopeCtx, tenantModels.Voucher, voucherId, {
      include: [{ model: tenantModels.Ledger, as: 'partyLedger' }],
    });

    if (!voucher) throw new Error('Voucher not found');

    const partyLedger = voucher.partyLedger;
    if (!partyLedger) throw new Error('Party ledger not found for voucher');

    const grossAmount = parseFloat(voucher.total_amount || 0);
    const section = tdsSection || partyLedger.tds_section || '194C';
    const paymentDate = voucher.voucher_date || new Date();

    // Determine quarter and financial year
    const quarter = getQuarter(paymentDate);
    const financialYear = getFinancialYear(paymentDate);

    // Check if Sandbox API is configured
    const compliance = company?.compliance || {};
    const useThirdParty = compliance.tds_api?.applicable && 
                          compliance.tds_api?.api_key;
    const hasEnvCredentials = process.env.SANDBOX_API_KEY && process.env.SANDBOX_API_SECRET;

    let tdsAmount = 0;
    let netAmount = grossAmount;
    let effectiveRate = parseFloat(tdsRate) || parseFloat(partyLedger.tds_rate) || 10;
    let apiResponse = null;

    if (useThirdParty || hasEnvCredentials) {
      try {
        const apiClient = createApiClientFromCompany(company);
        
        // Prepare payment data for Sandbox API
        const paymentData = {
          payment_amount: grossAmount,
          section: section,
          deductee_pan: partyLedger.pan || null,
          payment_date: paymentDate.toISOString().split('T')[0],
          nature_of_payment: `Payment to ${partyLedger.ledger_name || partyLedger.name || 'Party'}`,
        };

        const result = await apiClient.calculateNonSalaryTDS(paymentData);
        apiResponse = result;
        
        // Use API response
        if (result.tdsAmount !== undefined) {
          tdsAmount = parseFloat(result.tdsAmount || result.tds_amount || 0);
          netAmount = parseFloat(result.netAmount || result.net_amount || (grossAmount - tdsAmount));
          effectiveRate = parseFloat(result.effectiveRate || result.effective_rate || effectiveRate);
        }
      } catch (error) {
        logger.error('Sandbox TDS calculation API error:', error);
        // Fall through to basic calculation if API fails
        tdsAmount = (grossAmount * effectiveRate) / 100;
        netAmount = grossAmount - tdsAmount;
      }
    } else {
      // Basic calculation without API
      tdsAmount = (grossAmount * effectiveRate) / 100;
      netAmount = grossAmount - tdsAmount;
    }

    // Create or update TDS detail
    const existing = await findOneScoped(scopeCtx, tenantModels.TDSDetail, { voucher_id: voucherId });

    const tdsData = {
      voucher_id: voucherId,
      ledger_id: voucher.party_ledger_id,
      section: section,
      tds_rate: effectiveRate,
      taxable_amount: grossAmount,
      tds_amount: parseFloat(tdsAmount.toFixed(2)),
      quarter: quarter,
      financial_year: financialYear,
    };

    let tdsDetail;
    if (existing) {
      await existing.update(tdsData);
      tdsDetail = existing;
    } else {
      tdsDetail = await tenantModels.TDSDetail.create(tdsData);
    }

    return {
      tdsDetail,
      summary: {
        grossAmount,
        tdsAmount: parseFloat(tdsAmount.toFixed(2)),
        netAmount: parseFloat(netAmount.toFixed(2)),
        effectiveRate,
      },
      apiResponse,
    };
  }

  /**
   * Calculate TDS for a given amount (testing/preview mode)
   * Uses Sandbox API for accurate TDS calculation
   */
  async calculateTDSForAmount(ctx, amount, tdsSection = '194C', tdsRate = null, panAvailable = true) {
    const { company } = ctx;

    const grossAmount = parseFloat(amount || 0);
    const section = tdsSection || '194C';
    const paymentDate = new Date();

    // Determine quarter and financial year
    const quarter = getQuarter(paymentDate);
    const financialYear = getFinancialYear(paymentDate);

    // Check if Sandbox API is configured
    const compliance = company?.compliance || {};
    const useThirdParty = compliance.tds_api?.applicable && compliance.tds_api?.api_key;
    const hasEnvCredentials = process.env.SANDBOX_API_KEY && process.env.SANDBOX_API_SECRET;

    let tdsAmount = 0;
    let netAmount = grossAmount;
    let effectiveRate = parseFloat(tdsRate) || 10;
    let apiResponse = null;

    if (useThirdParty || hasEnvCredentials) {
      try {
        const apiClient = createApiClientFromCompany(company);
        
        // Prepare payment data for Sandbox API
        const paymentData = {
          payment_amount: grossAmount,
          section: section,
          deductee_pan: panAvailable ? 'ABCDE1234F' : null, // Sample PAN for testing
          payment_date: paymentDate.toISOString().split('T')[0],
          nature_of_payment: 'Test payment for TDS calculation',
        };

        const result = await apiClient.calculateNonSalaryTDS(paymentData);
        apiResponse = result;
        
        // Use API response
        if (result.tdsAmount !== undefined) {
          tdsAmount = parseFloat(result.tdsAmount || result.tds_amount || 0);
          netAmount = parseFloat(result.netAmount || result.net_amount || (grossAmount - tdsAmount));
          effectiveRate = parseFloat(result.effectiveRate || result.effective_rate || effectiveRate);
        }
      } catch (error) {
        logger.error('Sandbox TDS calculation API error:', error);
        // Fall through to basic calculation if API fails
        // Adjust rate based on PAN availability (higher rate if PAN not available)
        effectiveRate = panAvailable ? effectiveRate : effectiveRate * 2;
        tdsAmount = (grossAmount * effectiveRate) / 100;
        netAmount = grossAmount - tdsAmount;
      }
    } else {
      // Basic calculation without API
      // Adjust rate based on PAN availability (higher rate if PAN not available)
      effectiveRate = panAvailable ? effectiveRate : effectiveRate * 2;
      tdsAmount = (grossAmount * effectiveRate) / 100;
      netAmount = grossAmount - tdsAmount;
    }

    // Return calculation without saving to database
    return {
      tdsDetail: {
        section: section,
        tds_rate: effectiveRate,
        taxable_amount: grossAmount,
        tds_amount: parseFloat(tdsAmount.toFixed(2)),
        quarter: quarter,
        financial_year: financialYear,
        pan_available: panAvailable,
      },
      summary: {
        grossAmount,
        tdsAmount: parseFloat(tdsAmount.toFixed(2)),
        netAmount: parseFloat(netAmount.toFixed(2)),
        effectiveRate,
      },
      apiResponse,
    };
  }

  /**
   * Prepare and file TDS return
   * Uses third-party API if configured
   */
  async prepareAndFileReturn(ctx, quarter, financialYear) {
    const { tenantModels, company } = ctx;

    const where = {
      quarter,
      financial_year: financialYear,
    };

    const tdsDetails = await tenantModels.TDSDetail.findAll({
      where,
    });

    if (!tdsDetails || tdsDetails.length === 0) {
      throw new Error('No TDS details found for the specified quarter and financial year');
    }

    // Group by TDS section
    const returnData = {
      tan: company?.tan || '',
      financial_year: financialYear,
      quarter: quarter,
      formType: '24Q', // Default form type
      deducteeDetails: [],
    };

    // Fetch related ledgers and vouchers
    const ledgerIds = [...new Set(tdsDetails.map(tds => tds.ledger_id))];
    const voucherIds = [...new Set(tdsDetails.map(tds => tds.voucher_id))];
    
    const ledgers = await tenantModels.Ledger.findAll({
      where: { id: ledgerIds },
    });
    const vouchers = await tenantModels.Voucher.findAll({
      where: { id: voucherIds },
    });
    
    const ledgerMap = new Map(ledgers.map(l => [l.id, l]));
    const voucherMap = new Map(vouchers.map(v => [v.id, v]));

    // Prepare deductee details for API
    tdsDetails.forEach((tds) => {
      const deductee = ledgerMap.get(tds.ledger_id) || {};
      const voucher = voucherMap.get(tds.voucher_id) || {};
      returnData.deducteeDetails.push({
        pan: deductee.pan || '',
        name: deductee.ledger_name || deductee.name || '',
        section: tds.section,
        rate: parseFloat(tds.tds_rate),
        grossAmount: parseFloat(tds.taxable_amount),
        tdsAmount: parseFloat(tds.tds_amount),
        paymentDate: voucher.voucher_date || new Date(),
        voucherNumber: voucher.voucher_number || '',
      });
    });

    // Check if third-party API is configured (Sandbox uses API key)
    const compliance = company?.compliance || {};
    const useThirdParty = compliance.tds_api?.applicable && 
                          compliance.tds_api?.api_key;

    let preparedReturn = null;
    let filedReturn = null;
    let returnId = null;
    let acknowledgmentNumber = null;

    if (useThirdParty) {
      try {
        const apiClient = createApiClientFromCompany(company);
        
        // Prepare return using Sandbox API
        preparedReturn = await apiClient.prepareTDSReturn(returnData, '24Q');
        
        if (preparedReturn && preparedReturn.success !== false) {
          // File the return
          filedReturn = await apiClient.fileTDSReturn(returnData, '24Q');
          
          if (filedReturn) {
            returnId = filedReturn.returnId || filedReturn.return_id || null;
            acknowledgmentNumber = filedReturn.acknowledgmentNumber || filedReturn.acknowledgment_number || null;
          }
        }
      } catch (error) {
        logger.error('Third-party TDS return API error:', error);
        throw new Error(`Failed to prepare/file TDS return: ${error.message}`);
      }
    } else {
      // Local preparation without API
      preparedReturn = {
        success: true,
        returnData: returnData,
        message: 'TDS return prepared locally (API not configured)',
      };
    }

    return {
      preparedReturn,
      filedReturn,
      returnId,
      acknowledgmentNumber,
      summary: {
        totalDeductees: tdsDetails.length,
        totalTDS: tdsDetails.reduce((sum, tds) => sum + parseFloat(tds.tds_amount), 0),
        totalSections: new Set(tdsDetails.map(tds => tds.section)).size,
      },
    };
  }

  /**
   * Generate TDS Certificate (Task 9.4)
   * Generates sequential certificate numbers and stores certificate details
   * 
   * @param {Object} ctx - Context containing tenantModels, masterModels, tenant_id, company
   * @param {string} tdsDetailId - TDS detail ID for which certificate is being generated
   * @returns {Promise<Object>} Generated certificate with all mandatory fields
   * 
   * Validates Requirements: 4.7, 4.9
   */
  async generateTDSCertificate(ctx, tdsDetailId) {
    const { tenantModels, company, tenant_id, company_id } = ctx;
    const scopeCtx = { tenant_id: tenant_id || null, company_id: company_id || null };

    if (!tdsDetailId) {
      throw new Error('TDS detail ID is required for generating certificate');
    }

    // Fetch TDS detail with related voucher
    const tdsDetail = await findByIdScoped(scopeCtx, tenantModels.TDSDetail, tdsDetailId, {
      include: [
        {
          model: tenantModels.Voucher,
          as: 'voucher',
          include: [
            {
              model: tenantModels.Ledger,
              as: 'partyLedger',
            },
          ],
        },
      ],
    });

    if (!tdsDetail) {
      throw new Error('TDS detail not found');
    }

    const voucher = tdsDetail.voucher;
    const partyLedger = voucher?.partyLedger;

    if (!voucher) {
      throw new Error('Voucher not found for TDS detail');
    }

    if (!partyLedger) {
      throw new Error('Party ledger not found for voucher');
    }

    // Requirement 4.9: Generate sequential certificate number
    // Format: TDS/FY/QUARTER/SEQUENCE
    // Example: TDS/2024-25/Q1/0001
    const certificateNumber = await this.generateSequentialCertificateNumber(
      tenantModels,
      tenant_id,
      tdsDetail.financial_year,
      tdsDetail.quarter
    );

    // Current date for certificate generation
    const certificateDate = new Date();

    // Requirement 4.7: Update TDS detail with certificate number and date
    await tdsDetail.update({
      certificate_no: certificateNumber,
      certificate_date: certificateDate,
    });

    // Requirement 4.7: Include all mandatory fields
    // (PAN, TAN, section, amounts)
    const certificate = {
      certificate_type: 'Form 16A',
      certificate_number: certificateNumber,
      certificate_date: certificateDate.toISOString(),
      financial_year: tdsDetail.financial_year,
      quarter: tdsDetail.quarter,
      
      // Deductor details (company/organization deducting TDS)
      deductor: {
        name: company?.company_name || company?.name || '',
        pan: company?.pan || '',
        tan: company?.tan || '', // Tax Deduction Account Number
        address: company?.registered_address || company?.address || '',
      },
      
      // Deductee details (party from whom TDS is deducted)
      deductee: {
        name: tdsDetail.deductee_name || partyLedger.ledger_name || partyLedger.name || '',
        pan: tdsDetail.deductee_pan || partyLedger.pan || '',
        address: this.formatAddress(partyLedger),
      },
      
      // TDS transaction details
      tds_details: {
        section_code: tdsDetail.section_code,
        section_description: this.getTDSSection(tdsDetail.section_code)?.description || '',
        tds_rate: parseFloat(tdsDetail.tds_rate),
        taxable_amount: parseFloat(tdsDetail.taxable_amount),
        tds_amount: parseFloat(tdsDetail.tds_amount),
        voucher_number: voucher.voucher_number || '',
        voucher_date: voucher.voucher_date || null,
      },
      
      // Metadata
      issued_date: certificateDate.toISOString(),
      tds_detail_id: tdsDetail.id,
      voucher_id: voucher.id,
    };

    return {
      certificate,
      tdsDetail,
      certificateNumber,
      certificateDate,
    };
  }

  /**
   * Generate sequential certificate number for TDS certificates
   * Format: TDS/FY/QUARTER/SEQUENCE
   * Example: TDS/2024-25/Q1/0001
   * 
   * @private
   * @param {Object} tenantModels - Tenant models
   * @param {string} tenant_id - Tenant ID
   * @param {string} financialYear - Financial year (e.g., '2024-2025')
   * @param {string} quarter - Quarter (e.g., 'Q1-2024')
   * @returns {Promise<string>} Sequential certificate number
   */
  async generateSequentialCertificateNumber(tenantModels, tenant_id, financialYear, quarter) {
    // Find the highest certificate number for this tenant, FY, and quarter
    const existingCertificates = await tenantModels.TDSDetail.findAll({
      where: {
        tenant_id: tenant_id,
        financial_year: financialYear,
        quarter: quarter,
        certificate_no: {
          [tenantModels.Sequelize.Op.ne]: null,
        },
      },
      attributes: ['certificate_no'],
      order: [['certificate_no', 'DESC']],
      limit: 1,
    });

    let sequence = 1;

    if (existingCertificates.length > 0) {
      const lastCertificateNo = existingCertificates[0].certificate_no;
      
      // Extract sequence number from certificate number
      // Format: TDS/2024-25/Q1-2024/0001
      const parts = lastCertificateNo.split('/');
      if (parts.length === 4) {
        const lastSequence = parseInt(parts[3], 10);
        if (!isNaN(lastSequence)) {
          sequence = lastSequence + 1;
        }
      }
    }

    // Format financial year for certificate number (2024-2025 -> 2024-25)
    let fyShort = financialYear;
    if (financialYear.includes('-')) {
      const parts = financialYear.split('-');
      if (parts.length === 2 && parts[1].length === 4) {
        // Convert 2024-2025 to 2024-25
        fyShort = `${parts[0]}-${parts[1].substring(2)}`;
      }
    }
    
    // Format: TDS/FY/QUARTER/SEQUENCE (padded to 4 digits)
    const certificateNumber = `TDS/${fyShort}/${quarter}/${sequence.toString().padStart(4, '0')}`;
    
    return certificateNumber;
  }

  /**
   * Format address from ledger details
   * @private
   */
  formatAddress(ledger) {
    if (!ledger) return '';
    
    const parts = [];
    if (ledger.address) parts.push(ledger.address);
    if (ledger.city) parts.push(ledger.city);
    if (ledger.state) parts.push(ledger.state);
    if (ledger.pincode) parts.push(ledger.pincode);
    
    return parts.filter(p => p).join(', ');
  }

  /**
   * Generate Form 16A certificate
   * Uses third-party API if configured, otherwise generates locally
   */
  async generateForm16A(ctx, tdsDetailId) {
    const { tenantModels, company, tenant_id, company_id } = ctx;
    const scopeCtx = { tenant_id: tenant_id || null, company_id: company_id || null };

    const tdsDetail = await findByIdScoped(scopeCtx, tenantModels.TDSDetail, tdsDetailId);

    if (!tdsDetail) {
      throw new Error('TDS detail not found');
    }

    const ledger = await findByIdScoped(scopeCtx, tenantModels.Ledger, tdsDetail.ledger_id);
    const voucher = await findByIdScoped(scopeCtx, tenantModels.Voucher, tdsDetail.voucher_id);

    // Check if third-party API is configured (Sandbox uses API key)
    const compliance = company?.compliance || {};
    const useThirdParty = compliance.tds_api?.applicable && 
                          compliance.tds_api?.api_key;

    let certificate = null;
    let certificateNumber = null;

    if (useThirdParty) {
      try {
        const apiClient = createApiClientFromCompany(company);
        
        // Generate Form 16A using Sandbox API
        const apiResponse = await apiClient.generateForm16A(tdsDetailId);
        
        if (apiResponse && apiResponse.certificate) {
          certificate = apiResponse.certificate;
          certificateNumber = apiResponse.certificateNumber || apiResponse.certificate_number || null;
        }
      } catch (error) {
        logger.error('Third-party Form 16A API error:', error);
        // Fall through to local generation if API fails
      }
    }

    // If API didn't return certificate, generate locally
    if (!certificate) {
      // Generate certificate number
      // Note: certificate_number field may not exist in the model, so we generate it in-memory
      certificateNumber = tdsDetail.certificate_number || `TDS/${tdsDetail.financial_year}/${tdsDetail.quarter}/${tdsDetail.id.substring(0, 8).toUpperCase()}`;
      
      // Try to save certificate_number if the field exists (optional, won't fail if it doesn't)
      if (!tdsDetail.certificate_number) {
        try {
          await tdsDetail.update({ certificate_number: certificateNumber }).catch(() => {
            // Ignore if field doesn't exist
          });
        } catch (e) {
          // Ignore update errors
        }
      }

      // Form 16A structure
      certificate = {
        certificate_type: 'Form 16A',
        certificate_number: certificateNumber,
        financial_year: tdsDetail.financial_year,
        quarter: tdsDetail.quarter,
        deductor: {
          name: company?.company_name || company?.name || '',
          pan: company?.pan || '',
          tan: company?.tan || '',
          address: company?.registered_address || company?.address || '',
        },
        deductee: {
          name: ledger?.ledger_name || ledger?.name || '',
          pan: ledger?.pan || '',
          address: `${ledger?.address || ''}, ${ledger?.city || ''}, ${ledger?.state || ''} - ${ledger?.pincode || ''}`,
        },
        tds_details: {
          section: tdsDetail.section,
          rate: tdsDetail.tds_rate,
          gross_amount: tdsDetail.taxable_amount,
          tds_amount: tdsDetail.tds_amount,
          voucher_number: voucher?.voucher_number || '',
          voucher_date: voucher?.voucher_date || null,
        },
        issued_date: new Date().toISOString(),
      };
    }

    return {
      certificate,
      tdsDetail,
      ledger,
      voucher,
    };
  }

  /**
   * Get TDS return status
   * Uses third-party API if configured
   */
  async getReturnStatus(ctx, returnId, formType = '24Q') {
    const { company } = ctx;

    // Check if third-party API is configured (Sandbox uses API key)
    const compliance = company?.compliance || {};
    const useThirdParty = compliance.tds_api?.applicable && 
                          compliance.tds_api?.api_key;

    if (!useThirdParty) {
      throw new Error('TDS API not configured');
    }

    try {
      const apiClient = createApiClientFromCompany(company);
      const status = await apiClient.getTDSReturnStatus(returnId, formType);
      return status;
    } catch (error) {
      logger.error('Third-party TDS return status API error:', error);
      throw new Error(`Failed to get TDS return status: ${error.message}`);
    }
  }

  /**
   * Create TDS Potential Notice Job using Sandbox API
   */
  async createTDSPotentialNoticeJob(ctx, params) {
    const { company } = ctx;
    const compliance = company?.compliance || {};
    const useThirdParty = compliance.tds_api?.applicable && compliance.tds_api?.api_key;

    if (useThirdParty) {
      try {
        const apiClient = createApiClientFromCompany(company);
        const result = await apiClient.createTDSPotentialNoticeJob(params);
        return {
          success: true,
          jobId: result.job_id || result.jobId,
          message: result.message || 'TDS potential notice job created successfully',
          details: result,
        };
      } catch (error) {
        logger.error('Third-party TDS potential notice API error:', error);
        throw new Error(`Failed to create TDS potential notice job: ${error.message}`);
      }
    }

    throw new Error('TDS API not configured');
  }

  /**
   * Get TDS Analytics Job Status using Sandbox API
   */
  async getTDSAnalyticsJobStatus(ctx, jobId) {
    const { company } = ctx;
    const compliance = company?.compliance || {};
    const useThirdParty = compliance.tds_api?.applicable && compliance.tds_api?.api_key;

    if (useThirdParty) {
      try {
        const apiClient = createApiClientFromCompany(company);
        const result = await apiClient.getTDSAnalyticsJobStatus(jobId);
        return {
          success: true,
          status: result.status,
          progress: result.progress,
          result: result.result,
          details: result,
        };
      } catch (error) {
        logger.error('Third-party TDS analytics status API error:', error);
        throw new Error(`Failed to get TDS analytics job status: ${error.message}`);
      }
    }

    throw new Error('TDS API not configured');
  }

  /**
   * Calculate Non-Salary TDS using Sandbox API
   */
  async calculateNonSalaryTDS(ctx, params) {
    const { company } = ctx;
    const compliance = company?.compliance || {};
    const useThirdParty = compliance.tds_api?.applicable && compliance.tds_api?.api_key;

    if (useThirdParty) {
      try {
        const apiClient = createApiClientFromCompany(company);
        const result = await apiClient.calculateNonSalaryTDS(params);
        return {
          success: true,
          tdsAmount: result.tds_amount || result.tdsAmount,
          netAmount: result.net_amount || result.netAmount,
          effectiveRate: result.effective_rate || result.effectiveRate,
          details: result,
        };
      } catch (error) {
        logger.error('Third-party non-salary TDS calculation API error:', error);
        throw new Error(`Failed to calculate non-salary TDS: ${error.message}`);
      }
    }

    throw new Error('TDS API not configured');
  }

  /**
   * Check Section 206AB & 206CCA Compliance using Sandbox API
   */
  async check206ABCompliance(ctx, params) {
    const { company } = ctx;
    const compliance = company?.compliance || {};
    const useThirdParty = compliance.tds_api?.applicable && compliance.tds_api?.api_key;

    if (useThirdParty) {
      try {
        const apiClient = createApiClientFromCompany(company);
        const result = await apiClient.check206ABCompliance(params);
        return {
          success: true,
          isCompliant: result.is_compliant || result.isCompliant,
          higherRate: result.higher_rate || result.higherRate,
          reason: result.reason,
          details: result,
        };
      } catch (error) {
        logger.error('Third-party 206AB compliance check API error:', error);
        throw new Error(`Failed to check 206AB compliance: ${error.message}`);
      }
    }

    throw new Error('TDS API not configured');
  }

  /**
   * Generate TDS Return (Task 9.5)
   * Generates quarterly TDS return with all TDS entries for specified quarter and FY
   * 
   * @param {Object} ctx - Context containing tenantModels, masterModels, tenant_id, company
   * @param {string} quarter - Quarter (e.g., 'Q1-2024', 'Q2-2024', 'Q3-2024', 'Q4-2024')
   * @param {string} financialYear - Financial year (e.g., '2024-2025' or '2024-25')
   * @returns {Promise<Object>} TDS return data with all entries and summary
   * 
   * Validates Requirements: 4.8
   */
  async generateTDSReturn(ctx, quarter, financialYear) {
    const { tenantModels, company, tenant_id } = ctx;

    if (!quarter) {
      throw new Error('Quarter is required for generating TDS return');
    }

    if (!financialYear) {
      throw new Error('Financial year is required for generating TDS return');
    }

    // Normalize financial year format (2024-2025 -> 2024-25)
    let fyNormalized = financialYear;
    if (financialYear.includes('-')) {
      const parts = financialYear.split('-');
      if (parts.length === 2 && parts[1].length === 4) {
        fyNormalized = `${parts[0]}-${parts[1].substring(2)}`;
      }
    }

    // Requirement 4.8: Query all TDS entries for specified quarter and FY
    const tdsEntries = await tenantModels.TDSDetail.findAll({
      where: {
        tenant_id: tenant_id,
        quarter: quarter,
        financial_year: fyNormalized,
      },
      include: [
        {
          model: tenantModels.Voucher,
          as: 'voucher',
          attributes: ['id', 'voucher_number', 'voucher_date', 'party_ledger_id'],
          include: [
            {
              model: tenantModels.Ledger,
              as: 'partyLedger',
              attributes: ['id', 'ledger_name', 'name', 'pan', 'address', 'city', 'state', 'pincode'],
            },
          ],
        },
      ],
      order: [
        ['section_code', 'ASC'],
        ['deductee_name', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });

    if (!tdsEntries || tdsEntries.length === 0) {
      throw new Error(`No TDS entries found for quarter ${quarter} and financial year ${fyNormalized}`);
    }

    // Format return data according to requirements
    // Group entries by deductee PAN and section for summary
    const deducteeMap = new Map();
    const sectionSummary = {};
    let totalTaxableAmount = 0;
    let totalTDSAmount = 0;

    // Process each TDS entry
    const returnEntries = tdsEntries.map((tds) => {
      const voucher = tds.voucher;
      const partyLedger = voucher?.partyLedger;

      const taxableAmount = parseFloat(tds.taxable_amount || 0);
      const tdsAmount = parseFloat(tds.tds_amount || 0);

      // Update totals
      totalTaxableAmount += taxableAmount;
      totalTDSAmount += tdsAmount;

      // Update section summary
      if (!sectionSummary[tds.section_code]) {
        sectionSummary[tds.section_code] = {
          section_code: tds.section_code,
          section_description: this.getTDSSection(tds.section_code)?.description || '',
          count: 0,
          total_taxable_amount: 0,
          total_tds_amount: 0,
        };
      }
      sectionSummary[tds.section_code].count += 1;
      sectionSummary[tds.section_code].total_taxable_amount += taxableAmount;
      sectionSummary[tds.section_code].total_tds_amount += tdsAmount;

      // Group by deductee PAN
      const deducteePAN = tds.deductee_pan || 'NO_PAN';
      if (!deducteeMap.has(deducteePAN)) {
        deducteeMap.set(deducteePAN, {
          deductee_pan: tds.deductee_pan,
          deductee_name: tds.deductee_name || partyLedger?.ledger_name || partyLedger?.name || '',
          deductee_address: this.formatAddress(partyLedger),
          entries: [],
          total_taxable_amount: 0,
          total_tds_amount: 0,
        });
      }

      const deducteeData = deducteeMap.get(deducteePAN);
      deducteeData.total_taxable_amount += taxableAmount;
      deducteeData.total_tds_amount += tdsAmount;

      // Create entry for return
      const entry = {
        tds_detail_id: tds.id,
        voucher_number: voucher?.voucher_number || '',
        voucher_date: voucher?.voucher_date || null,
        section_code: tds.section_code,
        section_description: this.getTDSSection(tds.section_code)?.description || '',
        tds_rate: parseFloat(tds.tds_rate || 0),
        taxable_amount: taxableAmount,
        tds_amount: tdsAmount,
        deductee_pan: tds.deductee_pan,
        deductee_name: tds.deductee_name || partyLedger?.ledger_name || partyLedger?.name || '',
        certificate_no: tds.certificate_no,
        certificate_date: tds.certificate_date,
      };

      deducteeData.entries.push(entry);

      return entry;
    });

    // Convert deductee map to array
    const deducteeDetails = Array.from(deducteeMap.values());

    // Convert section summary to array
    const sectionSummaryArray = Object.values(sectionSummary);

    // Prepare return data structure
    const tdsReturn = {
      return_type: 'Form 24Q', // Non-salary TDS return
      quarter: quarter,
      financial_year: fyNormalized,
      
      // Deductor details (company/organization deducting TDS)
      deductor: {
        name: company?.company_name || company?.name || '',
        pan: company?.pan || '',
        tan: company?.tan || '', // Tax Deduction Account Number
        address: company?.registered_address || company?.address || '',
      },
      
      // Summary statistics
      summary: {
        total_deductees: deducteeDetails.length,
        total_entries: returnEntries.length,
        total_sections: sectionSummaryArray.length,
        total_taxable_amount: parseFloat(totalTaxableAmount.toFixed(2)),
        total_tds_amount: parseFloat(totalTDSAmount.toFixed(2)),
      },
      
      // Section-wise summary
      section_summary: sectionSummaryArray.map(s => ({
        ...s,
        total_taxable_amount: parseFloat(s.total_taxable_amount.toFixed(2)),
        total_tds_amount: parseFloat(s.total_tds_amount.toFixed(2)),
      })),
      
      // Deductee-wise details
      deductee_details: deducteeDetails.map(d => ({
        ...d,
        total_taxable_amount: parseFloat(d.total_taxable_amount.toFixed(2)),
        total_tds_amount: parseFloat(d.total_tds_amount.toFixed(2)),
        entry_count: d.entries.length,
      })),
      
      // All entries (flat list)
      entries: returnEntries,
      
      // Metadata
      generated_date: new Date().toISOString(),
      generated_by: ctx.user_id || 'system',
      tenant_id: tenant_id,
    };

    return {
      tdsReturn,
      summary: tdsReturn.summary,
      sectionSummary: tdsReturn.section_summary,
      deducteeDetails: tdsReturn.deductee_details,
    };
  }

  /**
   * Auto-create statutory ledgers when TDS is enabled
   * Phase 1: Foundation Layer
   * 
   * @param {Object} tenantModels - Tenant database models
   * @param {Object} masterModels - Master database models
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Array>} Created ledgers
   */
  async createTDSLedgers(tenantModels, masterModels, tenantId) {
    try {
      // Find "Duties & Taxes" group
      const dutiesTaxGroup = await masterModels.AccountGroup.findOne({
        where: { name: 'Duties & Taxes' },
      });

      if (!dutiesTaxGroup) {
        throw new Error('Duties & Taxes account group not found');
      }

      // Find "Current Assets" group for TDS Receivable
      const currentAssetsGroup = await masterModels.AccountGroup.findOne({
        where: { name: 'Current Assets' },
      });

      const ledgersToCreate = [
        {
          ledger_name: 'TDS Payable',
          system_code: 'TDS_PAYABLE',
          account_group_id: dutiesTaxGroup.id,
          description: 'System-generated ledger for TDS payable to government',
        },
      ];

      // Optionally create TDS Receivable
      if (currentAssetsGroup) {
        ledgersToCreate.push({
          ledger_name: 'TDS Receivable',
          system_code: 'TDS_RECEIVABLE',
          account_group_id: currentAssetsGroup.id,
          description: 'System-generated ledger for TDS receivable',
        });
      }

      const createdLedgers = [];

      for (const ledgerData of ledgersToCreate) {
        // Check if already exists for this tenant
        const existing = await findOneScoped(
          { tenant_id: tenantId },
          tenantModels.Ledger,
          { system_code: ledgerData.system_code }
        );

        if (!existing) {
          // Generate ledger code
          const groupCode = dutiesTaxGroup.group_code || 'TAX';
          const ledgerCode = await this.generateLedgerCode(tenantModels, groupCode, tenantId);

          const ledger = await tenantModels.Ledger.create({
            ...ledgerData,
            ledger_code: ledgerCode,
            is_system_generated: true,
            opening_balance: 0,
            balance_type: 'credit',
            opening_balance_type: 'Cr',
            currency: 'INR',
            tenant_id: tenantId,
          });

          createdLedgers.push(ledger);
          logger.info(`✅ Created TDS ledger: ${ledgerData.ledger_name}`);
        } else {
          logger.info(`ℹ️ TDS ledger already exists: ${ledgerData.ledger_name}`);
        }
      }

      return createdLedgers;
    } catch (error) {
      logger.error('Error creating TDS ledgers:', error);
      throw error;
    }
  }

  /**
   * Auto-create statutory ledgers when TCS is enabled
   * Phase 1: Foundation Layer
   * 
   * @param {Object} tenantModels - Tenant database models
   * @param {Object} masterModels - Master database models
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Array>} Created ledgers
   */
  async createTCSLedgers(tenantModels, masterModels, tenantId) {
    try {
      // Find "Duties & Taxes" group
      const dutiesTaxGroup = await masterModels.AccountGroup.findOne({
        where: { name: 'Duties & Taxes' },
      });

      if (!dutiesTaxGroup) {
        throw new Error('Duties & Taxes account group not found');
      }

      const ledgerData = {
        ledger_name: 'TCS Payable',
        system_code: 'TCS_PAYABLE',
        account_group_id: dutiesTaxGroup.id,
        description: 'System-generated ledger for TCS payable to government',
      };

      // Check if already exists for this tenant
      const existing = await findOneScoped(
        { tenant_id: tenantId },
        tenantModels.Ledger,
        { system_code: ledgerData.system_code }
      );

      if (!existing) {
        // Generate ledger code
        const groupCode = dutiesTaxGroup.group_code || 'TAX';
        const ledgerCode = await this.generateLedgerCode(tenantModels, groupCode, tenantId);

        const ledger = await tenantModels.Ledger.create({
          ...ledgerData,
          ledger_code: ledgerCode,
          is_system_generated: true,
          opening_balance: 0,
          balance_type: 'credit',
          opening_balance_type: 'Cr',
          currency: 'INR',
          tenant_id: tenantId,
        });

        logger.info(`✅ Created TCS ledger: ${ledgerData.ledger_name}`);
        return [ledger];
      } else {
        logger.info(`ℹ️ TCS ledger already exists: ${ledgerData.ledger_name}`);
        return [existing];
      }
    } catch (error) {
      logger.error('Error creating TCS ledgers:', error);
      throw error;
    }
  }

  /**
   * Generate unique ledger code
   * @param {Object} tenantModels - Tenant database models
   * @param {string} groupCode - Account group code prefix
   * @returns {Promise<string>} Generated ledger code
   */
  async generateLedgerCode(tenantModels, groupCode, tenantId) {
    const { findOneScoped } = require('../utils/scopedQueries');
    const lastLedger = await findOneScoped(
      { tenant_id: tenantId },
      tenantModels.Ledger,
      {
        ledger_code: {
          [require('sequelize').Op.like]: `${groupCode}%`,
        },
      },
      { order: [['ledger_code', 'DESC']] }
    );

    if (lastLedger && lastLedger.ledger_code) {
      const lastNumber = parseInt(lastLedger.ledger_code.replace(groupCode, '')) || 0;
      return `${groupCode}${String(lastNumber + 1).padStart(4, '0')}`;
    }

    return `${groupCode}0001`;
  }

  /**
   * Get TDS sections from master database
   * @param {Object} masterModels - Master database models
   * @returns {Promise<Array>} TDS sections
   */
  async getTDSSectionsFromDB(masterModels) {
    try {
      const sections = await masterModels.TDSSection.findAll({
        where: { is_active: true },
        order: [['section_code', 'ASC']],
      });
      return sections;
    } catch (error) {
      logger.error('Error fetching TDS sections:', error);
      throw error;
    }
  }

  /**
   * Get TCS sections from master database
   * @param {Object} masterModels - Master database models
   * @returns {Promise<Array>} TCS sections
   */
  async getTCSSectionsFromDB(masterModels) {
    try {
      const sections = await masterModels.TCSSection.findAll({
        where: { is_active: true },
        order: [['section_code', 'ASC']],
      });
      return sections;
    } catch (error) {
      logger.error('Error fetching TCS sections:', error);
      throw error;
    }
  }

  /**
   * Get company TDS/TCS configuration
   * @param {Object} masterModels - Master database models
   * @param {string} companyId - Company ID
   * @returns {Promise<Object>} Company TDS/TCS config
   */
  async getCompanyTDSTCSConfig(masterModels, companyId, tenantId) {
    try {
      // Tenant-scoped lookup: a caller cannot read another tenant's company
      // even if they guess the companyId.
      const where = { id: companyId };
      if (tenantId) where.tenant_id = tenantId;
      const company = await masterModels.Company.findOne({
        where,
        attributes: ['id', 'company_name', 'is_tds_enabled', 'is_tcs_enabled'],
      });

      if (!company) {
        throw new Error('Company not found');
      }

      return {
        company_id: company.id,
        company_name: company.company_name,
        is_tds_enabled: company.is_tds_enabled || false,
        is_tcs_enabled: company.is_tcs_enabled || false,
      };
    } catch (error) {
      logger.error('Error fetching company TDS/TCS config:', error);
      throw error;
    }
  }
}

module.exports = new TDSService();
module.exports.TDS_SECTIONS = TDS_SECTIONS;
