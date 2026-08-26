import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthState } from '@/types';
import { STORAGE_KEYS } from '@/constants';
import api from '@/services/api';

const AuthContext = createContext<AuthState | undefined>(undefined);

/** How long startup waits for a token refresh before showing the app anyway. */
const BOOT_REFRESH_GRACE_MS = 6000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const loadStoredAuth = useCallback(async () => {
    try {
      const [storedToken, storedUser, storedRefresh] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.token),
        AsyncStorage.getItem(STORAGE_KEYS.user),
        AsyncStorage.getItem(STORAGE_KEYS.refreshToken),
      ]);

      if (!storedToken || !storedUser) return;

      // Restore first so the UI has a session immediately, even offline.
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      api.setToken(storedToken);

      if (!storedRefresh) {
        // Nothing can save this session past the access token's 15 minutes.
        // Surfaced loudly because it means the login response never carried a
        // refreshToken — a server/config problem, not a user error.
        console.warn(
          '[auth] Restored a session with no refresh token. It will end as soon as the access token expires.'
        );
        return;
      }

      // The stored access token is almost certainly expired — it lives 15
      // minutes and a reload is usually much later. Refresh once here, before
      // any screen mounts, instead of letting every screen's first request
      // 401 simultaneously and race the same recovery.
      // Bounded: the request itself allows 30s, which would strand a retailer
      // on the splash screen when the shop's connection is down. After the
      // grace period we carry on with the restored session; the refresh keeps
      // running and the interceptor picks up its result.
      const result = await Promise.race([
        api.ensureFreshToken(),
        new Promise<{ token: string | null; rejected: boolean }>((resolve) =>
          setTimeout(() => resolve({ token: null, rejected: false }), BOOT_REFRESH_GRACE_MS)
        ),
      ]);
      if (result.token) {
        setToken(result.token);
        api.setToken(result.token);
      } else if (result.rejected) {
        console.warn('[auth] Stored refresh token was rejected on startup; signing out.');
        await clearAuthState();
      }
      // Neither branch: the server was unreachable. Keep the restored session
      // and let the interceptor retry when connectivity returns.
    } catch (error) {
      console.error('[auth] Failed to load stored auth:', error);
    } finally {
      setIsInitializing(false);
    }
    // clearAuthState is stable (useCallback with no deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAuthState = useCallback(async () => {
    setToken(null);
    setUser(null);
    await api.clearSession();
  }, []);

  const refreshAuthToken = useCallback(async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.token);
    if (!stored) return; // logged out: nothing to refresh
    try {
      // The backend replies with token/role/user at the top level, not under `data`.
      const response = await api.refreshToken();
      if (response.success && response.token) {
        const refreshedUser = { ...response.user, role: response.role };
        setToken(response.token);
        setUser(refreshedUser);
        api.setToken(response.token);
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.token, response.token),
          AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(refreshedUser)),
        ]);
      } else if (response.success === false) {
        // An explicit refusal from the server ends the session. A network
        // failure throws instead and is handled below.
        console.warn('[auth] Refresh refused:', response.message ?? '(no message)');
        await clearAuthState();
      }
    } catch (error) {
      // Only a rejected refresh token ends the session. Timeouts, DNS failures
      // and 5xx leave it alone — a retailer on patchy mobile data was being
      // logged out mid-shift by a single dropped request.
      const status = (error as any)?.response?.status;
      if (status === 401 || status === 403) {
        console.warn(`[auth] Refresh rejected with ${status}; signing out.`);
        await clearAuthState();
      } else {
        console.warn('Token refresh could not reach the server; keeping session.', status ?? '');
      }
    }
  }, [clearAuthState]);

  useEffect(() => {
    loadStoredAuth();

    // Keeps the axios 401 handler and the React tree in sync.
    api.setUnauthorizedHandler(() => {
      console.warn('[auth] Refresh token rejected by the server; signing out.');
      setToken(null);
      setUser(null);
    });

    // The axios interceptor refreshes silently on a 401; without this the
    // React tree would keep rendering the stale token it captured at login.
    api.setTokenRefreshedHandler((newToken, newUser, role) => {
      setToken(newToken);
      if (newUser) {
        const merged = { ...newUser, role: role ?? newUser.role };
        setUser(merged);
        AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(merged)).catch(() => {});
      }
    });

    // Access tokens live 15 minutes. Refreshing every 10 covers a foregrounded
    // app, but JS timers are throttled or suspended in the background — and
    // this app is backgrounded on every fingerprint capture, since the RD
    // Service runs as a separate activity. So the foreground transition is the
    // signal that actually matters; the interval is just a backstop.
    const refreshIfStale = () => {
      refreshAuthToken();
    };

    const intervalId = setInterval(refreshIfStale, 600000);
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshIfStale();
    });

    return () => {
      api.setUnauthorizedHandler(null);
      api.setTokenRefreshedHandler(null);
      clearInterval(intervalId);
      appStateSub.remove();
    };
  }, [loadStoredAuth, refreshAuthToken]);

  const login = async (newToken: string, newUser: User, newRefreshToken?: string) => {
    if (!newRefreshToken) {
      console.warn(
        '[auth] Login returned no refreshToken — this session cannot outlive the 15-minute access token.'
      );
    }
    setToken(newToken);
    setUser(newUser);
    api.setToken(newToken);
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.token, newToken),
      AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(newUser)),
      newRefreshToken
        ? AsyncStorage.setItem(STORAGE_KEYS.refreshToken, newRefreshToken)
        : Promise.resolve(),
    ]);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout API failed:', error);
    }
    await clearAuthState();
  };

  const checkSession = refreshAuthToken;

  return (
    <AuthContext.Provider value={{ user, token, isInitializing, login, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};