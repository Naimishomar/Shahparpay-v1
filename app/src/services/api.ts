import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '@/constants';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

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
          this.token = await AsyncStorage.getItem('token');
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
        if (error.response?.status === 401) {
          await this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  private async handleUnauthorized() {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    this.token = null;
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
    return this.post(API_ENDPOINTS.auth.refreshToken);
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
  async getAepsServices() {
    return this.get(API_ENDPOINTS.aeps.services);
  }

  async getAepsSettlement(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.aeps.settlement, params);
  }

  async getAepsPipes() {
    return this.get(API_ENDPOINTS.aeps.pipes);
  }

  async getOnboardingPlan(pipe: string) {
    return this.get(`${API_ENDPOINTS.aeps.onboardingPlan}?pipe=${pipe}`);
  }

  // DMT endpoints
  async getDmtServices() {
    return this.get(API_ENDPOINTS.dmt.services);
  }

  async getDmtReport(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.dmt.report, params);
  }

  // Recharge endpoints
  async getRechargeServices() {
    return this.get(API_ENDPOINTS.recharge.services);
  }

  async getRechargeOperators() {
    return this.get(API_ENDPOINTS.recharge.operators);
  }

  // BBPS endpoints
  async getBbpsCategories() {
    return this.get(API_ENDPOINTS.bbps.categories);
  }

  async getBbpsBillers(categoryId: string) {
    return this.get(`${API_ENDPOINTS.bbps.billers}?categoryId=${categoryId}`);
  }

  async fetchBbpsBill(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.bbps.fetchBill, data);
  }

  async payBbpsBill(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.bbps.payBill, data);
  }

  // UPI endpoints
  async getUpiPayments(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.upi.payments, params);
  }

  async getUpiReport(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.upi.report, params);
  }

  // PAN endpoints
  async applyPanCard(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.pan.apply, data);
  }

  async getPanStatus(applicationId: string) {
    return this.get(`${API_ENDPOINTS.pan.status}/${applicationId}`);
  }

  async getPanReport(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.pan.report, params);
  }

  // ITR endpoints
  async fileItr(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.itr.filing, data);
  }

  async getItrReport(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.itr.report, params);
  }

  // Lead Generation endpoints
  async generateLead(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.lead.generate, data);
  }

  async getLeadReport(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.lead.report, params);
  }

  // Fund Request endpoints
  async createFundRequest(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.fundRequest.create, data);
  }

  async getFundRequests(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.fundRequest.list, params);
  }

  async approveFundRequest(requestId: string, action: 'approve' | 'reject', remark?: string) {
    return this.post(`${API_ENDPOINTS.fundRequest.approve}/${requestId}`, { action, remark });
  }

  // Distributor endpoints
  async getDistributorRetailers(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.distributor.retailers, params);
  }

  async createDistributorRetailer(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.distributor.create, data);
  }

  // Admin endpoints
  async getAdminDistributors(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.admin.distributors, params);
  }

  async createAdminUser(data: Record<string, any>) {
    return this.post(API_ENDPOINTS.admin.create, data);
  }

  async getAdminCommissions(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.admin.commissions, params);
  }

  async getAdminFundRequests(params?: Record<string, any>) {
    return this.get(API_ENDPOINTS.admin.fundRequests, params);
  }
}

export const api = new ApiService();
export default api;