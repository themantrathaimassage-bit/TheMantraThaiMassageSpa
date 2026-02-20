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

    // Keep in sync with Firebase session (only if Firebase is configured)
    useEffect(() => {
        if (!auth) return;
        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
            if (!firebaseUser) {
                setUser(null);
                localStorage.removeItem('sq_user');
            }
        });
        return unsub;
    }, []);

    const login = (userData) => {
        setUser(userData);
        localStorage.setItem('sq_user', JSON.stringify(userData));
        setIsAuthModalOpen(false); // Close modal on success
    };

    const logout = async () => {
        try { await auth.signOut(); } catch { }
        setUser(null);
        localStorage.removeItem('sq_user');
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
