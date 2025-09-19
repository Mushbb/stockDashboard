import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import _ from 'lodash';
import TreemapChart from './TreemapChart';
import RankTable from './RankTable';
import ChartContainer from './ChartContainer';
import { useResizeObserver } from './useResizeObserver';

const AddWidgetModal = ({ onAdd, onClose }) => {
    const availableWidgets = [
        { name: '통합 시장 트리맵', type: 'TreemapChart', settings: { marketType: 'ALL' } },
        { name: '상승률 순위', type: 'RankTable', settings: { by: 'CHANGE_RATE', order: 'DESC', visibleColumns: ['currentPrice', 'changeRate'], columnWidths: { name: 80, currentPrice: 80, changeRate: 80, volume: 80, tradeValue: 80 } } },
        { name: '하락률 순위', type: 'RankTable', settings: { by: 'CHANGE_RATE', order: 'ASC', visibleColumns: ['currentPrice', 'changeRate'], columnWidths: { name: 80, currentPrice: 80, changeRate: 80, volume: 80, tradeValue: 80 } } },
        { name: '거래량 순위', type: 'RankTable', settings: { by: 'VOLUME', order: 'DESC', visibleColumns: ['currentPrice', 'volume'], columnWidths: { name: 80, currentPrice: 80, changeRate: 80, volume: 80, tradeValue: 80 } } },
        { name: '거래대금 순위', type: 'RankTable', settings: { by: 'TRADE_VALUE', order: 'DESC', visibleColumns: ['currentPrice', 'tradeValue'], columnWidths: { name: 80, currentPrice: 80, changeRate: 80, volume: 80, tradeValue: 80 } } },
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

const Widget = ({ widgetId, type, props }) => {
    const [ref, { width, height }] = useResizeObserver();

    // RankTable을 위한 limit 계산
    const rankTableLimit = (() => {
        if (type !== 'RankTable' || height <= 70) return 10; // 기본값
        const rowHeight = 35;
        return Math.floor((height - 70) / rowHeight);
    })();

    return (
        <div ref={ref} style={{ width: '100%', height: '100%' }}>
            {(() => {
                if (width === 0 || height === 0) return null;
                switch (type) {
                    case 'TreemapChart':
                        return <TreemapChart widgetId={widgetId} settings={props} width={width} height={height - 45} />;
                    case 'RankTable':
                        // 계산된 limit을 props에 추가하여 전달
                        return <RankTable widgetId={widgetId} settings={{...props, limit: rankTableLimit}} width={width} height={height} />;
                    default:
                        return <div>Unknown widget type</div>;
                }
            })()}
        </div>
    );
};

function Dashboard() {
    const [widgets, setWidgets] = useState({});
    const [layouts, setLayouts] = useState({ lg: [], md: [], sm: [] });
    const [currentBreakpoint, setCurrentBreakpoint] = useState('lg');
    const [loading, setLoading] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isAddModalOpen, setAddModalOpen] = useState(false);

    useEffect(() => {
        fetch('/api/widgets')
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    const newWidgets = {};
                    const newLayouts = { lg: [], md: [], sm: [] };
                    data.forEach(widget => {
                        const widgetId = widget.widgetId.toString();
                        newWidgets[widgetId] = { title: widget.widgetName, type: widget.widgetType, props: JSON.parse(widget.widgetSettings) };
                        const layoutInfo = JSON.parse(widget.layoutInfo);
                        Object.keys(layoutInfo).forEach(bp => {
                            if (newLayouts[bp] && layoutInfo[bp]) {
                                newLayouts[bp].push({ ...layoutInfo[bp], i: widgetId });
                            }
                        });
                    });
                    setWidgets(newWidgets);
                    setLayouts(newLayouts);
                }
            })
            .catch(error => console.error("Failed to load initial widgets:", error))
            .finally(() => setLoading(false));
    }, []);

    const changedLayoutsRef = useRef({});
    const debouncedSaveLayout = useCallback(_.debounce(() => {
        const layoutsToSave = { ...changedLayoutsRef.current };
        if (Object.keys(layoutsToSave).length === 0) return;
        Object.keys(layoutsToSave).forEach(widgetId => {
            const layoutInfo = layoutsToSave[widgetId];
            fetch(`/api/widgets/${widgetId}/layout`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(layoutInfo),
            }).catch(error => console.error(`Failed to save layout for widget ${widgetId}:`, error));
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
        const newLayoutItem = { i: 'new', x: 0, y: 0, w: 2, h: 2 }; // h 값을 2로 수정
        const defaultLayoutInfo = { lg: newLayoutItem, md: newLayoutItem, sm: newLayoutItem };
        const newWidgetData = {
            widgetName: widgetTemplate.name,
            widgetType: widgetTemplate.type,
            layoutInfo: JSON.stringify(defaultLayoutInfo),
            widgetSettings: JSON.stringify(widgetTemplate.settings),
        };
        fetch('/api/widgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newWidgetData) })
            .then(() => { window.location.reload(); })
            .catch(err => console.error('Failed to add widget:', err));
    };

    const handleRenameWidget = (widgetId) => {
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
    };

    const handleDeleteWidget = (widgetId) => {
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
    };

    if (loading) return <div>Loading Dashboard...</div>;

    return (
        <div style={{ fontFamily: 'sans-serif', padding: '20px', backgroundColor: '#f4f7f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ margin: 0 }}>주요 증시 현황 대시보드</h1>
                <div>
                    <button onClick={() => setIsEditMode(!isEditMode)}>{isEditMode ? '✅ 완료' : '✏️ 편집'}</button>
                    {isEditMode && <button onClick={() => setAddModalOpen(true)} style={{ marginLeft: '10px' }}>+ 위젯 추가</button>}
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
                            title={widgets[key].title}
                            isEditMode={isEditMode}
                            onRename={() => handleRenameWidget(key)}
                            onDelete={() => handleDeleteWidget(key)}
                        >
                            <Widget widgetId={key} type={widgets[key].type} props={widgets[key].props} />
                        </ChartContainer>
                    </div>
                ))}
            </ResponsiveGridLayout>
        </div>
    );
}

export default Dashboard;
