import React from 'react';
import { useData } from '../contexts/DataProvider';

const formatNumber = (numStr) => {
    if (!numStr) return '-';
    const num = parseFloat(String(numStr).replace(/,/g, ''));
    if (isNaN(num)) return '-';
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getRateColor = (rate) => {
    const numRate = parseFloat(rate);
    if (isNaN(numRate) || numRate === 0) return '#333';
    return numRate > 0 ? '#d14242' : '#4287d1';
};

function TextWidget({ widgetId, settings, onSettingsChange }) {
    const { data: dashboardData, isLoading, error } = useData();

    const { dataKey = 'index_KOSPI', title = '코스피' } = settings;
    const metricData = dashboardData[dataKey];

    if (isLoading && !metricData) { // 데이터가 아직 없을 때만 로딩 표시
        return <div style={{ padding: '20px' }}>Loading...</div>;
    }

    if (error || !metricData) {
        return <div style={{ padding: '20px', color: 'red' }}>Error or No Data</div>;
    }

    // 원래의 대문자 키로 롤백
    const value = metricData.CLSPRC_IDX;
    const change = metricData.CMPPREVDD_IDX;
    const changeRate = metricData.FLUC_RT;
    const sign = parseFloat(change) > 0 ? '▲' : '▼';

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
            boxSizing: 'border-box',
            color: getRateColor(changeRate)
        }}>
            <div style={{ fontSize: '1.2em', color: '#888', marginBottom: '10px' }}>{title}</div>
            <div style={{ fontSize: '3em', fontWeight: 'bold' }}>{formatNumber(value)}</div>
            <div style={{ fontSize: '1.5em', marginTop: '10px' }}>
                <span>{sign} {formatNumber(change)}</span>
                <span style={{ marginLeft: '15px' }}>({changeRate}%)</span>
            </div>
        </div>
    );
}

export default TextWidget;
