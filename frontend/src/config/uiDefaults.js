export const DEFAULT_UI_PREFERENCES = {
  theme: "light",
  accent: "#647687", // Reference neutral accent; user choice overrides this in both themes.
  density: "comfortable",
  fontScale: "default",
  radius: "medium",
  sidebarMode: "comfortable",
  sidebarWidth: 277,
  tableDensity: "comfortable",
  navbarCompact: false,
  cardShadow: true,
  reducedMotion: false,
  productView: "grid",
  productColumns: ["sku","category","price","stock","status"],
  inventoryColumns: 3,
};

export const DEFAULT_BUSINESS_FEATURES = {
  variants: true,
  sizeColor: false,
  weightVolume: true,
  batchExpiry: false,
  serialImei: false,
  warranty: false,
  supplierTracking: true,
  stockTransfers: true,
};

export const DEFAULT_WORKSPACE_SETTINGS = {
  organization: {
    businessName: "Zenix POS",
    phone: "",
    address: "",
    currency: "UZS",
    timezone: "Asia/Tashkent",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "24",
    businessType: "universal",
  },
  pos: {
    defaultPayment: "cash",
    barcodeAutoAdd: true,
    enterAddsProduct: true,
    autoPrintReceipt: false,
    saleConfirmation: false,
    blockNegativeStock: true,
    discountLimit: 20,
    cashierDiscountAllowed: false,
    holdCartEnabled: true,
    paymentMethods: { cash:true, card:true, transfer:true, split:true },
  },
  inventory: {
    defaultLowStock: 5,
    blockNegativeStock: true,
    transferApproval: true,
    countApproval: true,
  },
  businessDay: {
    startTime: "00:00",
    closeTime: "23:59",
    maxShiftHours: 12,
    warnBeforeCloseMinutes: 30,
  },
  receipt: {
    width: "80",
    showLogo: true,
    showCashier: true,
    showPaymentBreakdown: true,
    footer: "Xaridingiz uchun rahmat!",
    printMode: "browser",
    copies: 1,
  },
  notifications: {
    lowStock: true,
    outOfStock: true,
    shift: true,
    approvals: true,
    billing: true,
    supplierDebt: true,
  },
  storeOverrides: {},
};

export const DEFAULT_ROLE_PERMISSIONS = {
  OWNER: {
    moduleDashboard:true,moduleShifts:true,moduleSales:true,moduleHistory:true,moduleProducts:true,moduleInventory:true,moduleSuppliers:true,moduleExpenses:true,moduleAnalytics:true,moduleSellerAnalytics:true,moduleActivityLog:true,moduleSettings:true,moduleBilling:true,
    productWrite:true,inventoryAdjust:true,transferView:true,transferCreate:true,transferApprove:true,transferReceive:true,transferCancel:true,supplierWrite:true,returns:true,expensesWrite:true,analytics:true,shiftRecon:true,billingWrite:true,inventoryCountApprove:true,closeBusinessDay:true,dataExport:true,settingsWrite:true,
  },
  ADMIN: {
    moduleDashboard:true,moduleShifts:true,moduleSales:true,moduleHistory:true,moduleProducts:true,moduleInventory:true,moduleSuppliers:true,moduleExpenses:true,moduleAnalytics:true,moduleSellerAnalytics:true,moduleActivityLog:true,moduleSettings:true,moduleBilling:true,
    productWrite:true,inventoryAdjust:true,transferView:true,transferCreate:true,transferApprove:true,transferReceive:true,transferCancel:true,supplierWrite:true,returns:true,expensesWrite:true,analytics:true,shiftRecon:true,billingWrite:false,inventoryCountApprove:true,closeBusinessDay:true,dataExport:true,settingsWrite:true,
  },
  MANAGER: {
    moduleDashboard:true,moduleShifts:true,moduleSales:true,moduleHistory:true,moduleProducts:true,moduleInventory:true,moduleSuppliers:true,moduleExpenses:true,moduleAnalytics:true,moduleSellerAnalytics:true,moduleActivityLog:true,moduleSettings:false,moduleBilling:false,
    productWrite:true,inventoryAdjust:true,transferView:true,transferCreate:true,transferApprove:false,transferReceive:true,transferCancel:true,supplierWrite:true,returns:true,expensesWrite:true,analytics:true,shiftRecon:true,billingWrite:false,inventoryCountApprove:false,closeBusinessDay:false,dataExport:false,settingsWrite:false,
  },
  CASHIER: {
    moduleDashboard:false,moduleShifts:true,moduleSales:true,moduleHistory:true,moduleProducts:false,moduleInventory:false,moduleSuppliers:false,moduleExpenses:false,moduleAnalytics:false,moduleSellerAnalytics:false,moduleActivityLog:false,moduleSettings:false,moduleBilling:false,
    productWrite:false,inventoryAdjust:false,transferView:false,transferCreate:false,transferApprove:false,transferReceive:false,transferCancel:false,supplierWrite:false,returns:true,expensesWrite:false,analytics:false,shiftRecon:false,billingWrite:false,inventoryCountApprove:false,closeBusinessDay:false,dataExport:false,settingsWrite:false,
  },
  SALES: {
    moduleDashboard:false,moduleShifts:true,moduleSales:true,moduleHistory:true,moduleProducts:true,moduleInventory:false,moduleSuppliers:false,moduleExpenses:false,moduleAnalytics:false,moduleSellerAnalytics:false,moduleActivityLog:false,moduleSettings:false,moduleBilling:false,
    productWrite:false,inventoryAdjust:false,transferView:false,transferCreate:false,transferApprove:false,transferReceive:false,transferCancel:false,supplierWrite:false,returns:false,expensesWrite:false,analytics:false,shiftRecon:false,billingWrite:false,inventoryCountApprove:false,closeBusinessDay:false,dataExport:false,settingsWrite:false,
  },
  WAREHOUSE: {
    moduleDashboard:false,moduleShifts:false,moduleSales:false,moduleHistory:false,moduleProducts:true,moduleInventory:true,moduleSuppliers:true,moduleExpenses:false,moduleAnalytics:false,moduleSellerAnalytics:false,moduleActivityLog:false,moduleSettings:false,moduleBilling:false,
    productWrite:true,inventoryAdjust:true,transferView:true,transferCreate:true,transferApprove:false,transferReceive:true,transferCancel:false,supplierWrite:true,returns:false,expensesWrite:false,analytics:false,shiftRecon:false,billingWrite:false,inventoryCountApprove:false,closeBusinessDay:false,dataExport:false,settingsWrite:false,
  },
};
