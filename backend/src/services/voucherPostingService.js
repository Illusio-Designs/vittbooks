const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Voucher Posting Service
 * Handles ledger entry generation and posting for different voucher types
 */

/**
 * Helper function to get master group ID
 */
async function getMasterGroupId(masterModels, groupCode) {
  const group = await masterModels.AccountGroup.findOne({ where: { group_code: groupCode } });
  if (!group) throw new Error(`Master AccountGroup not found for group_code=${groupCode}`);
  return group.id;
}

/**
 * Helper function to get or create system ledger
 */
async function getOrCreateSystemLedger({ tenantModels, masterModels, tenant_id }, { ledgerCode, ledgerName, groupCode }, transaction) {
  if (!tenant_id) {
    throw new Error('tenant_id is required for creating system ledgers');
  }

  const { findOneScoped } = require('../utils/scopedQueries');
  const ctx = { tenant_id };
  const existing =
    (ledgerCode
      ? await findOneScoped(ctx, tenantModels.Ledger, { ledger_code: ledgerCode }, { transaction })
      : null) ||
    (ledgerName
      ? await findOneScoped(ctx, tenantModels.Ledger, { ledger_name: ledgerName }, { transaction })
      : null);

  if (existing) return existing;

  const groupId = await getMasterGroupId(masterModels, groupCode);
  return tenantModels.Ledger.create({
    ledger_name: ledgerName,
    ledger_code: ledgerCode || null,
    account_group_id: groupId,
    opening_balance: 0,
    opening_balance_type: 'Dr',
    balance_type: 'debit',
    is_active: true,
    tenant_id: tenant_id,
  }, { transaction });
}

/**
 * Generate ledger entries based on voucher type
 * @param {Object} tenantModels - Tenant database models
 * @param {Object} masterModels - Master database models
 * @param {Object} voucher - Voucher object
 * @param {Array} items - Voucher items
 * @param {Object} transaction - Database transaction
 * @returns {Array} - Array of ledger entries
 */
async function generateLedgerEntriesByType(tenantModels, masterModels, voucher, items, transaction) {
  const voucherType = voucher.voucher_type?.toLowerCase();
  
  switch (voucherType) {
    // Sales related vouchers
    case 'sales_invoice':
    case 'tax_invoice':
    case 'retail_invoice':
    case 'export_invoice':
      return await generateSalesInvoiceEntries(tenantModels, masterModels, voucher, items, transaction);
    
    // Purchase related vouchers
    case 'purchase_invoice':
    case 'purchase':
      return await generatePurchaseInvoiceEntries(tenantModels, masterModels, voucher, items, transaction);
    
    // Delivery and supply vouchers (no accounting entries, just inventory movement)
    case 'delivery_challan':
    case 'bill_of_supply':
      return await generateDeliveryChallanEntries(tenantModels, masterModels, voucher, items, transaction);
    
    // Order vouchers (no accounting entries until converted to invoice)
    case 'sales_order':
    case 'purchase_order':
    case 'proforma_invoice':
      logger.info(`${voucherType} - No ledger entries generated (order/proforma)`);
      return [];
    
    // Payment and receipt vouchers
    case 'payment':
      return await generatePaymentEntries(tenantModels, masterModels, voucher, items, transaction);
    
    case 'receipt':
      return await generateReceiptEntries(tenantModels, masterModels, voucher, items, transaction);
    
    // Journal voucher
    case 'journal':
      return await generateJournalEntries(tenantModels, masterModels, voucher, items, transaction);
    
    // Credit and debit notes
    case 'credit_note':
      return await generateCreditNoteEntries(tenantModels, masterModels, voucher, items, transaction);
    
    case 'debit_note':
      return await generateDebitNoteEntries(tenantModels, masterModels, voucher, items, transaction);
    
    // Contra voucher
    case 'contra':
      return await generateContraEntries(tenantModels, masterModels, voucher, items, transaction);
    
    default:
      logger.warn(`No posting method defined for voucher type: ${voucherType}`);
      return [];
  }
}

/**
 * Generate ledger entries for Sales Invoice
 */
async function generateSalesInvoiceEntries(tenantModels, masterModels, voucher, items, transaction) {
  const ledgerEntries = [];
  
  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  const totalCGST = items.reduce((sum, item) => sum + parseFloat(item.cgst_amount || 0), 0);
  const totalSGST = items.reduce((sum, item) => sum + parseFloat(item.sgst_amount || 0), 0);
  const totalIGST = items.reduce((sum, item) => sum + parseFloat(item.igst_amount || 0), 0);
  const totalAmount = subtotal + totalCGST + totalSGST + totalIGST;
  
  // Calculate COGS (Cost of Goods Sold) for Stock in Hand credit
  let totalCOGS = 0;
  for (const item of items) {
    if (item.inventory_item_id) {
      const { findByIdScoped } = require('../utils/scopedQueries');
      const inventoryItem = await findByIdScoped(
        { tenant_id: voucher.tenant_id, company_id: voucher.company_id || null },
        tenantModels.InventoryItem,
        item.inventory_item_id,
        { transaction }
      );
      if (inventoryItem) {
        const cost = parseFloat(inventoryItem.avg_cost || inventoryItem.purchase_price || 0);
        const quantity = parseFloat(item.quantity || 0);
        totalCOGS += cost * quantity;
      }
    }
  }
  
  const ctx = { tenantModels, masterModels, tenant_id: voucher.tenant_id };
  
  // Get or create required ledgers
  const salesLedger = await getOrCreateSystemLedger(ctx, 
    { ledgerCode: 'SALES', ledgerName: 'Sales', groupCode: 'SAL' }, transaction);
  
  const stockLedger = await getOrCreateSystemLedger(ctx,
    { ledgerCode: 'INVENTORY', ledgerName: 'Stock in Hand', groupCode: 'INV' }, transaction);
  
  // 1. Debit Customer Account (Sundry Debtor)
  if (voucher.party_ledger_id) {
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: voucher.party_ledger_id,
      debit_amount: totalAmount,
      credit_amount: 0,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 2. Credit Sales Account
  if (salesLedger && subtotal > 0) {
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: salesLedger.id,
      debit_amount: 0,
      credit_amount: subtotal,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 3. Credit CGST (Output Tax)
  if (totalCGST > 0) {
    const cgstLedger = await getOrCreateSystemLedger(ctx,
      { ledgerCode: 'CGST-OUTPUT', ledgerName: 'Output CGST', groupCode: 'DT' }, transaction);
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: cgstLedger.id,
      debit_amount: 0,
      credit_amount: totalCGST,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 4. Credit SGST (Output Tax)
  if (totalSGST > 0) {
    const sgstLedger = await getOrCreateSystemLedger(ctx,
      { ledgerCode: 'SGST-OUTPUT', ledgerName: 'Output SGST', groupCode: 'DT' }, transaction);
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: sgstLedger.id,
      debit_amount: 0,
      credit_amount: totalSGST,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 5. Credit IGST (for interstate sales)
  if (totalIGST > 0) {
    const igstLedger = await getOrCreateSystemLedger(ctx,
      { ledgerCode: 'IGST-OUTPUT', ledgerName: 'Output IGST', groupCode: 'DT' }, transaction);
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: igstLedger.id,
      debit_amount: 0,
      credit_amount: totalIGST,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 6. Credit Stock in Hand (reduce inventory value)
  if (stockLedger && totalCOGS > 0) {
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: stockLedger.id,
      debit_amount: 0,
      credit_amount: totalCOGS,
      tenant_id: voucher.tenant_id,
    });
    logger.info(`Added Stock in Hand credit entry: ${totalCOGS} (COGS)`);
  }
  
  // 7. Debit Cost of Goods Sold (record expense)
  if (totalCOGS > 0) {
    const cogsLedger = await getOrCreateSystemLedger(ctx,
      { ledgerCode: 'COGS', ledgerName: 'Cost of Goods Sold', groupCode: 'DIR_EXP' }, transaction);
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: cogsLedger.id,
      debit_amount: totalCOGS,
      credit_amount: 0,
      tenant_id: voucher.tenant_id,
    });
    logger.info(`Added COGS debit entry: ${totalCOGS}`);
  }
  
  return ledgerEntries;
}

/**
 * Generate ledger entries for Purchase Invoice
 * TDS 194Q is now calculated in voucherService.createPurchaseInvoice
 * This function just validates the ledger entries
 */
async function generatePurchaseInvoiceEntries(tenantModels, masterModels, voucher, items, transaction) {
  const ledgerEntries = [];
  
  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  const totalCGST = items.reduce((sum, item) => sum + parseFloat(item.cgst_amount || 0), 0);
  const totalSGST = items.reduce((sum, item) => sum + parseFloat(item.sgst_amount || 0), 0);
  const totalIGST = items.reduce((sum, item) => sum + parseFloat(item.igst_amount || 0), 0);
  const totalAmount = subtotal + totalCGST + totalSGST + totalIGST;
  
  const ctx = { tenantModels, masterModels, tenant_id: voucher.tenant_id };
  
  // Get or create Stock ledger
  const stockLedger = await getOrCreateSystemLedger(ctx,
    { ledgerCode: 'INVENTORY', ledgerName: 'Stock in Hand', groupCode: 'INV' }, transaction);
  
  // 1. Debit Stock in Hand (Perpetual Inventory System - Tally Style)
  // Only taxable value goes to stock, GST is separate
  if (stockLedger && subtotal > 0) {
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: stockLedger.id,
      debit_amount: subtotal,
      credit_amount: 0,
      tenant_id: voucher.tenant_id,
    });
    logger.info(`Added Stock in Hand debit entry: ${subtotal}`);
  }
  
  // 2. Debit CGST (Input Tax Credit - Asset)
  if (totalCGST > 0) {
    const cgstLedger = await getOrCreateSystemLedger(ctx,
      { ledgerCode: 'CGST-INPUT', ledgerName: 'Input CGST', groupCode: 'DT' }, transaction);
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: cgstLedger.id,
      debit_amount: totalCGST,
      credit_amount: 0,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 3. Debit SGST (Input Tax Credit - Asset)
  if (totalSGST > 0) {
    const sgstLedger = await getOrCreateSystemLedger(ctx,
      { ledgerCode: 'SGST-INPUT', ledgerName: 'Input SGST', groupCode: 'DT' }, transaction);
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: sgstLedger.id,
      debit_amount: totalSGST,
      credit_amount: 0,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 4. Debit IGST (for interstate purchases - Input Tax Credit)
  if (totalIGST > 0) {
    const igstLedger = await getOrCreateSystemLedger(ctx,
      { ledgerCode: 'IGST-INPUT', ledgerName: 'Input IGST', groupCode: 'DT' }, transaction);
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: igstLedger.id,
      debit_amount: totalIGST,
      credit_amount: 0,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 5. TDS and Party entries are already calculated in voucherService.createPurchaseInvoice
  // They come through voucher.ledger_entries, so we don't duplicate them here
  // This function is called by postVoucher which uses the ledger_entries from createPurchaseInvoice
  
  logger.info('Purchase invoice entries generated (TDS handled in voucherService)');
  
  return ledgerEntries;
}

/**
 * Generate ledger entries for Delivery Challan / Bill of Supply
 * These are typically for goods movement without immediate sale
 * No accounting entries, just for tracking
 */
async function generateDeliveryChallanEntries(tenantModels, masterModels, voucher, items, transaction) {
  // Delivery challans don't create accounting entries
  // They are used for goods movement tracking only
  logger.info('Delivery Challan/Bill of Supply - No ledger entries generated (goods movement only)');
  return [];
}

/**
 * Generate ledger entries for Payment Voucher
 * Note: Payment vouchers should have ledger_entries provided in the request
 * This function is a fallback for legacy support
 */
async function generatePaymentEntries(tenantModels, masterModels, voucher, items, transaction) {
  logger.info('Payment voucher - ledger entries should be provided in request');
  
  // Payment vouchers should have ledger_entries already provided by the controller
  // This function returns empty array as entries are created by transactionController.createPayment
  return [];
}

/**
 * Generate ledger entries for Receipt Voucher
 * Note: Receipt vouchers should have ledger_entries provided in the request
 * This function is a fallback for legacy support
 */
async function generateReceiptEntries(tenantModels, masterModels, voucher, items, transaction) {
  logger.info('Receipt voucher - ledger entries should be provided in request');
  
  // Receipt vouchers should have ledger_entries already provided by the controller
  // This function returns empty array as entries are created by transactionController.createReceipt
  return [];
}

/**
 * Generate ledger entries for Journal Voucher
 */
async function generateJournalEntries(tenantModels, masterModels, voucher, items, transaction) {
  // Journal entries can be provided manually in ledger_entries
  // Or we can generate them if debit_ledger_id and credit_ledger_id are provided
  
  // Check if voucher has debit_ledger_id and credit_ledger_id (legacy format)
  if (voucher.debit_ledger_id && voucher.credit_ledger_id) {
    logger.info('Journal voucher - generating entries from debit/credit ledger IDs');
    
    const amount = parseFloat(voucher.total_amount || voucher.amount || 0);
    
    if (amount <= 0) {
      logger.error('Journal voucher has zero or negative amount');
      throw new Error('Journal voucher requires a positive amount');
    }
    
    return [
      {
        voucher_id: voucher.id,
        ledger_id: voucher.debit_ledger_id,
        debit_amount: amount,
        credit_amount: 0,
        narration: voucher.narration || 'Journal entry - Debit',
        tenant_id: voucher.tenant_id
      },
      {
        voucher_id: voucher.id,
        ledger_id: voucher.credit_ledger_id,
        debit_amount: 0,
        credit_amount: amount,
        narration: voucher.narration || 'Journal entry - Credit',
        tenant_id: voucher.tenant_id
      }
    ];
  }
  
  // Check if ledger entries are provided in items format
  if (items && items.length > 0) {
    logger.info('Journal voucher - generating entries from items');
    
    const entries = [];
    for (const item of items) {
      if (!item.ledger_id) {
        logger.warn('Journal item missing ledger_id');
        continue;
      }
      
      const debitAmount = parseFloat(item.debit_amount || 0);
      const creditAmount = parseFloat(item.credit_amount || 0);
      
      if (debitAmount === 0 && creditAmount === 0) {
        logger.warn('Journal item has zero debit and credit amounts');
        continue;
      }
      
      entries.push({
        voucher_id: voucher.id,
        ledger_id: item.ledger_id,
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        narration: item.narration || voucher.narration || 'Journal entry',
        tenant_id: voucher.tenant_id,
      });
    }
    
    // Validate that debits equal credits
    const totalDebit = entries.reduce((sum, entry) => sum + entry.debit_amount, 0);
    const totalCredit = entries.reduce((sum, entry) => sum + entry.credit_amount, 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      logger.error(`Journal voucher unbalanced: Debit=${totalDebit}, Credit=${totalCredit}`);
      throw new Error('Journal voucher entries must be balanced (total debits must equal total credits)');
    }
    
    logger.info(`Generated ${entries.length} journal entries (Total: ${totalDebit.toFixed(2)})`);
    return entries;
  }
  
  // Otherwise, ledger entries should be provided manually in the request
  logger.warn('Journal voucher - no ledger entries provided');
  throw new Error('Journal voucher requires either debit_ledger_id/credit_ledger_id or items with ledger entries');
}

/**
 * Generate ledger entries for Credit Note
 */
async function generateCreditNoteEntries(tenantModels, masterModels, voucher, items, transaction) {
  const ledgerEntries = [];
  
  // Credit Note: Reverse of Sales Invoice
  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  const totalCGST = items.reduce((sum, item) => sum + parseFloat(item.cgst_amount || 0), 0);
  const totalSGST = items.reduce((sum, item) => sum + parseFloat(item.sgst_amount || 0), 0);
  const totalIGST = items.reduce((sum, item) => sum + parseFloat(item.igst_amount || 0), 0);
  const totalAmount = subtotal + totalCGST + totalSGST + totalIGST;
  
  const salesLedger = await findLedger(tenantModels, voucher.tenant_id, ['Sales', '%sales%'], transaction);
  const cgstLedger = await findLedger(tenantModels, voucher.tenant_id, ['CGST Output', '%CGST Output%'], transaction);
  const sgstLedger = await findLedger(tenantModels, voucher.tenant_id, ['SGST Output', '%SGST Output%'], transaction);
  const igstLedger = await findLedger(tenantModels, voucher.tenant_id, ['IGST Output', '%IGST Output%'], transaction);
  
  // 1. Credit Customer Account (reverse debit)
  if (voucher.party_ledger_id) {
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: voucher.party_ledger_id,
      debit_amount: 0,
      credit_amount: totalAmount,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 2. Debit Sales Account (reverse credit)
  if (salesLedger && subtotal > 0) {
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: salesLedger.id,
      debit_amount: subtotal,
      credit_amount: 0,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 3. Debit CGST (reverse output tax)
  if (cgstLedger && totalCGST > 0) {
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: cgstLedger.id,
      debit_amount: totalCGST,
      credit_amount: 0,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 4. Debit SGST (reverse output tax)
  if (sgstLedger && totalSGST > 0) {
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: sgstLedger.id,
      debit_amount: totalSGST,
      credit_amount: 0,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 5. Debit IGST
  if (igstLedger && totalIGST > 0) {
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: igstLedger.id,
      debit_amount: totalIGST,
      credit_amount: 0,
      tenant_id: voucher.tenant_id,
    });
  }
  
  return ledgerEntries;
}

/**
 * Generate ledger entries for Debit Note
 */
async function generateDebitNoteEntries(tenantModels, masterModels, voucher, items, transaction) {
  const ledgerEntries = [];
  
  // Debit Note: Reverse of Purchase Invoice
  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  const totalCGST = items.reduce((sum, item) => sum + parseFloat(item.cgst_amount || 0), 0);
  const totalSGST = items.reduce((sum, item) => sum + parseFloat(item.sgst_amount || 0), 0);
  const totalIGST = items.reduce((sum, item) => sum + parseFloat(item.igst_amount || 0), 0);
  const totalAmount = subtotal + totalCGST + totalSGST + totalIGST;
  
  const purchaseLedger = await findLedger(tenantModels, voucher.tenant_id, ['Purchase', 'Purchases', '%purchase%'], transaction);
  const cgstLedger = await findLedger(tenantModels, voucher.tenant_id, ['CGST Input', '%CGST Input%'], transaction);
  const sgstLedger = await findLedger(tenantModels, voucher.tenant_id, ['SGST Input', '%SGST Input%'], transaction);
  const igstLedger = await findLedger(tenantModels, voucher.tenant_id, ['IGST Input', '%IGST Input%'], transaction);
  
  // 1. Debit Supplier Account (reverse credit)
  if (voucher.party_ledger_id) {
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: voucher.party_ledger_id,
      debit_amount: totalAmount,
      credit_amount: 0,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 2. Credit Purchase Account (reverse debit)
  if (purchaseLedger && subtotal > 0) {
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: purchaseLedger.id,
      debit_amount: 0,
      credit_amount: subtotal,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 3. Credit CGST (reverse input tax)
  if (cgstLedger && totalCGST > 0) {
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: cgstLedger.id,
      debit_amount: 0,
      credit_amount: totalCGST,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 4. Credit SGST (reverse input tax)
  if (sgstLedger && totalSGST > 0) {
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: sgstLedger.id,
      debit_amount: 0,
      credit_amount: totalSGST,
      tenant_id: voucher.tenant_id,
    });
  }
  
  // 5. Credit IGST
  if (igstLedger && totalIGST > 0) {
    ledgerEntries.push({
      voucher_id: voucher.id,
      ledger_id: igstLedger.id,
      debit_amount: 0,
      credit_amount: totalIGST,
      tenant_id: voucher.tenant_id,
    });
  }
  
  return ledgerEntries;
}

/**
 * Generate ledger entries for Contra Voucher
 * Contra vouchers are used for transfers between cash and bank accounts
 */
async function generateContraEntries(tenantModels, masterModels, voucher, items, transaction) {
  logger.info('Generating contra voucher entries');
  
  const entries = [];
  
  // If ledger entries are already provided in the voucher, use them
  if (voucher.ledger_entries && voucher.ledger_entries.length > 0) {
    logger.info('Using provided ledger entries for contra voucher');
    return voucher.ledger_entries;
  }
  
  // Otherwise, generate entries from items if available
  if (!items || items.length === 0) {
    logger.warn('No items or ledger entries provided for contra voucher');
    return [];
  }
  
  // For contra vouchers, items should have ledger_id, debit_amount, and credit_amount
  for (const item of items) {
    if (!item.ledger_id) {
      logger.warn('Item missing ledger_id in contra voucher');
      continue;
    }
    
    const debitAmount = parseFloat(item.debit_amount || 0);
    const creditAmount = parseFloat(item.credit_amount || 0);
    
    if (debitAmount === 0 && creditAmount === 0) {
      logger.warn('Item has zero debit and credit amounts');
      continue;
    }
    
    entries.push({
      ledger_id: item.ledger_id,
      debit_amount: debitAmount,
      credit_amount: creditAmount,
      narration: item.narration || voucher.narration || 'Contra entry',
    });
  }
  
  // Validate that debits equal credits
  const totalDebit = entries.reduce((sum, entry) => sum + entry.debit_amount, 0);
  const totalCredit = entries.reduce((sum, entry) => sum + entry.credit_amount, 0);
  
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    logger.error(`Contra voucher unbalanced: Debit=${totalDebit}, Credit=${totalCredit}`);
    throw new Error('Contra voucher entries must be balanced (total debits must equal total credits)');
  }
  
  logger.info(`Generated ${entries.length} contra entries (Total: ${totalDebit.toFixed(2)})`);
  return entries;
}

/**
 * Helper function to find ledger by name patterns
 */
async function findLedger(tenantModels, tenantId, patterns, transaction) {
  const conditions = patterns.map(pattern => {
    if (pattern.includes('%')) {
      return { [Op.like]: pattern };
    }
    return pattern;
  });
  
  return await tenantModels.Ledger.findOne({
    where: { 
      ledger_name: {
        [Op.or]: conditions
      },
      tenant_id: tenantId
    },
    transaction
  });
}

/**
 * Update ledger balance based on ledger entries.
 *
 * `tenantId` is required for tenant-scoped lookup; older callers that
 * don't pass it fall back to the legacy unscoped behaviour and emit a
 * deprecation warning. New code MUST pass tenantId.
 */
async function updateLedgerBalance(tenantModels, ledgerId, transaction, tenantId) {
  try {
    const { findByIdScoped } = require('../utils/scopedQueries');
    let ledger;
    if (tenantId) {
      ledger = await findByIdScoped(
        { tenant_id: tenantId },
        tenantModels.Ledger,
        ledgerId,
        { transaction }
      );
    } else {
      logger.warn(
        `updateLedgerBalance called without tenantId for ledger ${ledgerId} — caller should pass req.tenant_id`
      );
      ledger = await tenantModels.Ledger.findByPk(ledgerId, { transaction });
    }
    if (!ledger) {
      logger.warn(`Ledger not found: ${ledgerId}`);
      return;
    }

    // Calculate total debits and credits from ledger entries
    const entries = await tenantModels.VoucherLedgerEntry.findAll({
      where: { ledger_id: ledgerId, ...(tenantId ? { tenant_id: tenantId } : {}) },
      attributes: [
        [tenantModels.sequelize.fn('SUM', tenantModels.sequelize.col('debit_amount')), 'total_debit'],
        [tenantModels.sequelize.fn('SUM', tenantModels.sequelize.col('credit_amount')), 'total_credit']
      ],
      raw: true,
      transaction
    });

    const totalDebit = parseFloat(entries[0]?.total_debit || 0);
    const totalCredit = parseFloat(entries[0]?.total_credit || 0);
    const openingBalance = parseFloat(ledger.opening_balance || 0);

    // Calculate current balance based on ledger type
    let currentBalance = openingBalance;
    if (ledger.balance_type === 'debit' || ledger.opening_balance_type === 'Dr') {
      currentBalance = openingBalance + totalDebit - totalCredit;
    } else {
      currentBalance = openingBalance + totalCredit - totalDebit;
    }

    // Determine the balance type based on the sign
    let balanceType;
    if (currentBalance >= 0) {
      balanceType = (ledger.balance_type === 'debit' || ledger.opening_balance_type === 'Dr') ? 'Dr' : 'Cr';
    } else {
      balanceType = (ledger.balance_type === 'debit' || ledger.opening_balance_type === 'Dr') ? 'Cr' : 'Dr';
    }

    // Update the ledger's current balance and balance type
    await ledger.update({
      current_balance: Math.abs(currentBalance),
      balance_type: balanceType === 'Dr' ? 'debit' : 'credit'
    }, { transaction });

    logger.info(`Updated ledger balance for ${ledger.ledger_name}: ${Math.abs(currentBalance)} ${balanceType}`);
    return { balance: Math.abs(currentBalance), balanceType };
  } catch (error) {
    logger.error(`Error updating ledger balance for ${ledgerId}:`, error);
    throw error;
  }
}

module.exports = {
  generateLedgerEntriesByType,
  updateLedgerBalance,
  generateSalesInvoiceEntries,
  generatePurchaseInvoiceEntries,
  generateDeliveryChallanEntries,
  generatePaymentEntries,
  generateReceiptEntries,
  generateJournalEntries,
  generateCreditNoteEntries,
  generateDebitNoteEntries,
  generateContraEntries,
};
