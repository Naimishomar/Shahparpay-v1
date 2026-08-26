import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { API_ENDPOINTS, STORAGE_KEYS } from '@/constants';

// On a device or emulator "localhost" is the device itself, not the dev
// machine, so fall back to whichever host is serving the Metro bundle.
const resolveBaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:3000` : 'http://localhost:3000';
};

export const BASE_URL = resolveBaseUrl();

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private onUnauthorized: (() => void) | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        if (!this.token) {
          this.token = await AsyncStorage.getItem(STORAGE_KEYS.token);
        }
        if (this.token && config.headers) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const original = error.config as RetriableConfig | undefined;
        const isAuthCall = original?.url?.startsWith('/api/auth/');

        // Access tokens live 15 minutes; refresh once and replay the request
        // instead of dumping the user back on the login screen.
        if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
          original._retry = true;
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            original.headers.Authorization = `Bearer ${refreshed}`;
            return this.client(original);
          }
          await this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  private refreshAccessToken(): Promise<string | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
        if (!refreshToken) return null;
        try {
          // Raw axios: going through this.client would recurse on a 401.
          const { data } = await axios.post(
            `${BASE_URL}${API_ENDPOINTS.auth.refreshToken}`,
            { refreshToken },
            { timeout: 30000 }
          );
          if (!data?.success || !data?.token) return null;
          this.token = data.token;
          await AsyncStorage.setItem(STORAGE_KEYS.token, data.token);
          return data.token as string;
        } catch {
          return null;
        }
      })().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async handleUnauthorized() {
    await this.clearSession();
    this.onUnauthorized?.();
  }

  async clearSession() {
    this.token = null;
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.token,
      STORAGE_KEYS.refreshToken,
      STORAGE_KEYS.user,
    ]);
  }

  setUnauthorizedHandler(handler: (() => void) | null) {
    this.onUnauthorized = handler;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  async get<T = any>(url: string, params?: Record<string, any>) {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T = any>(url: string, data?: Record<string, any>) {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T = any>(url: string, data?: Record<string, any>) {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async patch<T = any>(url: string, data?: Record<string, any>) {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async delete<T = any>(url: string) {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  /**
   * Multipart POST for the endpoints behind multer (fund-request slips,
   * profile pictures, KYC documents). React Native's FormData takes
   * {uri, name, type} for files; axios must not set its own boundary, so the
   * Content-Type header is removed and left to the runtime.
   */
  async postForm<T = any>(
    url: string,
    fields: Record<string, any>,
    files?: Record<string, { uri: string; name: string; type: string } | undefined>
  ) {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.append(key, String(value));
    });
    Object.entries(files ?? {}).forEach(([key, file]) => {
      if (file) form.append(key, file as any);
    });
    const response = await this.client.post<T>(url, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    });
    return response.data;
  }

  async putForm<T = any>(
    url: string,
    fields: Record<string, any>,
    files?: Record<string, { uri: string; name: string; type: string } | undefined>
  ) {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.append(key, String(value));
    });
    Object.entries(files ?? {}).forEach(([key, file]) => {
      if (file) form.append(key, file as any);
    });
    const response = await this.client.put<T>(url, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    });
    return response.data;
  }

  // Auth endpoints
  async login(identifier: string, password: string) {
    return this.post(API_ENDPOINTS.auth.login, { identifier, password });
  }

  async verifyOtp(identifier: string, otp: string) {
    return this.post(API_ENDPOINTS.auth.verifyOtp, { identifier, otp });
  }

  async logout() {
    return this.post(API_ENDPOINTS.auth.logout);
  }

  async refreshToken() {
    const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
    return this.post(API_ENDPOINTS.auth.refreshToken, refreshToken ? { refreshToken } : undefined);
  }

  async getPaysprintOnboardUrl(merchantId: string, isNew: boolean, pipe: string, callbackUrl: string) {
    return this.post(API_ENDPOINTS.auth.paysprintOnboardUrl, { merchantId, isNew, pipe, callbackUrl });
  }

  // Wallet endpoints
  async getWalletBalance() {
    return this.get(API_ENDPOINTS.wallet.balance);
  }

  // Dashboard endpoints
  async getRetailerDashboard(params?: { startDate?: string; endDate?: string }) {
    return this.get(API_ENDPOINTS.dashboard.retailer, params);
  }

  async updateProfile(data: Record<string, any>) {
    return this.put(API_ENDPOINTS.auth.updateProfile, data);
  }

  /** Password change is OTP-gated: request the code, then submit it. */
  async sendPasswordOtp() {
    return this.post(API_ENDPOINTS.auth.sendPasswordOtp);
  }

  async changePassword(data: { email: string; otp: string; newPassword: string }) {
    return this.put(API_ENDPOINTS.auth.changePassword, data);
  }

  async updateKycStatus(jwt: string) {
    return this.post(API_ENDPOINTS.auth.paysprintUpdateKyc, { jwt });
  }

  // ---------------------------------------------------------------- AEPS
  async getAepsBanks() {
    return this.get(API_ENDPOINTS.aeps.banks);
  }

  /** merchantcode is optional: the backend falls back to the caller. */
  async getAepsMerchantStatus(params?: {
    merchantcode?: string;
    pipe?: string;
    forceRefresh?: boolean;
  }) {
    return this.get(API_ENDPOINTS.aeps.merchantStatus, params);
  }

  async verifyAepsPipes() {
    return this.get(API_ENDPOINTS.aeps.pipesVerify);
  }

  async getOnboardingPlan(pipe: string) {
    return this.get(API_ENDPOINTS.aeps.onboardingPlan, { pipe });
  }

  async getPidOptions(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.aeps.pidOptions, data);
  }

  async aepsBalanceEnquiry(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.aeps.balanceEnquiry, data);
  }

  /** Withdrawals above the OTP threshold need this first. */
  async aepsInitiateOtp(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.aeps.initiateOtp, data);
  }

  async aepsCashWithdrawal(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.aeps.cashWithdrawal, data);
  }

  async aepsCashDeposit(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.aeps.cashDeposit, data);
  }

  async aepsAadhaarPay(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.aeps.aadhaarPay, data);
  }

  async aepsMiniStatement(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.aeps.miniStatement, data);
  }

  async aepsTxnStatus(reference: string) {
    return this.post(API_ENDPOINTS.aeps.txnStatus, { reference });
  }

  async aepsKycSendOtp(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.aeps.kycSendOtp, data);
  }

  async aepsKycResendOtp(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.aeps.kycResendOtp, data);
  }

  async aepsKycVerifyOtp(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.aeps.kycVerifyOtp, data);
  }

  async aepsActivateMerchant(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.aeps.kycActivate, data);
  }

  async aepsDailyAuth(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.aeps.dailyAuth, data);
  }

  // ---------------------------------------------------- Settlement / payout
  async getSettlementHistory(params?: { type?: string }) {
    return this.get(API_ENDPOINTS.settlement.history, params);
  }

  async getSavedBanks() {
    return this.get(API_ENDPOINTS.settlement.savedBanks);
  }

  async syncSavedBanks() {
    return this.get(API_ENDPOINTS.settlement.syncBanks);
  }

  async addSettlementBank(data: {
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    accountHolderName: string;
    accountType?: string;
  }) {
    return this.post(API_ENDPOINTS.settlement.addBank, data);
  }

  async deleteSettlementBank(id: string) {
    return this.delete(`${API_ENDPOINTS.settlement.deleteBank}/${id}`);
  }

  async getSettlementAccountStatus(id: string) {
    return this.get(`${API_ENDPOINTS.settlement.accountStatus}/${id}`);
  }

  async initiateSettlement(data: { bankId: string; amount: number; pin: string; mode?: string }) {
    return this.post(API_ENDPOINTS.settlement.initiate, data);
  }

  async initiateDirectPayout(data: {
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
    bankName?: string;
    amount: number;
    pin: string;
    mode?: string;
  }) {
    return this.post(API_ENDPOINTS.settlement.directPayout, data);
  }

  async checkSettlementStatus(transactionId: string) {
    return this.post(API_ENDPOINTS.settlement.status, { transactionId });
  }

  // ----------------------------------------------------------------- DMT
  async getDmtBanks() {
    return this.post(API_ENDPOINTS.dmt.banks);
  }

  async queryDmtRemitter(mobile: string) {
    return this.post(API_ENDPOINTS.dmt.remitterQuery, { mobile });
  }

  async dmtRemitterEkyc(data: {
    mobile: string;
    aadhaar_number: string;
    pidData: any;
    lat?: string;
    long?: string;
  }) {
    return this.post(API_ENDPOINTS.dmt.remitterEkyc, data);
  }

  async registerDmtRemitter(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.dmt.remitterRegister, data);
  }

  async fetchDmtBeneficiaries(mobile: string) {
    return this.post(API_ENDPOINTS.dmt.beneficiaryFetch, { mobile });
  }

  async addDmtBeneficiary(data: {
    mobile: string;
    bankid: string | number;
    benename: string;
    beneaccount: string;
    ifsc: string;
    pincode: string;
  }) {
    return this.post(API_ENDPOINTS.dmt.beneficiaryAdd, data);
  }

  async deleteDmtBeneficiary(data: { mobile: string; beneid: string }) {
    return this.post(API_ENDPOINTS.dmt.beneficiaryDelete, data);
  }

  async transferDmt(data: {
    mobile: string;
    beneid: string;
    amount: number;
    beneaccount: string;
    ifsc: string;
    pin: string;
  }) {
    return this.post(API_ENDPOINTS.dmt.transfer, data);
  }

  async getDmtHistory() {
    return this.get(API_ENDPOINTS.dmt.history);
  }

  // ------------------------------------------------- Recharge / BBPS
  async getRechargeOperators(type: string) {
    return this.get(`${API_ENDPOINTS.recharge.operators}/${type}`);
  }

  async browseRechargePlans(data: {
    mobileNumber: string;
    operator: string;
    operatorName?: string;
    circle?: string;
  }) {
    return this.post(API_ENDPOINTS.recharge.browsePlan, data);
  }

  async getDthInfo(data: { dthNumber: string; operator: string; operatorName?: string }) {
    return this.post(API_ENDPOINTS.recharge.dthInfo, data);
  }

  async fetchBill(data: {
    caNumber: string;
    operator: string;
    ad1?: string;
    ad2?: string;
    ad3?: string;
  }) {
    return this.post(API_ENDPOINTS.recharge.fetchBill, data);
  }

  async doRecharge(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.recharge.doRecharge, data);
  }

  async getRechargeHistory() {
    return this.get(API_ENDPOINTS.recharge.history);
  }

  async getRechargeStatus(transid: string) {
    return this.get(`${API_ENDPOINTS.recharge.status}/${transid}`);
  }

  // ----------------------------------------------------------------- UPI
  async getUpiMerchantStatus() {
    return this.get(API_ENDPOINTS.upi.merchantStatus);
  }

  async generateUpiToken(data: { mobile: string; amount: number; redirectUrl?: string }) {
    return this.post(API_ENDPOINTS.upi.generateToken, data);
  }

  async getUpiTxnStatus(data: { transactionId?: string; refid?: string }) {
    return this.post(API_ENDPOINTS.upi.status, data);
  }

  // ----------------------------------------------------------------- PAN
  async getMyPsaStatus() {
    return this.get(API_ENDPOINTS.pan.myPsaStatus);
  }

  async registerBioPsa(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.pan.registerBioPsa, data);
  }

  async buyPanCoupons(data: { psa_id: string; amount: number }) {
    return this.post(API_ENDPOINTS.pan.buyCoupons, data);
  }

  async setPsaId(psa_id: string) {
    return this.patch(API_ENDPOINTS.pan.setPsaId, { psa_id });
  }

  async syncPsaStatus(data: { psa_id: string; status: string }) {
    return this.patch(API_ENDPOINTS.pan.syncPsaStatus, data);
  }

  async getMyStdPsaStatus() {
    return this.get(API_ENDPOINTS.pan.myStdPsaStatus);
  }

  async registerStdPsa(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.pan.registerStdPsa, data);
  }

  async updateStdPsa(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.pan.updateStdPsa, data);
  }

  async buyStdPanCoupons(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.pan.buyStdCoupons, data);
  }

  async getStdPsaPassword() {
    return this.get(API_ENDPOINTS.pan.stdPsaPassword);
  }

  async applyPanService(data: {
    pan_number: string;
    shop_name: string;
    shop_address: string;
    state_name: string;
    district_name: string;
    pincode: string;
  }) {
    return this.post(API_ENDPOINTS.pan.esevaApplyService, data);
  }

  async applyPanCoupon(data: {
    psa_id: string;
    number_of_coupons: number;
    pan_agency_name: string;
  }) {
    return this.post(API_ENDPOINTS.pan.esevaApplyCoupon, data);
  }

  async getPanServiceStatus(application_number: string) {
    return this.post(API_ENDPOINTS.pan.esevaServiceStatus, { application_number });
  }

  async getPanCouponStatus(application_number: string) {
    return this.post(API_ENDPOINTS.pan.esevaCouponStatus, { application_number });
  }

  async getPanHistory() {
    return this.get(API_ENDPOINTS.pan.esevaHistory);
  }

  async getMyPsaId() {
    return this.get(API_ENDPOINTS.pan.esevaMyPsa);
  }

  // ----------------------------------------------------------------- ITR
  async launchItr() {
    return this.post(API_ENDPOINTS.itr.launch);
  }

  async getItrHistory() {
    return this.get(API_ENDPOINTS.itr.history);
  }

  // ------------------------------------------------------- Lead generation
  async generateLead(data: {
    name: string;
    mobile_no: string;
    email?: string;
    product: string;
    pincode: string;
    state: string;
  }) {
    return this.post(API_ENDPOINTS.lead.generate, data);
  }

  async getLeadStatus(refid: string) {
    return this.get(`${API_ENDPOINTS.lead.status}/${refid}`);
  }

  async getLeadHistory() {
    return this.get(API_ENDPOINTS.lead.history);
  }

  // -------------------------------------------------------- Fund requests
  /** Multipart: the deposit slip is an optional image. */
  async createFundRequest(
    data: {
      transactionMode: string;
      amount: number;
      bankUtr: string;
      depositDate: string;
      remarks?: string;
    },
    depositSlip?: { uri: string; name: string; type: string }
  ) {
    return this.postForm(API_ENDPOINTS.fundRequest.create, data, { depositSlip });
  }

  async getRetailerFundRequests() {
    return this.get(API_ENDPOINTS.fundRequest.retailer);
  }

  async getDistributorFundRequests() {
    return this.get(API_ENDPOINTS.fundRequest.distributor);
  }

  async updateFundRequest(data: { requestId: string; status: string; adminRemarks?: string }) {
    return this.put(API_ENDPOINTS.fundRequest.update, data);
  }

  async createDistributorFundRequest(
    data: Record<string, any>,
    depositSlip?: { uri: string; name: string; type: string }
  ) {
    return this.postForm(API_ENDPOINTS.fundRequest.distributorCreate, data, { depositSlip });
  }

  async getDistributorOwnFundRequests() {
    return this.get(API_ENDPOINTS.fundRequest.distributorMine);
  }

  async getAdminFundRequests() {
    return this.get(API_ENDPOINTS.fundRequest.admin);
  }

  async updateAdminFundRequest(data: { requestId: string; status: string; adminRemarks?: string }) {
    return this.put(API_ENDPOINTS.fundRequest.adminUpdate, data);
  }

  async deleteFundRequest(id: string) {
    return this.delete(`${API_ENDPOINTS.fundRequest.delete}/${id}`);
  }

  // -------------------------------------------------------------- Wallet
  async setWalletPin(pin: string) {
    return this.post(API_ENDPOINTS.wallet.setPin, { pin });
  }

  async transferAepsToMain(data: { amount: number; pin: string }) {
    return this.post(API_ENDPOINTS.wallet.transfer, data);
  }

  async getWalletHistory() {
    return this.get(API_ENDPOINTS.wallet.history);
  }

  async getWalletLedger(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.wallet.ledger, params);
  }

  async getPaysprintCreditLedger(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.paysprintLedger.creditLedger, params);
  }

  // ----------------------------------------------------------- Reporting
  async getRecentTransactions(params?: {
    type?: string;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) {
    return this.get(API_ENDPOINTS.dashboard.recentTransactions, params);
  }

  // --------------------------------------------------------- Distributor
  async getDistributorStats() {
    return this.get(API_ENDPOINTS.distributor.stats);
  }

  async getDistributorRetailers() {
    return this.get(API_ENDPOINTS.distributor.retailers);
  }

  async getDistributorProfile() {
    return this.get(API_ENDPOINTS.distributor.profile);
  }

  async updateRetailer(id: string, data: Record<string, any>) {
    return this.put(`${API_ENDPOINTS.distributor.retailers}/${id}`, data);
  }

  async createRetailer(
    data: Record<string, any>,
    files?: Record<string, { uri: string; name: string; type: string } | undefined>
  ) {
    return this.postForm(API_ENDPOINTS.auth.createRetailer, data, files);
  }

  // --------------------------------------------------------------- Admin
  async getAdminStats() {
    return this.get(API_ENDPOINTS.admin.stats);
  }

  async getAdminDistributors() {
    return this.get(API_ENDPOINTS.admin.distributors);
  }

  async getAdminProfile() {
    return this.get(API_ENDPOINTS.admin.profile);
  }

  async getAdminRecentTransactions(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.admin.recentTransactions, params);
  }

  async getGlobalSettings() {
    return this.get(API_ENDPOINTS.admin.settings);
  }

  async updateGlobalSettings(data: Record<string, any>) {
    return this.put(API_ENDPOINTS.admin.settings, data);
  }

  async createDistributor(
    data: Record<string, any>,
    files?: Record<string, { uri: string; name: string; type: string } | undefined>
  ) {
    return this.postForm(API_ENDPOINTS.auth.createDistributor, data, files);
  }
}

export const api = new ApiService();
export default api;