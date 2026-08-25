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
    paysprintOnboardUrl: '/api/auth/paysprint/get-onboard-url',
  },
  wallet: {
    balance: '/api/wallet/balance',
    transfer: '/api/wallet/transfer',
    ledger: '/api/wallet/ledger',
  },
  dashboard: {
    retailer: '/api/dashboard/retailer',
  },
  aeps: {
    services: '/api/aeps/services',
    settlement: '/api/aeps/settlement',
    pipes: '/api/aeps/pipes',
    onboardingPlan: '/api/aeps/onboarding/plan',
  },
  dmt: {
    services: '/api/dmt/services',
    report: '/api/dmt/report',
  },
  recharge: {
    services: '/api/recharge/services',
    operators: '/api/recharge/operators',
  },
  bbps: {
    categories: '/api/bbps/categories',
    billers: '/api/bbps/billers',
    fetchBill: '/api/bbps/fetch-bill',
    payBill: '/api/bbps/pay-bill',
  },
  upi: {
    payments: '/api/upi/payments',
    report: '/api/upi/report',
  },
  pan: {
    apply: '/api/pan/apply',
    status: '/api/pan/status',
    report: '/api/pan/report',
  },
  itr: {
    filing: '/api/itr/filing',
    report: '/api/itr/report',
  },
  lead: {
    generate: '/api/lead/generate',
    report: '/api/lead/report',
  },
  fundRequest: {
    create: '/api/fund-request/create',
    list: '/api/fund-request/list',
    approve: '/api/fund-request/approve',
  },
  distributor: {
    retailers: '/api/distributor/retailers',
    create: '/api/distributor/create',
  },
  admin: {
    distributors: '/api/admin/distributors',
    create: '/api/admin/create',
    commissions: '/api/admin/commissions',
    fundRequests: '/api/admin/fund-requests',
  },
};

export const STORAGE_KEYS = {
  token: 'token',
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