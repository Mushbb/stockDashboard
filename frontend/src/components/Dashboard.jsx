import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import _ from 'lodash'; // 디바운스를 위해 lodash 임포트
import TreemapChart from './TreemapChart';
import RankTable from './RankTable';
import ChartContainer from './ChartContainer';
import { useResizeObserver } from './useResizeObserver';

const ResponsiveGridLayout = WidthProvider(Responsive);

const Widget = ({ widgetId, type, props }) => {
    const [ref, { width, height }] = useResizeObserver();
    return (
        <div ref={ref} style={{ width: '100%', height: '100%' }}>
            {(() => {
                if (width === 0 || height === 0) return null;
                switch (type) {
                    case 'TreemapChart':
                        return <TreemapChart widgetId={widgetId} settings={props} width={width} height={height - 45} />;
                    case 'RankTable':
                        return <RankTable widgetId={widgetId} settings={props} width={width} height={Math.max(0, height - 40)} />;
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

    // 컴포넌트 마운트 시 위젯 데이터 로드
    useEffect(() => {
        fetch('/api/widgets')
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch widgets');
                return res.json();
            })
            .then(data => {
                if (data && data.length > 0) {
                    const newWidgets = {};
                    const newLayouts = { lg: [], md: [], sm: [] };

                    data.forEach(widget => {
                        const widgetId = widget.widgetId.toString();
                        
                        newWidgets[widgetId] = {
                            title: widget.widgetName,
                            type: widget.widgetType,
                            props: JSON.parse(widget.widgetSettings)
                        };

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
            .catch(error => {
                console.error("Failed to load initial widgets:", error);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    // 변경된 레이아웃을 추적하기 위한 ref
    const changedLayoutsRef = useRef({});

    const debouncedSave = useCallback(_.debounce(() => {
        const layoutsToSave = changedLayoutsRef.current;
        if (Object.keys(layoutsToSave).length === 0) return;

        console.log('Saving layouts:', layoutsToSave);
        // TODO: 실제로는 layoutsToSave 객체를 순회하며 각 위젯에 대한 API를 호출해야 함
        // 지금은 첫 번째 변경된 위젯에 대해서만 API 호출 예시를 보여줍니다.
        const widgetId = Object.keys(layoutsToSave)[0];
        const layoutInfo = layoutsToSave[widgetId];

        fetch(`/api/widgets/${widgetId}/layout`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(layoutInfo),
        }).catch(error => {
            console.error(`Failed to save layout for widget ${widgetId}:`, error);
        });

        // 저장 후 변경된 내용 초기화
        changedLayoutsRef.current = {};
    }, 2000), []); // 2초 디바운스

    const onLayoutChange = (layout, allLayouts) => {
        setLayouts(allLayouts);
        
        // 현재 breakpoint의 이전 레이아웃과 비교하여 변경된 항목 찾기
        const oldLayout = layouts[currentBreakpoint] || [];
        const changedItems = layout.filter(newItem => {
            const oldItem = oldLayout.find(item => item.i === newItem.i);
            return oldItem && !_.isEqual(oldItem, newItem);
        });

        if (changedItems.length > 0) {
            changedItems.forEach(item => {
                const widgetId = item.i;
                // DB에 저장할 포맷으로 가공
                changedLayoutsRef.current[widgetId] = {
                    lg: allLayouts.lg.find(l => l.i === widgetId),
                    md: allLayouts.md.find(l => l.i === widgetId),
                    sm: allLayouts.sm.find(l => l.i === widgetId),
                };
            });
            debouncedSave();
        }
    };
    
    const onBreakpointChange = (newBreakpoint) => {
        setCurrentBreakpoint(newBreakpoint);
    };

    if (loading) {
        return <div>Loading Dashboard...</div>;
    }

    return (
        <div style={{ fontFamily: 'sans-serif', padding: '20px', backgroundColor: '#f4f7f6' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>주요 증시 현황 대시보드</h1>
            <ResponsiveGridLayout
                className="layout"
                layouts={layouts}
                breakpoints={{ lg: 1200, md: 768, sm: 0 }}
                cols={{ lg: 4, md: 3, sm: 2 }}
                rowHeight={250}
                isResizable={true}
                draggableHandle=".widget-title"
                onLayoutChange={onLayoutChange}
                onBreakpointChange={onBreakpointChange}
                style={{ transform: 'scale(1)' }}
            >
                {Object.keys(widgets).map(key => (
                    <div key={key}>
                        <ChartContainer title={widgets[key].title}>
                            <Widget widgetId={key} type={widgets[key].type} props={widgets[key].props} />
                        </ChartContainer>
                    </div>
                ))}
            </ResponsiveGridLayout>
        </div>
    );
}

export default Dashboard;