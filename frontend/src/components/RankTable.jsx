import React, { useState, useEffect, useCallback, useMemo } from 'react';
import _ from 'lodash';
import { useDashboard } from '../contexts/DashboardContext';
import { useData } from '../contexts/DataProvider';

// --- Helper Functions & Constants ---

/** 숫자를 천 단위 콤마로 포맷팅합니다. */
const formatNumber = (num) => num?.toLocaleString() || '-';
/** 등락률을 부호와 %를 붙여 포맷팅합니다. */
const formatRate = (rate) => (rate > 0 ? `+${rate.toFixed(2)}%` : `${rate?.toFixed(2) || '-'}%`);
/** 등락률에 따라 색상을 반환합니다. */
const getRateColor = (rate) => (rate > 0 ? '#d14242' : rate < 0 ? '#4287d1' : '#333');

/** 테이블에서 사용 가능한 모든 컬럼의 정의입니다. */
const ALL_COLUMNS = {
    currentPrice: { header: '현재가', align: 'right', format: formatNumber },
    changeRate: { header: '등락률', align: 'right', format: formatRate, color: getRateColor },
    volume: { header: '거래량', align: 'right', format: formatNumber },
    tradeValue: { header: '거래대금(억)', align: 'right', format: (val) => (val / 100000000).toFixed(0) },
};


/**
 * 순위 테이블의 컬럼 가시성 및 너비를 설정하는 모달 컴포넌트입니다.
 * @param {object} props - 컴포넌트 속성
 * @param {object} props.settings - 현재 위젯의 설정 객체
 * @param {function} props.onColumnToggle - 컬럼 가시성 토글 시 호출되는 함수
 * @param {function} props.onWidthChange - 컬럼 너비 변경 시 호출되는 함수
 * @param {function} props.onClose - 모달을 닫을 때 호출되는 함수
 */
const SettingsModal = ({ settings, onColumnToggle, onWidthChange, onClose }) => {
    const defaultColumnWidths = { name: 120, currentPrice: 90, changeRate: 90, volume: 100, tradeValue: 100 };
    const visibleColumns = settings.visibleColumns || Object.keys(ALL_COLUMNS);
    const columnWidths = settings.columnWidths || defaultColumnWidths;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', color: '#333' }} onClick={e => e.stopPropagation()}>
                <h4>표시할 컬럼</h4>
                <div>
                    {Object.keys(ALL_COLUMNS).map(key => (
                        <label key={key} style={{ marginRight: '15px', fontSize: '0.9em' }}>
                            <input type="checkbox" checked={visibleColumns.includes(key)} onChange={() => onColumnToggle(key)} />
                            {ALL_COLUMNS[key].header}
                        </label>
                    ))}
                </div>
                <h4 style={{ marginTop: '20px' }}>컬럼 너비 (px)</h4>
                <div>
                    {visibleColumns.map(key => (
                        <label key={key} style={{ display: 'inline-block', marginRight: '15px', fontSize: '0.9em' }}>
                            {ALL_COLUMNS[key].header}:
                            <input type="number" defaultValue={columnWidths[key] || defaultColumnWidths[key]} onBlur={(e) => onWidthChange(key, parseInt(e.target.value, 10) || 0)} style={{ width: '60px', marginLeft: '5px' }} />
                        </label>
                    ))}
                </div>
                <button onClick={onClose} style={{ marginTop: '20px', float: 'right' }}>닫기</button>
            </div>
        </div>
    );
};

/**
 * 주식 순위 데이터를 테이블 형태로 표시하는 위젯입니다.
 * DataProvider로부터 데이터를 받아오며, 다양한 순위 기준(상승률, 거래량 등)으로 변경할 수 있습니다.
 * @param {object} props - 컴포넌트 속성
 * @param {string} props.widgetId - 위젯의 고유 ID
 * @param {object} props.settings - 위젯의 설정값 (e.g., { by, order, visibleColumns })
 * @param {function} props.onSettingsChange - 위젯 설정 변경 시 호출되는 함수
 */
function RankTable({ widgetId, settings, onSettingsChange }) {
    const { setSelectedAsset } = useDashboard();
    const { data: dashboardData, isLoading, error } = useData(); // DataProvider의 데이터 사용
    
    const [showSettings, setShowSettings] = useState(false);

    /** 위젯 설정(settings)에 따라 DataProvider에 요청할 데이터 키를 동적으로 생성합니다. */
    const dataKey = useMemo(() => {
        const { by, market = 'ALL', order = 'DESC', mode = 'default' } = settings;
        if (mode === 'top-and-bottom') {
            return `rank_${market.toUpperCase()}_CHANGE_RATE_TOP_AND_BOTTOM`;
        }
        return `rank_${market.toUpperCase()}_${by.toUpperCase()}_${order.toUpperCase()}`;
    }, [settings]);

    /** 중앙 데이터 저장소에서 이 위젯에 해당하는 데이터를 추출합니다. */
    const fullData = dashboardData[dataKey] || [];

    const defaultColumnWidths = { name: 120, currentPrice: 90, changeRate: 90, volume: 100, tradeValue: 100 };

    /** 순위 모드(상승률, 하락률 등) 변경 시 호출되는 핸들러입니다. */
    const handleModeChange = useCallback((event) => {
        const newMode = event.target.value;
        let newSettings;
        switch (newMode) {
            case 'rate_desc': newSettings = { ...settings, by: 'CHANGE_RATE', order: 'DESC', mode: 'default' }; break;
            case 'rate_asc': newSettings = { ...settings, by: 'CHANGE_RATE', order: 'ASC', mode: 'default' }; break;
            case 'volume_desc': newSettings = { ...settings, by: 'VOLUME', order: 'DESC', mode: 'default' }; break;
            case 'trade_value_desc': newSettings = { ...settings, by: 'TRADE_VALUE', order: 'DESC', mode: 'default' }; break;
            case 'top_and_bottom': newSettings = { ...settings, by: 'CHANGE_RATE', mode: 'top-and-bottom' }; break;
            default: newSettings = settings;
        }
        onSettingsChange(widgetId, newSettings);
    }, [widgetId, settings, onSettingsChange]);

    /** 컬럼 가시성 토글 시 호출되는 핸들러입니다. */
    const handleColumnToggle = useCallback((columnKey) => {
        const currentColumns = settings.visibleColumns || Object.keys(ALL_COLUMNS);
        const newColumns = currentColumns.includes(columnKey)
            ? currentColumns.filter(c => c !== columnKey)
            : [...currentColumns, columnKey];
        onSettingsChange(widgetId, { ...settings, visibleColumns: newColumns });
    }, [widgetId, settings, onSettingsChange]);

    /** 컬럼 너비 변경 시 호출되는 핸들러입니다. */
    const handleWidthChange = useCallback((columnKey, newWidth) => {
        const newColumnWidths = { ...(settings.columnWidths || defaultColumnWidths), [columnKey]: newWidth };
        onSettingsChange(widgetId, { ...settings, columnWidths: newColumnWidths });
    }, [widgetId, settings, onSettingsChange, defaultColumnWidths]);

    /** 현재 설정에 맞는 UI 선택 모드를 반환합니다. */
    const getCurrentMode = () => {
        if (settings.mode === 'top-and-bottom') return 'top_and_bottom';
        if (settings.by === 'VOLUME') return 'volume_desc';
        if (settings.by === 'TRADE_VALUE') return 'trade_value_desc';
        if (settings.order === 'ASC') return 'rate_asc';
        return 'rate_desc';
    };

    const visibleColumns = settings.visibleColumns || ['currentPrice', 'changeRate'];
    const columnWidths = settings.columnWidths || defaultColumnWidths;
    
    /** 위젯의 높이에 따라 실제로 화면에 표시할 데이터의 개수를 제한합니다. */
    const displayData = useMemo(() => {
        return fullData.slice(0, settings.limit || 10);
    }, [fullData, settings.limit]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* 컨트롤러: 순위 기준 선택 및 설정 버튼 */}
            <div style={{ padding: '5px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <select value={getCurrentMode()} onChange={handleModeChange} style={{ fontSize: '0.8em', marginRight: '5px' }}>
                    <option value="rate_desc">📈 상승률</option>
                    <option value="rate_asc">📉 하락률</option>
                    <option value="volume_desc">📊 거래량</option>
                    <option value="trade_value_desc">💰 거래대금</option>
                    <option value="top_and_bottom">🎢 Top & Bottom</option>
                </select>
                <button onClick={() => setShowSettings(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2em' }}>⚙️</button>
            </div>
            
            {showSettings && <SettingsModal settings={settings} onColumnToggle={handleColumnToggle} onWidthChange={handleWidthChange} onClose={() => setShowSettings(false)} />}

            {/* 순위 테이블 본문 */}
            <div style={{ width: '100%', flexGrow: 1, overflow: 'auto' }}>
                {isLoading ? <p style={{textAlign: 'center'}}>Loading...</p> : error ? <p style={{ color: 'red', textAlign: 'center' }}>Error: {error}</p> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #eee' }}>
                                <th title="종목명" style={{ padding: '8px', textAlign: 'left', fontWeight: 'normal', color: '#666', width: `${columnWidths.name}px`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>종목명</th>
                                {visibleColumns.map(key => (
                                    <th key={key} title={ALL_COLUMNS[key].header} style={{ padding: '8px', textAlign: ALL_COLUMNS[key].align, fontWeight: 'normal', color: '#666', width: `${columnWidths[key]}px`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {ALL_COLUMNS[key].header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayData.map((item, index) => (
                                <tr key={index} style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }} onClick={() => setSelectedAsset({ symbol: item.symbol, type: 'KRX' })}>
                                    <td title={item.name} style={{ padding: '8px', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</td>
                                    {visibleColumns.map(key => (
                                        <td key={key} title={ALL_COLUMNS[key].format(item[key])} style={{ padding: '8px', textAlign: ALL_COLUMNS[key].align, color: ALL_COLUMNS[key].color?.(item[key]), fontWeight: 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {ALL_COLUMNS[key].format(item[key])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default RankTable;