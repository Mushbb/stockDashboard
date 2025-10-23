import React, { useState, useEffect, useCallback, useMemo } from 'react';
import _ from 'lodash';
import { useDashboard } from '../contexts/DashboardContext';
import SymbolSearchInput from './SymbolSearchInput';

const formatNumber = (num) => num?.toLocaleString() || '-';
const formatRate = (rate) => (rate != null ? (rate > 0 ? `+${rate.toFixed(2)}%` : `${rate.toFixed(2)}%`) : '-');
const getRateColor = (rate) => (rate != null ? (rate > 0 ? '#d14242' : rate < 0 ? '#4287d1' : '#333') : '#333');

const ALL_COLUMNS = {
    currentPrice: { header: '현재가', align: 'right', format: formatNumber },
    fluc_rate: { header: '등락률', align: 'right', format: formatRate, color: getRateColor },
    tradeVolume: { header: '거래량', align: 'right', format: formatNumber },
    tradeValue: { header: '거래대금(억)', align: 'right', format: (val) => (val != null ? (val / 100000000).toFixed(0) : '-') },
};

const SettingsModal = ({ settings, onColumnToggle, onWidthChange, onClose }) => {
    const defaultColumnWidths = { name: 120, currentPrice: 90, fluc_rate: 90, tradeVolume: 100, tradeValue: 100 };
    const visibleColumns = (settings.visibleColumns || Object.keys(ALL_COLUMNS)).filter(key => Object.keys(ALL_COLUMNS).includes(key));
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

function WatchlistWidget({ widgetId, settings, width, height, onSettingsChange }) {
    const { setSelectedAsset } = useDashboard();
    const [watchlistData, setWatchlistData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showSettings, setShowSettings] = useState(false);

    const symbols = useMemo(() => settings.symbols || [], [settings.symbols]);

    useEffect(() => {
        if (symbols.length === 0) {
            setWatchlistData([]);
            setIsLoading(false);
            return;
        }

        const fetchWatchlistData = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/stocks/quotes?symbols=${symbols.join(',')}`);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                setWatchlistData(data);
                setError(null);
            } catch (err) {
                setError('데이터를 불러오는 데 실패했습니다.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWatchlistData();
    }, [symbols]);

    const handleAddSymbol = (symbolToAdd) => {
        if (!symbolToAdd || symbolToAdd.trim() === '') return;
        const upperSymbol = symbolToAdd.trim().toUpperCase();
        if (symbols.includes(upperSymbol)) {
            alert('이미 추가된 종목입니다.');
            return;
        }
        const newSymbols = [...symbols, upperSymbol];
        onSettingsChange(widgetId, { ...settings, symbols: newSymbols });
    };

    const handleRemoveSymbol = (symbolToRemove) => {
        const newSymbols = symbols.filter(s => s !== symbolToRemove);
        onSettingsChange(widgetId, { ...settings, symbols: newSymbols });
    };

    const defaultColumnWidths = { name: 120, currentPrice: 90, fluc_rate: 90, tradeVolume: 100, tradeValue: 100, remove: 40 };

    const handleColumnToggle = useCallback((columnKey) => {
        const currentColumns = settings.visibleColumns || Object.keys(ALL_COLUMNS);
        const newColumns = currentColumns.includes(columnKey)
            ? currentColumns.filter(c => c !== columnKey)
            : [...currentColumns, columnKey];
        onSettingsChange(widgetId, { ...settings, visibleColumns: newColumns });
    }, [widgetId, settings, onSettingsChange]);

    const handleWidthChange = useCallback((columnKey, newWidth) => {
        const newColumnWidths = { ...(settings.columnWidths || defaultColumnWidths), [columnKey]: newWidth };
        onSettingsChange(widgetId, { ...settings, columnWidths: newColumnWidths });
    }, [widgetId, settings, onSettingsChange, defaultColumnWidths]);

    const visibleColumns = (settings.visibleColumns || ['currentPrice', 'fluc_rate']).filter(key => Object.keys(ALL_COLUMNS).includes(key));
    const columnWidths = { ...defaultColumnWidths, ...(settings.columnWidths || {}) };
    
    const displayData = useMemo(() => {
        return symbols.map(symbol => watchlistData.find(item => item.isuSrtCd === symbol)).filter(Boolean);
    }, [watchlistData, symbols]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <SymbolSearchInput onSymbolSelect={(stock) => handleAddSymbol(stock.symbol)} />
                <button onClick={() => setShowSettings(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2em' }}>⚙️</button>
            </div>
            
            {showSettings && 
                <SettingsModal 
                    settings={settings} 
                    onColumnToggle={handleColumnToggle} 
                    onWidthChange={handleWidthChange} 
                    onClose={() => setShowSettings(false)} 
                />
            }

            <div style={{ width: '100%', flexGrow: 1, overflow: 'auto' }}>
                {isLoading ? <p style={{textAlign: 'center'}}>Loading...</p> : error ? <p style={{ color: 'red', textAlign: 'center' }}>{error}</p> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #eee' }}>
                                <th title="종목명" style={{ padding: '8px', textAlign: 'left', fontWeight: 'normal', color: '#666', width: `${columnWidths.name}px` }}>종목명</th>
                                {visibleColumns.map(key => (
                                    <th key={key} title={ALL_COLUMNS[key].header} style={{ padding: '8px', textAlign: ALL_COLUMNS[key].align, fontWeight: 'normal', color: '#666', width: `${columnWidths[key]}px` }}>
                                        {ALL_COLUMNS[key].header}
                                    </th>
                                ))}
                                <th style={{ padding: '8px', width: `${columnWidths.remove}px` }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayData.map((item, index) => (
                                <tr 
                                    key={item.isuSrtCd || index} 
                                    style={{ borderBottom: '1px solid #f5f5f5' }}
                                >
                                    <td 
                                        title={item.nodeName}
                                        style={{ padding: '8px', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                                        onClick={() => setSelectedAsset({ symbol: item.isuSrtCd, type: 'KRX' })}
                                    >
                                        {item.nodeName}
                                    </td>
                                    {visibleColumns.map(key => (
                                        <td key={key} title={ALL_COLUMNS[key].format(item[key])} style={{ padding: '8px', textAlign: ALL_COLUMNS[key].align, color: ALL_COLUMNS[key].color?.(item[key]), fontWeight: 'normal' }}>
                                            {ALL_COLUMNS[key].format(item[key])}
                                        </td>
                                    ))}
                                    <td style={{ textAlign: 'center'}}>
                                        <button onClick={() => handleRemoveSymbol(item.isuSrtCd)} style={{ border: 'none', background: 'none', color: '#aaa', cursor: 'pointer' }}>×</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default WatchlistWidget;