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

const ResponsiveGridLayout = WidthProvider(Responsive);

/**
 * 새로운 위젯을 추가할 때 표시되는 모달 컴포넌트입니다.
 * @param {object} props - 컴포넌트 속성
 * @param {function} props.onAdd - 사용자가 추가할 위젯을 선택했을 때 호출되는 함수
 * @param {function} props.onClose - 모달을 닫을 때 호출되는 함수
 */
const AddWidgetModal = ({ onAdd, onClose }) => {
    // 추가 가능한 위젯의 목록과 기본 설정
    const availableWidgets = [
        { name: '지표 텍스트', type: 'TextWidget', settings: { dataKey: 'index_KOSPI', title: '코스피' } },
        { name: '메모장', type: 'MemoWidget', settings: { content: '' } },
        { name: '국내 주식 차트', type: 'KrxChartWidget', settings: { symbol: '005930' } },
        { name: '글로벌 차트 (해외/코인)', type: 'SymbolChartWidget', settings: { symbol: 'AAPL' } },
        { name: '통합 시장 트리맵', type: 'TreemapChart', settings: { marketType: 'ALL' } },
        { name: '상승률 순위', type: 'RankTable', settings: { by: 'CHANGE_RATE', order: 'DESC', visibleColumns: ['currentPrice', 'changeRate'] } },
        { name: '하락률 순위', type: 'RankTable', settings: { by: 'CHANGE_RATE', order: 'ASC', visibleColumns: ['currentPrice', 'changeRate'] } },
        { name: '거래량 순위', type: 'RankTable', settings: { by: 'VOLUME', order: 'DESC', visibleColumns: ['currentPrice', 'volume'] } },
        { name: '거래대금 순위', type: 'RankTable', settings: { by: 'TRADE_VALUE', order: 'DESC', visibleColumns: ['currentPrice', 'tradeValue'] } },
        { name: '관심종목', type: 'WatchlistWidget', settings: { visibleColumns: ['currentPrice', 'changeRate'] } },
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


/**
 * 위젯의 타입에 따라 적절한 실제 위젯 컴포넌트를 렌더링하는 '디스패처' 컴포넌트입니다.
 * @param {object} props - 컴포넌트 속성
 * @param {string} props.widgetId - 위젯의 고유 ID
 * @param {string} props.type - 위젯의 종류 (e.g., 'RankTable', 'TreemapChart')
 * @param {object} props.props - 위젯에 전달될 설정값
 * @param {function} props.onSettingsChange - 위젯의 설정이 변경될 때 호출되는 함수
 * @param {boolean} props.isEditMode - 현재 대시보드가 편집 모드인지 여부
 */
const Widget = ({ widgetId, type, props, onSettingsChange, isEditMode }) => {
    const [ref, { width, height }] = useResizeObserver();
    
    // RankTable의 경우, 위젯 높이에 따라 표시할 행의 개수를 동적으로 계산합니다.
    const rankTableLimit = (() => {
        if (type !== 'RankTable' || height <= 70) return 10;
        const rowHeight = 35; // 한 행의 대략적인 높이
        return Math.floor((height - 70) / rowHeight);
    })();

    return (
        <div ref={ref} style={{ width: '100%', height: '100%' }}>
            {(() => {
                if (width === 0 || height === 0) return null; // 크기가 0이면 렌더링하지 않음
                switch (type) {
                    case 'TreemapChart':
                        return <TreemapChart widgetId={widgetId} settings={props} width={width} height={height-50} onSettingsChange={onSettingsChange} />;
                    case 'RankTable':
                        return <RankTable widgetId={widgetId} settings={{...props, limit: rankTableLimit}} width={width} height={height} onSettingsChange={onSettingsChange} />;
                    case 'WatchlistWidget':
                        return <WatchlistWidget widgetId={widgetId} settings={{...props, limit: rankTableLimit}} width={width} height={height} onSettingsChange={onSettingsChange} />;
                    case 'SymbolChartWidget':
                        return <SymbolChartWidget widgetId={widgetId} settings={props} width={width} height={height} onSettingsChange={onSettingsChange} />;
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

/**
 * 애플리케이션의 메인 대시보드 컴포넌트입니다.
 * 그리드 레이아웃, 위젯 렌더링, 사용자 상호작용 및 전체적인 UI를 관리합니다.
 */
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
        renameWidget,
    } = useDashboard();

    const [isEditMode, setIsEditMode] = useState(false);
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [editingWidgetId, setEditingWidgetId] = useState(null);
    const [dashboardTitle, setDashboardTitle] = useState('');

    // 사용자 상태에 따라 대시보드 제목을 설정합니다.
    useEffect(() => {
        if (user) {
            const savedTitle = localStorage.getItem('dashboardTitle');
            setDashboardTitle(savedTitle || `${user.username}님의 대시보드`);
        } else {
            setDashboardTitle('샘플 대시보드');
        }
    }, [user]);

    /** 위젯 추가 모달에서 위젯을 선택했을 때 실행되는 핸들러 */
    const handleAddWidget = (widgetTemplate) => {
        setAddModalOpen(false);
        addWidget(widgetTemplate);
    };

    /** 위젯 삭제 버튼 클릭 시 실행되는 핸들러 */
    const handleDeleteWidget = useCallback((event) => {
        const widgetId = event.currentTarget.dataset.id;
        removeWidget(widgetId);
    }, [removeWidget]);

    /** 위젯 이름 변경 버튼 클릭 시 실행되는 핸들러 */
    const handleRenameWidget = useCallback((event) => {
        const widgetId = event.currentTarget.dataset.id;
        const currentName = widgets[widgetId]?.title || '';
        const newName = prompt("새로운 위젯 이름을 입력하세요:", currentName);

        if (newName && newName !== currentName) {
            renameWidget(widgetId, newName);
        }
    }, [widgets, renameWidget]);

    /** 위젯 설정 버튼 클릭 시 실행되는 핸들러 */
    const handleSettings = useCallback((event) => {
        const widgetId = event.currentTarget.dataset.id;
        setEditingWidgetId(widgetId);
    }, []);

    /** 위젯 설정창을 닫을 때 실행되는 핸들러 */
    const handleCloseSettings = useCallback(() => {
        setEditingWidgetId(null);
    }, []);

    /** 위젯 내부에서 설정이 변경되었을 때 호출되는 콜백 */
    const handleWidgetSettingsChange = useCallback((widgetId, newSettings) => {
        updateWidgetSettings(widgetId, newSettings);
    }, [updateWidgetSettings]);

    /** 현재 렌더링된 모든 위젯이 필요로 하는 데이터 키 목록을 집계합니다. */
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

    /** 대시보드 제목을 변경하는 핸들러 */
    const handleTitleChange = () => {
        if (!user) return; // 비로그인 사용자는 제목 변경 불가
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
            {isAddModalOpen && <AddWidgetModal onAdd={handleAddWidget} onClose={() => setAddModalOpen(false)} />}

            <div style={{ fontFamily: 'sans-serif', padding: '5px', backgroundColor: '#f4f7f6' }}>
                {/* 헤더: 제목 및 컨트롤 버튼 */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', height: '50px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', cursor: user ? 'pointer' : 'default' }} onClick={handleTitleChange}>
                        <h1 style={{ margin: 0, fontSize: 'clamp(1.2rem, 5vw, 1.8rem)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={user ? "제목 변경" : ""}>
                            {dashboardTitle}
                        </h1>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginLeft: '10px' }}>
                        {!user && <span className="demo-message">체험용 대시보드입니다. 변경사항은 저장되지 않습니다.</span>}
                        <button onClick={() => setIsEditMode(!isEditMode)} className="control-button">
                            {isEditMode ? '✅' : '✏️'}
                        </button>
                        {isEditMode &&
                            <button onClick={() => setAddModalOpen(true)} className="control-button">+</button>
                        }
                        {user ? (
                            <button onClick={logout} className="control-button">로그아웃</button>
                        ) : (
                            <button onClick={() => setLoginModalOpen(true)} className="control-button">로그인</button>
                        )}
                    </div>
                </header>

                {/* 위젯들을 표시하는 그리드 레이아웃 */}
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
                        <div key={key} data-grid={layouts.lg.find(l => l.i === key)}>
                            <ChartContainer
                                widgetId={key}
                                title={widgets[key].title}
                                isEditMode={isEditMode}
                                onRename={user ? handleRenameWidget : null}
                                onDelete={handleDeleteWidget}
                                onSettings={widgets[key].type === 'SymbolChartWidget' ? handleSettings : null}
                            >
                                <Widget
                                    widgetId={key}
                                    type={widgets[key].type}
                                    props={widgets[key].props}
                                    onSettingsChange={handleWidgetSettingsChange}
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