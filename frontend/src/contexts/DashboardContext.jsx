import React, {createContext, useState, useContext, useEffect, useCallback, useRef} from 'react';
import {useAuth} from './AuthContext';
import _ from 'lodash';
import {useToast} from "./ToastContext.jsx";

const DashboardContext = createContext(null);

export const useDashboard = () => {
    return useContext(DashboardContext);
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

const sampleWidgets = {
    '1': { title: '코스피', type: 'TextWidget', props: { dataKey: 'index_KOSPI', title: '코스피' } },
    '2': { title: '코스닥', type: 'TextWidget', props: { dataKey: 'index_KOSDAQ', title: '코스닥' } },
    '3': { title: '삼성전자', type: 'KrxChartWidget', props: { symbol: '005930' } },
    '4': { title: '통합 시장 트리맵', type: 'TreemapChart', props: { marketType: 'ALL' } },
    '5': { title: '상승률 순위', type: 'RankTable', props: { by: 'CHANGE_RATE', order: 'DESC', visibleColumns: ['currentPrice', 'changeRate'], columnWidths: { name: 80, currentPrice: 80, changeRate: 80, volume: 80, tradeValue: 80 } } },
};

const sampleLayouts = {
    lg: [
        { i: '1', x: 0, y: 0, w: 1, h: 1, ...WIDGET_SIZE_LIMITS.TextWidget },
        { i: '2', x: 1, y: 0, w: 1, h: 1, ...WIDGET_SIZE_LIMITS.TextWidget },
        { i: '3', x: 0, y: 1, w: 2, h: 2, ...WIDGET_SIZE_LIMITS.KrxChartWidget },
        { i: '4', x: 2, y: 0, w: 2, h: 4, ...WIDGET_SIZE_LIMITS.TreemapChart },
        { i: '5', x: 0, y: 3, w: 2, h: 2, ...WIDGET_SIZE_LIMITS.RankTable },
    ],
    md: [
        { i: '1', x: 0, y: 0, w: 1, h: 1, ...WIDGET_SIZE_LIMITS.TextWidget },
        { i: '2', x: 1, y: 0, w: 1, h: 1, ...WIDGET_SIZE_LIMITS.TextWidget },
        { i: '3', x: 0, y: 1, w: 2, h: 2, ...WIDGET_SIZE_LIMITS.KrxChartWidget },
        { i: '4', x: 0, y: 3, w: 2, h: 2, ...WIDGET_SIZE_LIMITS.TreemapChart },
        { i: '5', x: 0, y: 5, w: 2, h: 2, ...WIDGET_SIZE_LIMITS.RankTable },
    ],
    sm: [
        { i: '1', x: 0, y: 0, w: 1, h: 1, ...WIDGET_SIZE_LIMITS.TextWidget },
        { i: '2', x: 1, y: 0, w: 1, h: 1, ...WIDGET_SIZE_LIMITS.TextWidget },
        { i: '3', x: 0, y: 1, w: 2, h: 2, ...WIDGET_SIZE_LIMITS.KrxChartWidget },
        { i: '4', x: 0, y: 3, w: 2, h: 2, ...WIDGET_SIZE_LIMITS.TreemapChart },
        { i: '5', x: 0, y: 5, w: 2, h: 2, ...WIDGET_SIZE_LIMITS.RankTable },
    ]
};


export const DashboardProvider = ({ children }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [widgets, setWidgets] = useState({});
    const [layouts, setLayouts] = useState({ lg: [], md: [], sm: [] });
    const [loading, setLoading] = useState(true);
    const [selectedAsset, setSelectedAsset] = useState(null);

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
                    } else {
                        // 사용자는 있지만 위젯이 없는 경우
                        setWidgets({});
                        setLayouts({ lg: [], md: [], sm: [] });
                    }
                })
                .catch(error => console.error(error))
                .finally(() => setLoading(false));
        } else {
            // 비로그인 사용자 (샘플 모드)
            setWidgets(sampleWidgets);
            setLayouts(sampleLayouts);
            setLoading(false);
        }
    }, [user]);

    const changedLayoutsRef = useRef({});
    const debouncedSaveLayout = useCallback(_.debounce(() => {
        if (!user) return; // 비로그인 시 저장 안함
        const layoutsToSave = { ...changedLayoutsRef.current };
        if (Object.keys(layoutsToSave).length === 0) return;

        Object.keys(layoutsToSave).forEach(widgetId => {
            const layoutInfo = layoutsToSave[widgetId];
            fetch(`/api/widgets/${widgetId}/layout`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(layoutInfo)
            }).catch(error => console.error(`Failed to save layout for widget ${widgetId}:`, error));
        });
        changedLayoutsRef.current = {};
    }, 2000), [user]);

    const onLayoutChange = (layout, allLayouts) => {
        setLayouts(allLayouts);
        if (!user) return; // 비로그인 시 저장 로직 무시

        const currentBreakpoint = 'lg'; // 이 부분은 실제 브레이크포인트를 받아와야 할 수 있음
        const oldLayout = layouts[currentBreakpoint] || [];
        const changedItems = layout.filter(newItem => {
            const oldItem = oldLayout.find(item => item.i === newItem.i);
            return oldItem && !_.isEqual(oldItem, newItem);
        });

        if (changedItems.length > 0) {
            changedItems.forEach(item => {
                const widgetId = item.i;
                changedLayoutsRef.current[widgetId] = {
                    lg: allLayouts.lg.find(l => l.i === widgetId),
                    md: allLayouts.md.find(l => l.i === widgetId),
                    sm: allLayouts.sm.find(l => l.i === widgetId)
                };
            });
            debouncedSaveLayout();
        }
    };
    
    const addWidget = (widgetTemplate) => {
        const newWidgetId = Date.now().toString();
        const newWidget = {
            title: widgetTemplate.name,
            type: widgetTemplate.type,
            props: widgetTemplate.settings
        };

        const limits = WIDGET_SIZE_LIMITS[widgetTemplate.type] || {};
        const newLayoutItem = { i: newWidgetId, x: 0, y: Infinity, w: 2, h: 2, ...limits };

        setWidgets(prev => ({ ...prev, [newWidgetId]: newWidget }));
        setLayouts(prev => ({
            lg: [...prev.lg, newLayoutItem],
            md: [...prev.md, newLayoutItem],
            sm: [...prev.sm, newLayoutItem],
        }));

        if (user) {
            const defaultLayoutInfo = { lg: newLayoutItem, md: newLayoutItem, sm: newLayoutItem };
            const newWidgetData = {
                widgetName: widgetTemplate.name,
                widgetType: widgetTemplate.type,
                layoutInfo: JSON.stringify(defaultLayoutInfo),
                widgetSettings: JSON.stringify(widgetTemplate.settings)
            };
            fetch('/api/widgets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newWidgetData)
            })
            .then(res => res.json())
            .then(savedWidget => {
                // 임시 ID를 실제 저장된 ID로 교체
                setWidgets(prev => {
                    const newWidgets = { ...prev };
                    delete newWidgets[newWidgetId];
                    newWidgets[savedWidget.widgetId.toString()] = newWidget;
                    return newWidgets;
                });
                setLayouts(prev => ({
                    lg: prev.lg.map(l => l.i === newWidgetId ? { ...l, i: savedWidget.widgetId.toString() } : l),
                    md: prev.md.map(l => l.i === newWidgetId ? { ...l, i: savedWidget.widgetId.toString() } : l),
                    sm: prev.sm.map(l => l.i === newWidgetId ? { ...l, i: savedWidget.widgetId.toString() } : l),
                }));
            })
            .catch(err => console.error('Failed to add widget:', err));
        }
    };

    const removeWidget = (widgetId) => {
        if (!window.confirm(`'${widgets[widgetId].title}' 위젯을 삭제하시겠습니까?`)) return;

        const originalWidgets = widgets;
        const originalLayouts = layouts;

        const newWidgets = { ...widgets };
        delete newWidgets[widgetId];
        setWidgets(newWidgets);

        const newLayouts = { ...layouts };
        Object.keys(newLayouts).forEach(bp => {
            newLayouts[bp] = newLayouts[bp].filter(l => l.i !== widgetId);
        });
        setLayouts(newLayouts);

        if (user) {
            fetch(`/api/widgets/${widgetId}`, { method: 'DELETE' })
                .catch(err => {
                    console.error('Failed to delete widget:', err);
                    setWidgets(originalWidgets);
                    setLayouts(originalLayouts);
                });
        }
    };

    const updateWidgetSettings = useCallback((widgetId, newSettings) => {
        setWidgets(prev => ({
            ...prev,
            [widgetId]: { ...prev[widgetId], props: newSettings }
        }));

        if (user) {
            const { limit, ...settingsToSave } = newSettings;
            fetch(`/api/widgets/${widgetId}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settingsToSave),
            })
            .then(response => {
                if (response.ok) {
                    showToast('설정이 저장되었습니다.', 'info');
                } else {
                    throw new Error('Network response was not ok');
                }
            })
            .catch(err => {
                console.error(`Failed to save widget settings for ${widgetId}:`, err);
                showToast('설정 저장에 실패했습니다.', 'error');
            });
        }
    }, [user, showToast]);
    
    const renameWidget = (widgetId, newName) => {
        const originalWidgets = widgets;
        setWidgets(prev => ({
            ...prev,
            [widgetId]: { ...prev[widgetId], title: newName }
        }));

        if (user) {
            fetch(`/api/widgets/${widgetId}/name`, {
                method: 'PUT',
                headers: { 'Content-Type': 'text/plain' },
                body: newName
            })
            .catch(err => {
                console.error('Failed to rename widget:', err);
                setWidgets(originalWidgets); // 이름 변경 실패 시 원래대로 복구
            });
        }
    };

    const value = {
        widgets,
        layouts,
        loading,
        selectedAsset,
        setSelectedAsset,
        onLayoutChange,
        addWidget,
        removeWidget,
        updateWidgetSettings,
        renameWidget, // renameWidget 추가
        WIDGET_SIZE_LIMITS
    };

    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
};