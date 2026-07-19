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
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isInitializing: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
    checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
    const [isInitializing, setIsInitializing] = useState(() => !localStorage.getItem('token'));

    const refreshAuthToken = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/refresh-token`, {
                method: 'POST',
                credentials: 'include' // Important: sends the HttpOnly cookie
            });
            const data = await res.json();
            if (data.success) {
                const refreshedUser = { ...data.user, role: data.role };
                setToken(data.token);
                setUser(refreshedUser);
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(refreshedUser));
            } else {
                // If refresh fails, log out completely
                setToken(null);
                setUser(null);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        } catch (error) {
            console.error("Session restoration failed:", error);
            setToken(null);
            setUser(null);
        } finally {
            setIsInitializing(false);
        }
    };

    useEffect(() => {
        refreshAuthToken();

        // Silently refresh token every 10 minutes (600000 ms)
        const intervalId = setInterval(() => {
            refreshAuthToken();
        }, 600000);

        return () => clearInterval(intervalId);
    }, []);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
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
