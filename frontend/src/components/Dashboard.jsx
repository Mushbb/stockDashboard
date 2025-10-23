import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import _ from 'lodash';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { DataProvider } from '../contexts/DataProvider'; // DataProvider 임포트
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
import useDashboard from "../contexts/DashboardContext.jsx";

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
                        return <TreemapChart widgetId={widgetId} settings={props} width={width} height={height-40} onSettingsChange={onSettingsChange} />;
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
                        return <MemoWidget widgetId={widgetId} settings={props} onSettingsChange={onSettingsChange} />;
                    default:
                        return <div>Unknown widget type</div>;
                }
            })()}
        </div>
    );
};

const WIDGET_SIZE_LIMITS = {
    TextWidget: { minW: 1, maxW: 2, minH: 1, maxH: 1 },
    MemoWidget: { minW: 1, maxW: 4, minH: 1, maxH: 4 },
    KrxChartWidget: { minW: 2, maxW: 4, minH: 2, maxH: 2 },
    SymbolChartWidget: { minW: 2, maxW: 4, minH: 2, maxH: 2 },
    TreemapChart: { minW: 2, maxW: 4, minH: 2, maxH: 4 },
    RankTable: { minW: 1, maxW: 4, minH: 2, maxH: 4 },
    WatchlistWidget: { minW: 1, maxW: 4, minH: 2, maxH: 4 },
};

function Dashboard() {
    const { user, logout } = useAuth();
    const { showToast } = useToast();
    const { selectedAsset } = useDashboard();
    const [widgets, setWidgets] = useState({});
    const [layouts, setLayouts] = useState({ lg: [], md: [], sm: [] });
    const [loading, setLoading] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [currentBreakpoint, setCurrentBreakpoint] = useState('lg');
    const [editingWidgetId, setEditingWidgetId] = useState(null);
    const [dashboardTitle, setDashboardTitle] = useState('');

    useEffect(() => {
        if (user) {
            const savedTitle = localStorage.getItem('dashboardTitle');
            setDashboardTitle(savedTitle || `${user.username}님의 대시보드`);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            setLoading(true);
            fetch('/api/widgets')
                .then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to fetch widgets')))
                .then(data => {
                    if (data && data.length > 0) {
                        const newWidgets = {};
                        const newLayouts = { lg: [], md: [], sm: [] };
                        data.forEach(widget => {
                            const widgetId = widget.widgetId.toString();
                            newWidgets[widgetId] = { title: widget.widgetName, type: widget.widgetType, props: JSON.parse(widget.widgetSettings) };
                            const layoutInfo = JSON.parse(widget.layoutInfo);
                            const limits = WIDGET_SIZE_LIMITS[widget.widgetType] || {};
                            Object.keys(layoutInfo).forEach(bp => {
                                if (newLayouts[bp] && layoutInfo[bp]) {
                                    newLayouts[bp].push({ ...layoutInfo[bp], i: widgetId, ...limits });
                                }
                            });
                        });
                        setWidgets(newWidgets);
                        setLayouts(newLayouts);
                    }
                })
                .catch(error => {
                    console.error(error);
                    if (error.message.includes('401')) setLoginModalOpen(true);
                })
                .finally(() => setLoading(false));
        } else {
            setWidgets({});
            setLayouts({ lg: [], md: [], sm: [] });
            setLoading(false);
        }
    }, [user]);

    const changedLayoutsRef = useRef({});
    const debouncedSaveLayout = useCallback(_.debounce(() => {
        const layoutsToSave = { ...changedLayoutsRef.current };
        if (Object.keys(layoutsToSave).length === 0) return;
        Object.keys(layoutsToSave).forEach(widgetId => {
            const layoutInfo = layoutsToSave[widgetId];
            fetch(`/api/widgets/${widgetId}/layout`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(layoutInfo) })
                .catch(error => console.error(`Failed to save layout for widget ${widgetId}:`, error));
        });
        changedLayoutsRef.current = {};
    }, 2000), []);

    const onLayoutChange = (layout, allLayouts) => {
        setLayouts(allLayouts);
        const oldLayout = layouts[currentBreakpoint] || [];
        const changedItems = layout.filter(newItem => {
            const oldItem = oldLayout.find(item => item.i === newItem.i);
            return oldItem && !_.isEqual(oldItem, newItem);
        });
        if (changedItems.length > 0) {
            changedItems.forEach(item => {
                const widgetId = item.i;
                changedLayoutsRef.current[widgetId] = { lg: allLayouts.lg.find(l => l.i === widgetId), md: allLayouts.md.find(l => l.i === widgetId), sm: allLayouts.sm.find(l => l.i === widgetId) };
            });
            debouncedSaveLayout();
        }
    };

    const onBreakpointChange = (newBreakpoint) => setCurrentBreakpoint(newBreakpoint);

    const handleAddWidget = (widgetTemplate) => {
        setAddModalOpen(false);
        const limits = WIDGET_SIZE_LIMITS[widgetTemplate.type] || {};
        const newLayoutItem = { i: 'new', x: 0, y: 0, w: 2, h: 2, ...limits };
        const defaultLayoutInfo = { lg: newLayoutItem, md: newLayoutItem, sm: newLayoutItem };
        const newWidgetData = { widgetName: widgetTemplate.name, widgetType: widgetTemplate.type, layoutInfo: JSON.stringify(defaultLayoutInfo), widgetSettings: JSON.stringify(widgetTemplate.settings) };
        fetch('/api/widgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newWidgetData) })
            .then(() => { window.location.reload(); })
            .catch(err => console.error('Failed to add widget:', err));
    };

    const handleRenameWidget = useCallback((event) => {
        const widgetId = event.currentTarget.dataset.id;
        const newName = prompt("새로운 위젯 이름을 입력하세요:", widgets[widgetId].title);
        if (newName && newName !== widgets[widgetId].title) {
            const originalWidgets = widgets;
            setWidgets(prev => ({ ...prev, [widgetId]: { ...prev[widgetId], title: newName } }));
            fetch(`/api/widgets/${widgetId}/name`, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: newName })
                .catch(err => {
                    console.error('Failed to rename widget:', err);
                    setWidgets(originalWidgets);
                });
        }
    }, [widgets]);

    const handleDeleteWidget = useCallback((event) => {
        const widgetId = event.currentTarget.dataset.id;
        if (window.confirm(`'${widgets[widgetId].title}' 위젯을 삭제하시겠습니까?`)) {
            const originalWidgets = widgets;
            const originalLayouts = layouts;
            const newWidgets = { ...widgets };
            delete newWidgets[widgetId];
            const newLayouts = { ...layouts };
            Object.keys(newLayouts).forEach(bp => { newLayouts[bp] = newLayouts[bp].filter(l => l.i !== widgetId); });
            setWidgets(newWidgets);
            setLayouts(newLayouts);
            fetch(`/api/widgets/${widgetId}`, { method: 'DELETE' })
                .catch(err => {
                    console.error('Failed to delete widget:', err);
                    setWidgets(originalWidgets);
                    setLayouts(originalLayouts);
                });
        }
    }, [widgets, layouts]);

    const handleSettings = useCallback((event) => {
        const widgetId = event.currentTarget.dataset.id;
        setEditingWidgetId(widgetId);
    }, []);

    const handleCloseSettings = useCallback(() => {
        setEditingWidgetId(null);
    }, []);

    // 중앙화된 위젯 설정 저장 로직
    const debouncedSave = useRef(
        _.debounce((widgetId, settingsToSave) => {
            fetch(`/api/widgets/${widgetId}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settingsToSave),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                showToast('설정이 저장되었습니다.', 'info');
            })
            .catch(err => {
                console.error(`Failed to save widget settings for ${widgetId}:`, err);
                showToast('설정 저장에 실패했습니다.', 'error');
            });
        }, 1000)
    ).current;

    const handleWidgetSettingsChange = useCallback((widgetId, newSettings) => {
        // UI 즉시 반응을 위해 위젯 상태를 먼저 업데이트
        setWidgets(prev => ({
            ...prev,
            [widgetId]: { ...prev[widgetId], props: newSettings }
        }));
        
        // 실제 저장은 debounce를 통해 실행
        const { limit, ...settingsToSave } = newSettings;
        debouncedSave(widgetId, settingsToSave);
    }, [debouncedSave]);

    // 현재 활성화된 위젯을 기반으로 DataProvider가 요청할 데이터 키 목록을 생성
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
        const newTitle = prompt("새로운 대시보드 제목을 입력하세요:", dashboardTitle);
        if (newTitle && newTitle !== dashboardTitle) {
            setDashboardTitle(newTitle);
            localStorage.setItem('dashboardTitle', newTitle);
        }
    };


    if (loading && !user) return <div>Loading...</div>;

    if (!user) {
        return (
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
                <h1>로그인이 필요합니다.</h1>
                <button onClick={() => setLoginModalOpen(true)}>로그인 / 회원가입</button>
                {isLoginModalOpen && <LoginModal onClose={() => setLoginModalOpen(false)} />}
            </div>
        );
    }

    return (
        <DataProvider requiredDataKeys={requiredDataKeys}>
            <div style={{ fontFamily: 'sans-serif', padding: '20px', backgroundColor: '#f4f7f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', height: '50px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={handleTitleChange}>
                        <h1 style={{ 
                            margin: 0, 
                            fontSize: 'clamp(1.2rem, 5vw, 1.8rem)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }} title="제목 변경">{dashboardTitle}</h1>
                    </div>
                    <div style={{ display: 'flex', marginLeft: '10px' }}>
                        <button 
                            onClick={() => setIsEditMode(!isEditMode)} 
                            style={{ 
                                padding: '0 15px', 
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
                                style={{ padding: '0 15px', border: '1px solid #ccc', borderLeft: 'none', background: 'white', cursor: 'pointer' }}
                            >
                                +
                            </button>}
                        <button 
                            onClick={logout} 
                            style={{ padding: '0 15px', border: '1px solid #ccc', borderLeft: 'none', background: 'white', cursor: 'pointer' }}
                        >
                            로그아웃
                        </button>
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
                    onBreakpointChange={onBreakpointChange}
                    style={{ transform: 'scale(1)' }}
                >
                    {Object.keys(widgets).map(key => (
                        <div key={key}>
                            <ChartContainer 
                                widgetId={key}
                                title={widgets[key].title}
                                isEditMode={isEditMode}
                                onRename={handleRenameWidget}
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