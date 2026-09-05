import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { API_ENDPOINTS, STORAGE_KEYS } from '@/constants';

// On a device or emulator "localhost" is the device itself, not the dev
// machine, so fall back to whichever host is serving the Metro bundle.
const resolveBaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  // Metro's host, so a dev build on a device reaches the laptop running the
  // API rather than the device's own loopback.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:3000`;

  // No env var and no Metro host means a standalone build shipped without
  // EXPO_PUBLIC_BACKEND_URL — every request then goes to the handset's own
  // loopback and fails as "could not reach the server". Say so, loudly:
  // silently pointing at localhost is how it shipped that way once already.
  if (!__DEV__) {
    console.error(
      '[api] EXPO_PUBLIC_BACKEND_URL is missing from this build. ' +
        'Set it in eas.json under build.<profile>.env — a gitignored .env ' +
        'never reaches the EAS build.'
    );
  }
  return 'http://localhost:3000';
};

export const BASE_URL = resolveBaseUrl();

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

interface RefreshResult {
  token: string | null;
  /** The server refused the refresh token — the session is over. */
  rejected: boolean;
}

type TokenRefreshedHandler = (token: string, user?: any, role?: string) => void;

/**
 * How long a GET response stays reusable, per endpoint. Only what is listed
 * here is cached — anything absent always hits the network, so a new endpoint
 * can never become quietly stale by default.
 *
 * TTLs are set by how fast the data actually moves, not by convenience:
 * reference lists barely change in a day; balances must not lag a transaction.
 * Every mutation clears the whole cache regardless (see `invalidateCache`), so
 * these ceilings only apply to idle browsing.
 */
const MINUTE = 60_000;
const CACHE_TTL: Record<string, number> = {
  // Reference data: PaySprint caches the bank list server-side for 24h.
  [API_ENDPOINTS.aeps.banks]: 60 * MINUTE,
  [API_ENDPOINTS.recharge.operators]: 60 * MINUTE,
  // Onboarding state changes only through flows that mutate and thus flush.
  [API_ENDPOINTS.aeps.merchantStatus]: 2 * MINUTE,
  [API_ENDPOINTS.aeps.pipesVerify]: 5 * MINUTE,
  [API_ENDPOINTS.pan.myPsaStatus]: 5 * MINUTE,
  [API_ENDPOINTS.pan.myStdPsaStatus]: 5 * MINUTE,
  // Money: short enough that a stale read is never how a retailer finds out.
  [API_ENDPOINTS.wallet.balance]: 20_000,
  [API_ENDPOINTS.dashboard.retailer]: MINUTE,
  [API_ENDPOINTS.dashboard.recentTransactions]: 30_000,
  [API_ENDPOINTS.settlement.savedBanks]: 5 * MINUTE,
  [API_ENDPOINTS.distributor.retailers]: MINUTE,
  [API_ENDPOINTS.distributor.stats]: MINUTE,
  [API_ENDPOINTS.admin.stats]: MINUTE,
  [API_ENDPOINTS.admin.distributors]: MINUTE,
};

/** The TTL for a URL, matching on prefix so `/status/:id` inherits `/status`. */
export const cacheTtlFor = (url: string): number => {
  if (CACHE_TTL[url] !== undefined) return CACHE_TTL[url];
  for (const [path, ttl] of Object.entries(CACHE_TTL)) {
    if (url.startsWith(`${path}/`)) return ttl;
  }
  return 0;
};

/** Endpoints that legitimately answer 401 while logged out. */
const PUBLIC_AUTH_PATHS = [
  API_ENDPOINTS.auth.login,
  API_ENDPOINTS.auth.verifyOtp,
  API_ENDPOINTS.auth.refreshToken,
  API_ENDPOINTS.auth.sendVerificationOtp,
  API_ENDPOINTS.auth.verifyEmailOtp,
];

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;
  private refreshPromise: Promise<RefreshResult> | null = null;
  private onUnauthorized: (() => void) | null = null;
  private onTokenRefreshed: TokenRefreshedHandler | null = null;
  private cache = new Map<string, { data: any; at: number }>();
  private inFlight = new Map<string, Promise<any>>();

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        // PaySprint wants accessmode APP for Android-captured biometrics and
        // SITE for the web dashboard. The backend reads this header to decide;
        // without it every AEPS/eKYC call from the app is sent as SITE.
        'X-Client': 'APP',
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

        // Only the genuinely public endpoints are exempt. `/api/auth/` also
        // hosts authenticated routes (update-profile, change-password,
        // paysprint/*, create-retailer); excluding the whole prefix meant an
        // expired token failed those outright instead of refreshing.
        const isPublicAuthCall = PUBLIC_AUTH_PATHS.some((path) => original?.url?.startsWith(path));

        // Access tokens live 15 minutes; refresh once and replay the request
        // instead of dumping the user back on the login screen.
        if (error.response?.status === 401 && original && !original._retry && !isPublicAuthCall) {
          original._retry = true;
          const result = await this.refreshAccessToken();
          if (result.token) {
            original.headers.Authorization = `Bearer ${result.token}`;
            return this.client(original);
          }
          // Only a server that actually rejected the refresh token ends the
          // session. A timeout or a dropped connection leaves it intact — on a
          // flaky connection the old code logged the retailer out mid-shift.
          if (result.rejected) await this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * `rejected` means the server refused the refresh token (or there isn't
   * one), so the session is genuinely over. Anything else — timeout, DNS,
   * offline, 5xx — leaves `rejected` false and the session untouched.
   */
  private refreshAccessToken(): Promise<RefreshResult> {
    if (!this.refreshPromise) {
      this.refreshPromise = (async (): Promise<RefreshResult> => {
        const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
        if (!refreshToken) return { token: null, rejected: true };
        try {
          // Raw axios: going through this.client would recurse on a 401.
          const { data } = await axios.post(
            `${BASE_URL}${API_ENDPOINTS.auth.refreshToken}`,
            { refreshToken },
            { timeout: 30000 }
          );
          if (!data?.success || !data?.token) return { token: null, rejected: true };
          this.token = data.token;
          await AsyncStorage.setItem(STORAGE_KEYS.token, data.token);
          this.onTokenRefreshed?.(data.token, data.user, data.role);
          return { token: data.token as string, rejected: false };
        } catch (error) {
          const status = (error as AxiosError)?.response?.status;
          // 401/403 = the refresh token is dead. No status at all = we never
          // reached the server, so we cannot conclude anything about it.
          return { token: null, rejected: status === 401 || status === 403 };
        }
      })().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  /** Proactive refresh, used when the app returns to the foreground. */
  async ensureFreshToken(): Promise<RefreshResult> {
    return this.refreshAccessToken();
  }

  setTokenRefreshedHandler(handler: TokenRefreshedHandler | null) {
    this.onTokenRefreshed = handler;
  }

  private async handleUnauthorized() {
    await this.clearSession();
    this.onUnauthorized?.();
  }

  async clearSession() {
    this.token = null;
    this.invalidateCache();
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

  /**
   * GET with a short-lived response cache.
   *
   * Two screens asking for the wallet balance at the same moment share one
   * request, and revisiting a screen inside its TTL costs nothing — which is
   * the common case, since every screen refetches on mount.
   */
  async get<T = any>(url: string, params?: Record<string, any>) {
    const ttl = cacheTtlFor(url);
    if (!ttl) return (await this.client.get<T>(url, { params })).data;

    const key = `${url}?${JSON.stringify(params ?? {})}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.data as T;

    // Coalesce: a second caller during the first request awaits the same
    // promise instead of opening its own connection.
    const inFlight = this.inFlight.get(key);
    if (inFlight) return inFlight as Promise<T>;

    const request = this.client
      .get<T>(url, { params })
      .then((response) => {
        this.cache.set(key, { data: response.data, at: Date.now() });
        return response.data;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, request);
    return request;
  }

  /**
   * Drops every cached response. Called after any mutation and by
   * pull-to-refresh — once money has moved, nothing cached is trustworthy,
   * and picking which entries to expire would be guesswork.
   */
  invalidateCache() {
    this.cache.clear();
    this.inFlight.clear();
  }

  async post<T = any>(url: string, data?: Record<string, any>) {
    this.invalidateCache();
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T = any>(url: string, data?: Record<string, any>) {
    this.invalidateCache();
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async patch<T = any>(url: string, data?: Record<string, any>) {
    this.invalidateCache();
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async delete<T = any>(url: string) {
    this.invalidateCache();
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
    this.invalidateCache();
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
    this.invalidateCache();
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

  /** Signup-time email check used when onboarding a retailer or distributor. */
  async sendVerificationOtp(email: string, name?: string) {
    return this.post(API_ENDPOINTS.auth.sendVerificationOtp, { email, name });
  }

  async verifyEmailOtp(email: string, otp: string) {
    return this.post(API_ENDPOINTS.auth.verifyEmailOtp, { email, otp });
  }

  async getPaysprintOnboardUrl(merchantId: string, isNew: boolean, pipe?: string, callbackUrl?: string) {
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

  /**
   * Same endpoint as updateProfile, but multipart so the profile photo can
   * ride along. `address` is nested, and multer flattens form fields, so it
   * goes over as JSON — the controller parses it back.
   */
  async updateProfileWithPhoto(
    data: Record<string, any>,
    profilePicture?: { uri: string; name: string; type: string }
  ) {
    const { address, ...rest } = data;
    return this.putForm(
      API_ENDPOINTS.auth.updateProfile,
      { ...rest, ...(address ? { address: JSON.stringify(address) } : {}) },
      { profilePicture }
    );
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
    type?: string;
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

  /** Replaces the wallet PIN. Gated on the OTP from `sendPasswordOtp`, not the old PIN. */
  async changeWalletPin(data: { otp: string; newPin: string }) {
    return this.post(API_ENDPOINTS.wallet.changePin, data);
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