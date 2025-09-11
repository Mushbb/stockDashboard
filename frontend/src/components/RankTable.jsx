// /frontend/src/components/RankTable.jsx
import React, { useState, useEffect } from 'react';

function RankTable({ title, by, market = 'ALL', order = 'DESC', limit = 10, mode = 'default', width, height }) {
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                let url;
                if (mode === 'top-and-bottom') {
                    url = `/api/market/rank/top-and-bottom?market=${market}&limit=${limit}`;
                } else {
                    url = `/api/market/rank?by=${by}&market=${market}&order=${order}&limit=${limit}`;
                }
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const result = await response.json();
                setData(result);
            } catch (e) {
                setError(e.message);
                console.error(`Failed to fetch ${title} data:`, e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
        const intervalId = setInterval(fetchData, 300000); // 5분마다 갱신
        return () => clearInterval(intervalId);
    }, [title, by, market, order, limit, mode]);

    const formatPrice = (price) => {
        if (price === null || typeof price === 'undefined') return '-';
        return price.toLocaleString();
    };

    const formatRate = (rate) => {
        if (rate === null || typeof rate === 'undefined') return '-';
        const fixedRate = rate.toFixed(2);
        return rate > 0 ? `+${fixedRate}%` : `${fixedRate}%`;
    };

    const getRateColor = (rate) => {
        if (rate > 0) return '#d14242'; // 상승 (빨강)
        if (rate < 0) return '#4287d1'; // 하락 (파랑)
        return '#333'; // 보합
    };

    return (
        <div style={{ width: `${width}px`, height: `${height}px`, overflowY: 'auto' }}>
            {isLoading && <p>로딩 중...</p>}
            {error && <p style={{ color: 'red' }}>오류: {error}</p>}
            {!isLoading && !error && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #eee' }}>
                            <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'normal', color: '#666' }}>종목명</th>
                            <th style={{ padding: '8px', textAlign: 'right', fontWeight: 'normal', color: '#666' }}>현재가</th>
                            <th style={{ padding: '8px', textAlign: 'right', fontWeight: 'normal', color: '#666' }}>등락률</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                <td style={{ padding: '8px', textAlign: 'left' }}>{item.name}</td>
                                <td style={{ padding: '8px', textAlign: 'right' }}>{formatPrice(item.currentPrice)}</td>
                                <td style={{ padding: '8px', textAlign: 'right', color: getRateColor(item.changeRate), fontWeight: 'bold' }}>
                                    {formatRate(item.changeRate)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default RankTable;
