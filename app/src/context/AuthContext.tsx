import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthState } from '@/types';
import { STORAGE_KEYS } from '@/constants';
import api from '@/services/api';

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const loadStoredAuth = useCallback(async () => {
    try {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.token),
        AsyncStorage.getItem(STORAGE_KEYS.user),
      ]);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        api.setToken(storedToken);
      }
    } catch (error) {
      console.error('Failed to load stored auth:', error);
    } finally {
      setIsInitializing(false);
    }
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
      } else {
        await clearAuthState();
      }
    } catch (error) {
      // A 401 means the refresh token is gone or expired: drop back to login.
      if ((error as any)?.response?.status === 401) {
        await clearAuthState();
      } else {
        console.error('Session restoration failed:', error);
      }
    }
  }, [clearAuthState]);

  useEffect(() => {
    loadStoredAuth();

    // Keeps the axios 401 handler and the React tree in sync.
    api.setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });

    const intervalId = setInterval(() => {
      refreshAuthToken();
    }, 600000);

    return () => {
      api.setUnauthorizedHandler(null);
      clearInterval(intervalId);
    };
  }, [loadStoredAuth, refreshAuthToken]);

  const login = async (newToken: string, newUser: User, newRefreshToken?: string) => {
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