import React, { memo, useState, useEffect } from 'react';
import * as TradingView from 'react-tradingview-embed';

/**
 * SymbolChartWidget의 설정을 변경하는 모달 컴포넌트입니다.
 * @param {object} props - 컴포넌트 속성
 * @param {object} props.settings - 현재 위젯의 설정 객체
 * @param {function} props.onSave - '저장' 버튼 클릭 시 호출되는 함수
 * @param {function} props.onClose - 모달을 닫을 때 호출되는 함수
 */
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

/**
 * TradingView의 Advanced Chart를 임베드하여 보여주는 위젯입니다.
 * 해외 주식, 암호화폐 등 TradingView에서 지원하는 모든 종목을 표시할 수 있습니다.
 * @param {object} props - 컴포넌트 속성
 * @param {string} props.widgetId - 위젯의 고유 ID
 * @param {object} props.settings - 위젯의 설정값 (e.g., { symbol, isLocked })
 * @param {function} props.onSettingsChange - 위젯 설정 변경 시 호출되는 함수
 * @param {string|null} props.editingWidgetId - 현재 설정 중인 위젯의 ID
 * @param {function} props.onCloseSettings - 설정 모달을 닫는 함수
 * @param {number} props.width - 위젯의 너비
 * @param {number} props.height - 위젯의 높이
 */
const SymbolChartWidget = ({ widgetId, settings, onSettingsChange, editingWidgetId, onCloseSettings, width, height }) => {
    // TODO: 향후 대시보드 전체에서 공유되는 selectedSymbol을 컨텍스트로부터 받아 연동하는 기능 추가 예정
    const dashboardSymbol = null;

    const { symbol: defaultSymbol = 'AAPL', isLocked = false } = settings;
    
    const isSettingsOpen = editingWidgetId === widgetId;

    // 'isLocked'가 true이면 위젯의 기본 심볼을 사용하고, false이면 대시보드의 전역 심볼을 따릅니다.
    const effectiveSymbol = isLocked ? defaultSymbol : (dashboardSymbol || defaultSymbol);

    /** 설정 모달에서 '저장'을 눌렀을 때 호출됩니다. */
    const handleSaveSettings = (newSettings) => {
        onSettingsChange(widgetId, newSettings);
        onCloseSettings();
    };

    /** 설정 모달에서 '취소'나 배경을 클릭했을 때 호출됩니다. */
    const handleClose = () => {
        onCloseSettings();
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
