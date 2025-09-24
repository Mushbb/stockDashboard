import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, createTextWatermark } from 'lightweight-charts';

const KrxChartWidget = ({ settings, width, height }) => {
    const chartContainerRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { symbol = '005930' } = settings;

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

        fetch(`/api/charts/krx/history?symbol=${symbol}&days=365`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(chartData => {
                if (!chartContainerRef.current) return;

                const mainPane = chart.panes()[0];
                createTextWatermark(mainPane, {
                    horzAlign: 'left',
                    vertAlign: 'top',
                    lines: [
                        {
                            text: `${chartData.stockName} (${symbol})`,
                            color: 'rgba(0, 0, 0, 0.4)',
                            fontSize: 24,
                            fontWeight: 'bold',
                        },
                    ],
                });

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
                const { width, height } = entry.contentRect;
                chart.resize(width, height);
            }
        });
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
        };
    }, [symbol, width, height]);

    return (
        <div ref={chartContainerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
            {(loading || error) && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    {loading ? 'Loading...' : `Error: ${error}`}
                </div>
            )}
        </div>
    );
};

export default KrxChartWidget;
