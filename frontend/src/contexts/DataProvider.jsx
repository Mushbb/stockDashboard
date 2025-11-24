import React, { createContext, useState, useEffect, useCallback, useMemo, useContext } from 'react';

const DataContext = createContext(null);

/**
 * 특정 데이터 키 목록에 대한 데이터를 서버에서 동적으로 가져와 제공하는 Provider 컴포넌트입니다.
 * 데이터는 30초마다 자동으로 새로고침됩니다.
 * @param {object} props - 컴포넌트에 전달되는 속성
 * @param {string[]} props.requiredDataKeys - 서버에 요청할 데이터 키의 배열
 * @param {React.ReactNode} props.children - 이 Provider가 감싸게 될 자식 컴포넌트들
 */
export function DataProvider({ requiredDataKeys, children }) {
	const [data, setData] = useState({});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);

	/**
	 * 주어진 키 목록을 사용하여 서버에서 동적 데이터를 비동기적으로 가져옵니다.
	 * @param {string[]} keys - 가져올 데이터의 키 목록
	 */
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

    // `requiredDataKeys`가 변경되거나 30초마다 데이터를 새로고침합니다.
	useEffect(() => {
        // 키 배열의 순서에 상관없이 변경을 감지하기 위해 정렬 후 문자열로 변환합니다.
        const keysString = JSON.stringify(requiredDataKeys.sort());

		fetchData(requiredDataKeys);

		const intervalId = setInterval(() => fetchData(requiredDataKeys), 30000); // 30초마다 폴링

		return () => clearInterval(intervalId); // 컴포넌트 언마운트 시 인터벌 정리
	}, [fetchData, JSON.stringify(requiredDataKeys.sort())]); // 키 목록이 바뀌면 즉시 재실행

	const value = useMemo(() => ({ data, isLoading, error }), [data, isLoading, error]);

	return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/**
 * DataContext를 사용하기 위한 커스텀 훅입니다.
 * @returns {{data: object, isLoading: boolean, error: string|null}} 데이터 컨텍스트 값
 * @throws {Error} DataProvider 외부에서 사용 시 에러 발생
 */
export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};