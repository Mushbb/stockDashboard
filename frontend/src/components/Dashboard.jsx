import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import _ from 'lodash';
import { useAuth } from '../contexts/AuthContext';
import { DataProvider } from '../contexts/DataProvider';
import { LoginModal } from './LoginModal';
import TreemapChart from './TreemapChart';
import RankTable from './RankTable';
import ChartContainer from './ChartContainer';
import { useResizeObserver } from './useResizeObserver';
import SymbolChartWidget from './SymbolChartWidget';
import KrxChartWidget from './KrxChartWidget';
import TextWidget from './TextWidget';
import MemoWidget from './MemoWidget';
import WatchlistWidget from './WatchlistWidget';
import { useDashboard } from "../contexts/DashboardContext.jsx";

const AddWidgetModal = ({ onAdd, onClose }) => {
    const availableWidgets = [
        { name: '지표 텍스트', type: 'TextWidget', settings: { dataKey: 'index_KOSPI', title: '코스피' } },
        { name: '메모장', type: 'MemoWidget', settings: { content: '' } },
        { name: '국내 주식 차트', type: 'KrxChartWidget', settings: { symbol: '005930' } },
        { name: '글로벌 차트 (해외/코인)', type: 'SymbolChartWidget', settings: { symbol: 'AAPL' } },
        { name: '통합 시장 트리맵', type: 'TreemapChart', settings: { marketType: 'ALL' } },
        { name: '상승률 순위', type: 'RankTable', settings: { by: 'CHANGE_RATE', order: 'DESC', visibleColumns: ['currentPrice', 'changeRate'], columnWidths: { name: 80, currentPrice: 80, changeRate: 80, volume: 80, tradeValue: 80 } } },
        { name: '하락률 순위', type: 'RankTable', settings: { by: 'CHANGE_RATE', order: 'ASC', visibleColumns: ['currentPrice', 'changeRate'], columnWidths: { name: 80, currentPrice: 80, changeRate: 80, volume: 80, tradeValue: 80 } } },
        { name: '거래량 순위', type: 'RankTable', settings: { by: 'VOLUME', order: 'DESC', visibleColumns: ['currentPrice', 'volume'], columnWidths: { name: 80, currentPrice: 80, changeRate: 80, volume: 80, tradeValue: 80 } } },
        { name: '거래대금 순위', type: 'RankTable', settings: { by: 'TRADE_VALUE', order: 'DESC', visibleColumns: ['currentPrice', 'tradeValue'], columnWidths: { name: 80, currentPrice: 80, changeRate: 80, volume: 80, tradeValue: 80 } } },
        { name: '관심종목', type: 'WatchlistWidget', settings: { visibleColumns: ['currentPrice', 'changeRate'], columnWidths: { name: 80, currentPrice: 80, changeRate: 80, volume: 80, tradeValue: 80 } } },
    ];
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', color: '#333' }} onClick={e => e.stopPropagation()}>
                <h3>추가할 위젯 선택</h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {availableWidgets.map((widget, index) => (
                        <li key={index} onClick={() => onAdd(widget)} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                            {widget.name}
                        </li>
                    ))}
                </ul>
                <button onClick={onClose} style={{ marginTop: '10px' }}>닫기</button>
            </div>
        </div>
    );
};

const ResponsiveGridLayout = WidthProvider(Responsive);

const Widget = ({ widgetId, type, props, onSettingsChange, editingWidgetId, onCloseSettings, isEditMode }) => {
    const [ref, { width, height }] = useResizeObserver();
    const rankTableLimit = (() => {
        if (type !== 'RankTable' || height <= 70) return 10;
        const rowHeight = 35;
        return Math.floor((height - 70) / rowHeight);
    })();
    return (
        <div ref={ref} style={{ width: '100%', height: '100%' }}>
            {(() => {
                if (width === 0 || height === 0) return null;
                switch (type) {
                    case 'TreemapChart':
                        return <TreemapChart widgetId={widgetId} settings={props} width={width} height={height-50} onSettingsChange={onSettingsChange} />;
                    case 'RankTable':
                        return <RankTable widgetId={widgetId} settings={{...props, limit: rankTableLimit}} width={width} height={height} onSettingsChange={onSettingsChange} />;
                    case 'WatchlistWidget':
                        return <WatchlistWidget widgetId={widgetId} settings={{...props, limit: rankTableLimit}} width={width} height={height} onSettingsChange={onSettingsChange} />;
                    case 'SymbolChartWidget':
                        return <SymbolChartWidget widgetId={widgetId} settings={props} width={width} height={height} onSettingsChange={onSettingsChange} editingWidgetId={editingWidgetId} onCloseSettings={onCloseSettings} />;
                    case 'KrxChartWidget':
                        return <KrxChartWidget widgetId={widgetId} settings={props} width={width} height={height} onSettingsChange={onSettingsChange} />;
                    case 'TextWidget':
                        return <TextWidget widgetId={widgetId} settings={props} onSettingsChange={onSettingsChange} isEditMode={isEditMode} />;
                    case 'MemoWidget':
                        return <MemoWidget widgetId={widgetId} settings={props} onSettingsChange={onSettingsChange} isEditMode={isEditMode} />;
                    default:
                        return <div>Unknown widget type</div>;
                }
            })()}
        </div>
    );
};

function Dashboard() {
    const { user, logout } = useAuth();
    const {
        widgets,
        layouts,
        loading,
        onLayoutChange,
        addWidget,
        removeWidget,
        updateWidgetSettings,
        renameWidget, // renameWidget 가져오기
        WIDGET_SIZE_LIMITS
    } = useDashboard();

    const [isEditMode, setIsEditMode] = useState(false);
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [editingWidgetId, setEditingWidgetId] = useState(null);
    const [dashboardTitle, setDashboardTitle] = useState('');

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    useEffect(() => {
        if (user) {
            const savedTitle = localStorage.getItem('dashboardTitle');
            setDashboardTitle(savedTitle || `${user.username}님의 대시보드`);
        } else {
            setDashboardTitle('샘플 대시보드');
        }
    }, [user]);

    const handleAddWidget = (widgetTemplate) => {
        setAddModalOpen(false);
        addWidget(widgetTemplate);
    };

    const handleDeleteWidget = useCallback((event) => {
        const widgetId = event.currentTarget.dataset.id;
        removeWidget(widgetId);
    }, [removeWidget]);

    const handleRenameWidget = useCallback((event) => {
        const widgetId = event.currentTarget.dataset.id;
        const currentName = widgets[widgetId]?.title || '';
        const newName = prompt("새로운 위젯 이름을 입력하세요:", currentName);

        if (newName && newName !== currentName) {
            renameWidget(widgetId, newName);
        }
    }, [widgets, renameWidget]);

    const handleSettings = useCallback((event) => {
        const widgetId = event.currentTarget.dataset.id;
        setEditingWidgetId(widgetId);
    }, []);

    const handleCloseSettings = useCallback(() => {
        setEditingWidgetId(null);
    }, []);

    const handleWidgetSettingsChange = useCallback((widgetId, newSettings) => {
        updateWidgetSettings(widgetId, newSettings);
    }, [updateWidgetSettings]);

    const requiredDataKeys = useMemo(() => {
        const keys = new Set();
        Object.values(widgets).forEach(widget => {
            const settings = widget.props || {};
            switch (widget.type) {
                case 'TextWidget':
                    keys.add(settings.dataKey || 'index_KOSPI');
                    break;
                case 'TreemapChart':
                    keys.add(`treemap_${(settings.marketType || 'ALL').toUpperCase()}`);
                    break;
                case 'RankTable':
                    if (settings.mode === 'top-and-bottom') {
                        keys.add(`rank_${(settings.market || 'ALL').toUpperCase()}_CHANGE_RATE_TOP_AND_BOTTOM`);
                    } else {
                        const by = settings.by || 'CHANGE_RATE';
                        const order = settings.order || 'DESC';
                        const market = settings.market || 'ALL';
                        keys.add(`rank_${market.toUpperCase()}_${by.toUpperCase()}_${order.toUpperCase()}`);
                    }
                    break;
                default:
                    break;
            }
        });
        return Array.from(keys);
    }, [widgets]);

    const handleTitleChange = () => {
        if (!user) return;
        const newTitle = prompt("새로운 대시보드 제목을 입력하세요:", dashboardTitle);
        if (newTitle && newTitle !== dashboardTitle) {
            setDashboardTitle(newTitle);
            localStorage.setItem('dashboardTitle', newTitle);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <DataProvider requiredDataKeys={requiredDataKeys}>
            {isLoginModalOpen && <LoginModal onClose={() => setLoginModalOpen(false)} />}

            <div style={{ fontFamily: 'sans-serif', padding: '5px', backgroundColor: '#f4f7f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', height: '50px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', cursor: user ? 'pointer' : 'default' }} onClick={handleTitleChange}>
                        <h1 style={{
                            margin: 0,
                            fontSize: 'clamp(1.2rem, 5vw, 1.8rem)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }} title={user ? "제목 변경" : ""}>{dashboardTitle}</h1>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginLeft: '10px' }}>
                        {!user && <span className="demo-message">체험용 대시보드입니다. 변경사항은 저장되지 않습니다.</span>}
                        <button
                            onClick={() => setIsEditMode(!isEditMode)}
                            style={{
                                padding: '0 15px', height: '40px',
                                border: '1px solid #ccc',
                                background: isEditMode ? '#e0e0e0' : 'white',
                                cursor: 'pointer'
                            }}
                        >
                            {isEditMode ? '✅' : '✏️'}
                        </button>
                        {isEditMode &&
                            <button
                                onClick={() => setAddModalOpen(true)}
                                style={{ padding: '0 15px', height: '40px', border: '1px solid #ccc', borderLeft: 'none', background: 'white', cursor: 'pointer' }}
                            >
                                +
                            </button>}
                        {user ? (
                            <button
                                onClick={logout}
                                style={{ padding: '0 15px', height: '40px', border: '1px solid #ccc', borderLeft: 'none', background: 'white', cursor: 'pointer' }}
                            >
                                로그아웃
                            </button>
                        ) : (
                            <button
                                onClick={() => setLoginModalOpen(true)}
                                style={{ padding: '0 15px', height: '40px', border: '1px solid #ccc', borderLeft: 'none', background: 'white', cursor: 'pointer' }}
                            >
                                로그인
                            </button>
                        )}
                    </div>
                </div>

                {isAddModalOpen && <AddWidgetModal onAdd={handleAddWidget} onClose={() => setAddModalOpen(false)} />}

                <ResponsiveGridLayout
                    className="layout"
                    layouts={layouts}
                    breakpoints={{ lg: 1200, md: 768, sm: 0 }}
                    cols={{ lg: 4, md: 3, sm: 2 }}
                    rowHeight={250}
                    isDraggable={isEditMode}
                    isResizable={isEditMode}
                    draggableHandle=".widget-title"
                    onLayoutChange={onLayoutChange}
                    style={{ transform: 'scale(1)' }}
                >
                    {Object.keys(widgets).map(key => (
                        <div key={key} data-grid={layouts.lg.find(l => l.i === key)} style={{...WIDGET_SIZE_LIMITS[widgets[key].type]}}>
                            <ChartContainer
                                widgetId={key}
                                title={widgets[key].title}
                                isEditMode={isEditMode}
                                onRename={user ? handleRenameWidget : null} // 로그인 시에만 이름 변경 가능
                                onDelete={handleDeleteWidget}
                                onSettings={widgets[key].type === 'SymbolChartWidget' ? handleSettings : null}
                            >
                                <Widget
                                    widgetId={key}
                                    type={widgets[key].type}
                                    props={widgets[key].props}
                                    onSettingsChange={handleWidgetSettingsChange}
                                    editingWidgetId={editingWidgetId}
                                    onCloseSettings={handleCloseSettings}
                                    isEditMode={isEditMode}
                                />
                            </ChartContainer>
                        </div>
                    ))}
                </ResponsiveGridLayout>
            </div>
        </DataProvider>
    );
}

export default Dashboard;