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

function TextWidget({ widgetId, settings, onSettingsChange, isEditMode }) {
    const { data: dashboardData, isLoading, error } = useData();

    const { dataKey = 'index_KOSPI', title = '코스피' } = settings;
    const metricData = dashboardData[dataKey];

    const handleDataKeyChange = (newKey, newTitle) => {
        onSettingsChange(widgetId, { ...settings, dataKey: newKey, title: newTitle });
    };

    const handleTitleChange = (e) => {
        onSettingsChange(widgetId, { ...settings, title: e.target.value });
    };

    if (isLoading && !metricData) {
        return <div style={{ padding: '20px' }}>Loading...</div>;
    }

    if (error || !metricData) {
        return <div style={{ padding: '20px', color: 'red' }}>Error or No Data</div>;
    }

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
            color: getRateColor(changeRate),
            position: 'relative' // For absolute positioning of edit controls
        }}>
            <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                backgroundColor: 'rgba(255,255,255,0.9)',
                padding: '5px',
                borderRadius: '5px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                zIndex: 10,
                width: '60px',
                opacity: 0.3, // Default opacity
                transition: 'opacity 0.2s ease-in-out' // Smooth transition
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
            onMouseLeave={(e) => e.currentTarget.style.opacity = 0.3}
            >
                    <button
                        onClick={() => handleDataKeyChange('index_KOSPI', '코스피')}
                        style={{ backgroundColor: dataKey === 'index_KOSPI' ? '#007bff' : '#f0f0f0', color: dataKey === 'index_KOSPI' ? 'white' : 'black', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', width: '100%' }}
                    >
                        코스피
                    </button>
                    <button
                        onClick={() => handleDataKeyChange('index_KOSDAQ', '코스닥')}
                        style={{ backgroundColor: dataKey === 'index_KOSDAQ' ? '#007bff' : '#f0f0f0', color: dataKey === 'index_KOSDAQ' ? 'white' : 'black', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', width: '100%' }}
                    >
                        코스닥
                    </button>
                </div>
            <div style={{ fontSize: '1.2em', color: '#888', marginBottom: '10px', position: 'relative', zIndex: 11 }}>{title}</div>
            <div style={{ fontSize: '3em', fontWeight: 'bold', position: 'relative', zIndex: 11 }}>{formatNumber(value)}</div>
            <div style={{ fontSize: '1.5em', marginTop: '10px', position: 'relative', zIndex: 11 }}>
                <span>{sign} {formatNumber(change)}</span>
                <span style={{ marginLeft: '15px', position: 'relative', zIndex: 11 }}>({changeRate}%)</span>
            </div>
        </div>
    );
}

export default TextWidget;
