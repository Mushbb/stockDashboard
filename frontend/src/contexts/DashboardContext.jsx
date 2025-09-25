import React, { createContext, useState, useContext } from 'react';

const DashboardContext = createContext(null);

export const useDashboard = () => {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
};

export const DashboardProvider = ({ children }) => {
    const [selectedAsset, setSelectedAsset] = useState(null); // 예: { symbol: '005930', type: 'KRX' }

    const value = {
        selectedAsset,
        setSelectedAsset,
    };

    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
};

export default useDashboard;