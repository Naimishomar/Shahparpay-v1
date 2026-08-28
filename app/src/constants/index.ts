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

/**
 * Exact values PaySprint's `activate_merchant` accepts for
 * `nature_of_bussiness` (bank5 only). The backend rejects anything else, so
 * this list must stay in step with NATURE_OF_BUSINESS_OPTIONS in
 * backend/src/controllers/aepsPayment.controller.js.
 */
export const NATURE_OF_BUSINESS = [
  'Agriculture',
  'Antique Dealer',
  'Arms Dealer',
  'Art Dealer',
  'Banking',
  'Mobility',
  'Barber',
  'Parlour',
  'Salon',
  'Bullion Dealer and Jeweller',
  'Casino',
  'Gaming Application',
  'Educational Institute',
  'Financial Institution',
  'Healthcare',
  'Pharma',
  'Import And Export Trader',
  'Law',
  'Accountancy firm',
  'Liquor',
  'Manufacturing',
  'Marketing including Multi-level Marketing',
  'Media',
  'Pawn Shop',
  'Money Lender',
  'Money Changer',
  'Real Estate',
  'Restaurant and Hospitality',
  'Retail Shop',
  'Service Provider',
  'Small vendor',
  'Kirana shop',
  'Stock Trading',
  'Brokerage',
  'Transport',
  'Logistics',
  'Wholesale Trading',
  'Others',
];

/** Every AEPS pipe the backend can onboard, in the order PaySprint lists them. */
export const AEPS_PIPES = [
  { key: 'bank2', label: 'Bank 2' },
  { key: 'bank3', label: 'Bank 3' },
  { key: 'bank4', label: 'Bank 4 (City Union)' },
  { key: 'bank5', label: 'Bank 5' },
  { key: 'bank6', label: 'Bank 6' },
];

/** AEPS cash withdrawals at or above this need a customer OTP first. */
export const AEPS_OTP_THRESHOLD = 5000;

/** PaySprint caps a single AEPS cash withdrawal at this amount. */
export const AEPS_MAX_WITHDRAWAL = 10000;

export interface MenuEntry {
  name: string;
  route: string;
  icon: string; // MaterialCommunityIcons name
  /** Short line shown under the name in the Services grid. */
  hint?: string;
  group?: string;
}

export interface TabEntry {
  key: string;
  name: string;
  route: string;
  icon: string;
  iconActive: string;
}

/**
 * Bottom navigation: five top-level destinations, the platform maximum.
 * Everything else lives one level down under Services or Reports, so the bar
 * never carries sub-navigation.
 *
 * Account is deliberately NOT a tab — the header avatar opens it, which frees
 * the slot for AEPS, the service retailers open many times a day.
 */
export const RETAILER_TABS: TabEntry[] = [
  { key: 'home', name: 'Home', route: 'Dashboard', icon: 'home-outline', iconActive: 'home' },
  // Same glyph either way: MaterialCommunityIcons has no outline fingerprint,
  // and the active pill plus colour already carry the selected state.
  { key: 'aeps', name: 'AEPS', route: 'AEPS', icon: 'fingerprint', iconActive: 'fingerprint' },
  { key: 'services', name: 'Services', route: 'Services', icon: 'apps', iconActive: 'apps' },
  { key: 'reports', name: 'Reports', route: 'Reports', icon: 'chart-box-outline', iconActive: 'chart-box' },
  { key: 'settlement', name: 'Settlement', route: 'AepsSettlement', icon: 'bank-outline', iconActive: 'bank' },
];

export const ADMIN_TABS: TabEntry[] = [
  { key: 'home', name: 'Overview', route: 'AdminPortal', icon: 'view-dashboard-outline', iconActive: 'view-dashboard' },
  { key: 'reports', name: 'Reports', route: 'Reports', icon: 'chart-box-outline', iconActive: 'chart-box' },
];

export const DISTRIBUTOR_TABS: TabEntry[] = [
  { key: 'home', name: 'Overview', route: 'DistributorPortal', icon: 'view-dashboard-outline', iconActive: 'view-dashboard' },
  { key: 'reports', name: 'Reports', route: 'Reports', icon: 'chart-box-outline', iconActive: 'chart-box' },
];

/** Services grid — every route must also be registered in AppNavigator. */
export const SERVICE_ITEMS: MenuEntry[] = [
  { name: 'AEPS', route: 'AEPS', icon: 'fingerprint', hint: 'Aadhaar banking', group: 'Banking' },
  { name: 'DMT', route: 'DMT', icon: 'bank-transfer', hint: 'Money transfer', group: 'Banking' },
  { name: 'Wallet Transfer', route: 'WalletTransfer', icon: 'wallet-plus-outline', hint: 'AEPS to main wallet', group: 'Banking' },
  { name: 'Direct Payout', route: 'DirectPayout', icon: 'cash-fast', hint: 'Pay any account', group: 'Banking' },
  { name: 'UPI Collect', route: 'UPIPayments', icon: 'qrcode', hint: 'Collect on UPI', group: 'Banking' },

  { name: 'Recharge', route: 'Recharge', icon: 'cellphone', hint: 'Mobile & DTH', group: 'Payments' },
  { name: 'BBPS', route: 'BBPS', icon: 'receipt', hint: 'Utility bills', group: 'Payments' },
  { name: 'Fund Request', route: 'FundRequest', icon: 'hand-coin-outline', hint: 'Top up wallet', group: 'Payments' },

  { name: 'PAN Card', route: 'PAN', icon: 'card-account-details-outline', hint: 'PSA & applications', group: 'Government' },
  { name: 'ITR Filing', route: 'ITR', icon: 'file-document-outline', hint: 'Income tax returns', group: 'Government' },
  { name: 'Lead Generation', route: 'LeadGeneration', icon: 'account-plus-outline', hint: 'Loans & cards', group: 'Government' },

  { name: 'KYC Status', route: 'KycStatus', icon: 'shield-check-outline', hint: 'Verification', group: 'Account' },
  { name: 'Pipe Status', route: 'PipeStatus', icon: 'pipe', hint: 'Bank connectivity', group: 'Account' },
  { name: 'Biometric', route: 'BiometricSupport', icon: 'fingerprint-off', hint: 'Device help', group: 'Account' },
];

/** Report destinations. `type` filters /api/dashboard/recent-transactions. */
export interface ReportEntry {
  name: string;
  route: string;
  icon: string;
  hint: string;
  /** Transaction type prefix the report filters on, when it uses that endpoint. */
  type?: string;
}

export const REPORT_ITEMS: ReportEntry[] = [
  { name: 'Wallet Ledger', route: 'WalletLedgerReport', icon: 'notebook-outline', hint: 'Every credit and debit' },
  { name: 'AEPS Report', route: 'AepsReport', icon: 'fingerprint', hint: 'Withdrawals and enquiries', type: 'AEPS' },
  { name: 'DMT Report', route: 'DmtReport', icon: 'bank-transfer', hint: 'Money transfers', type: 'DMT' },
  { name: 'Payout Report', route: 'PayoutReport', icon: 'cash-fast', hint: 'Settlements and payouts' },
  { name: 'Recharge Report', route: 'RechargeReport', icon: 'cellphone', hint: 'Recharges and bills', type: 'RECHARGE' },
  { name: 'UPI Report', route: 'UpiReport', icon: 'qrcode', hint: 'UPI collections', type: 'WALLET_TOPUP' },
  { name: 'PAN Report', route: 'PanReport', icon: 'card-account-details-outline', hint: 'PAN applications' },
  { name: 'ITR Report', route: 'ItrReport', icon: 'file-document-outline', hint: 'Filings and charges' },
  { name: 'Lead Report', route: 'LeadReport', icon: 'account-plus-outline', hint: 'Referred customers' },
];

/** Home screen shortcuts. */
export const QUICK_ACTIONS: MenuEntry[] = [
  { name: 'AEPS', route: 'AEPS', icon: 'fingerprint' },
  { name: 'Recharge', route: 'Recharge', icon: 'cellphone' },
  { name: 'DMT', route: 'DMT', icon: 'bank-transfer' },
  { name: 'Payout', route: 'DirectPayout', icon: 'cash-fast' },
];

export const API_ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
    verifyOtp: '/api/auth/verify-login-otp',
    logout: '/api/auth/logout',
    refreshToken: '/api/auth/refresh-token',
    sendVerificationOtp: '/api/auth/send-verification-otp',
    sendPasswordOtp: '/api/auth/send-password-otp',
    verifyEmailOtp: '/api/auth/verify-email-otp',
    updateProfile: '/api/auth/update-profile',
    changePassword: '/api/auth/change-password',
    paysprintOnboardUrl: '/api/auth/paysprint/get-onboard-url',
    paysprintUpdateKyc: '/api/auth/paysprint/update-kyc-status',
    aadhaarSendOtp: '/api/auth/paysprint/aadhaar/send-otp',
    aadhaarVerifyOtp: '/api/auth/paysprint/aadhaar/verify-otp',
    verifyPan: '/api/auth/paysprint/pan/verify',
    createRetailer: '/api/auth/create-retailer',
    createDistributor: '/api/auth/create-distributor',
  },
  wallet: {
    balance: '/api/wallet/balance',
    setPin: '/api/wallet/set-pin',
    changePin: '/api/wallet/change-pin',
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
    pidOptions: '/api/aeps/get-pid-options',
    banks: '/api/aeps/banks',
    balanceEnquiry: '/api/aeps/balance-enquiry',
    initiateOtp: '/api/aeps/initiate-otp',
    cashWithdrawal: '/api/aeps/cash-withdrawal',
    cashDeposit: '/api/aeps/cash-deposit',
    aadhaarPay: '/api/aeps/aadhaar-pay',
    miniStatement: '/api/aeps/mini-statement',
    txnStatus: '/api/aeps/txn-status',
    kycSendOtp: '/api/aeps/kyc/send-otp',
    kycResendOtp: '/api/aeps/kyc/resend-otp',
    kycVerifyOtp: '/api/aeps/kyc/verify-otp',
    kycActivate: '/api/aeps/kyc/activate-merchant',
    dailyAuth: '/api/aeps/daily-auth',
  },
  settlement: {
    savedBanks: '/api/settlement/saved-banks',
    syncBanks: '/api/settlement/sync-banks',
    addBank: '/api/settlement/add-bank',
    deleteBank: '/api/settlement/bank', // append /:id
    accountStatus: '/api/settlement/account-status', // append /:id
    initiate: '/api/settlement/initiate',
    directPayout: '/api/settlement/direct-payout',
    status: '/api/settlement/status',
    history: '/api/settlement/history',
    uploadDocument: '/api/settlement/upload-document',
  },
  dmt: {
    banks: '/api/dmt/banks',
    remitterQuery: '/api/dmt/remitter/query',
    remitterEkyc: '/api/dmt/remitter/ekyc',
    remitterRegister: '/api/dmt/remitter/register',
    beneficiaryFetch: '/api/dmt/beneficiary/fetch',
    beneficiaryAdd: '/api/dmt/beneficiary/add',
    beneficiaryDelete: '/api/dmt/beneficiary/delete',
    transfer: '/api/dmt/transfer',
    history: '/api/dmt/history',
  },
  recharge: {
    operators: '/api/recharge/operators', // append /:type
    browsePlan: '/api/recharge/browse-plan',
    dthInfo: '/api/recharge/dth-info',
    fetchBill: '/api/recharge/fetch-bill',
    doRecharge: '/api/recharge/do-recharge',
    history: '/api/recharge/history',
    balance: '/api/recharge/balance',
    status: '/api/recharge/status', // append /:transid
  },
  upi: {
    merchantStatus: '/api/upi/cashout/merchant-status',
    generateToken: '/api/upi/cashout/generate-token',
    status: '/api/upi/cashout/status',
  },
  pan: {
    // Biometric PSA (PaySprint)
    myPsaStatus: '/api/pan/my-psa-status',
    registerBioPsa: '/api/pan/register-bio-psa',
    buyCoupons: '/api/pan/buy-coupons',
    setPsaId: '/api/pan/set-psa-id',
    syncPsaStatus: '/api/pan/sync-psa-status',
    // Standard PSA (PaySprint)
    myStdPsaStatus: '/api/pan/my-std-psa-status',
    registerStdPsa: '/api/pan/register-std-psa',
    updateStdPsa: '/api/pan/update-std-psa',
    buyStdCoupons: '/api/pan/buy-std-coupons',
    stdPsaPassword: '/api/pan/std-psa-password',
    // eSeva PAN
    esevaApplyService: '/api/pan/eseva/apply-service',
    esevaApplyCoupon: '/api/pan/eseva/apply-coupon',
    esevaServiceStatus: '/api/pan/eseva/service-status',
    esevaCouponStatus: '/api/pan/eseva/coupon-status',
    esevaHistory: '/api/pan/eseva/history',
    esevaMyPsa: '/api/pan/eseva/my-psa',
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
    create: '/api/fund-request/create',
    retailer: '/api/fund-request/retailer',
    distributor: '/api/fund-request/distributor',
    update: '/api/fund-request/update',
    distributorCreate: '/api/fund-request/distributor/create',
    distributorMine: '/api/fund-request/distributor/mine',
    admin: '/api/fund-request/admin',
    adminUpdate: '/api/fund-request/admin/update',
    delete: '/api/fund-request/delete', // append /:id
  },
  distributor: {
    stats: '/api/distributor/stats',
    retailers: '/api/distributor/retailers', // append /:id to update
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