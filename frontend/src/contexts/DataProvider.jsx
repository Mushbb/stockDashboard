import React, { createContext, useState, useEffect, useCallback, useMemo, useContext } from 'react';
import * as d3 from 'd3';

// 서버에서 받은 플랫 리스트 데이터를 D3 계층 구조로 변환하는 헬퍼 함수
// (기존 App_old.jsx에서 가져옴)
function transformData(flatData, marketName) {
	if (!flatData || flatData.length === 0) {
		return { name: marketName, children: [] };
	}
	const groupedData = d3.group(flatData, d => d.sectorName);
	const children = Array.from(groupedData, ([key, value]) => {
		const sectorName = key || '기타 섹터';
		const sectorChildren = value.map(item => ({
			name: item.nodeName || '이름없음',
			value: item.mktcap || 0,
			fluc_rate: item.fluc_rate || 0,
			cur_price: item.currentPrice || 0,
		}));
		return { name: sectorName, children: sectorChildren };
	});
	return { name: marketName, children };
}


const DataContext = createContext(null);

export function DataProvider({ children }) {
	const [marketData, setMarketData] = useState({ kospi: null, kosdaq: null });
	const [isLoading, setIsLoading] = useState({ kospi: true, kosdaq: true });
	const [error, setError] = useState(null);
	
	// 실제 API를 호출하여 데이터를 가져오는 함수
	const fetchData = useCallback(async () => {
		// 데이터 업데이트 시에도 로딩 상태를 true로 설정 (스피너 표시용)
		setIsLoading({ kospi: true, kosdaq: true });
		setError(null);
		
		try {
			// 전체 시장 데이터를 단일 API 호출로 가져옵니다.
			const response = await fetch('/api/market-data');
			
			if (!response.ok) {
				throw new Error('API 서버에서 데이터를 가져오는데 실패했습니다.');
			}
			
			const allMarketData = await response.json();
			
			// 가져온 전체 데이터를 KOSPI와 KOSDAQ으로 분리합니다.
			// (데이터 항목에 market 속성이 있다고 가정)
			const kospiItems = allMarketData.filter(item => item.marketType === 'KOSPI');
			const kosdaqItems = allMarketData.filter(item => item.marketType === 'KOSDAQ');
			
			// 분리된 데이터를 D3가 사용할 수 있는 계층 구조로 변환합니다.
			const transformedKospi = transformData(kospiItems, 'KOSPI');
			const transformedKosdaq = transformData(kosdaqItems, 'KOSDAQ');
			
			setMarketData({
				kospi: transformedKospi,
				kosdaq: transformedKosdaq
			});
			
		} catch (err) {
			console.error(err);
			setError(err.message);
		} finally {
			// 데이터 로딩이 성공하든 실패하든 로딩 상태를 false로 변경
			setIsLoading({ kospi: false, kosdaq: false });
		}
	}, []);
	
	// 컴포넌트가 처음 마운트될 때, 그리고 30초마다 데이터를 새로고침합니다.
	useEffect(() => {
		fetchData(); // 즉시 첫 데이터 로딩 실행
		
		const intervalId = setInterval(fetchData, 30000); // 30초마다 반복
		
		// 컴포넌트가 언마운트될 때 interval을 정리합니다.
		return () => clearInterval(intervalId);
	}, [fetchData]);
	
	// marketType을 받아 필요한 데이터와 로딩 상태만 반환하는 함수
	const getChartData = useCallback((marketType) => {
		return {
			data: marketData[marketType],
			isLoading: isLoading[marketType],
			error: error
		};
	}, [marketData, isLoading, error]);
	
	const value = useMemo(() => ({
		getChartData
	}), [getChartData]);
	
	return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// 컴포넌트에서 Context를 쉽게 사용하기 위한 커스텀 훅
export const useData = () => useContext(DataContext);

