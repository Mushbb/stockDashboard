import React, { memo, useState, useEffect } from 'react';
import * as TradingView from 'react-tradingview-embed';

const SettingsModal = ({ settings, onSave, onClose }) => {
    const [symbol, setSymbol] = useState(settings.symbol || 'AAPL');
    const [isLocked, setIsLocked] = useState(settings.isLocked || false);

    const handleSave = () => {
        onSave({ ...settings, symbol, isLocked });
        onClose();
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', color: '#333' }} onClick={e => e.stopPropagation()}>
                <h3>차트 설정</h3>
                <div>
                    <label>기본 종목 코드: </label>
                    <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="예: KRX:005930, AAPL" />
                </div>
                <div style={{ marginTop: '10px' }}>
                    <label>
                        <input type="checkbox" checked={isLocked} onChange={e => setIsLocked(e.target.checked)} />
                        대시보드 신호에 연동 잠금
                    </label>
                </div>
                <div style={{ marginTop: '20px' }}>
                    <button onClick={handleSave}>저장</button>
                    <button onClick={onClose} style={{ marginLeft: '10px' }}>취소</button>
                </div>
            </div>
        </div>
    );
};

const SymbolChartWidget = ({ widgetId, settings, onSettingsChange, editingWidgetId, onCloseSettings, width, height }) => {
    // const { selectedSymbol: dashboardSymbol } = useDashboard(); // 향후 컨텍스트에서 받을 전역 심볼
    const dashboardSymbol = null; // 임시값

    const { symbol: defaultSymbol = 'AAPL', isLocked = false } = settings;
    
    // 이 위젯의 설정 모달이 열려있는지 여부
    const isSettingsOpen = editingWidgetId === widgetId;

    // 위젯에 최종적으로 표시될 심볼. 잠겨있으면 자신의 기본 심볼, 아니면 대시보드 심볼을 따름.
    const effectiveSymbol = isLocked ? defaultSymbol : (dashboardSymbol || defaultSymbol);

    const handleSaveSettings = (newSettings) => {
        onSettingsChange(widgetId, newSettings); // 변경된 설정을 Dashboard.jsx로 전달
        onCloseSettings(); // 모달 닫기 신호
    };

    const handleClose = () => {
        onCloseSettings(); // 모달 닫기 신호
    };

    return (
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            {isSettingsOpen && (
                <SettingsModal 
                    settings={settings}
                    onSave={handleSaveSettings}
                    onClose={handleClose}
                />
            )}
            <div style={{ position: 'relative', flexGrow: 1 }}>
                <TradingView.AdvancedChart widgetProps={{
                    "width": width,
                    "height": height,
                    "symbol": effectiveSymbol,
                    "interval": "D",
                    "timezone": "Asia/Seoul",
                    "theme": "light",
                    "style": "1",
                    "locale": "kr",
                    "toolbar_bg": "#f1f3f6",
                    "enable_publishing": false,
                    "hide_side_toolbar": true,
                    "details": false,
                    "hotlist": false,
                    "allow_symbol_change": true,
                    "container_id": `tradingview-widget-container-${widgetId}`
                }} />
            </div>
        </div>
    );
};

export default memo(SymbolChartWidget);
