export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export interface MenuEntry {
  name: string;
  route: string;
  icon: string; // MaterialCommunityIcons name
}

// Only routes registered in AppNavigator appear here; adding a screen means
// adding it to both places.
export const RETAILER_MENU_ITEMS: MenuEntry[] = [
  { name: "Dashboard", route: "Dashboard", icon: "view-dashboard-outline" },
  { name: "AEPS", route: "AEPS", icon: "fingerprint" },
  { name: "AEPS Settlement", route: "AepsSettlement", icon: "bank-outline" },
  { name: "PAN Card", route: "PAN", icon: "card-account-details-outline" },
  { name: "Lead Generation", route: "LeadGeneration", icon: "account-plus-outline" },
  { name: "ITR Filing", route: "ITR", icon: "file-document-outline" },
  { name: "UPI Payments", route: "UPIPayments", icon: "qrcode" },
  { name: "DMT", route: "DMT", icon: "send-outline" },
  { name: "Recharge", route: "Recharge", icon: "flash-outline" },
  { name: "BBPS", route: "BBPS", icon: "receipt" },
  { name: "Wallet Transfer", route: "WalletTransfer", icon: "wallet-outline" },
  { name: "Direct Payout", route: "DirectPayout", icon: "cash-fast" },
  { name: "Fund Request", route: "FundRequest", icon: "hand-coin-outline" },
  { name: "AEPS Pipe Status", route: "PipeStatus", icon: "pipe" },
  { name: "Biometric Support", route: "BiometricSupport", icon: "fingerprint-off" },
  { name: "KYC Status", route: "KycStatus", icon: "shield-check-outline" },
  { name: "My Profile", route: "Profile", icon: "account-circle-outline" },
];

export const ADMIN_MENU_ITEMS: MenuEntry[] = [
  { name: "Overview", route: "AdminPortal", icon: "view-dashboard-outline" },
];

export const DISTRIBUTOR_MENU_ITEMS: MenuEntry[] = [
  { name: "Overview", route: "DistributorPortal", icon: "view-dashboard-outline" },
];

export const API_ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
    verifyOtp: '/api/auth/verify-login-otp',
    logout: '/api/auth/logout',
    refreshToken: '/api/auth/refresh-token',
    updateProfile: '/api/auth/update-profile',
    changePassword: '/api/auth/change-password',
    paysprintOnboardUrl: '/api/auth/paysprint/get-onboard-url',
    createRetailer: '/api/auth/create-retailer',
    createDistributor: '/api/auth/create-distributor',
  },
  wallet: {
    balance: '/api/wallet/balance',
    setPin: '/api/wallet/set-pin',
    transfer: '/api/wallet/transfer',
    history: '/api/wallet/history',
    ledger: '/api/wallet/ledger',
  },
  dashboard: {
    retailer: '/api/dashboard/retailer',
    recentTransactions: '/api/dashboard/recent-transactions',
  },
  aeps: {
    merchantStatus: '/api/aeps/merchant-status',
    pipesVerify: '/api/aeps/pipes/verify',
    onboardingPlan: '/api/aeps/onboarding/plan',
    banks: '/api/aeps/banks',
    balanceEnquiry: '/api/aeps/balance-enquiry',
    cashWithdrawal: '/api/aeps/cash-withdrawal',
    miniStatement: '/api/aeps/mini-statement',
    dailyAuth: '/api/aeps/daily-auth',
  },
  settlement: {
    savedBanks: '/api/settlement/saved-banks',
    addBank: '/api/settlement/add-bank',
    initiate: '/api/settlement/initiate',
    directPayout: '/api/settlement/direct-payout',
    history: '/api/settlement/history',
  },
  dmt: {
    banks: '/api/dmt/banks',
    remitterQuery: '/api/dmt/remitter/query',
    beneficiaryFetch: '/api/dmt/beneficiary/fetch',
    transfer: '/api/dmt/transfer',
    history: '/api/dmt/history',
  },
  recharge: {
    operators: '/api/recharge/operators', // append /:type
    browsePlan: '/api/recharge/browse-plan',
    fetchBill: '/api/recharge/fetch-bill',
    doRecharge: '/api/recharge/do-recharge',
    history: '/api/recharge/history',
  },
  upi: {
    merchantStatus: '/api/upi/cashout/merchant-status',
    generateToken: '/api/upi/cashout/generate-token',
    status: '/api/upi/cashout/status',
  },
  pan: {
    esevaApplyService: '/api/pan/eseva/apply-service',
    esevaServiceStatus: '/api/pan/eseva/service-status',
    esevaHistory: '/api/pan/eseva/history',
    myPsaStatus: '/api/pan/my-psa-status',
  },
  itr: {
    launch: '/api/itr/launch',
    history: '/api/itr/history',
  },
  lead: {
    generate: '/api/lead/generate',
    status: '/api/lead/status', // append /:refid
    history: '/api/lead/history',
  },
  fundRequest: {
    retailer: '/api/fund-request/retailer',
    distributor: '/api/fund-request/distributor',
    update: '/api/fund-request/update',
    admin: '/api/fund-request/admin',
    adminUpdate: '/api/fund-request/admin/update',
  },
  distributor: {
    stats: '/api/distributor/stats',
    retailers: '/api/distributor/retailers',
    profile: '/api/distributor/profile',
  },
  admin: {
    stats: '/api/admin/stats',
    distributors: '/api/admin/distributors',
    profile: '/api/admin/profile',
    recentTransactions: '/api/admin/recent-transactions',
    settings: '/api/admin/settings',
  },
};

export const STORAGE_KEYS = {
  token: 'token',
  refreshToken: 'refreshToken',
  user: 'user',
  theme: 'theme',
  selectedPipe: 'selectedPipe',
};

export const QUICK_ACTIONS = [
  { name: 'AEPS Services', route: 'AEPS', icon: 'fingerprint', color: 'blue' },
  { name: 'Lead Generation', route: 'LeadGeneration', icon: 'account-group', color: 'teal' },
  { name: 'PAN Card', route: 'PAN', icon: 'credit-card', color: 'rose' },
  { name: 'ITR Filing', route: 'ITR', icon: 'file-document', color: 'indigo' },
];

export const DATE_FILTER_OPTIONS = [
  'Today',
  'Yesterday',
  'Last 7 Days',
  'Last 30 Days',
  'This Month',
  'Last Month',
  'Custom Range',
];

export const TRANSACTION_STATUS = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PENDING: 'PENDING',
};

export const KYC_STEPS = {
  WEB_KYC: 'web',
  BIOMETRIC: 'biometric',
};