import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthState } from '@/types';
import api from '@/services/api';

const AuthContext = createContext<AuthState | undefined>(undefined);

const STORAGE_KEYS = {
  token: 'token',
  user: 'user',
};

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

  const refreshAuthToken = useCallback(async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.token);
    if (!stored) return; // logged out: nothing to refresh
    try {
      const response = await api.refreshToken();
      if (response.success) {
        const refreshedUser = { ...response.data.user, role: response.data.role };
        setToken(response.data.token);
        setUser(refreshedUser);
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.token, response.data.token),
          AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(refreshedUser)),
        ]);
        api.setToken(response.data.token);
      } else {
        await logout();
      }
    } catch (error) {
      console.error('Session restoration failed:', error);
    }
  }, []);

  useEffect(() => {
    loadStoredAuth();

    const intervalId = setInterval(() => {
      refreshAuthToken();
    }, 600000);

    return () => clearInterval(intervalId);
  }, [loadStoredAuth, refreshAuthToken]);

  const login = async (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    api.setToken(newToken);
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.token, newToken),
      AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(newUser)),
    ]);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout API failed:', error);
    }
    setToken(null);
    setUser(null);
    api.setToken(null);
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.token),
      AsyncStorage.removeItem(STORAGE_KEYS.user),
    ]);
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