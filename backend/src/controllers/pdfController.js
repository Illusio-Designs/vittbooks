const pdfService = require('../services/pdfService');
const logger = require('../utils/logger');
const { findByIdScoped } = require('../utils/scopedQueries');

// Helper function to format numbers
const formatNumber = (num) => {
  return parseFloat(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

module.exports = {
  /**
   * Test Sales Invoice PDF with dummy data
   */
  async testSalesInvoice(req, res, next) {
    try {
      const dummyData = {
        company_name: 'Test Trader Company Pvt Ltd',
        company_address: 'Plot No. 123, Industrial Area, Sector 5, Mumbai, Maharashtra - 400001',
        company_gstin: '27AABCT1234F1Z5',
        company_pan: 'AABCT1234F',
        company_phone: '+91-9876543210',
        company_email: 'accounts@testtrader.com',
        company_state: 'Maharashtra',
        company_state_code: '27',
        party_name: 'ABC Enterprises',
        party_address: 'Shop No. 45, Market Road, Andheri West, Mumbai, Maharashtra - 400058',
        party_gstin: '27AABCU9603R1ZM',
        party_pan: 'AABCU9603R',
        party_state: 'Maharashtra',
        voucher_number: 'SI-2026-0001',
        voucher_date: '14/02/2026',
        due_date: '14/03/2026',
        place_of_supply: 'Maharashtra',
        status: 'POSTED',
        items: [
          { item_name: 'Product A - Premium Widget', hsn_code: '84159000', quantity: 10, uqc: 'PCS', rate: 1000.00, taxable_amount: 10000.00, gst_rate: 18, gst_amount: 1800.00, amount: 11800.00 },
          { item_name: 'Product B - Deluxe Gadget', hsn_code: '85176200', quantity: 5, uqc: 'PCS', rate: 2000.00, taxable_amount: 10000.00, gst_rate: 18, gst_amount: 1800.00, amount: 11800.00 },
          { item_name: 'Product C - Professional Tool', hsn_code: '82054000', quantity: 15, uqc: 'PCS', rate: 800.00, taxable_amount: 12000.00, gst_rate: 12, gst_amount: 1440.00, amount: 13440.00 }
        ],
        taxable_amount: 32000.00,
        is_intrastate: true,
        cgst_amount: 2520.00,
        sgst_amount: 2520.00,
        igst_amount: 0,
        total_amount: 37040.00,
        amount_in_words: 'Thirty Seven Thousand Forty Rupees Only',
        narration: 'Sale of goods as per purchase order PO-2026-001 dated 10/02/2026',
        payment_terms: 30,
        generated_at: new Date().toLocaleString('en-IN')
      };

      const result = await pdfService.generatePDFBuffer('sales-invoice', dummyData);
      if (result.success) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="sales-invoice-test.pdf"');
        res.send(result.buffer);
      } else {
        res.status(500).json({ success: false, message: 'Failed to generate PDF', error: result.error });
      }
    } catch (error) {
      logger.error('Error generating test sales invoice PDF:', error);
      next(error);
    }
  },

  /**
   * Test Purchase Invoice PDF
   */
  async testPurchaseInvoice(req, res, next) {
    try {
      const dummyData = {
        company_name: 'Test Trader Company Pvt Ltd',
        company_address: 'Plot No. 123, Industrial Area, Sector 5, Mumbai, Maharashtra - 400001',
        company_gstin: '27AABCT1234F1Z5',
        company_pan: 'AABCT1234F',
        company_phone: '+91-9876543210',
        company_email: 'accounts@testtrader.com',
        party_name: 'Supplier One Pvt Ltd',
        party_address: 'Building No. 67, Trade Center, Andheri East, Mumbai, Maharashtra - 400069',
        party_gstin: '27AABCS9603R1ZA',
        party_pan: 'AABCS9603R',
        voucher_number: 'PI-2026-0001',
        voucher_date: '12/02/2026',
        supplier_invoice_number: 'SUP-INV-2026-0045',
        supplier_invoice_date: '10/02/2026',
        status: 'POSTED',
        items: [
          { item_name: 'Raw Material A', hsn_code: '39011000', quantity: 100, uqc: 'KGS', rate: 150.00, taxable_amount: 15000.00, gst_rate: 18, gst_amount: 2700.00, amount: 17700.00 },
          { item_name: 'Component B', hsn_code: '84099100', quantity: 50, uqc: 'PCS', rate: 500.00, taxable_amount: 25000.00, gst_rate: 18, gst_amount: 4500.00, amount: 29500.00 }
        ],
        taxable_amount: 40000.00,
        is_intrastate: true,
        cgst_amount: 3600.00,
        sgst_amount: 3600.00,
        tds_amount: 800.00,
        tds_section: '194C',
        tds_rate: 2,
        total_amount: 46400.00,
        amount_in_words: 'Forty Six Thousand Four Hundred Rupees Only',
        narration: 'Purchase of raw materials as per purchase order',
        generated_at: new Date().toLocaleString('en-IN')
      };

      const result = await pdfService.generatePDFBuffer('purchase-invoice', dummyData);
      if (result.success) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="purchase-invoice-test.pdf"');
        res.send(result.buffer);
      } else {
        res.status(500).json({ success: false, message: 'Failed to generate PDF', error: result.error });
      }
    } catch (error) {
      logger.error('Error generating test purchase invoice PDF:', error);
      next(error);
    }
  },

  /**
   * Test Receipt Voucher PDF
   */
  async testReceiptVoucher(req, res, next) {
    try {
      const dummyData = {
        company_name: 'Test Trader Company Pvt Ltd',
        company_address: 'Plot No. 123, Industrial Area, Sector 5, Mumbai, Maharashtra - 400001',
        voucher_number: 'REC-2026-0001',
        voucher_date: '14/02/2026',
        status: 'POSTED',
        party_name: 'ABC Enterprises',
        payment_mode: 'NEFT',
        reference_number: 'NEFT200001',
        bank_name: 'HDFC Bank',
        narration: 'Payment received against invoice SI-2026-0001',
        total_amount: 25000.00,
        amount_in_words: 'Twenty Five Thousand Rupees Only',
        ledger_entries: [
          { ledger_name: 'Bank Account - HDFC', debit_amount: 25000.00, credit_amount: 0 },
          { ledger_name: 'ABC Enterprises', debit_amount: 0, credit_amount: 25000.00 }
        ],
        total_debit: 25000.00,
        total_credit: 25000.00,
        generated_at: new Date().toLocaleString('en-IN')
      };

      const result = await pdfService.generatePDFBuffer('receipt-voucher', dummyData);
      if (result.success) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="receipt-voucher-test.pdf"');
        res.send(result.buffer);
      } else {
        res.status(500).json({ success: false, message: 'Failed to generate PDF', error: result.error });
      }
    } catch (error) {
      logger.error('Error generating test receipt voucher PDF:', error);
      next(error);
    }
  },

  /**
   * Test Payment Voucher PDF
   */
  async testPaymentVoucher(req, res, next) {
    try {
      const dummyData = {
        company_name: 'Test Trader Company Pvt Ltd',
        company_address: 'Plot No. 123, Industrial Area, Sector 5, Mumbai, Maharashtra - 400001',
        voucher_number: 'PAY-2026-0001',
        voucher_date: '14/02/2026',
        status: 'POSTED',
        party_name: 'Supplier One Pvt Ltd',
        payment_mode: 'Cheque',
        reference_number: 'CHQ-100001',
        bank_name: 'ICICI Bank',
        narration: 'Payment made against invoice PI-2026-0001',
        total_amount: 20000.00,
        amount_in_words: 'Twenty Thousand Rupees Only',
        ledger_entries: [
          { ledger_name: 'Supplier One Pvt Ltd', debit_amount: 20000.00, credit_amount: 0 },
          { ledger_name: 'Bank Account - ICICI', debit_amount: 0, credit_amount: 20000.00 }
        ],
        total_debit: 20000.00,
        total_credit: 20000.00,
        generated_at: new Date().toLocaleString('en-IN')
      };

      const result = await pdfService.generatePDFBuffer('payment-voucher', dummyData);
      if (result.success) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="payment-voucher-test.pdf"');
        res.send(result.buffer);
      } else {
        res.status(500).json({ success: false, message: 'Failed to generate PDF', error: result.error });
      }
    } catch (error) {
      logger.error('Error generating test payment voucher PDF:', error);
      next(error);
    }
  },

  /**
   * Test Journal Voucher PDF
   */
  async testJournalVoucher(req, res, next) {
    try {
      const dummyData = {
        company_name: 'Test Trader Company Pvt Ltd',
        company_address: 'Plot No. 123, Industrial Area, Sector 5, Mumbai, Maharashtra - 400001',
        voucher_number: 'JV-2026-0001',
        voucher_date: '14/02/2026',
        status: 'POSTED',
        narration: 'Adjustment entry for depreciation on fixed assets',
        ledger_entries: [
          { ledger_name: 'Depreciation Expense', debit_amount: 5000.00, credit_amount: 0 },
          { ledger_name: 'Accumulated Depreciation', debit_amount: 0, credit_amount: 5000.00 }
        ],
        total_debit: 5000.00,
        total_credit: 5000.00,
        generated_at: new Date().toLocaleString('en-IN')
      };

      const result = await pdfService.generatePDFBuffer('journal-voucher', dummyData);
      if (result.success) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="journal-voucher-test.pdf"');
        res.send(result.buffer);
      } else {
        res.status(500).json({ success: false, message: 'Failed to generate PDF', error: result.error });
      }
    } catch (error) {
      logger.error('Error generating test journal voucher PDF:', error);
      next(error);
    }
  },

  /**
   * Test Contra Voucher PDF
   */
  async testContraVoucher(req, res, next) {
    try {
      const dummyData = {
        company_name: 'Test Trader Company Pvt Ltd',
        company_address: 'Plot No. 123, Industrial Area, Sector 5, Mumbai, Maharashtra - 400001',
        voucher_number: 'CNT-2026-0001',
        voucher_date: '14/02/2026',
        status: 'POSTED',
        from_account: 'Cash on Hand',
        to_account: 'Bank Account - HDFC',
        total_amount: 10000.00,
        amount_in_words: 'Ten Thousand Rupees Only',
        narration: 'Cash deposited to bank',
        ledger_entries: [
          { ledger_name: 'Bank Account - HDFC', debit_amount: 10000.00, credit_amount: 0 },
          { ledger_name: 'Cash on Hand', debit_amount: 0, credit_amount: 10000.00 }
        ],
        total_debit: 10000.00,
        total_credit: 10000.00,
        generated_at: new Date().toLocaleString('en-IN')
      };

      const result = await pdfService.generatePDFBuffer('contra-voucher', dummyData);
      if (result.success) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="contra-voucher-test.pdf"');
        res.send(result.buffer);
      } else {
        res.status(500).json({ success: false, message: 'Failed to generate PDF', error: result.error });
      }
    } catch (error) {
      logger.error('Error generating test contra voucher PDF:', error);
      next(error);
    }
  },

  /**
   * Test Credit Note PDF
   */
  async testCreditNote(req, res, next) {
    try {
      const dummyData = {
        company_name: 'Test Trader Company Pvt Ltd',
        company_address: 'Plot No. 123, Industrial Area, Sector 5, Mumbai, Maharashtra - 400001',
        company_gstin: '27AABCT1234F1Z5',
        company_pan: 'AABCT1234F',
        company_phone: '+91-9876543210',
        company_email: 'accounts@testtrader.com',
        party_name: 'ABC Enterprises',
        party_address: 'Shop No. 45, Market Road, Andheri West, Mumbai, Maharashtra - 400058',
        party_gstin: '27AABCU9603R1ZM',
        voucher_number: 'CN-2026-0001',
        voucher_date: '14/02/2026',
        reference_number: 'SI-2026-0001',
        status: 'POSTED',
        narration: 'Sales return due to damaged goods received',
        items: [
          { item_name: 'Product A - Premium Widget', hsn_code: '84159000', quantity: 2, uqc: 'PCS', rate: 1000.00, taxable_amount: 2000.00, gst_rate: 18, gst_amount: 360.00, amount: 2360.00 }
        ],
        taxable_amount: 2000.00,
        is_intrastate: true,
        cgst_amount: 180.00,
        sgst_amount: 180.00,
        total_amount: 2360.00,
        amount_in_words: 'Two Thousand Three Hundred Sixty Rupees Only',
        generated_at: new Date().toLocaleString('en-IN')
      };

      const result = await pdfService.generatePDFBuffer('credit-note', dummyData);
      if (result.success) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="credit-note-test.pdf"');
        res.send(result.buffer);
      } else {
        res.status(500).json({ success: false, message: 'Failed to generate PDF', error: result.error });
      }
    } catch (error) {
      logger.error('Error generating test credit note PDF:', error);
      next(error);
    }
  },

  /**
   * Test Debit Note PDF
   */
  async testDebitNote(req, res, next) {
    try {
      const dummyData = {
        company_name: 'Test Trader Company Pvt Ltd',
        company_address: 'Plot No. 123, Industrial Area, Sector 5, Mumbai, Maharashtra - 400001',
        company_gstin: '27AABCT1234F1Z5',
        company_pan: 'AABCT1234F',
        company_phone: '+91-9876543210',
        company_email: 'accounts@testtrader.com',
        party_name: 'Supplier One Pvt Ltd',
        party_address: 'Building No. 67, Trade Center, Andheri East, Mumbai, Maharashtra - 400069',
        party_gstin: '27AABCS9603R1ZA',
        voucher_number: 'DN-2026-0001',
        voucher_date: '14/02/2026',
        reference_number: 'PI-2026-0001',
        status: 'POSTED',
        narration: 'Purchase return due to quality issues',
        items: [
          { item_name: 'Raw Material A', hsn_code: '39011000', quantity: 10, uqc: 'KGS', rate: 150.00, taxable_amount: 1500.00, gst_rate: 18, gst_amount: 270.00, amount: 1770.00 }
        ],
        taxable_amount: 1500.00,
        is_intrastate: true,
        cgst_amount: 135.00,
        sgst_amount: 135.00,
        total_amount: 1770.00,
        amount_in_words: 'One Thousand Seven Hundred Seventy Rupees Only',
        generated_at: new Date().toLocaleString('en-IN')
      };

      const result = await pdfService.generatePDFBuffer('debit-note', dummyData);
      if (result.success) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="debit-note-test.pdf"');
        res.send(result.buffer);
      } else {
        res.status(500).json({ success: false, message: 'Failed to generate PDF', error: result.error });
      }
    } catch (error) {
      logger.error('Error generating test debit note PDF:', error);
      next(error);
    }
  },

  /**
   * Generate PDF for actual voucher
   */
  async generateVoucherPDF(req, res, next) {
    try {
      const { voucherId } = req.params;

      // Fetch voucher with all related data
      const voucher = await findByIdScoped(req, req.tenantModels.Voucher, voucherId, {
        include: [
          {
            model: req.tenantModels.Ledger,
            as: 'partyLedger',
            attributes: ['id', 'ledger_name', 'address', 'gstin', 'pan', 'state']
          },
          {
            model: req.tenantModels.VoucherItem,
            as: 'items'
          }
        ]
      });

      if (!voucher) {
        return res.status(404).json({ success: false, message: 'Voucher not found' });
      }

      // Get company details from tenant context
      const companyData = req.user?.company || {};

      // Map voucher type to template name
      const templateMap = {
        'sales_invoice': 'sales-invoice',
        'purchase_invoice': 'purchase-invoice',
        'receipt': 'receipt-voucher',
        'payment': 'payment-voucher',
        'journal': 'journal-voucher',
        'contra': 'contra-voucher',
        'credit_note': 'credit-note',
        'debit_note': 'debit-note'
      };

      const templateName = templateMap[voucher.voucher_type];
      if (!templateName) {
        return res.status(400).json({ success: false, message: 'Invalid voucher type for PDF generation' });
      }

      // Format date helper
      const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
      };

      // Prepare PDF data
      const pdfData = {
        company_name: companyData.company_name || 'Company Name',
        company_address: companyData.address || '',
        company_gstin: companyData.gstin || '',
        company_pan: companyData.pan || '',
        company_phone: companyData.phone || '',
        company_email: companyData.email || '',
        company_state: companyData.state || '',
        company_state_code: companyData.state_code || '',
        party_name: voucher.partyLedger?.ledger_name || 'N/A',
        party_address: voucher.partyLedger?.address || '',
        party_gstin: voucher.partyLedger?.gstin || '',
        party_pan: voucher.partyLedger?.pan || '',
        party_state: voucher.partyLedger?.state || '',
        voucher_number: voucher.voucher_number || 'N/A',
        voucher_date: formatDate(voucher.voucher_date),
        due_date: formatDate(voucher.due_date),
        place_of_supply: voucher.place_of_supply || '',
        status: voucher.status?.toUpperCase() || 'DRAFT',
        items: voucher.items?.map(item => ({
          item_name: item.item_name || item.item_description || item.description || 'Item',
          hsn_code: item.hsn_code || item.hsn_sac_code || '',
          quantity: item.quantity || 0,
          uqc: item.uqc || item.unit || 'PCS',
          rate: parseFloat(item.rate || item.unit_price || 0),
          taxable_amount: parseFloat(item.taxable_amount || item.amount || 0),
          gst_rate: parseFloat(item.gst_rate || item.tax_rate || 0),
          gst_amount: parseFloat(item.gst_amount || item.tax_amount || 0),
          amount: parseFloat(item.total_amount || item.amount || 0)
        })) || [],
        taxable_amount: parseFloat(voucher.subtotal || voucher.taxable_amount || 0),
        is_intrastate: voucher.is_intrastate || false,
        cgst_amount: parseFloat(voucher.cgst_amount || 0),
        sgst_amount: parseFloat(voucher.sgst_amount || 0),
        igst_amount: parseFloat(voucher.igst_amount || 0),
        tds_amount: parseFloat(voucher.tds_amount || 0),
        tds_section: voucher.tds_section || '',
        tds_rate: parseFloat(voucher.tds_rate || 0),
        total_amount: parseFloat(voucher.total_amount || 0),
        amount_in_words: voucher.amount_in_words || '',
        narration: voucher.narration || '',
        payment_terms: voucher.payment_terms || 0,
        payment_mode: voucher.payment_mode || '',
        reference_number: voucher.reference_number || '',
        bank_name: voucher.bank_name || '',
        generated_at: new Date().toLocaleString('en-IN')
      };

      // Generate PDF
      const result = await pdfService.generatePDFBuffer(templateName, pdfData);
      
      if (result.success) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${voucher.voucher_number || 'voucher'}.pdf"`);
        res.send(result.buffer);
      } else {
        res.status(500).json({ success: false, message: 'Failed to generate PDF', error: result.error });
      }
    } catch (error) {
      logger.error('Error generating voucher PDF:', error);
      next(error);
    }
  }
};
