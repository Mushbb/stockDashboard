import React, { createContext, useState, useEffect, useCallback, useMemo, useContext } from 'react';

const DataContext = createContext(null);

export function DataProvider({ requiredDataKeys, children }) {
	const [data, setData] = useState({});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);

	const fetchData = useCallback(async (keys) => {
        if (keys.length === 0) {
            setData({});
            setIsLoading(false);
            return;
        }

		setIsLoading(true);
		setError(null);

		try {
            const response = await fetch('/api/dashboard/dynamic-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(keys),
            });

			if (!response.ok) {
				throw new Error('Failed to fetch dynamic dashboard data.');
			}

			const result = await response.json();
			setData(result);

		} catch (err) {
			console.error(err);
			setError(err.message);
		} finally {
			setIsLoading(false);
		}
	}, []);

    // requiredDataKeys가 변경되거나 30초마다 데이터를 새로고침합니다.
	useEffect(() => {
        const keysString = JSON.stringify(requiredDataKeys.sort());

		fetchData(requiredDataKeys);

		const intervalId = setInterval(() => fetchData(requiredDataKeys), 30000);

		return () => clearInterval(intervalId);
	}, [fetchData, JSON.stringify(requiredDataKeys.sort())]); // 키 목록이 바뀌면 즉시 재실행

	const value = useMemo(() => ({ data, isLoading, error }), [data, isLoading, error]);

	return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};