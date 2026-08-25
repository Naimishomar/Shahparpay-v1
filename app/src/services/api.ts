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

  async transferWallet(data: { amount: number; toUserId: string; type: string }) {
    return this.post(API_ENDPOINTS.wallet.transfer, data);
  }

  async getWalletLedger(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.wallet.ledger, params);
  }

  // Dashboard endpoints
  async getRetailerDashboard(params?: { startDate?: string; endDate?: string }) {
    return this.get(API_ENDPOINTS.dashboard.retailer, params);
  }

  // AEPS endpoints
  async getAepsBanks() {
    return this.get(API_ENDPOINTS.aeps.banks);
  }

  async getAepsMerchantStatus() {
    return this.get(API_ENDPOINTS.aeps.merchantStatus);
  }

  async verifyAepsPipes() {
    return this.get(API_ENDPOINTS.aeps.pipesVerify);
  }

  async getOnboardingPlan(pipe: string) {
    return this.get(API_ENDPOINTS.aeps.onboardingPlan, { pipe });
  }

  // Settlement / payout endpoints
  async getSettlementHistory(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.settlement.history, params);
  }

  async getSavedBanks() {
    return this.get(API_ENDPOINTS.settlement.savedBanks);
  }

  async initiateSettlement(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.settlement.initiate, data);
  }

  async directPayout(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.settlement.directPayout, data);
  }

  // DMT endpoints
  async getDmtBanks(data?: Record<string, any>) {
    return this.post(API_ENDPOINTS.dmt.banks, data);
  }

  async getDmtHistory(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.dmt.history, params);
  }

  // Recharge / BBPS endpoints (BBPS bill pay runs through the recharge routes)
  async getRechargeOperators(type: string) {
    return this.get(`${API_ENDPOINTS.recharge.operators}/${type}`);
  }

  async fetchBill(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.recharge.fetchBill, data);
  }

  async doRecharge(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.recharge.doRecharge, data);
  }

  async getRechargeHistory(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.recharge.history, params);
  }

  // UPI endpoints
  async getUpiMerchantStatus() {
    return this.get(API_ENDPOINTS.upi.merchantStatus);
  }

  async generateUpiToken(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.upi.generateToken, data);
  }

  // PAN endpoints
  async applyPanService(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.pan.esevaApplyService, data);
  }

  async getPanHistory(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.pan.esevaHistory, params);
  }

  // ITR endpoints
  async launchItr(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.itr.launch, data);
  }

  async getItrHistory(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.itr.history, params);
  }

  // Lead Generation endpoints
  async generateLead(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.lead.generate, data);
  }

  async getLeadHistory(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.lead.history, params);
  }

  // Fund Request endpoints
  async getRetailerFundRequests(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.fundRequest.retailer, params);
  }

  async getDistributorFundRequests(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.fundRequest.distributor, params);
  }

  async updateFundRequest(data: Record<string, any>) {
    return this.put(API_ENDPOINTS.fundRequest.update, data);
  }

  // Distributor endpoints
  async getDistributorStats() {
    return this.get(API_ENDPOINTS.distributor.stats);
  }

  async getDistributorRetailers(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.distributor.retailers, params);
  }

  // Admin endpoints
  async getAdminStats() {
    return this.get(API_ENDPOINTS.admin.stats);
  }

  async getAdminDistributors(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.admin.distributors, params);
  }

  async getAdminFundRequests(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.fundRequest.admin, params);
  }
}

export const api = new ApiService();
export default api;