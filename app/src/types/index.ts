export type UserRole = 'admin' | 'distributor' | 'retailer';

export interface User {
  id: string;
  _id?: string;
  role: UserRole;
  code?: string;
  retailerId?: string;
  distributorId?: string;
  adminId?: string;
  name: string;
  email: string;
  contactNumber?: string;
  profilePicture?: string;
  isMerchantKycComplete?: boolean;
  activeAepsPipes?: string[];
  aadhaarNumber?: string;
  dob?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isInitializing: boolean;
  login: (token: string, user: User, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  requireOtp?: boolean;
}

export interface WalletBalances {
  aepsBalance: number;
  mainBalance: number;
  adminBalance: number;
}

export interface DashboardStats {
  DMT: number;
  RECHARGE: number;
  AEPS_WITHDRAWAL: number;
  AEPS_SETTLEMENT: number;
  BILL_PAYMENT: number;
  WALLET_TOPUP: number;
  TotalCommission: number;
  TotalCustomers: number;
  TotalTransactionsAmount: number;
}

export interface RecentSale {
  id: string;
  service: string;
  name: string;
  amount: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  date: string;
  details?: string;
}

export interface MenuItem {
  name: string;
  url: string;
  icon: string;
  subItems?: MenuItem[];
}

export interface NavigationParams {
  RetailerStack: {
    Dashboard: undefined;
    AEPS: undefined;
    AepsSettlement: undefined;
    PAN: undefined;
    LeadGeneration: undefined;
    ITR: undefined;
    UPIPayments: undefined;
    DMT: undefined;
    Recharge: undefined;
    BBPS: undefined;
    WalletTransfer: undefined;
    DirectPayout: undefined;
    FundRequest: undefined;
    BiometricSupport: undefined;
    PipeStatus: undefined;
    Profile: undefined;
    KycStatus: undefined;
    Reports: {
      Ledger: undefined;
      Aeps: undefined;
      Dmt: undefined;
      Payout: undefined;
      Upi: undefined;
      Pan: undefined;
      Itr: undefined;
      LeadGeneration: undefined;
      WalletLedger: undefined;
    };
  };
  AdminStack: {
    AdminPortal: undefined;
    Distributors: undefined;
    FundRequests: undefined;
    Create: undefined;
    Commissions: undefined;
    Ledger: undefined;
    Profile: undefined;
  };
  DistributorStack: {
    DistributorPortal: undefined;
    Retailers: undefined;
    FundRequests: undefined;
    Create: undefined;
    Profile: undefined;
  };
  AuthStack: {
    Login: undefined;
    Landing: undefined;
  };
}

export interface DrawerItem {
  label: string;
  icon: string;
  route: string;
  subItems?: DrawerItem[];
}

export interface ScreenProps {
  navigation: any;
  route: any;
}