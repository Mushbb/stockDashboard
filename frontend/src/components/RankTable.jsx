import React, { useState, useEffect, useCallback, useMemo } from 'react';
import _ from 'lodash';
import { useDashboard } from '../contexts/DashboardContext';

const formatNumber = (num) => num?.toLocaleString() || '-';
const formatRate = (rate) => (rate > 0 ? `+${rate.toFixed(2)}%` : `${rate?.toFixed(2) || '-'}%`);
const getRateColor = (rate) => (rate > 0 ? '#d14242' : rate < 0 ? '#4287d1' : '#333');

const ALL_COLUMNS = {
    currentPrice: { header: '현재가', align: 'right', format: formatNumber },
    changeRate: { header: '등락률', align: 'right', format: formatRate, color: getRateColor },
    volume: { header: '거래량', align: 'right', format: formatNumber },
    tradeValue: { header: '거래대금(억)', align: 'right', format: (val) => (val / 100000000).toFixed(0) },
};

const SettingsModal = ({ settings, onColumnToggle, onWidthChange, onClose }) => {
    const defaultColumnWidths = { name: 120, currentPrice: 90, changeRate: 90, volume: 100, tradeValue: 100 };
    const visibleColumns = settings.visibleColumns || Object.keys(ALL_COLUMNS);
    const columnWidths = settings.columnWidths || defaultColumnWidths;
    
    const handleWidthInput = (e, key) => {
        if (e.key === 'Enter') {
            onWidthChange(key, parseInt(e.target.value, 10) || 0);
            e.target.blur();
        }
    };
    
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
                            <input
                                type="number"
                                defaultValue={columnWidths[key] || defaultColumnWidths[key]}
                                onBlur={(e) => onWidthChange(key, parseInt(e.target.value, 10) || 0)}
                                onKeyDown={(e) => handleWidthInput(e, key)}
                                style={{ width: '60px', marginLeft: '5px' }}
                            />
                        </label>
                    ))}
                </div>
                <button onClick={onClose} style={{ marginTop: '20px', float: 'right' }}>닫기</button>
            </div>
        </div>
    );
};

function RankTable({ widgetId, settings, width, height }) {
    const { setSelectedAsset } = useDashboard();
    const [fullData, setFullData] = useState([]); // 전체 데이터를 저장할 상태
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentSettings, setCurrentSettings] = useState(settings);
    const [showSettings, setShowSettings] = useState(false);

    const defaultColumnWidths = { name: 120, currentPrice: 90, changeRate: 90, volume: 100, tradeValue: 100 };

    // 부모로부터 받는 limit prop만 동기화.
    useEffect(() => {
        if (settings.limit !== currentSettings.limit) {
            setCurrentSettings(prev => ({ ...prev, limit: settings.limit }));
        }
    }, [settings.limit]);

    // 데이터 fetch에 영향을 주는 설정값들이 변경될 때만 fetchKey를 재생성
    const fetchKey = useMemo(() => {
        const { by, market, order, mode } = currentSettings;
        return `${mode}-${by}-${market}-${order}`;
    }, [currentSettings.by, currentSettings.market, currentSettings.order, currentSettings.mode]);


    // fetchKey가 변경될 때만 데이터를 다시 가져옴
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const { by, market = 'ALL', order = 'DESC', mode = 'default' } = currentSettings;
                const fetchLimit = 100; // 항상 최대 100개를 가져옴
                let url;

                if (mode === 'top-and-bottom') {
                    url = `/api/market/rank/top-and-bottom?market=${market}&limit=${fetchLimit}`;
                } else {
                    url = `/api/market/rank?by=${by}&market=${market}&order=${order}&limit=${fetchLimit}`;
                }
                
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const result = await response.json();
                setFullData(result); // 전체 데이터를 저장
            } catch (e) {
                console.error("Fetch data error:", e);
                setError(e.message);
                setFullData([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [fetchKey]);

    const debouncedSave = useCallback(
        _.debounce((newSettings) => {
            // limit은 동적으로 계산되므로 DB에 저장하지 않음
            const { limit, ...settingsToSave } = newSettings;
            fetch(`/api/widgets/${widgetId}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settingsToSave),
            }).catch(error => console.error(`Failed to save settings for widget ${widgetId}:`, error));
        }, 1000),
        [widgetId]
    );

    const handleSettingsChange = useCallback((newSettings) => {
        setCurrentSettings(newSettings);
        debouncedSave(newSettings);
    }, [debouncedSave]);

    const handleModeChange = useCallback((event) => {
        const newMode = event.target.value;
        let newSettings;
        switch (newMode) {
            case 'rate_desc': newSettings = { ...currentSettings, by: 'CHANGE_RATE', order: 'DESC', mode: 'default' }; break;
            case 'rate_asc': newSettings = { ...currentSettings, by: 'CHANGE_RATE', order: 'ASC', mode: 'default' }; break;
            case 'volume_desc': newSettings = { ...currentSettings, by: 'VOLUME', order: 'DESC', mode: 'default' }; break;
            case 'trade_value_desc': newSettings = { ...currentSettings, by: 'TRADE_VALUE', order: 'DESC', mode: 'default' }; break;
            case 'top_and_bottom': newSettings = { ...currentSettings, by: 'CHANGE_RATE', mode: 'top-and-bottom' }; break;
            default: newSettings = currentSettings;
        }
        handleSettingsChange(newSettings);
    }, [currentSettings, handleSettingsChange]);

    const handleColumnToggle = useCallback((columnKey) => {
        const currentColumns = currentSettings.visibleColumns || Object.keys(ALL_COLUMNS);
        const newColumns = currentColumns.includes(columnKey)
            ? currentColumns.filter(c => c !== columnKey)
            : [...currentColumns, columnKey];
        handleSettingsChange({ ...currentSettings, visibleColumns: newColumns });
    }, [currentSettings, handleSettingsChange]);

    const handleWidthChange = useCallback((columnKey, newWidth) => {
        const newColumnWidths = { ...(currentSettings.columnWidths || defaultColumnWidths), [columnKey]: newWidth };
        handleSettingsChange({ ...currentSettings, columnWidths: newColumnWidths });
    }, [currentSettings, handleSettingsChange, defaultColumnWidths]);

    const getCurrentMode = () => {
        if (currentSettings.mode === 'top-and-bottom') return 'top_and_bottom';
        if (currentSettings.by === 'VOLUME') return 'volume_desc';
        if (currentSettings.by === 'TRADE_VALUE') return 'trade_value_desc';
        if (currentSettings.order === 'ASC') return 'rate_asc';
        return 'rate_desc';
    };

    const visibleColumns = currentSettings.visibleColumns || ['currentPrice', 'changeRate'];
    const columnWidths = currentSettings.columnWidths || defaultColumnWidths;
    const displayData = useMemo(() => {
        return fullData.slice(0, currentSettings.limit || 10);
    }, [fullData, currentSettings.limit]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
            
            {showSettings && 
                <SettingsModal 
                    settings={currentSettings} 
                    onColumnToggle={handleColumnToggle} 
                    onWidthChange={handleWidthChange} 
                    onClose={() => setShowSettings(false)} 
                />
            }

            <div style={{ width: '100%', flexGrow: 1, overflow: 'hidden' }}>
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
                                <tr 
                                    key={index} 
                                    style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}
                                    onClick={() => setSelectedAsset({ symbol: item.symbol, type: 'KRX' })}
                                >
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
