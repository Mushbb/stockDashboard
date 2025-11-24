import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { useDashboard } from '../contexts/DashboardContext';

/**
 * 국내 주식(KRX)의 시세 차트(캔들스틱 + 거래량)를 표시하는 위젯입니다.
 * Lightweight Charts 라이브러리를 사용하며, 종목 검색 기능을 포함합니다.
 * @param {object} props - 컴포넌트 속성
 * @param {string} props.widgetId - 위젯의 고유 ID
 * @param {object} props.settings - 위젯의 설정값 (e.g., { symbol: '005930' })
 * @param {number} props.width - 위젯의 현재 너비
 * @param {number} props.height - 위젯의 현재 높이
 * @param {function} props.onSettingsChange - 위젯 설정 변경 시 호출되는 함수
 */
const KrxChartWidget = ({ widgetId, settings, width, height, onSettingsChange }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const candlestickSeriesRef = useRef(null);
    const volumeSeriesRef = useRef(null);

    const { selectedAsset } = useDashboard();
    const { symbol = '005930' } = settings;

    // 차트 데이터 및 상태
    const [stockName, setStockName] = useState('');
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 종목 검색 관련 상태
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const searchContainerRef = useRef(null);

    /** 검색창 외부 클릭 시 검색 모드를 종료합니다. */
    useEffect(() => {
        function handleClickOutside(event) {
            if (searchContainerRef.current && !searchContainerred.current.contains(event.target)) {
                setIsSearching(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [searchContainerRef]);

    /** 대시보드 컨텍스트에서 선택된 자산이 변경되면, 이 위젯의 종목도 동기화합니다. */
    useEffect(() => {
        if (selectedAsset && selectedAsset.type === 'KRX' && selectedAsset.symbol !== symbol) {
            onSettingsChange(widgetId, { symbol: selectedAsset.symbol });
        }
    }, [selectedAsset, onSettingsChange, widgetId, symbol]);

    /** 사용자 입력에 따라 종목을 검색하고, 디바운싱을 적용하여 API 호출을 최소화합니다. */
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

    /** 검색 결과에서 특정 종목을 선택했을 때의 처리 로직입니다. */
    const handleSelectStock = (stock) => {
        onSettingsChange(widgetId, { ...settings, symbol: stock.symbol });
        setIsSearching(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    /** symbol이 변경될 때마다 해당 종목의 시세 이력 데이터를 가져옵니다. */
    useEffect(() => {
        if (!symbol) return;
        setLoading(true);
        setError(null);
        fetch(`/api/charts/krx/history?symbol=${symbol}&days=5844`) // 약 16년치 데이터
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

    /** 컴포넌트 마운트 시 차트를 초기화합니다. 이 효과는 한 번만 실행됩니다. */
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
            priceScaleId: '', // Y축을 캔들스틱과 공유하지 않음
        });
        chart.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

        return () => {
            chart.remove();
            chartRef.current = null;
        };
    }, []);

    /** chartData가 변경되면 차트의 캔들스틱과 거래량 데이터를 업데이트합니다. */
    useEffect(() => {
        if (!chartData || !candlestickSeriesRef.current || !volumeSeriesRef.current) return;

        const candleData = chartData.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close }));
        const volumeData = chartData.map(d => ({ time: d.time, value: d.volume, color: d.close > d.open ? 'rgba(209, 66, 66, 0.5)' : 'rgba(66, 135, 209, 0.5)' }));
        
        candlestickSeriesRef.current.setData(candleData);
        volumeSeriesRef.current.setData(volumeData);

    }, [chartData]);

    /** 위젯의 크기가 변경되면 차트의 크기를 조절합니다. */
    useEffect(() => {
        if (!chartRef.current || width === 0 || height === 0) return;
        chartRef.current.resize(width, height);
    }, [width, height]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* 차트 상단의 종목 정보 및 검색 UI */}
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(255, 255, 255, 0.8)', padding: '0px', borderRadius: '5px', width: `${width - 20}px`, boxSizing: 'border-box' }}>
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
                                    <li key={item.symbol} onClick={() => handleSelectStock(item)} style={{ padding: '8px 10px', cursor: 'pointer' }}>
                                        {item.name} <span style={{color: '#888'}}>({item.symbol})</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div onClick={() => setIsSearching(true)} style={{ cursor: 'pointer' }}>
                        <h3 style={{ margin: 0, fontSize: 'clamp(1rem, 4vw, 1.5rem)', color: '#333' }}>{stockName || '종목 정보 없음'}</h3>
                        <span style={{ fontSize: 'clamp(0.8rem, 3vw, 1.2rem)', color: '#666' }}>{symbol}</span>
                    </div>
                )}
            </div>

            {/* 차트가 렌더링될 컨테이너 */}
            <div ref={chartContainerRef} style={{ width: '100%', height: '100%', pointerEvents: isSearching ? 'none' : 'auto' }} />

            {/* 로딩 및 에러 상태 표시 */}
            {(loading || error) && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    {loading ? 'Loading...' : `Error: ${error}`}
                </div>
            )}
        </div>
    );
};

export default KrxChartWidget;
