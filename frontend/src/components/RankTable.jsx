import React, { useState, useEffect, useCallback } from 'react';
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

function RankTable({ widgetId, settings, width, height }) {
    const { setSelectedAsset } = useDashboard();
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentSettings, setCurrentSettings] = useState(settings);
    const [showSettings, setShowSettings] = useState(false);

    const defaultColumnWidths = { name: 120, currentPrice: 90, changeRate: 90, volume: 100, tradeValue: 100 };

    // settings prop이 변경될 때마다(limit 포함) currentSettings를 업데이트
    useEffect(() => {
        setCurrentSettings(settings);
    }, [settings]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const { by, market = 'ALL', order = 'DESC', limit = 10, mode = 'default' } = currentSettings;
                let url;
                if (mode === 'top-and-bottom') {
                    url = `/api/market/rank/top-and-bottom?market=${market}&limit=${limit}`;
                } else {
                    url = `/api/market/rank?by=${by}&market=${market}&order=${order}&limit=${limit}`;
                }
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const result = await response.json();
                setData(result);
            } catch (e) {
                console.error("Fetch data error:", e);
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [currentSettings]);

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
                            {data.map((item, index) => (
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