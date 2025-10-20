import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { useDashboard } from '../contexts/DashboardContext';

const KrxChartWidget = ({ widgetId, settings, width, height, onSettingsChange }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const candlestickSeriesRef = useRef(null);
    const volumeSeriesRef = useRef(null);

    const { selectedAsset } = useDashboard();
    const { symbol = '005930' } = settings;

    const [stockName, setStockName] = useState('');
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 검색 관련 상태
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const searchContainerRef = useRef(null);

    // 외부 클릭 감지
    useEffect(() => {
        function handleClickOutside(event) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setIsSearching(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [searchContainerRef]);

    // 대시보드 컨텍스트와 동기화
    useEffect(() => {
        if (selectedAsset && selectedAsset.type === 'KRX' && selectedAsset.symbol !== symbol) {
            onSettingsChange(widgetId, { symbol: selectedAsset.symbol });
        }
    }, [selectedAsset, onSettingsChange, widgetId, symbol]);

    // 종목 검색
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

    // 데이터 로딩
    useEffect(() => {
        if (!symbol) return;
        setLoading(true);
        setError(null);
        fetch(`/api/charts/krx/history?symbol=${symbol}&days=5844`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                setStockName(data.stockName);
                setChartData(data.history);
            })
            .catch(err => {
                console.error("Fetch data error:", err);
                setChartData(null);
                setError(err.message);
            })
            .finally(() => setLoading(false));
    }, [symbol]);

    // 차트 초기 생성 (한 번만 실행)
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: { background: { color: '#ffffff' }, textColor: '#333' },
            grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
            timeScale: { borderColor: '#cccccc' },
        });
        chartRef.current = chart;

        candlestickSeriesRef.current = chart.addSeries(CandlestickSeries, {
            upColor: '#d14242', downColor: '#4287d1', borderDownColor: '#4287d1',
            borderUpColor: '#d14242', wickDownColor: '#4287d1', wickUpColor: '#d14242',
        });

        volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: '',
        });
        chart.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

        return () => {
            chart.remove();
            chartRef.current = null;
        };
    }, []);

    // 데이터 변경 시 차트 업데이트
    useEffect(() => {
        if (!chartData || !candlestickSeriesRef.current || !volumeSeriesRef.current) return;

        const candleData = chartData.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close }));
        const volumeData = chartData.map(d => ({ time: d.time, value: d.volume, color: d.close > d.open ? 'rgba(209, 66, 66, 0.5)' : 'rgba(66, 135, 209, 0.5)' }));
        
        candlestickSeriesRef.current.setData(candleData);
        volumeSeriesRef.current.setData(volumeData);

    }, [chartData]);

    // 크기 변경 시 차트 리사이즈
    useEffect(() => {
        if (!chartRef.current || width === 0 || height === 0) return;
        chartRef.current.resize(width, height);
    }, [width, height]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(255, 255, 255, 0.8)', padding: '5px', borderRadius: '5px' }}>
                {isSearching ? (
                    <div ref={searchContainerRef}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="종목명 검색..."
                            autoFocus
                        />
                        {searchResults.length > 0 && (
                            <ul style={{ background: 'white', border: '1px solid #ccc', listStyle: 'none', padding: 0, margin: 0, position: 'absolute', width: '100%', pointerEvents: isSearching ? 'auto' : 'none' }}>
                                {searchResults.map(item => (
                                    <li 
                                        key={item.symbol} 
                                        onClick={() => handleSelectStock(item)}
                                        style={{ padding: '8px 10px', cursor: 'pointer' }}
                                    >
                                        {item.name} <span style={{color: '#888'}}>({item.symbol})</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div onClick={() => setIsSearching(true)} style={{ cursor: 'pointer' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>{stockName || '종목 정보 없음'}</h3>
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
