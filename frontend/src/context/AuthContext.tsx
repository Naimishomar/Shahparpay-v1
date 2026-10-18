import React, { createContext, useContext, useState, useEffect } from 'react';

type UserRole = 'admin' | 'distributor' | 'retailer';

interface User {
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
    /** Services this retailer's distributor has switched off. */
    disabledServices?: string[];
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isInitializing: boolean;
    login: (token: string, user: User, refreshToken?: string) => void;
    logout: () => void;
    checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Milliseconds until the stored access token expires; 0 when absent or unreadable. */
const accessTokenMsLeft = () => {
    try {
        const token = localStorage.getItem('token');
        if (!token) return 0;
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return typeof payload.exp === 'number' ? payload.exp * 1000 - Date.now() : 0;
    } catch {
        return 0;
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
    const [isInitializing, setIsInitializing] = useState(false);

    const refreshAuthToken = async () => {
        // No stored session means nothing to refresh; skip the guaranteed 401 for visitors.
        if (!localStorage.getItem('token')) return;
        try {
            // The site (shahparpay.in) and the API (api.shahparpay.com) are different
            // sites, so the refresh cookie is third-party and Safari, Brave and
            // incognito Chrome never send it. The body copy is what survives that.
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/refresh-token`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') || undefined }),
            });
            // Only a refused session ends it; a 5xx or a deploy restart is not a logout.
            if (res.status !== 401 && res.status !== 403 && !res.ok) return;
            const data = await res.json();
            if (data.success) {
                const refreshedUser = { ...data.user, role: data.role };
                setToken(data.token);
                setUser(refreshedUser);
                localStorage.setItem('token', data.token);
                if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
                localStorage.setItem('user', JSON.stringify(refreshedUser));
            } else {
                // If refresh fails, log out completely
                setToken(null);
                setUser(null);
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
            }
        } catch (error) {
            console.error("Session restoration failed:", error);
            // Do not log the user out on network errors
        } finally {
            setIsInitializing(false);
        }
    };

    useEffect(() => {
        // Refresh only when the access token is about to expire (it carries its
        // own `exp`), not on every page load. The 1-minute check is local; a
        // hidden tab makes no calls and catches up when it becomes visible.
        const maybeRefresh = () => {
            if (document.visibilityState !== 'visible') return;
            if (accessTokenMsLeft() > 5 * 60000) return;
            refreshAuthToken();
        };
        maybeRefresh();
        const intervalId = setInterval(maybeRefresh, 60000);
        document.addEventListener('visibilitychange', maybeRefresh);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', maybeRefresh);
        };
    }, []);

    const login = (newToken: string, newUser: User, refreshToken?: string) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(newUser));
    };

    const logout = async () => {
        try {
            await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/logout`, { 
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include' 
            });
        } catch (e) {
            console.error("Logout API failed", e);
        }
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider value={{ user, token, isInitializing, login, logout, checkSession: refreshAuthToken }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};
