import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const [selectedServices, setSelectedServices] = useState([]);

    const addService = (service) => {
        setSelectedServices((prev) => {
            const exists = prev.find(s => s.id === service.id);
            if (!exists) {
                return [...prev, service];
            }
            return prev;
        });
    };

    const clearCart = () => {
        setSelectedServices([]);
    };

    return (
        <CartContext.Provider value={{ selectedServices, addService, setSelectedServices, clearCart }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};
