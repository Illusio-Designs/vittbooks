const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const models = {};

  models.User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: DataTypes.STRING,
    phone: DataTypes.STRING,
    profile_image: DataTypes.STRING,
    role: {
      type: DataTypes.ENUM('tenant_admin', 'user', 'accountant'),
      defaultValue: 'user',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    last_login: DataTypes.DATE,
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    email_verified_at: DataTypes.DATE,
    preferences: DataTypes.JSON,
    created_by: DataTypes.UUID,
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'users',
    timestamps: true,
  });

  models.Ledger = sequelize.define('Ledger', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ledger_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ledger_code: DataTypes.STRING,
    account_group_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    opening_balance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    opening_balance_type: {
      type: DataTypes.ENUM('Dr', 'Cr'),
      defaultValue: 'Dr',
    },
    balance_type: {
      type: DataTypes.ENUM('debit', 'credit'),
      defaultValue: 'debit',
    },
    current_balance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    credit_limit: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: 'Credit limit for the ledger',
    },
    credit_days: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Credit period in days',
    },
    address: DataTypes.TEXT,
    city: DataTypes.STRING,
    state: DataTypes.STRING,
    pincode: DataTypes.STRING,
    country: {
      type: DataTypes.STRING,
      defaultValue: 'India',
    },
    gstin: DataTypes.STRING,
    pan: DataTypes.STRING,
    email: DataTypes.STRING,
    contact_number: DataTypes.STRING,
    bank_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Bank name for bank ledgers',
    },
    bank_account_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Bank account number',
    },
    bank_ifsc: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Bank IFSC code',
    },
    bank_branch: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Bank branch name',
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'ledgers',
    timestamps: true,
  });

  models.GSTIN = sequelize.define('GSTIN', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    gstin: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    legal_name: DataTypes.STRING,
    trade_name: DataTypes.STRING,
    address: DataTypes.TEXT,
    state: DataTypes.STRING,
    state_code: DataTypes.STRING,
    gstin_status: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'GSTIN status (active, cancelled, etc.)',
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this is the primary GSTIN for the tenant',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'gstins',
    timestamps: true,
  });

  models.Voucher = sequelize.define('Voucher', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    voucher_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    voucher_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    voucher_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    party_ledger_id: DataTypes.UUID,
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    narration: DataTypes.TEXT,
    status: {
      type: DataTypes.ENUM('draft', 'posted', 'cancelled'),
      defaultValue: 'draft',
    },
    reference_number: DataTypes.STRING,
    due_date: DataTypes.DATE,
    // Export/Import fields
    currency_code: {
      type: DataTypes.STRING(3),
      allowNull: true,
      comment: 'Currency code for export invoices (e.g., USD, EUR)',
    },
    exchange_rate: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
      comment: 'Exchange rate for foreign currency transactions',
    },
    shipping_bill_number: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Shipping bill number for export invoices',
    },
    shipping_bill_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Shipping bill date for export invoices',
    },
    port_of_loading: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Port of loading for export invoices',
    },
    destination_country: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Destination country for export invoices',
    },
    has_lut: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether export is under Letter of Undertaking (LUT)',
    },
    // Delivery Challan fields
    purpose: {
      type: DataTypes.ENUM('job_work', 'stock_transfer', 'sample'),
      allowNull: true,
      comment: 'Purpose of delivery challan (job_work, stock_transfer, sample)',
    },
    converted_to_invoice_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Reference to sales invoice if this voucher was converted',
    },
    validity_period: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Validity period in days for proforma invoice or quotation',
    },
    valid_until: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Valid until date for proforma invoice or quotation',
    },
    // Supplier Invoice fields (for purchase invoices)
    supplier_invoice_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Supplier invoice number for purchase invoices',
    },
    supplier_invoice_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Supplier invoice date for purchase invoices',
    },
    // Multi-tenant, multi-company, multi-branch isolation
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Company ID for explicit company-level isolation',
    },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Branch ID for explicit branch-level isolation',
    },
    created_by: DataTypes.UUID,
  }, {
    tableName: 'vouchers',
    timestamps: true,
  });

  models.VoucherItem = sequelize.define('VoucherItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    voucher_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    inventory_item_id: DataTypes.UUID,
    barcode: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    item_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    item_name: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    item_description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(15, 3),
      defaultValue: 1,
    },
    uqc: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    rate: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
    },
    discount_percentage: {
      type: DataTypes.DECIMAL(6, 2),
      defaultValue: 0,
    },
    discount_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    taxable_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    hsn_sac_code: DataTypes.STRING,
    gst_rate: {
      type: DataTypes.DECIMAL(6, 2),
      defaultValue: 0,
    },
    cgst_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    sgst_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    igst_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    cess_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    variant_attributes: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Variant attributes for the item',
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'voucher_items',
    timestamps: true,
  });

  models.VoucherLedgerEntry = sequelize.define('VoucherLedgerEntry', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    voucher_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    ledger_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    debit_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    credit_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    narration: DataTypes.TEXT,
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'voucher_ledger_entries',
    timestamps: true,
  });

  models.InventoryItem = sequelize.define('InventoryItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    item_key: {
      type: DataTypes.STRING(300),
      allowNull: false,
      // Uniqueness is per-tenant — see indexes below. Two tenants can
      // legitimately have the same item_code / item_name.
      comment: 'Stable key (item_code if present else item_description)',
    },
    item_code: DataTypes.STRING(100),
    item_name: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    barcode: {
      type: DataTypes.STRING(100),
      allowNull: true,
      // Uniqueness is per-tenant — see indexes below.
      comment: 'Product barcode (EAN-13, UPC, etc.)',
    },
    parent_item_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'inventory_items',
        key: 'id',
      },
      comment: 'FK to self for product variants. NULL indicates a parent/template product.',
    },
    attributes: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'JSON object for variant attributes, e.g. {"Size": "M", "Color": "Blue"}',
    },
    hsn_sac_code: DataTypes.STRING(20),
    uqc: DataTypes.STRING(20),
    gst_rate: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
    },
    quantity_on_hand: {
      type: DataTypes.DECIMAL(15, 3),
      defaultValue: 0,
    },
    avg_cost: {
      type: DataTypes.DECIMAL(15, 4),
      defaultValue: 0,
    },
    mrp: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Maximum Retail Price',
    },
    selling_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Default selling price',
    },
    purchase_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Last purchase price',
    },
    reorder_level: {
      type: DataTypes.DECIMAL(15, 3),
      defaultValue: 0,
      comment: 'Minimum stock level before reorder',
    },
    reorder_quantity: {
      type: DataTypes.DECIMAL(15, 3),
      defaultValue: 0,
      comment: 'Quantity to reorder when stock falls below reorder level',
    },
    is_serialized: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether this item requires individual unit tracking with unique barcodes',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Company-level isolation (optional; null means tenant-wide)',
    },
  }, {
    tableName: 'inventory_items',
    timestamps: true,
    indexes: [
      // Per-tenant uniqueness on item_key and barcode. The previous
      // global uniqueness was correct under the per-tenant-DB model
      // but breaks once tenants share a database.
      { unique: true, fields: ['tenant_id', 'item_key'], name: 'uniq_inventory_tenant_itemkey' },
      { unique: true, fields: ['tenant_id', 'barcode'], name: 'uniq_inventory_tenant_barcode' },
      { fields: ['tenant_id'], name: 'idx_inventory_tenant' },
    ],
  });

  models.StockMovement = sequelize.define('StockMovement', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    inventory_item_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    warehouse_id: DataTypes.UUID,
    from_warehouse_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Source warehouse for transfers',
    },
    to_warehouse_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Destination warehouse for transfers',
    },
    voucher_id: DataTypes.UUID,
    movement_type: {
      type: DataTypes.ENUM('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
    },
    rate: {
      type: DataTypes.DECIMAL(15, 4),
      defaultValue: 0,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    batch_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Batch or lot number',
    },
    expiry_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Expiry date for batch',
    },
    reference_number: DataTypes.STRING,
    narration: DataTypes.TEXT,
    movement_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'stock_movements',
    timestamps: true,
  });

  models.Warehouse = sequelize.define('Warehouse', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    warehouse_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    warehouse_code: DataTypes.STRING,
    address: DataTypes.TEXT,
    city: DataTypes.STRING,
    state: DataTypes.STRING,
    pincode: DataTypes.STRING,
    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'warehouses',
    timestamps: true,
  });

  models.WarehouseStock = sequelize.define('WarehouseStock', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    warehouse_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    inventory_item_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(15, 3),
      defaultValue: 0,
    },
    avg_cost: {
      type: DataTypes.DECIMAL(15, 4),
      defaultValue: 0,
    },
    last_updated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'warehouse_stocks',
    timestamps: true,
  });

  models.EWayBill = sequelize.define('EWayBill', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    voucher_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    ewb_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },
    ewb_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    valid_upto: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'cancelled', 'expired'),
      defaultValue: 'active',
    },
    vehicle_no: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    transporter_id: {
      type: DataTypes.STRING(15),
      allowNull: true,
      comment: 'Transporter GSTIN',
    },
    transporter_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    transport_mode: {
      type: DataTypes.ENUM('road', 'rail', 'air', 'ship'),
      defaultValue: 'road',
    },
    distance: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Distance in kilometers',
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'eway_bills',
    timestamps: true,
    defaultScope: {
      // Default scope filters by tenant_id from context
      // This will be overridden by explicit where clauses
    },
    scopes: {
      // Scope to bypass tenant filtering when needed (e.g., admin operations)
      withoutTenantFilter: {
        where: {}
      }
    },
    indexes: [
      {
        fields: ['voucher_id'],
        name: 'idx_ewaybill_voucher_id',
      },
      {
        fields: ['status'],
        name: 'idx_ewaybill_status',
      },
      {
        fields: ['tenant_id', 'status'],
        name: 'idx_ewaybill_tenant_status',
      },
      {
        fields: ['ewb_number'],
        name: 'idx_ewaybill_number',
      },
    ],
    instanceMethods: {
      // Calculate validity period based on distance (1 day per 200 KM for normal goods)
      calculateValidityPeriod() {
        if (!this.distance || !this.ewb_date) {
          return null;
        }
        
        const validityDays = Math.ceil(this.distance / 200);
        const validityDate = new Date(this.ewb_date);
        validityDate.setDate(validityDate.getDate() + validityDays);
        
        return validityDate;
      },
      
      // Check if E-Way Bill is expired
      isExpired() {
        if (!this.valid_upto) {
          return false;
        }
        
        return new Date() > new Date(this.valid_upto);
      },
    },
  });

  models.BillWiseDetail = sequelize.define('BillWiseDetail', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    voucher_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    ledger_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    bill_number: DataTypes.STRING,
    bill_date: DataTypes.DATE,
    bill_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    pending_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    is_fully_paid: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'billwise_details',
    timestamps: true,
  });

  models.BillAllocation = sequelize.define('BillAllocation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    payment_voucher_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    bill_detail_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    allocated_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'bill_allocations',
    timestamps: true,
  });

  models.GSTRReturn = sequelize.define('GSTRReturn', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    return_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    return_period: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    gstin: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('draft', 'filed'),
      defaultValue: 'draft',
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'gstr_returns',
    timestamps: true,
  });

  models.TDSDetail = sequelize.define('TDSDetail', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    voucher_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'vouchers',
        key: 'id',
      },
    },
    tds_section: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'TDS section code like 194C, 194I, 194J, 194H',
    },
    tds_rate: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      comment: 'TDS rate percentage',
    },
    taxable_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Amount on which TDS is calculated',
    },
    tds_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'TDS amount deducted',
    },
    deductee_pan: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'PAN of the deductee',
    },
    deductee_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Name of the deductee',
    },
    certificate_number: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'TDS certificate number',
    },
    certificate_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'TDS certificate generation date',
    },
    quarter: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Quarter for TDS return (Q1, Q2, Q3, Q4)',
    },
    financial_year: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Financial year (e.g., 2024-25)',
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'tds_details',
    timestamps: true,
    defaultScope: {
      // Default scope filters by tenant_id from context
      // This will be overridden by explicit where clauses
    },
    scopes: {
      // Scope to bypass tenant filtering when needed (e.g., admin operations)
      withoutTenantFilter: {
        where: {}
      }
    },
    indexes: [
      {
        fields: ['voucher_id'],
        name: 'idx_tds_voucher_id',
      },
      {
        fields: ['section_code'],
        name: 'idx_tds_section_code',
      },
      {
        fields: ['tenant_id', 'quarter', 'financial_year'],
        name: 'idx_tds_tenant_period',
      },
      {
        fields: ['certificate_no'],
        name: 'idx_tds_certificate_no',
      },
      {
        fields: ['deductee_pan'],
        name: 'idx_tds_deductee_pan',
      },
    ],
  });

  models.EInvoice = sequelize.define('EInvoice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    voucher_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    irn: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
    ack_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    ack_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    signed_invoice: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    signed_qr_code: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'generated', 'cancelled'),
      defaultValue: 'pending',
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    retry_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    last_retry_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'einvoices',
    timestamps: true,
    defaultScope: {
      // Default scope filters by tenant_id from context
      // This will be overridden by explicit where clauses
    },
    scopes: {
      // Scope to bypass tenant filtering when needed (e.g., admin operations)
      withoutTenantFilter: {
        where: {}
      }
    },
    indexes: [
      {
        fields: ['voucher_id'],
        name: 'idx_einvoice_voucher_id',
      },
      {
        fields: ['status'],
        name: 'idx_einvoice_status',
      },
      {
        fields: ['tenant_id', 'status'],
        name: 'idx_einvoice_tenant_status',
      },
      {
        fields: ['irn'],
        name: 'idx_einvoice_irn',
      },
    ],
  });

  models.AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    table_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    record_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    action: {
      type: DataTypes.ENUM('create', 'update', 'delete'),
      allowNull: false,
    },
    old_values: DataTypes.JSON,
    new_values: DataTypes.JSON,
    user_id: DataTypes.UUID,
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'audit_logs',
    timestamps: true,
  });

  models.FinBoxConsent = sequelize.define('FinBoxConsent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    consent_given: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    consent_date: DataTypes.DATE,
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'finbox_consents',
    timestamps: true,
  });

  // NumberingSeries model for advanced invoice numbering
  models.NumberingSeries = sequelize.define('NumberingSeries', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Company ID for company-specific numbering sequences',
    },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    voucher_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    series_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    prefix: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        isUppercaseAlphanumeric(value) {
          if (!/^[A-Z0-9]+$/.test(value)) {
            throw new Error('Prefix must contain only uppercase letters and numbers');
          }
        },
      },
    },
    format: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        containsRequiredTokens(value) {
          if (!value.includes('PREFIX') || !value.includes('SEQUENCE')) {
            throw new Error('Format must contain both PREFIX and SEQUENCE tokens');
          }
        },
      },
    },
    separator: {
      type: DataTypes.STRING(5),
      defaultValue: '-',
    },
    sequence_length: {
      type: DataTypes.INTEGER,
      defaultValue: 4,
    },
    current_sequence: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    start_number: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    end_number: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reset_frequency: {
      type: DataTypes.ENUM('never', 'monthly', 'yearly', 'financial_year'),
      defaultValue: 'never',
    },
    last_reset_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'numbering_series',
    timestamps: true,
    defaultScope: {
      // Default scope filters by tenant_id from context
      // This will be overridden by explicit where clauses
    },
    scopes: {
      // Scope to bypass tenant filtering when needed (e.g., admin operations)
      withoutTenantFilter: {
        where: {}
      }
    }
  });

  // NumberingHistory model for tracking generated voucher numbers
  models.NumberingHistory = sequelize.define('NumberingHistory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    series_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'numbering_series',
        key: 'id',
      },
    },
    voucher_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'vouchers',
        key: 'id',
      },
    },
    generated_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    sequence_used: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    generated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'numbering_history',
    timestamps: false, // We use generated_at instead
    defaultScope: {
      // Default scope filters by tenant_id from context
      // This will be overridden by explicit where clauses
    },
    scopes: {
      // Scope to bypass tenant filtering when needed (e.g., admin operations)
      withoutTenantFilter: {
        where: {}
      }
    },
    indexes: [
      {
        fields: ['series_id', 'sequence_used'],
        name: 'idx_series_sequence',
      },
      {
        fields: ['voucher_id'],
        name: 'idx_voucher_id',
      },
      {
        fields: ['tenant_id', 'generated_at'],
        name: 'idx_tenant_date',
      },
    ],
  });

  // NEW: Product Attribute models
  models.ProductAttribute = require('../models/ProductAttribute')(sequelize);
  models.ProductAttributeValue = require('../models/ProductAttributeValue')(sequelize);
  
  // NEW: Inventory Unit model (for serialized inventory tracking)
  models.InventoryUnit = require('../models/InventoryUnit')(sequelize);

  // Define associations
  // Voucher associations
  models.Voucher.hasMany(models.VoucherLedgerEntry, { foreignKey: 'voucher_id', as: 'ledgerEntries' });
  models.VoucherLedgerEntry.belongsTo(models.Voucher, { foreignKey: 'voucher_id', as: 'voucher' });
  
  models.Voucher.hasMany(models.VoucherItem, { foreignKey: 'voucher_id', as: 'items' });
  models.VoucherItem.belongsTo(models.Voucher, { foreignKey: 'voucher_id', as: 'voucher' });
  
  // Party Ledger association for Voucher
  models.Voucher.belongsTo(models.Ledger, { foreignKey: 'party_ledger_id', as: 'partyLedger' });
  models.Ledger.hasMany(models.Voucher, { foreignKey: 'party_ledger_id', as: 'partyVouchers' });
  
  // Voucher conversion association (self-referencing)
  models.Voucher.belongsTo(models.Voucher, { foreignKey: 'converted_to_invoice_id', as: 'convertedToInvoice' });
  models.Voucher.hasMany(models.Voucher, { foreignKey: 'converted_to_invoice_id', as: 'sourceVouchers' });
  
  // Ledger associations
  models.Ledger.hasMany(models.VoucherLedgerEntry, { foreignKey: 'ledger_id', as: 'ledgerEntries' });
  models.VoucherLedgerEntry.belongsTo(models.Ledger, { foreignKey: 'ledger_id', as: 'ledger' });
  
  // Warehouse associations
  models.Warehouse.hasMany(models.WarehouseStock, { foreignKey: 'warehouse_id', as: 'stock' });
  models.WarehouseStock.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
  
  // Inventory associations
  models.InventoryItem.hasMany(models.WarehouseStock, { foreignKey: 'inventory_item_id', as: 'warehouseStock' });
  models.WarehouseStock.belongsTo(models.InventoryItem, { foreignKey: 'inventory_item_id', as: 'item' });
  
  models.InventoryItem.hasMany(models.StockMovement, { foreignKey: 'inventory_item_id', as: 'movements' });
  models.StockMovement.belongsTo(models.InventoryItem, { foreignKey: 'inventory_item_id', as: 'item' });
  
  models.Warehouse.hasMany(models.StockMovement, { foreignKey: 'warehouse_id', as: 'movements' });
  models.StockMovement.belongsTo(models.Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
  
  // Bill-wise associations
  models.Voucher.hasMany(models.BillWiseDetail, { foreignKey: 'voucher_id', as: 'billDetails' });
  models.BillWiseDetail.belongsTo(models.Voucher, { foreignKey: 'voucher_id', as: 'voucher' });
  
  models.Ledger.hasMany(models.BillWiseDetail, { foreignKey: 'ledger_id', as: 'billDetails' });
  models.BillWiseDetail.belongsTo(models.Ledger, { foreignKey: 'ledger_id', as: 'ledger' });
  
  models.BillWiseDetail.hasMany(models.BillAllocation, { foreignKey: 'bill_detail_id', as: 'allocations' });
  models.BillAllocation.belongsTo(models.BillWiseDetail, { foreignKey: 'bill_detail_id', as: 'billDetail' });
  
  // E-Invoice and E-Way Bill associations
  models.Voucher.hasOne(models.EInvoice, { foreignKey: 'voucher_id', as: 'eInvoice' });
  models.EInvoice.belongsTo(models.Voucher, { foreignKey: 'voucher_id', as: 'voucher' });
  
  models.Voucher.hasOne(models.EWayBill, { foreignKey: 'voucher_id', as: 'eWayBill' });
  models.EWayBill.belongsTo(models.Voucher, { foreignKey: 'voucher_id', as: 'voucher' });
  
  // TDS associations
  models.Voucher.hasMany(models.TDSDetail, { foreignKey: 'voucher_id', as: 'tdsDetails' });
  models.TDSDetail.belongsTo(models.Voucher, { foreignKey: 'voucher_id', as: 'voucher' });

  // NumberingSeries associations
  // Note: Branch model doesn't exist yet, so we'll skip that association for now
  // When Branch model is added, uncomment the following:
  // models.NumberingSeries.belongsTo(models.Branch, { foreignKey: 'branch_id', as: 'branch' });
  // models.Branch.hasMany(models.NumberingSeries, { foreignKey: 'branch_id', as: 'numberingSeries' });

  // NumberingHistory associations
  models.NumberingSeries.hasMany(models.NumberingHistory, { foreignKey: 'series_id', as: 'history' });
  models.NumberingHistory.belongsTo(models.NumberingSeries, { foreignKey: 'series_id', as: 'series' });
  
  models.Voucher.hasMany(models.NumberingHistory, { foreignKey: 'voucher_id', as: 'numberingHistory' });
  models.NumberingHistory.belongsTo(models.Voucher, { foreignKey: 'voucher_id', as: 'voucher' });

  // NEW: Inventory Item self-referencing for variants
  models.InventoryItem.belongsTo(models.InventoryItem, { as: 'ParentItem', foreignKey: 'parent_item_id' });
  models.InventoryItem.hasMany(models.InventoryItem, { as: 'Variants', foreignKey: 'parent_item_id' });

  // NEW: Product Attribute Associations
  if (models.ProductAttribute.associate) {
    models.ProductAttribute.associate(models);
  }
  if (models.ProductAttributeValue.associate) {
    models.ProductAttributeValue.associate(models);
  }
  
  // NEW: Inventory Unit Associations
  if (models.InventoryUnit.associate) {
    models.InventoryUnit.associate(models);
  }
  
  // Additional InventoryItem associations for units
  models.InventoryItem.hasMany(models.InventoryUnit, {
    foreignKey: 'inventory_item_id',
    as: 'units',
  });

  models.FinBoxConsent.belongsTo(models.User, { foreignKey: 'user_id' });

  // Attach sequelize instance to models for transaction support
  models.sequelize = sequelize;

  return models;
};