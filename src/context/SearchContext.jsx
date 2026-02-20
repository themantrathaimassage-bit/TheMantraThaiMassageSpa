import React, { createContext, useContext, useState } from 'react';

const SearchContext = createContext();

export const useSearch = () => {
    return useContext(SearchContext);
};

export const SearchProvider = ({ children }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const value = {
        searchQuery,
        setSearchQuery
    };

    return (
        <SearchContext.Provider value={value}>
            {children}
        </SearchContext.Provider>
    );
};
