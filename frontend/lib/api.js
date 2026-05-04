import axios from "axios";
import Cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Role-based access control helper
const checkPermission = (requiredRole) => {
  const user = JSON.parse(Cookies.get("user") || "{}");
  const userRole = user.role;
  
  const roleHierarchy = {
    'super_admin': 5,
    'admin': 4,
    'manager': 3,
    'user': 2,
    'client': 1
  };
  
  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;
  
  return userLevel >= requiredLevel;
};

// Enhanced error handler for permission-based failures
const handlePermissionError = (error, requiredRole) => {
  if (error.response?.status === 403) {
    throw new Error(`Insufficient permissions. Required role: ${requiredRole}`);
  }
  throw error;
};

// API Error Handler with detailed error messages
const handleApiError = (error, context = '') => {
  if (error.response) {
    const { status, data } = error.response;
    const message = data?.message || data?.error || `Request failed with status ${status}`;
    
    switch (status) {
      case 400:
        throw new Error(`Bad Request: ${message}${context ? ` (${context})` : ''}`);
      case 401:
        throw new Error('Authentication required. Please login again.');
      case 403:
        throw new Error(`Access denied: ${message}`);
      case 404:
        throw new Error(`Resource not found: ${message}`);
      case 409:
        throw new Error(`Conflict: ${message}`);
      case 413:
        throw new Error('Request too large. The server limits payloads to 1 MB.');
      case 429:
        // Backend's auth limiter (15-min window) hits this most often.
        throw new Error(
          message || 'Too many attempts. Please wait a few minutes and try again.'
        );
      case 500:
        throw new Error(`Server error: ${message}`);
      case 502:
      case 503:
      case 504:
        throw new Error('Service temporarily unavailable. Please try again in a moment.');
      default:
        throw new Error(`API Error (${status}): ${message}`);
    }
  }
  
  if (error.request) {
    throw new Error('Network error: Unable to reach server');
  }
  
  throw new Error(error.message || 'Unknown error occurred');
};

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const companyId = Cookies.get("companyId");
    if (companyId) {
      config.headers["X-Company-Id"] = companyId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    // Ensure response always has a data property with proper structure
    if (response && response.data) {
      // If the response data doesn't have the expected structure, normalize it
      if (!response.data.data && !response.data.items && !response.data.transfers && !response.data.tds && !response.data.tdsDetails && !response.data.pagination) {
        // If it's an array, wrap it in the expected structure
        if (Array.isArray(response.data)) {
          response.data = {
            data: response.data,
            pagination: {
              page: 1,
              limit: response.data.length,
              total: response.data.length,
              totalPages: 1
            }
          };
        }
        // Handle legacy TDS response format
        else if (response.data.tdsDetails && Array.isArray(response.data.tdsDetails)) {
          response.data = {
            data: response.data.tdsDetails,
            pagination: {
              page: 1,
              limit: response.data.tdsDetails.length,
              total: response.data.tdsDetails.length,
              totalPages: 1
            }
          };
        }
      }
    } else {
      // If no response data, provide empty structure
      response.data = {
        data: [],
        pagination: {
          page: 1,
          limit: 0,
          total: 0,
          totalPages: 0
        }
      };
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      Cookies.remove("token");
      Cookies.remove("user");
      Cookies.remove("companyId");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  refresh: () => api.post("/auth/refresh"),
  switchCompany: (companyId) => api.post("/auth/switch-company", { company_id: companyId }),
  
  // Google OAuth
  googleAuth: () => api.get("/auth/google"),
  googleCallback: (data) => api.post("/auth/google/callback", data),
  
  // Profile management
  getProfile: () => api.get("/auth/profile"),
  updateProfile: (data) => api.put("/auth/profile", data),
  uploadProfileImage: (formData) => api.post("/auth/profile/image", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  }),
  changePassword: (data) => api.post("/auth/change-password", data),
  
  // Password management
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
  verifyResetToken: (token) => api.get(`/auth/verify-reset-token/${token}`),
  resetPassword: (data) => api.post("/auth/reset-password", data),
  changePassword: (data) => api.post("/auth/change-password", data),
  
  // Email verification
  verifyEmail: (token) => api.post("/auth/verify-email", { token }),
  resendVerification: (email) => api.post("/auth/resend-verification", { email }),
  
  // Backward compatibility
  refreshToken: () => api.post("/auth/refresh"),
};

// Subscription API
export const subscriptionAPI = {
  createSubscription: (data) => api.post("/subscriptions", data),
  getCurrentSubscription: () => api.get("/subscriptions/current"),
  updateSubscription: (id, data) => api.put(`/subscriptions/${id}`, data),
  cancelSubscription: () => api.post("/subscriptions/cancel"),
  
  // Payment management
  verifyPayment: (data) => api.post("/subscriptions/payments/verify", data),
  getPaymentHistory: (params) => api.get("/subscriptions/payments/history", { params }),
  
  // Backward compatibility
  getCurrent: () => api.get("/subscriptions/current"),
  list: () => api.get("/subscriptions"),
  create: (data) => api.post("/subscriptions", data),
  update: (id, data) => api.put(`/subscriptions/${id}`, data),
  cancel: (id) => api.post(`/subscriptions/${id}/cancel`),
  reactivate: (id) => api.post(`/subscriptions/${id}/reactivate`),
};

// Notification API
export const notificationAPI = {
  list: (params) => api.get("/notifications", { params }),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put("/notifications/read-all"),
  delete: (id) => api.delete(`/notifications/${id}`),
  getPreferences: () => api.get("/notifications/preferences"),
  updatePreferences: (data) => api.put("/notifications/preferences", data),
};

// Company API
export const companyAPI = {
  list: () => api.get("/companies"),
  status: () => api.get("/companies/status"),
  create: (data) => api.post("/companies", data),
  get: (id) => api.get(`/companies/${id}`), // Alias for getById
  getById: (id) => api.get(`/companies/${id}`),
  update: (id, data) => api.put(`/companies/${id}`, data),
  delete: (id) => api.delete(`/companies/${id}`),
  
  // File uploads
  uploadLogo: (id, formData) => api.post(`/companies/${id}/upload-logo`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  }),
  uploadSignature: (id, formData) => api.post(`/companies/${id}/upload-signature`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  }),
  uploadDSCCertificate: (id, formData) => api.post(`/companies/${id}/upload-dsc-certificate`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  }),
  updateDSCConfig: (id, data) => api.put(`/companies/${id}/dsc-config`, data),
};

// Accounting API
export const accountingAPI = {
  // Dashboard
  getDashboard: () => api.get("/accounting/dashboard"),
  dashboard: () => api.get("/accounting/dashboard"), // Alias for backward compatibility
  
  // Account Groups
  groups: {
    list: () => api.get("/accounting/groups"),
    getTree: () => api.get("/accounting/groups/tree"),
  },
  
  // Account Groups (alias for backward compatibility)
  accountGroups: {
    list: (params) => api.get("/accounting/groups", { params }),
    getTree: () => api.get("/accounting/groups/tree"),
  },
  
  // Ledgers
  ledgers: {
    list: (params) => api.get("/accounting/ledgers", { params }),
    create: (data) => api.post("/accounting/ledgers", data),
    get: (id) => api.get(`/accounting/ledgers/${id}`),
    update: (id, data) => api.put(`/accounting/ledgers/${id}`, data),
    delete: (id) => api.delete(`/accounting/ledgers/${id}`),
    getBalance: (id, params) => api.get(`/accounting/ledgers/${id}/balance`, { params }),
    getStatement: (id, params) => api.get(`/accounting/ledgers/${id}/statement`, { params }),
  },
  
  // Voucher Types
  voucherTypes: {
    list: () => api.get("/accounting/voucher-types"),
    create: (data) => api.post("/accounting/voucher-types", data),
  },
  
  // Vouchers
  vouchers: {
    list: (params) => api.get("/accounting/vouchers", { params }),
    create: (data) => api.post("/accounting/vouchers", data),
    get: (id) => api.get(`/accounting/vouchers/${id}`),
    update: (id, data) => api.put(`/accounting/vouchers/${id}`, data),
    post: (id) => api.post(`/accounting/vouchers/${id}/post`),
    cancel: (id) => api.post(`/accounting/vouchers/${id}/cancel`),
  },
  
  // Invoices
  invoices: {
    createSales: (data) => api.post("/accounting/invoices/sales", data),
    createPurchase: (data) => api.post("/accounting/invoices/purchase", data),
  },
  
  // Payments
  payments: {
    create: (data) => api.post("/accounting/payments", data),
  },
  
  // Receipts
  receipts: {
    create: (data) => api.post("/accounting/receipts", data),
  },
  
  // Journals
  journals: {
    create: (data) => api.post("/accounting/journals", data),
  },
  
  // Contra
  contra: {
    create: (data) => api.post("/accounting/contra", data),
  },
  
  // Transactions (alias for backward compatibility)
  transactions: {
    createSalesInvoice: (data) => api.post("/accounting/invoices/sales", data),
    createPurchaseInvoice: (data) => api.post("/accounting/invoices/purchase", data),
    createPayment: (data) => api.post("/accounting/payments", data),
    createReceipt: (data) => api.post("/accounting/receipts", data),
    createJournal: (data) => api.post("/accounting/journals", data),
    createContra: (data) => api.post("/accounting/contra", data),
  },
  
  // Inventory
  inventory: {
    items: {
      list: (params) => api.get("/accounting/inventory/items", { params }),
      create: (data) => api.post("/accounting/inventory/items", data),
      get: (id) => api.get(`/accounting/inventory/items/${id}`),
      update: (id, data) => {
        // Ensure tenant_id is included if available
        const companyId = Cookies.get("companyId");
        if (companyId && !data.tenant_id) {
          data.tenant_id = companyId;
        }
        return api.put(`/accounting/inventory/items/${id}`, data);
      },
      delete: (id) => api.delete(`/accounting/inventory/items/${id}`),
      generateBarcode: (id) => api.post(`/accounting/inventory/items/${id}/generate-barcode`),
      bulkGenerateBarcodes: (data) => api.post("/accounting/inventory/items/bulk-generate-barcodes", data),
      getWarehouseStock: (id, params) => api.get(`/accounting/inventory/items/${id}/warehouse-stock`, { params }),
      setOpeningStock: (id, data) => {
        // Ensure tenant_id is included for opening stock
        const companyId = Cookies.get("companyId");
        if (companyId && !data.tenant_id) {
          data.tenant_id = companyId;
        }
        return api.post(`/accounting/inventory/items/${id}/opening-stock`, data);
      },
    },
  },
  
  // Warehouses
  warehouses: {
    list: (params) => api.get("/accounting/warehouses", { params }),
    getAll: (params) => api.get("/accounting/warehouses", { params }),
    create: (data) => api.post("/accounting/warehouses", data),
    get: (id) => api.get(`/accounting/warehouses/${id}`),
    update: (id, data) => api.put(`/accounting/warehouses/${id}`, data),
    delete: (id) => api.delete(`/accounting/warehouses/${id}`),
  },
  
  // Stock Adjustments
  stockAdjustments: {
    list: (params) => api.get("/accounting/stock-adjustments", { params }),
    create: (data) => api.post("/accounting/stock-adjustments", data),
  },
  
  // Stock Transfers
  stockTransfers: {
    list: (params) => api.get("/accounting/stock-transfers", { params }),
    create: (data) => api.post("/accounting/stock-transfers", data),
  },
  
  // Tally Import
  tallyImport: {
    getTemplate: () => api.get("/accounting/tally-import/template"),
    import: (formData, onProgress) => {
      const config = {
        headers: { "Content-Type": "multipart/form-data" }
      };
      if (onProgress) {
        config.onUploadProgress = (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        };
      }
      return api.post("/accounting/tally-import", formData, config);
    },
  },
  
  // Outstanding Bills
  outstanding: {
    list: (params) => api.get("/accounting/outstanding", { params }),
    allocatePayment: (data) => api.post("/accounting/bills/allocate", data),
    getAgingReport: (params) => api.get("/accounting/bills/aging", { params }),
  },

  // Backward compatibility - flat methods
  getGroups: () => api.get("/accounting/groups"),
  getGroupTree: () => api.get("/accounting/groups/tree"),
  getLedgers: (params) => api.get("/accounting/ledgers", { params }),
  createLedger: (data) => api.post("/accounting/ledgers", data),
  getLedger: (id) => api.get(`/accounting/ledgers/${id}`),
  updateLedger: (id, data) => api.put(`/accounting/ledgers/${id}`, data),
  deleteLedger: (id) => api.delete(`/accounting/ledgers/${id}`),
  getLedgerBalance: (id) => api.get(`/accounting/ledgers/${id}/balance`),
  getVoucherTypes: () => api.get("/accounting/voucher-types"),
  createVoucherType: (data) => api.post("/accounting/voucher-types", data),
  getVouchers: (params) => api.get("/accounting/vouchers", { params }),
  createVoucher: (data) => api.post("/accounting/vouchers", data),
  getVoucher: (id) => api.get(`/accounting/vouchers/${id}`),
  updateVoucher: (id, data) => api.put(`/accounting/vouchers/${id}`, data),
  postVoucher: (id) => api.post(`/accounting/vouchers/${id}/post`),
  cancelVoucher: (id) => api.post(`/accounting/vouchers/${id}/cancel`),
  createSalesInvoice: (data) => api.post("/accounting/invoices/sales", data),
  createPurchaseInvoice: (data) => api.post("/accounting/invoices/purchase", data),
  createPayment: (data) => api.post("/accounting/payments", data),
  createReceipt: (data) => api.post("/accounting/receipts", data),
  createJournal: (data) => api.post("/accounting/journals", data),
  createContra: (data) => api.post("/accounting/contra", data),
  getStockAdjustments: (params) => api.get("/accounting/stock-adjustments", { params }),
  createStockAdjustment: (data) => api.post("/accounting/stock-adjustments", data),
  getStockTransfers: (params) => api.get("/accounting/stock-transfers", { params }),
  createStockTransfer: (data) => api.post("/accounting/stock-transfers", data),
  getTallyImportTemplate: () => api.get("/accounting/tally-import/template"),
  importTallyData: (formData) => api.post("/accounting/tally-import", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  }),
  getOutstanding: (params) => api.get("/accounting/outstanding", { params }),
  allocatePayment: (data) => api.post("/accounting/bills/allocate", data),
  getAgingReport: (params) => api.get("/accounting/bills/aging", { params }),
};

// Pricing API
export const pricingAPI = {
  list: (params) => api.get("/pricing", { params }),
  get: (id) => api.get(`/pricing/${id}`),
  getPlans: (params) => api.get("/pricing", { params }), // Alias for backward compatibility
  getPlan: (id) => api.get(`/pricing/${id}`), // Alias for backward compatibility
};

// Review API
export const reviewAPI = {
  getPublicReviews: (params) => api.get("/reviews/public", { params }),
  getPublic: (params) => api.get("/reviews/public", { params }), // Alias for backward compatibility
  submitReview: (data) => api.post("/reviews", data),
  submit: (data) => api.post("/reviews", data), // Alias
  getMyReview: () => api.get("/reviews/my"),
  getMy: () => api.get("/reviews/my"), // Alias
  updateReview: (id, data) => api.put(`/reviews/my/${id}`, data),
  update: (id, data) => api.put(`/reviews/my/${id}`, data), // Alias
  getAllReviews: (params) => api.get("/reviews", { params }),
  approveReview: (id) => api.put(`/reviews/${id}/approve`),
  deleteReview: (id) => api.delete(`/reviews/${id}`),
  // Backward compatibility
  list: (params) => api.get("/reviews", { params }),
  create: (data) => api.post("/reviews", data),
  delete: (id) => api.delete(`/reviews/${id}`),
};

// TDS API
export const tdsAPI = {
  list: () => api.get("/tds"),
  calculateTDS: (data) => api.post("/tds/calculate", data),
  generateReturn: (data) => api.post("/tds/return", data),
  getReturnStatus: (returnId, formType) => api.get(`/tds/return/${returnId}/status`, { params: { form_type: formType } }),
  generateCertificate: (id) => api.get(`/tds/certificate/${id}`),
  
  // Sandbox TDS Analytics APIs
  analytics: {
    createPotentialNoticeJob: (data) => {
      // Fix financial year format and ensure required fields
      const payload = {
        quarter: data.quarter,
        tan: data.tan,
        form: data.form || '24Q',
        financial_year: data.financial_year || '2024-25', // Use correct format
        ...data
      };
      return api.post("/tds/analytics/potential-notices", payload);
    },
    getJobStatus: (jobId) => api.get(`/tds/analytics/potential-notices/${jobId}`),
  },
  
  // Sandbox TDS Calculator APIs
  calculator: {
    calculateNonSalary: (data) => {
      // Ensure all required fields are present
      const payload = {
        payment_amount: data.payment_amount,
        credit_amount: data.credit_amount || data.payment_amount,
        nature_of_payment: data.nature_of_payment,
        deductee_pan: data.deductee_pan,
        deductee_type: data.deductee_type || 'individual', // Required field that was missing
        pan_available: data.pan_available || 'yes',
        section: data.section,
        residential_status: data.residential_status || 'resident',
        financial_year: data.financial_year || '2024-25',
        ...data
      };
      return api.post("/tds/calculator/non-salary", payload);
    },
  },
  
  // Sandbox TDS Compliance APIs
  compliance: {
    check206AB: (data) => {
      // Ensure proper request body structure
      const payload = {
        pan: data.pan,
        consent: data.consent || true,
        reason: data.reason || 'TDS rate verification',
        ...data
      };
      return api.post("/tds/compliance/206ab/check", payload);
    },
    generateCSIOTP: (data) => {
      // Ensure proper request body structure
      const payload = {
        tan: data.tan,
        quarter: data.quarter,
        financial_year: data.financial_year || '2024-25',
        ...data
      };
      return api.post("/tds/compliance/csi/otp", payload);
    },
    downloadCSI: (data) => {
      // Ensure proper request body structure
      const payload = {
        tan: data.tan,
        quarter: data.quarter,
        financial_year: data.financial_year || '2024-25',
        otp: data.otp,
        ...data
      };
      return api.post("/tds/compliance/csi/download", payload);
    },
  },
  
  // Sandbox TDS Reports APIs
  reports: {
    submitTCSJob: (data) => api.post("/tds/reports/tcs", data),
    getTCSJobStatus: (jobId) => api.get(`/tds/reports/tcs/${jobId}`),
    searchTCSJobs: (data) => api.post("/tds/reports/tcs/search", data),
  },
  
  // Backward compatibility
  getSections: () => api.get("/tds/sections"),
  getReturns: (params) => api.get("/tds/returns", { params }),
  createReturn: (data) => api.post("/tds/returns", data),
  updateReturn: (id, data) => api.put(`/tds/returns/${id}`, data),
  deleteReturn: (id) => api.delete(`/tds/returns/${id}`),
  generateChallan: (id) => api.post(`/tds/returns/${id}/challan`),
};

// Client Support API
export const clientSupportAPI = {
  // Nested structure for tickets
  tickets: {
    list: (params) => api.get("/support/my-tickets", { params }),
    create: (data) => api.post("/support/tickets", data),
    get: (id) => api.get(`/support/my-tickets/${id}`),
    addMessage: (id, data) => api.post(`/support/tickets/${id}/messages`, data),
    submitReview: (ticketId, data) => api.post(`/support/tickets/${ticketId}/review`, data),
  },
  
  // Admin/Support routes
  admin: {
    listTickets: (params) => api.get("/support/tickets", { params }),
    getTicket: (id) => api.get(`/support/tickets/${id}`),
    assignTicket: (id, data) => api.put(`/support/tickets/${id}/assign`, data),
    updateTicketStatus: (id, data) => api.put(`/support/tickets/${id}/status`, data),
    getAgentReviews: (agentId, params) => api.get(`/support/agents/${agentId}/reviews`, { params }),
  },
  
  // Flat methods for backward compatibility
  createTicket: (data) => api.post("/support/tickets", data),
  addMessage: (id, data) => api.post(`/support/tickets/${id}/messages`, data),
  submitReview: (ticketId, data) => api.post(`/support/tickets/${ticketId}/review`, data),
  listMyTickets: (params) => api.get("/support/my-tickets", { params }),
  getMyTicket: (id) => api.get(`/support/my-tickets/${id}`),
  listTickets: (params) => api.get("/support/tickets", { params }),
  getTicket: (id) => api.get(`/support/tickets/${id}`),
  assignTicket: (id, data) => api.put(`/support/tickets/${id}/assign`, data),
  updateTicketStatus: (id, data) => api.put(`/support/tickets/${id}/status`, data),
  getAgentReviews: (agentId, params) => api.get(`/support/agents/${agentId}/reviews`, { params }),
  
  // Legacy methods
  getTickets: (params) => api.get("/support", { params }),
  closeTicket: (id) => api.post(`/support/${id}/close`),
  addReply: (id, data) => api.post(`/support/${id}/replies`, data),
};

// Referral API
export const referralAPI = {
  verifyCode: (data) => api.post("/referrals/verify", data),
  getMyCode: () => api.get("/referrals/my-code"),
  listCodes: (params) => api.get("/referrals", { params }),
  getReferralCodeById: (id) => api.get(`/referrals/${id}`),
  listRewards: (params) => api.get("/referrals/rewards", { params }),
  getReferralRewardById: (id) => api.get(`/referrals/rewards/${id}`),
  getAnalytics: () => api.get("/referrals/analytics"),
  createCode: (data) => api.post("/referrals", data),
  updateReferralCode: (id, data) => api.put(`/referrals/${id}`, data),
  deleteReferralCode: (id) => api.delete(`/referrals/${id}`),
  approveReward: (id) => api.post(`/referrals/rewards/${id}/approve`),
  
  // Discount configuration
  getCurrentDiscountConfig: () => api.get("/referrals/discount-config/current"),
  listDiscountConfigs: () => api.get("/referrals/discount-config"),
  createDiscountConfig: (data) => api.post("/referrals/discount-config", data),
  updateDiscountConfig: (id, data) => api.put(`/referrals/discount-config/${id}`, data),
  deleteDiscountConfig: (id) => api.delete(`/referrals/discount-config/${id}`),
  
  // Backward compatibility
  getStats: () => api.get("/referrals/stats"),
  getReferrals: (params) => api.get("/referrals", { params }),
  createReferral: (data) => api.post("/referrals", data),
  getEarnings: (params) => api.get("/referrals/earnings", { params }),
};

// Reports API
export const reportsAPI = {
  trialBalance: (params) => api.get("/reports/trial-balance", { params }),
  balanceSheet: (params) => api.get("/reports/balance-sheet", { params }),
  profitLoss: (params) => api.get("/reports/profit-loss", { params }),
  ledgerStatement: (params) => api.get("/reports/ledger-statement", { params }),
  stockSummary: (params) => api.get("/reports/stock-summary", { params }),
  stockLedger: (params) => api.get("/reports/stock-ledger", { params }),
  
  // Backward compatibility
  getTrialBalance: (params) => api.get("/reports/trial-balance", { params }),
  getBalanceSheet: (params) => api.get("/reports/balance-sheet", { params }),
  getProfitLoss: (params) => api.get("/reports/profit-loss", { params }),
  getLedgerStatement: (params) => api.get("/reports/ledger-statement", { params }),
  getStockSummary: (params) => api.get("/reports/stock-summary", { params }),
  getStockLedger: (params) => api.get("/reports/stock-ledger", { params }),
  getCashFlow: (params) => api.get("/reports/cash-flow", { params }),
  getLedgerReport: (params) => api.get("/reports/ledger", { params }),
  getGSTReport: (params) => api.get("/reports/gst", { params }),
  getTDSReport: (params) => api.get("/reports/tds", { params }),
  getVoucherRegister: (params) => api.get("/reports/voucher-register", { params }),
  getDaybook: (params) => api.get("/reports/daybook", { params }),
  getOutstandingReport: (params) => api.get("/reports/outstanding", { params }),
  getAgingReport: (params) => api.get("/reports/aging", { params }),
};

// E-Invoice API
export const eInvoiceAPI = {
  list: () => api.get("/einvoice"),
  generate: (data) => {
    // Ensure voucher_id is present
    if (!data.voucher_id) {
      throw new Error('voucher_id is required for E-Invoice generation');
    }
    return api.post("/einvoice/generate", data);
  },
  get: (voucherId) => api.get(`/einvoice/voucher/${voucherId}`),
  getByVoucher: (voucherId) => api.get(`/einvoice/voucher/${voucherId}`),
  cancel: (voucherId) => api.post(`/einvoice/cancel/${voucherId}`),
  cancelIRN: (voucherId) => api.post(`/einvoice/cancel/${voucherId}`),
  generateIRN: (data) => {
    // Ensure voucher_id is present
    if (!data.voucher_id) {
      throw new Error('voucher_id is required for IRN generation');
    }
    return api.post("/einvoice/generate", data);
  },
  getStatus: (voucherId) => api.get(`/einvoice/status/${voucherId}`),
  downloadPDF: (voucherId) => api.get(`/einvoice/pdf/${voucherId}`, { responseType: 'blob' }),
};

// E-Way Bill API
export const eWayBillAPI = {
  list: () => api.get("/ewaybill"),
  generate: (data) => {
    // Ensure voucher_id is present
    if (!data.voucher_id) {
      throw new Error('voucher_id is required for E-Way Bill generation');
    }
    return api.post("/ewaybill/generate", data);
  },
  get: (voucherId) => api.get(`/ewaybill/voucher/${voucherId}`),
  getByVoucher: (voucherId) => api.get(`/ewaybill/voucher/${voucherId}`),
  cancel: (voucherId) => api.post(`/ewaybill/cancel/${voucherId}`),
  getStatus: (voucherId) => api.get(`/ewaybill/status/${voucherId}`),
  updateVehicle: (voucherId, data) => api.post(`/ewaybill/update-vehicle/${voucherId}`, data),
};

// GST API
export const gstAPI = {
  // GSTIN Management
  gstins: {
    list: () => api.get("/gst/gstins"),
    create: (data) => api.post("/gst/gstins", data),
    update: (id, data) => api.put(`/gst/gstins/${id}`, data),
    delete: (id) => api.delete(`/gst/gstins/${id}`),
  },
  
  // GST Rates removed - now using Sandbox API for live rates
  
  // Backward compatibility
  listGSTINs: () => api.get("/gst/gstins"),
  createGSTIN: (data) => api.post("/gst/gstins", data),
  updateGSTIN: (id, data) => api.put(`/gst/gstins/${id}`, data),
  // getGSTRates: () => api.get("/gst/rates"), // Removed - using Sandbox API
  // createGSTRate: (data) => api.post("/gst/rates", data), // Removed - using Sandbox API
  
  // GST Returns
  listReturns: (params) => api.get("/gst/returns", { params }),
  generateGSTR1: (data) => api.post("/gst/returns/gstr1", data),
  generateGSTR3B: (data) => api.post("/gst/returns/gstr3b", data),
  
  // Third-party API endpoints
  validateGSTIN: (data) => api.post("/gst/validate", data),
  getGSTINDetails: (gstin) => api.get(`/gst/details/${gstin}`),
  getGSTRate: (params) => api.get("/gst/rate", { params }),
  
  // Sandbox GST Analytics APIs
  analytics: {
    createGSTR2AReconciliation: (data) => {
      // Ensure proper request structure
      const payload = {
        gstin: data.gstin,
        year: data.year,
        month: data.month,
        reconciliation_criteria: data.reconciliation_criteria || 'strict',
        ...data
      };
      return api.post("/gst/analytics/gstr2a-reconciliation", payload);
    },
    getGSTR2AReconciliationStatus: (jobId) => api.get(`/gst/analytics/gstr2a-reconciliation/${jobId}`),
    uploadPurchaseLedger: (data) => {
      // Ensure required fields are present
      if (!data.upload_url || !data.ledger_data) {
        throw new Error('upload_url and ledger_data are required');
      }
      return api.post("/gst/analytics/upload-purchase-ledger", data);
    },
  },
  
  // Backward compatibility
  getReturns: (params) => api.get("/gst/returns", { params }),
  createReturn: (data) => api.post("/gst/returns", data),
  updateReturn: (id, data) => api.put(`/gst/returns/${id}`, data),
  deleteReturn: (id) => api.delete(`/gst/returns/${id}`),
  fileReturn: (id) => api.post(`/gst/returns/${id}/file`),
  getGSTR1: (params) => api.get("/gst/gstr1", { params }),
  getGSTR3B: (params) => api.get("/gst/gstr3b", { params }),
};

// HSN API
export const hsnAPI = {
  search: (params) => {
    // Use AWS signature helper for premium endpoints
    const { makeSecureApiCall } = require('./awsSignatureHelper');
    return makeSecureApiCall(() => api.get("/hsn/search", { params }));
  },
  getByCode: (code) => {
    // Use AWS signature helper for premium endpoints
    const { makeSecureApiCall } = require('./awsSignatureHelper');
    return makeSecureApiCall(() => api.get(`/hsn/${code}`));
  },
  validate: (code) => api.get(`/hsn/${code}/validate`),
  getConfigStatus: () => api.get("/hsn/config/status"),
  list: (params) => api.get("/hsn", { params }), // Backward compatibility
};

// Income Tax API
export const incomeTaxAPI = {
  calculateTax: (data) => api.post("/income-tax/calculate", data),
  prepareITR: (data) => api.post("/income-tax/itr/prepare", data),
  fileITR: (data) => api.post("/income-tax/itr/file", data),
  getITRStatus: (returnId) => api.get(`/income-tax/itr/${returnId}/status`),
  getForm26AS: (pan) => api.get(`/income-tax/form26as/${pan}`),
  parseForm16: (data) => api.post("/income-tax/form16/parse", data),
  
  // Sandbox Income Tax Calculator APIs
  calculator: {
    securities: {
      submitTaxPnLJob: (data) => api.post("/income-tax/calculator/securities/tax-pnl", data),
      getTaxPnLJobStatus: (jobId) => api.get(`/income-tax/calculator/securities/tax-pnl/${jobId}`),
      uploadTradingData: (data) => api.post("/income-tax/calculator/securities/upload-trading-data", data),
    },
    calculateCapitalGains: (data) => api.post("/income-tax/calculator/capital-gains", data),
    calculateAdvanceTax: (data) => api.post("/income-tax/calculator/advance-tax", data),
    calculateTaxPnL: (data) => api.post("/income-tax/calculator/tax-pl", data),
  },
  
  // Form 16 generation
  generateForm16: (data) => api.post("/income-tax/form16/generate", data),
  
  // Backward compatibility
  getReturns: (params) => api.get("/income-tax/returns", { params }),
  createReturn: (data) => api.post("/income-tax/returns", data),
  updateReturn: (id, data) => api.put(`/income-tax/returns/${id}`, data),
  deleteReturn: (id) => api.delete(`/income-tax/returns/${id}`),
  fileReturn: (id) => api.post(`/income-tax/returns/${id}/file`),
};

// Search API
export const searchAPI = {
  universalSearch: (params) => api.get("/search", { params }),
  global: (params) => api.get("/search", { params }),
  universal: (params) => api.get("/search", { params }), // Alias for global
  ledgers: (query) => api.get(`/search/ledgers?q=${query}`),
  items: (query) => api.get(`/search/items?q=${query}`),
  vouchers: (query) => api.get(`/search/vouchers?q=${query}`),
};

// File API
export const fileAPI = {
  upload: (formData) => api.post("/files/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  }),
  delete: (id) => api.delete(`/files/${id}`),
  getUrl: (id) => api.get(`/files/${id}/url`),
};

// Finbox API (for loan services)
export const finboxAPI = {
  getCreditScore: (data) => {
    // Ensure PAN is present
    if (!data.pan) {
      throw new Error('PAN is required for credit score check');
    }
    const payload = {
      customer_id: data.customer_id,
      pan: data.pan,
      consent: data.consent || true,
      ...data
    };
    return api.post("/finbox/credit-score", payload);
  },
  getInclusionScore: (customerId) => api.get(`/finbox/inclusion-score/${customerId}`),
  checkLoanEligibility: (data) => api.post("/finbox/eligibility", data),
  createUser: (data) => api.post("/finbox/user", data),
  initiateBankStatement: (data) => api.post("/finbox/bank-statement/initiate", data),
  getBankStatementStatus: (customerId) => api.get(`/finbox/bank-statement/${customerId}/status`),
  getBankStatementAnalysis: (customerId) => api.get(`/finbox/bank-statement/${customerId}/analysis`),
  getDeviceInsights: (data) => {
    // Ensure required fields are present
    if (!data.version) {
      throw new Error('version is required for device insights');
    }
    const payload = {
      customer_id: data.customer_id,
      version: data.version,
      salt: data.salt,
      device_data: data.device_data || {},
      ...data
    };
    return api.post("/finbox/device-insights", payload);
  },
  generateSessionToken: (data) => api.post("/finbox/session", data),
  saveConsent: (data) => {
    // Ensure all consent fields are present
    if (!data.customer_id || !data.consent_type || data.consent_given === undefined) {
      throw new Error('customer_id, consent_type, and consent_given are required');
    }
    return api.post("/finbox/consent", data);
  },
  getConsent: (params) => api.get("/finbox/consent", { params }),
  // Backward compatibility
  checkEligibility: (data) => api.post("/finbox/eligibility", data),
};

// Product Attributes API
export const attributeAPI = {
  list: () => api.get('/attributes'),
  create: (name) => api.post('/attributes', { name }),
  update: (id, name) => api.put(`/attributes/${id}`, { name }),
  delete: (id) => api.delete(`/attributes/${id}`),
  addValue: (attributeId, value) => api.post(`/attributes/${attributeId}/values`, { value }),
  removeValue: (valueId) => api.delete(`/attributes/values/${valueId}`),
};

// Tenant API
export const tenantAPI = {
  getProfile: () => api.get("/tenants/profile"),
  updateProfile: (data) => api.put("/tenants/profile", data),
  // Backward compatibility
  list: () => api.get("/tenants"),
  create: (data) => api.post("/tenants", data),
  getById: (id) => api.get(`/tenants/${id}`),
  update: (id, data) => api.put(`/tenants/${id}`, data),
  delete: (id) => api.delete(`/tenants/${id}`),
  getCurrent: () => api.get("/tenants/current"),
};

// Branch API
export const branchAPI = {
  create: (data) => api.post("/branches", data),
  list: (companyId) => {
    if (companyId) {
      return api.get(`/branches/company/${companyId}`);
    }
    return api.get("/branches");
  },
  getById: (id) => api.get(`/branches/${id}`),
  update: (id, data) => api.put(`/branches/${id}`, data),
  remove: (id) => api.delete(`/branches/${id}`),
  // Backward compatibility
  delete: (id) => api.delete(`/branches/${id}`),
};

export default api;

// Admin API - Full implementation matching backend comprehensive test
export const adminAPI = {
  // Dashboard
  dashboard: {
    getStats: () => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get("/admin/dashboard").catch(error => handlePermissionError(error, 'admin'));
    },
  },
  
  // Distributors Management
  distributors: {
    list: (params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get("/admin/distributors", { params }).catch(error => handlePermissionError(error, 'admin'));
    },
    create: (data) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.post("/admin/distributors", data).catch(error => handlePermissionError(error, 'admin'));
    },
    get: (id) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get(`/admin/distributors/${id}`).catch(error => handlePermissionError(error, 'admin'));
    },
    update: (id, data) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.put(`/admin/distributors/${id}`, data).catch(error => handlePermissionError(error, 'admin'));
    },
    delete: (id) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.delete(`/admin/distributors/${id}`).catch(error => handlePermissionError(error, 'admin'));
    },
    getPerformance: (id, params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get(`/admin/distributors/${id}/performance`, { params }).catch(error => handlePermissionError(error, 'admin'));
    },
  },
  
  // Salesmen Management
  salesmen: {
    list: (params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get("/admin/salesmen", { params }).catch(error => handlePermissionError(error, 'admin'));
    },
    create: (data) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.post("/admin/salesmen", data).catch(error => handlePermissionError(error, 'admin'));
    },
    get: (id) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get(`/admin/salesmen/${id}`).catch(error => handlePermissionError(error, 'admin'));
    },
    update: (id, data) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.put(`/admin/salesmen/${id}`, data).catch(error => handlePermissionError(error, 'admin'));
    },
    delete: (id) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.delete(`/admin/salesmen/${id}`).catch(error => handlePermissionError(error, 'admin'));
    },
    getPerformance: (id, params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get(`/admin/salesmen/${id}/performance`, { params }).catch(error => handlePermissionError(error, 'admin'));
    },
    getLeads: (id, params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get(`/admin/salesmen/${id}/leads`, { params }).catch(error => handlePermissionError(error, 'admin'));
    },
  },
  
  // Targets Management
  targets: {
    list: (params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get("/admin/targets", { params }).catch(error => handlePermissionError(error, 'admin'));
    },
    create: (data) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.post("/admin/targets", data).catch(error => handlePermissionError(error, 'admin'));
    },
    get: (id) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get(`/admin/targets/${id}`).catch(error => handlePermissionError(error, 'admin'));
    },
    update: (id, data) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.put(`/admin/targets/${id}`, data).catch(error => handlePermissionError(error, 'admin'));
    },
    delete: (id) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.delete(`/admin/targets/${id}`).catch(error => handlePermissionError(error, 'admin'));
    },
    recalculate: (id) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.post(`/admin/targets/${id}/recalculate`).catch(error => handlePermissionError(error, 'admin'));
    },
    recalculateAll: (data) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.post("/admin/targets/recalculate/all", data).catch(error => handlePermissionError(error, 'admin'));
    },
    getForDistributor: (distributorId, params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get(`/admin/targets/distributor/${distributorId}`, { params }).catch(error => handlePermissionError(error, 'admin'));
    },
    getForSalesman: (salesmanId, params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get(`/admin/targets/salesman/${salesmanId}`, { params }).catch(error => handlePermissionError(error, 'admin'));
    },
  },
  
  // Commission & Payouts
  commissions: {
    list: (params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get("/admin/commissions", { params }).catch(error => handlePermissionError(error, 'admin'));
    },
  },
  payouts: {
    list: (params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get("/admin/payouts", { params }).catch(error => handlePermissionError(error, 'admin'));
    },
  },
  commissionPayouts: {
    list: (params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get("/admin/commissions-payouts", { params }).catch(error => handlePermissionError(error, 'admin'));
    },
  },
  
  // Referrals Management
  referrals: {
    list: (params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get("/referrals", { params }).catch(error => handlePermissionError(error, 'admin'));
    },
    getStats: () => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get("/referrals/stats").catch(error => handlePermissionError(error, 'admin'));
    },
  },
  
  // Tenants Management
  tenants: {
    list: (params) => {
      if (!checkPermission('super_admin')) {
        throw new Error('Super admin access required');
      }
      return api.get("/admin/tenants", { params }).catch(error => handlePermissionError(error, 'super_admin'));
    },
    get: (id) => {
      if (!checkPermission('super_admin')) {
        throw new Error('Super admin access required');
      }
      return api.get(`/admin/tenants/${id}`).catch(error => handlePermissionError(error, 'super_admin'));
    },
    create: (data) => {
      if (!checkPermission('super_admin')) {
        throw new Error('Super admin access required');
      }
      return api.post("/admin/tenants", data).catch(error => handlePermissionError(error, 'super_admin'));
    },
    update: (id, data) => {
      if (!checkPermission('super_admin')) {
        throw new Error('Super admin access required');
      }
      return api.put(`/admin/tenants/${id}`, data).catch(error => handlePermissionError(error, 'super_admin'));
    },
    delete: (id) => {
      if (!checkPermission('super_admin')) {
        throw new Error('Super admin access required');
      }
      return api.delete(`/admin/tenants/${id}`).catch(error => handlePermissionError(error, 'super_admin'));
    },
  },
  
  // Users Management
  users: {
    list: (params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get("/admin/users", { params }).catch(error => handlePermissionError(error, 'admin'));
    },
  },
  
  // Support Management
  support: {
    list: (params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get("/support/tickets", { params }).catch(error => handlePermissionError(error, 'admin'));
    },
    get: (id) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get(`/support/tickets/${id}`).catch(error => handlePermissionError(error, 'admin'));
    },
    assign: (id, data) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.put(`/support/tickets/${id}/assign`, data).catch(error => handlePermissionError(error, 'admin'));
    },
    updateStatus: (id, data) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.put(`/support/tickets/${id}/status`, data).catch(error => handlePermissionError(error, 'admin'));
    },
    getAgentReviews: (agentId, params) => {
      if (!checkPermission('admin')) {
        throw new Error('Admin access required');
      }
      return api.get(`/support/agents/${agentId}/reviews`, { params }).catch(error => handlePermissionError(error, 'admin'));
    },
  },
  
  // Cron Job Management
  cron: {
    getStatus: () => {
      if (!checkPermission('super_admin')) {
        throw new Error('Super admin access required');
      }
      return api.get("/admin/cron/status").catch(error => handlePermissionError(error, 'super_admin'));
    },
    triggerTrialCleanup: () => {
      if (!checkPermission('super_admin')) {
        throw new Error('Super admin access required');
      }
      return api.post("/admin/cron/trigger-trial-cleanup").catch(error => handlePermissionError(error, 'super_admin'));
    },
    stopJob: (jobName) => {
      if (!checkPermission('super_admin')) {
        throw new Error('Super admin access required');
      }
      return api.post(`/admin/cron/jobs/${jobName}/stop`).catch(error => handlePermissionError(error, 'super_admin'));
    },
    startJob: (jobName) => {
      if (!checkPermission('super_admin')) {
        throw new Error('Super admin access required');
      }
      return api.post(`/admin/cron/jobs/${jobName}/start`).catch(error => handlePermissionError(error, 'super_admin'));
    },
  },
};

export const blogAPI = {
  list: (params) => api.get("/blogs", { params }),
  get: (id) => api.get(`/blogs/${id}`),
  create: (data) => api.post("/blogs", data),
  update: (id, data) => api.put(`/blogs/${id}`, data),
  delete: (id) => api.delete(`/blogs/${id}`),
  
  // Blog Categories
  categories: {
    list: (params) => api.get("/blog-categories", { params }),
    create: (data) => api.post("/blog-categories", data),
    update: (id, data) => api.put(`/blog-categories/${id}`, data),
    delete: (id) => api.delete(`/blog-categories/${id}`),
  },
};

export const seoAPI = {
  list: (params) => api.get("/seo", { params }),
  get: (path) => api.get(`/seo/${path}`),
  create: (data) => api.post("/seo", data),
  update: (id, data) => api.put(`/seo/${id}`, data),
  delete: (id) => api.delete(`/seo/${id}`),
};