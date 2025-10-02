import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { useDashboard } from '../contexts/DashboardContext';

const KrxChartWidget = ({ widgetId, settings, width, height, onSettingsChange }) => {
    const chartContainerRef = useRef(null);
    const { selectedAsset } = useDashboard();
    
    const { symbol = '005930' } = settings;

    const [stockName, setStockName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 검색 기능 상태
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [hoveredSymbol, setHoveredSymbol] = useState(null);
    const searchContainerRef = useRef(null);

    // 외부 클릭 감지를 위한 useEffect
    useEffect(() => {
        function handleClickOutside(event) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setIsSearching(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [searchContainerRef]);

    // 컨텍스트의 변경을 감지하여 DB에 업데이트
    useEffect(() => {
        if (selectedAsset && selectedAsset.type === 'KRX' && selectedAsset.symbol !== symbol) {
            onSettingsChange(widgetId, { ...settings, symbol: selectedAsset.symbol });
        }
    }, [selectedAsset, onSettingsChange, widgetId, settings, symbol]);

    // 검색 쿼리가 변경될 때 API 호출 (디바운싱 적용)
    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }
        const debounceTimer = setTimeout(() => {
            fetch(`/api/stocks/search?query=${searchQuery}`)
                .then(res => res.json())
                .then(data => setSearchResults(data))
                .catch(err => console.error('Search failed:', err));
        }, 300);
        return () => clearTimeout(debounceTimer);
    }, [searchQuery]);

    const handleSelectStock = (stock) => {
        onSettingsChange(widgetId, { ...settings, symbol: stock.symbol });
        setIsSearching(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    // 차트 생성 및 데이터 로딩
    useEffect(() => {
        if (!chartContainerRef.current || width === 0 || height === 0) return;

        setLoading(true);
        setError(null);

        const chart = createChart(chartContainerRef.current, {
            width: width,
            height: height,
            layout: { background: { color: '#ffffff' }, textColor: '#333' },
            grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
            timeScale: { borderColor: '#cccccc' },
        });

        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#d14242', downColor: '#4287d1', borderDownColor: '#4287d1',
            borderUpColor: '#d14242', wickDownColor: '#4287d1', wickUpColor: '#d14242',
        });

        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: '',
        });
        chart.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

        fetch(`/api/charts/krx/history?symbol=${symbol}&days=5844`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(chartData => {
                setStockName(chartData.stockName);
                const candleData = chartData.history.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close }));
                const volumeData = chartData.history.map(d => ({ time: d.time, value: d.volume, color: d.close > d.open ? 'rgba(209, 66, 66, 0.5)' : 'rgba(66, 135, 209, 0.5)' }));
                candlestickSeries.setData(candleData);
                volumeSeries.setData(volumeData);
                setLoading(false);
            })
            .catch(err => {
                console.error("Fetch data error:", err);
                setError(err.message);
                setLoading(false);
            });

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                chart.resize(entry.contentRect.width, entry.contentRect.height);
            }
        });
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
        };
    }, [symbol, width, height]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>
                {isSearching ? (
                    <div ref={searchContainerRef}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onCompositionStart={() => isComposing.current = true}
                            onCompositionEnd={() => isComposing.current = false}
                            placeholder="종목명 검색..."
                            autoFocus
                        />
                        {searchResults.length > 0 && (
                            <ul style={{ background: 'white', border: '1px solid #ccc', listStyle: 'none', padding: 0, margin: 0, position: 'absolute', width: '100%', pointerEvents: isSearching ? 'auto' : 'none' }}>
                                {searchResults.map(item => (
                                    <li 
                                        key={item.symbol} 
                                        onClick={() => handleSelectStock(item)}
                                        onMouseEnter={() => setHoveredSymbol(item.symbol)}
                                        onMouseLeave={() => setHoveredSymbol(null)}
                                        style={{
                                            padding: '8px 10px',
                                            cursor: 'pointer',
                                            background: hoveredSymbol === item.symbol ? '#f0f0f0' : 'white'
                                        }}
                                    >
                                        {item.name} <span style={{color: '#888'}}>({item.symbol})</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div onClick={() => setIsSearching(true)} style={{ cursor: 'pointer' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>{stockName}</h3>
                        <span style={{ fontSize: '14px', color: '#666' }}>{symbol}</span>
                    </div>
                )}
            </div>
            <div ref={chartContainerRef} style={{ width: '100%', height: '100%', pointerEvents: isSearching ? 'none' : 'auto' }} />
            {(loading || error) && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    {loading ? 'Loading...' : `Error: ${error}`}
                </div>
            )}
        </div>
    );
};

export default KrxChartWidget;