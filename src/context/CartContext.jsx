import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const [selectedServices, setSelectedServices] = useState([]);

    const addService = (service) => {
        setSelectedServices((prev) => {
            const existingIndex = prev.findIndex(s => s.baseServiceName === service.baseServiceName);
            if (existingIndex > -1) {
                const newCart = [...prev];
                newCart[existingIndex] = service;
                return newCart;
            }
            return [...prev, service];
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
