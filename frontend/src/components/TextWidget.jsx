import React from 'react';
import { useData } from '../contexts/DataProvider';

/**
 * 숫자를 2자리 소수점을 포함한 문자열로 포맷팅합니다.
 * @param {string | number} numStr - 포맷팅할 숫자 또는 숫자 문자열
 * @returns {string} 포맷팅된 문자열
 */
const formatNumber = (numStr) => {
    if (!numStr) return '-';
    const num = parseFloat(String(numStr).replace(/,/g, ''));
    if (isNaN(num)) return '-';
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * 등락률 값에 따라 적절한 색상을 반환합니다.
 * @param {string | number} rate - 등락률
 * @returns {string} CSS 색상 코드
 */
const getRateColor = (rate) => {
    const numRate = parseFloat(rate);
    if (isNaN(numRate) || numRate === 0) return '#333';
    return numRate > 0 ? '#d14242' : '#4287d1';
};

/**
 * KOSPI, KOSDAQ과 같은 주요 지표를 텍스트 형태로 표시하는 위젯입니다.
 * DataProvider로부터 데이터를 받아오며, 표시할 지표를 변경할 수 있습니다.
 * @param {object} props - 컴포넌트 속성
 * @param {string} props.widgetId - 위젯의 고유 ID
 * @param {object} props.settings - 위젯의 설정값 (e.g., { dataKey, title })
 * @param {function} props.onSettingsChange - 위젯 설정 변경 시 호출되는 함수
 */
function TextWidget({ widgetId, settings, onSettingsChange }) {
    const { data: dashboardData, isLoading, error } = useData();

    const { dataKey = 'index_KOSPI', title = '코스피' } = settings;
    const metricData = dashboardData[dataKey];

    /**
     * 표시할 데이터 키(코스피/코스닥)를 변경하는 핸들러입니다.
     * @param {string} newKey - 새로운 데이터 키 (e.g., 'index_KOSPI')
     * @param {string} newTitle - 새로운 위젯 제목
     */
    const handleDataKeyChange = (newKey, newTitle) => {
        onSettingsChange(widgetId, { ...settings, dataKey: newKey, title: newTitle });
    };

    if (isLoading && !metricData) {
        return <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>Loading...</div>;
    }

    if (error || !metricData) {
        return <div style={{ padding: '20px', color: 'red', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>Error or No Data</div>;
    }

    const value = metricData.CLSPRC_IDX;
    const change = metricData.CMPPREVDD_IDX;
    const changeRate = metricData.FLUC_RT;
    const sign = parseFloat(change) > 0 ? '▲' : '▼';

    return (
        <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', padding: '20px',
            boxSizing: 'border-box', color: getRateColor(changeRate), position: 'relative'
        }}>
            {/* 마우스를 올리면 나타나는 지표 변경 버튼 */}
            <div style={{
                position: 'absolute', top: '10px', left: '10px', backgroundColor: 'rgba(255,255,255,0.9)',
                padding: '5px', borderRadius: '5px', display: 'flex', flexDirection: 'column',
                gap: '5px', zIndex: 10, width: '60px', opacity: 0.3, transition: 'opacity 0.2s ease-in-out'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
            onMouseLeave={(e) => e.currentTarget.style.opacity = 0.3}
            >
                    <button onClick={() => handleDataKeyChange('index_KOSPI', '코스피')} style={{ backgroundColor: dataKey === 'index_KOSPI' ? '#007bff' : '#f0f0f0', color: dataKey === 'index_KOSPI' ? 'white' : 'black', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', width: '100%' }}>
                        코스피
                    </button>
                    <button onClick={() => handleDataKeyChange('index_KOSDAQ', '코스닥')} style={{ backgroundColor: dataKey === 'index_KOSDAQ' ? '#007bff' : '#f0f0f0', color: dataKey === 'index_KOSDAQ' ? 'white' : 'black', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', width: '100%' }}>
                        코스닥
                    </button>
            </div>

            <div style={{ fontSize: 'clamp(0.8rem, 2.5vw, 1.2em)', color: '#888', marginBottom: '10px' }}>{title}</div>
            <div style={{ fontSize: 'clamp(1.5rem, 6vw, 3em)', fontWeight: 'bold' }}>{formatNumber(value)}</div>
            <div style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2em)', marginTop: '10px', whiteSpace: 'nowrap' }}>
                <span>{sign} {formatNumber(change)}</span>
                <span style={{ marginLeft: '5px' }}>({changeRate}%)</span>
            </div>
        </div>
    );
}

export default TextWidget;
