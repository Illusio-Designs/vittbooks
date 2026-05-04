const tallyImportService = require('../services/tallyImportService');
const logger = require('../utils/logger');
const path = require('path');
const { findOneScoped } = require('../utils/scopedQueries');

/**
 * Tally Import Controller
 * Handles importing data from Tally accounting software
 */
module.exports = {
  /**
   * Import data from Tally file
   * Supports: XML, Excel (.xlsx, .xls), CSV
   */
  async importTallyData(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded. Please upload a Tally export file (XML, Excel, or CSV).',
        });
      }

      const filePath = req.file.path;
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      const { tenantModels, masterModels, company } = req;
      const { importOptions = {} } = req.body;

      let parsedData;

      // Parse file based on extension
      if (fileExtension === '.xml') {
        parsedData = await tallyImportService.parseTallyXML(filePath);
      } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        parsedData = await tallyImportService.parseTallyExcel(filePath);
      } else if (fileExtension === '.csv') {
        parsedData = await tallyImportService.parseTallyCSV(filePath);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Unsupported file format. Please upload XML, Excel (.xlsx, .xls), or CSV file.',
        });
      }

      const importResult = {
        groups: { imported: 0, skipped: 0, errors: [] },
        ledgers: { imported: 0, skipped: 0, errors: [] },
        stockItems: { imported: 0, skipped: 0, errors: [] },
        vouchers: { imported: 0, skipped: 0, errors: [] },
        openingBalances: { imported: 0, skipped: 0, errors: [] },
      };

      // Import Account Groups (if enabled)
      if (importOptions.importGroups !== false && parsedData.groups.length > 0) {
        for (const group of parsedData.groups) {
          try {
            // Skip groups without names
            if (!group.name || !group.name.trim()) {
              logger.warn('Skipping group with empty name');
              continue;
            }

            // Check if group exists in master (case-insensitive)
            const existingGroup = await masterModels.AccountGroup.findOne({
              where: { 
                name: group.name.trim()
              },
            });

            if (!existingGroup) {
              // Find or create parent group if specified
              let parentId = null;
              if (group.parent && group.parent.trim()) {
                const parentGroup = await masterModels.AccountGroup.findOne({
                  where: { 
                    name: group.parent.trim()
                  },
                });
                if (parentGroup) parentId = parentGroup.id;
              }

              // Create new group with proper nature
              await masterModels.AccountGroup.create({
                name: group.name.trim(),
                parent_id: parentId,
                nature: group.nature,
                is_system: false,
                group_code: group.name.trim().substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, ''),
              });
              importResult.groups.imported++;
              logger.info(`Created new group: ${group.name} (${group.nature})`);
            } else {
              importResult.groups.skipped++;
              logger.debug(`Skipped existing group: ${group.name}`);
            }
          } catch (error) {
            logger.error(`Error importing group ${group.name}:`, error);
            importResult.groups.errors.push({ group: group.name, error: error.message });
          }
        }
      }

      // Import Ledgers
      if (importOptions.importLedgers !== false && parsedData.ledgers.length > 0) {
        for (const ledger of parsedData.ledgers) {
          try {
            // Find account group - skip if no group specified
            let group = null;
            if (ledger.group && ledger.group.trim()) {
              group = await masterModels.AccountGroup.findOne({
                where: { name: ledger.group },
              });

              if (!group) {
                importResult.ledgers.errors.push({
                  ledger: ledger.name,
                  error: `Group "${ledger.group}" not found`,
                });
                continue;
              }
            } else {
              // For ledgers without a group, try to find a default group or skip
              logger.warn(`Ledger "${ledger.name}" has no group specified, skipping`);
              importResult.ledgers.errors.push({
                ledger: ledger.name,
                error: `No account group specified`,
              });
              continue;
            }

            // Check if ledger exists
            const existingLedger = await findOneScoped(req, tenantModels.Ledger, { ledger_name: ledger.name });

            if (!existingLedger) {
              // Determine balance type based on account group nature and opening balance sign
              const openingBalance = parseFloat(ledger.openingBalance || 0);
              let openingBalanceType;
              let balanceType;
              
              // Determine natural balance type from account group
              const isNaturallyDebit = ['asset', 'expense'].includes(group.nature);
              const isNaturallyCredit = ['liability', 'equity', 'income'].includes(group.nature);
              
              if (openingBalance >= 0) {
                // Positive opening balance
                if (isNaturallyDebit) {
                  openingBalanceType = 'Dr';
                  balanceType = 'debit';
                } else if (isNaturallyCredit) {
                  openingBalanceType = 'Cr';
                  balanceType = 'credit';
                } else {
                  // Default to debit for unknown nature
                  openingBalanceType = 'Dr';
                  balanceType = 'debit';
                }
              } else {
                // Negative opening balance (contra to natural type)
                if (isNaturallyDebit) {
                  openingBalanceType = 'Cr';
                  balanceType = 'credit';
                } else if (isNaturallyCredit) {
                  openingBalanceType = 'Dr';
                  balanceType = 'debit';
                } else {
                  // Default to credit for unknown nature
                  openingBalanceType = 'Cr';
                  balanceType = 'credit';
                }
              }
              
              await tenantModels.Ledger.create({
                ledger_name: ledger.name,
                account_group_id: group.id,
                address: ledger.address,
                state: ledger.state,
                pincode: ledger.pincode,
                gstin: ledger.gstin,
                pan: ledger.pan,
                email: ledger.email,
                contact_number: ledger.phone,
                opening_balance: Math.abs(openingBalance),
                opening_balance_type: openingBalanceType,
                balance_type: balanceType,
                is_default: ledger.isDefault || false,
                tenant_id: req.tenant_id || req.tenant?.id || req.company?.tenant_id, // Ensure tenant_id is set
              });
              importResult.ledgers.imported++;
              
              // Track opening balance import
              if (ledger.openingBalance && ledger.openingBalance !== 0) {
                importResult.openingBalances.imported++;
              }
            } else {
              importResult.ledgers.skipped++;
            }
          } catch (error) {
            logger.error(`Error importing ledger ${ledger.name}:`, error);
            importResult.ledgers.errors.push({ ledger: ledger.name, error: error.message });
          }
        }
      }

      // Import Stock Items
      if (importOptions.importStockItems !== false && parsedData.stockItems.length > 0) {
        for (const item of parsedData.stockItems) {
          try {
            const existingItem = await findOneScoped(req, tenantModels.InventoryItem, { item_name: item.name });

            if (!existingItem) {
              await tenantModels.InventoryItem.create({
                item_name: item.name,
                item_code: item.name,
                hsn_sac_code: item.hsnCode,
                gst_rate: item.gstRate,
                uqc: item.unit,
                quantity_on_hand: item.openingStock || 0,
                avg_cost: item.openingValue && item.openingStock 
                  ? item.openingValue / item.openingStock 
                  : 0,
                is_active: true,
              });
              importResult.stockItems.imported++;
            } else {
              importResult.stockItems.skipped++;
            }
          } catch (error) {
            logger.error(`Error importing stock item ${item.name}:`, error);
            importResult.stockItems.errors.push({ item: item.name, error: error.message });
          }
        }
      }

      // Import Vouchers (if enabled)
      if (importOptions.importVouchers !== false && parsedData.vouchers.length > 0) {
        // Limit voucher import to prevent timeout
        const maxVouchers = importOptions.maxVouchers || 1000;
        const vouchersToImport = parsedData.vouchers.slice(0, maxVouchers);

        for (const voucher of vouchersToImport) {
          try {
            // Find voucher type
            const voucherType = await masterModels.VoucherType.findOne({
              where: { name: voucher.type },
            });

            if (!voucherType) {
              importResult.vouchers.errors.push({
                voucher: voucher.number,
                error: `Voucher type "${voucher.type}" not found`,
              });
              continue;
            }

            // Find party ledger if specified
            let partyLedgerId = null;
            if (voucher.party) {
              const partyLedger = await findOneScoped(req, tenantModels.Ledger, { ledger_name: voucher.party });
              if (partyLedger) partyLedgerId = partyLedger.id;
            }

            // Check if voucher already exists
            const existingVoucher = await findOneScoped(req, tenantModels.Voucher, { voucher_number: voucher.number });

            if (!existingVoucher) {
              await tenantModels.Voucher.create({
                voucher_type_id: voucherType.id,
                voucher_type: voucher.type,
                voucher_number: voucher.number,
                voucher_date: voucher.date,
                party_ledger_id: partyLedgerId,
                narration: voucher.narration,
                total_amount: voucher.totalAmount,
                status: 'posted',
              });
              importResult.vouchers.imported++;
            } else {
              importResult.vouchers.skipped++;
            }
          } catch (error) {
            logger.error(`Error importing voucher ${voucher.number}:`, error);
            importResult.vouchers.errors.push({
              voucher: voucher.number,
              error: error.message,
            });
          }
        }

        if (parsedData.vouchers.length > maxVouchers) {
          importResult.vouchers.errors.push({
            voucher: 'Bulk',
            error: `Only first ${maxVouchers} vouchers imported. Total vouchers: ${parsedData.vouchers.length}`,
          });
        }
      }

      // Clean up uploaded file
      try {
        const fs = require('fs');
        fs.unlinkSync(filePath);
      } catch (error) {
        logger.warn('Failed to delete uploaded file:', error);
      }

      res.json({
        success: true,
        message: 'Tally data import completed',
        data: importResult,
        summary: {
          totalGroups: parsedData.groups.length,
          totalLedgers: parsedData.ledgers.length,
          totalStockItems: parsedData.stockItems.length,
          totalVouchers: parsedData.vouchers.length,
        },
      });
    } catch (error) {
      logger.error('Tally import error:', error);
      next(error);
    }
  },

  /**
   * Get import template/preview
   */
  async getImportTemplate(req, res, next) {
    try {
      res.json({
        success: true,
        data: {
          supportedFormats: ['XML', 'Excel (.xlsx, .xls)', 'CSV'],
          instructions: {
            xml: 'Export from Tally: Gateway of Tally > Display > List of Accounts > Export > XML',
            excel: 'Export from Tally: Gateway of Tally > Display > List of Accounts > Export > Excel',
            csv: 'Export from Tally: Gateway of Tally > Display > List of Accounts > Export > CSV',
          },
          requiredFields: {
            groups: ['Name', 'Parent (optional)'],
            ledgers: ['Name', 'Group', 'Opening Balance (optional)'],
            stockItems: ['Name', 'Group', 'Unit', 'HSN Code (optional)'],
            vouchers: ['Type', 'Number', 'Date', 'Party (optional)', 'Amount'],
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
