import React, {createContext, useState, useContext, useEffect, useCallback, useRef} from 'react';
import {useAuth} from './AuthContext';
import _ from 'lodash';
import {useToast} from "./ToastContext.jsx";

const DashboardContext = createContext(null);

/**
 * 대시보드 컨텍스트를 사용하기 위한 커스텀 훅입니다.
 * @returns {{
 *   widgets: object,
 *   layouts: object,
 *   loading: boolean,
 *   selectedAsset: object|null,
 *   setSelectedAsset: function,
 *   onLayoutChange: function,
 *   addWidget: function,
 *   removeWidget: function,
 *   updateWidgetSettings: function,
 *   renameWidget: function,
 *   WIDGET_SIZE_LIMITS: object
 * }} 대시보드 컨텍스트 값
 */
export const useDashboard = () => {
    return useContext(DashboardContext);
};

/** 각 위젯 타입별 최소/최대 크기 제약 조건입니다. */
const WIDGET_SIZE_LIMITS = {
    TextWidget: { minW: 1, maxW: 2, minH: 1, maxH: 1 },
    MemoWidget: { minW: 1, maxW: 4, minH: 1, maxH: 4 },
    KrxChartWidget: { minW: 2, maxW: 4, minH: 2, maxH: 2 },
    SymbolChartWidget: { minW: 2, maxW: 4, minH: 2, maxH: 2 },
    TreemapChart: { minW: 2, maxW: 4, minH: 2, maxH: 4 },
    RankTable: { minW: 1, maxW: 4, minH: 2, maxH: 4 },
    WatchlistWidget: { minW: 1, maxW: 4, minH: 2, maxH: 4 },
};

/** 비로그인 사용자를 위한 샘플 위젯 데이터입니다. */
const sampleWidgets = {
    '1': { title: '코스피', type: 'TextWidget', props: { dataKey: 'index_KOSPI', title: '코스피' } },
    '2': { title: '코스닥', type: 'TextWidget', props: { dataKey: 'index_KOSDAQ', title: '코스닥' } },
    '3': { title: '삼성전자', type: 'KrxChartWidget', props: { symbol: '005930' } },
    '4': { title: '통합 시장 트리맵', type: 'TreemapChart', props: { marketType: 'ALL' } },
    '5': { title: '상승률 순위', type: 'RankTable', props: { by: 'CHANGE_RATE', order: 'DESC', visibleColumns: ['currentPrice', 'changeRate'], columnWidths: { name: 80, currentPrice: 80, changeRate: 80, volume: 80, tradeValue: 80 } } },
};

/** 비로그인 사용자를 위한 샘플 레이아웃 데이터입니다. */
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

/**
 * 대시보드의 상태(위젯, 레이아웃 등)를 관리하고 관련 액션을 제공하는 Provider 컴포넌트입니다.
 * 로그인 상태에 따라 서버에서 위젯 데이터를 가져오거나, 샘플 데이터를 사용합니다.
 * @param {object} props - 컴포넌트에 전달되는 속성
 * @param {React.ReactNode} props.children - 이 Provider가 감싸게 될 자식 컴포넌트들
 */
export const DashboardProvider = ({ children }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [widgets, setWidgets] = useState({}); // 위젯 ID를 키로 하는 위젯 데이터 객체
    const [layouts, setLayouts] = useState({ lg: [], md: [], sm: [] }); // 반응형 레이아웃 상태
    const [loading, setLoading] = useState(true); // 위젯 로딩 상태
    const [selectedAsset, setSelectedAsset] = useState(null); // 종목 검색 등에서 선택된 자산 정보

    // 사용자 인증 상태가 변경될 때 위젯 및 레이아웃을 로드합니다.
    useEffect(() => {
        if (user) {
            // 로그인한 사용자의 경우, 서버에서 위젯 데이터를 가져옵니다.
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
                        // DB에 위젯이 없는 신규 사용자의 경우, 비어있는 상태로 시작합니다.
                        setWidgets({});
                        setLayouts({ lg: [], md: [], sm: [] });
                    }
                })
                .catch(error => console.error(error))
                .finally(() => setLoading(false));
        } else {
            // 비로그인 사용자의 경우, 미리 정의된 샘플 데이터로 대시보드를 구성합니다.
            setWidgets(sampleWidgets);
            setLayouts(sampleLayouts);
            setLoading(false);
        }
    }, [user]);

    // 레이아웃 변경사항을 임시 저장하는 ref
    const changedLayoutsRef = useRef({});

    /**
     * 변경된 레이아웃을 서버에 저장하는 함수 (디바운싱 적용).
     * 잦은 API 호출을 방지하기 위해 2초간의 지연 후 실행됩니다.
     */
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

    /**
     * 사용자가 위젯의 레이아웃(위치, 크기)을 변경할 때 호출되는 콜백 함수입니다.
     * @param {Array} layout - 현재 브레이크포인트의 레이아웃 배열
     * @param {Object} allLayouts - 모든 브레이크포인트(lg, md, sm)의 레이아웃 객체
     */
    const onLayoutChange = (layout, allLayouts) => {
        setLayouts(allLayouts);
        if (!user) return; // 비로그인 시 저장 로직 무시

        // 변경된 레이아웃 아이템을 감지하여 ref에 저장
        const currentBreakpoint = 'lg'; // TODO: 현재 브레이크포인트 감지 로직 필요
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
    
    /**
     * 대시보드에 새로운 위젯을 추가합니다.
     * @param {object} widgetTemplate - 추가할 위젯의 템플릿 정보 (이름, 타입, 설정 등)
     */
    const addWidget = (widgetTemplate) => {
        const newWidgetId = Date.now().toString();
        const newWidget = {
            title: widgetTemplate.name,
            type: widgetTemplate.type,
            props: widgetTemplate.settings
        };

        const limits = WIDGET_SIZE_LIMITS[widgetTemplate.type] || {};
        const newLayoutItem = { i: newWidgetId, x: 0, y: Infinity, w: 2, h: 2, ...limits };

        // 낙관적 UI 업데이트: 먼저 프론트엔드 상태를 업데이트
        setWidgets(prev => ({ ...prev, [newWidgetId]: newWidget }));
        setLayouts(prev => ({
            lg: [...prev.lg, newLayoutItem],
            md: [...prev.md, newLayoutItem],
            sm: [...prev.sm, newLayoutItem],
        }));

        if (user) {
            // 로그인 사용자의 경우, 서버에 위젯 추가 요청
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
                // 서버로부터 받은 실제 ID로 프론트엔드 상태를 다시 업데이트
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

    /**
     * 대시보드에서 특정 위젯을 삭제합니다.
     * @param {string} widgetId - 삭제할 위젯의 ID
     */
    const removeWidget = (widgetId) => {
        if (!window.confirm(`'${widgets[widgetId].title}' 위젯을 삭제하시겠습니까?`)) return;

        // 낙관적 UI 업데이트를 위해 원래 상태 저장
        const originalWidgets = widgets;
        const originalLayouts = layouts;

        // 프론트엔드 상태에서 위젯 즉시 제거
        const newWidgets = { ...widgets };
        delete newWidgets[widgetId];
        setWidgets(newWidgets);

        const newLayouts = { ...layouts };
        Object.keys(newLayouts).forEach(bp => {
            newLayouts[bp] = newLayouts[bp].filter(l => l.i !== widgetId);
        });
        setLayouts(newLayouts);

        if (user) {
            // 로그인 사용자의 경우, 서버에 삭제 요청
            fetch(`/api/widgets/${widgetId}`, { method: 'DELETE' })
                .catch(err => {
                    // 실패 시 원래 상태로 롤백
                    console.error('Failed to delete widget:', err);
                    setWidgets(originalWidgets);
                    setLayouts(originalLayouts);
                });
        }
    };

    /**
     * 특정 위젯의 설정을 업데이트합니다.
     * @param {string} widgetId - 설정할 위젯의 ID
     * @param {object} newSettings - 새로운 설정 객체
     */
    const updateWidgetSettings = useCallback((widgetId, newSettings) => {
        setWidgets(prev => ({
            ...prev,
            [widgetId]: { ...prev[widgetId], props: newSettings }
        }));

        if (user) {
            // 'limit'과 같이 프론트엔드에서만 사용하는 속성은 제외하고 저장
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
    
    /**
     * 특정 위젯의 이름을 변경합니다.
     * @param {string} widgetId - 이름을 변경할 위젯의 ID
     * @param {string} newName - 새로운 이름
     */
    const renameWidget = (widgetId, newName) => {
        // 낙관적 UI 업데이트를 위해 원래 상태 저장
        const originalWidgets = widgets;
        setWidgets(prev => ({
            ...prev,
            [widgetId]: { ...prev[widgetId], title: newName }
        }));

        if (user) {
            // 로그인 사용자의 경우, 서버에 이름 변경 요청
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

    // 컨텍스트를 통해 제공될 값들
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
        renameWidget,
        WIDGET_SIZE_LIMITS
    };

    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
};