import React, { createContext, useState, useEffect, useCallback, useMemo, useContext } from 'react';

const DataContext = createContext(null);

export function DataProvider({ children }) {
	const [marketData, setMarketData] = useState({ kospi: null, kosdaq: null });
	const [isLoading, setIsLoading] = useState({ kospi: true, kosdaq: true });
	const [error, setError] = useState(null);

	const fetchData = useCallback(async () => {
		setIsLoading({ kospi: true, kosdaq: true });
		setError(null);

		try {
			// KOSPI와 KOSDAQ API를 동시에 호출합니다.
			const [kospiResponse, kosdaqResponse] = await Promise.all([
				fetch('/api/charts/treemap/kospi'),
				fetch('/api/charts/treemap/kosdaq')
			]);

			if (!kospiResponse.ok || !kosdaqResponse.ok) {
				throw new Error('API 서버에서 데이터를 가져오는데 실패했습니다.');
			}

			// 각 응답을 JSON으로 변환합니다.
			const kospiData = await kospiResponse.json();
			const kosdaqData = await kosdaqResponse.json();

			// 백엔드에서 이미 가공된 데이터를 그대로 상태에 저장합니다.
			setMarketData({
				kospi: kospiData,
				kosdaq: kosdaqData
			});

		} catch (err) {
			console.error(err);
			setError(err.message);
		} finally {
			setIsLoading({ kospi: false, kosdaq: false });
		}
	}, []);

	// 컴포넌트가 처음 마운트될 때, 그리고 30초마다 데이터를 새로고침합니다.
	useEffect(() => {
		fetchData();
		const intervalId = setInterval(fetchData, 30000);
		return () => clearInterval(intervalId);
	}, [fetchData]);

	const getChartData = useCallback((marketType) => {
		return {
			data: marketData[marketType],
			isLoading: isLoading[marketType],
			error: error
		};
	}, [marketData, isLoading, error]);

	const value = useMemo(() => ({ getChartData }), [getChartData]);

	return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);

