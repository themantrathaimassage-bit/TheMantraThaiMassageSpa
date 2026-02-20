import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try {
            const stored = localStorage.getItem('sq_user');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalConfig, setAuthModalConfig] = useState({ returnTo: '/' });

    // Sync user to localStorage whenever it changes
    useEffect(() => {
        if (user) {
            localStorage.setItem('sq_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('sq_user');
        }
    }, [user]);

    const login = (userData) => {
        setUser(userData);
        setIsAuthModalOpen(false);
    };

    const logout = async () => {
        try { if (auth) await auth.signOut(); } catch { }
        setUser(null);
    };

    const openAuth = (config = { returnTo: '/' }) => {
        setAuthModalConfig(config);
        setIsAuthModalOpen(true);
    };

    const closeAuth = () => {
        setIsAuthModalOpen(false);
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            isAuthModalOpen,
            openAuth,
            closeAuth,
            authModalConfig
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
