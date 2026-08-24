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

export const RETAILER_MENU_ITEMS = [
  { name: "Dashboard", url: "/dashboard", icon: "layout-dashboard" },
  { name: "AEPS", url: "/aeps", icon: "fingerprint" },
  { name: "AEPS Settlement", url: "/aeps-settlement", icon: "landmark" },
  { name: "PAN Card", url: "/pan", icon: "file-text" },
  { name: "Lead Generation", url: "/lead-generation", icon: "user-plus" },
  { name: "ITR Filing", url: "/itr", icon: "file-text" },
  { name: "UPI Payments", url: "/upi-payments", icon: "wallet" },
  { name: "DMT", url: "/dmt", icon: "send" },
  { name: "Recharge", url: "/recharge", icon: "zap" },
  { name: "BBPS", url: "/bbps", icon: "zap" },
  {
    name: "Reports",
    icon: "bar-chart-3",
    subItems: [
      { name: "Ledger", url: "/reports/ledger" },
      { name: "All Reports", url: "/reports/ledger" },
      { name: "AEPS Reports", url: "/reports/aeps" },
      { name: "DMT Reports", url: "/reports/dmt" },
      { name: "Payout Reports", url: "/reports/payout" },
      { name: "UPI Reports", url: "/reports/upi" },
      { name: "PAN Reports", url: "/reports/pan" },
      { name: "ITR Reports", url: "/reports/itr" },
      { name: "Lead Generation Reports", url: "/reports/lead-generation" },
      { name: "Wallet Ledger", url: "/reports/wallet-ledger" },
    ],
  },
  { name: "Fund Request", url: "/fund-request", icon: "send" },
  { name: "AEPS Pipe Status", url: "/aeps/pipes", icon: "fingerprint" },
  { name: "Biometric Support", url: "/biometric-support", icon: "fingerprint" },
];

export const ADMIN_MENU_ITEMS = [
  { name: "Overview", url: "/admin", icon: "layout-dashboard" },
  { name: "Distributors", url: "/admin/distributors", icon: "users" },
  { name: "Fund Requests", url: "/admin/fund-requests", icon: "store" },
  { name: "Add New", url: "/admin/create", icon: "user-plus" },
  { name: "Commissions", url: "/admin/commissions", icon: "file-text" },
  { name: "Ledger", url: "/reports/ledger", icon: "file-text" },
  { name: "Lead Generation", url: "/lead-generation", icon: "user-plus" },
];

export const DISTRIBUTOR_MENU_ITEMS = [
  { name: "Overview", url: "/distributor", icon: "layout-dashboard" },
  { name: "Retailers", url: "/distributor/retailers", icon: "users" },
  { name: "Fund Requests", url: "/distributor/fund-requests", icon: "store" },
  { name: "Add New", url: "/distributor/create", icon: "user-plus" },
  { name: "My Profile", url: "/distributor/profile", icon: "user-circle" },
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
  { name: 'AEPS Services', route: '/aeps', icon: 'fingerprint', color: 'blue' },
  { name: 'Lead Generation', route: '/lead-generation', icon: 'users', color: 'teal' },
  { name: 'PAN Card', route: '/pan', icon: 'credit-card', color: 'rose' },
  { name: 'ITR Filing', route: '/itr', icon: 'file-text', color: 'indigo' },
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