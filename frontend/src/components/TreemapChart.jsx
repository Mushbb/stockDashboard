import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import _ from 'lodash';

import { useDashboard } from '../contexts/DashboardContext';
import { useData } from '../contexts/DataProvider';

// --- D3 Helper Functions ---

/**
 * 렌더링 후 너무 작아서 보이지 않을 노드들을 제거하여 성능을 최적화합니다.
 * @param {d3.HierarchyNode} root - 프루닝할 전체 계층 구조의 루트 노드
 * @param {number} minPixel - 노드가 표시되기 위한 최소 픽셀 크기
 * @returns {object} 프루닝된 새로운 데이터 객체
 */
function pruneByPixel(root, minPixel) {
	const keep = new Set();
	root.leaves().forEach(leaf => {
		const w = leaf.x1 - leaf.x0;
		const h = leaf.y1 - leaf.y0;
		if (w >= minPixel && h >= minPixel && (leaf.data.value || 0) > 0) {
			let n = leaf;
			while (n) {
				keep.add(n.data);
				n = n.parent;
			}
		}
	});
	function cloneFilter(d) {
		if (!keep.has(d)) return null;
		const kids = d.children ? d.children.map(cloneFilter).filter(Boolean) : null;
		return { ...d, children: kids };
	}
	return cloneFilter(root.data) || { name: root.data?.name || 'Market', children: [] };
}

/**
 * 특정 노드의 전체 경로(이름 배열)를 반환합니다. (e.g., ["KOSPI", "IT서비스", "삼성전자"])
 * @param {d3.HierarchyNode} node - 경로를 찾을 노드
 * @returns {string[]} 노드의 전체 경로
 */
const getNodePath = (node) => node.ancestors().map(d => d.data.name).reverse();

/**
 * 주어진 경로에 해당하는 노드를 계층 구조에서 찾습니다.
 * @param {d3.HierarchyNode} root - 검색을 시작할 루트 노드
 * @param {string[]} path - 찾을 노드의 경로
 * @returns {d3.HierarchyNode|null} 찾은 노드 또는 null
 */
const findNodeByPath = (root, path) => {
	if (!root || !path || path.length === 0 || root.data.name !== path[0]) return null;
	let current = root;
	for (let i = 1; i < path.length; i++) {
		const name = path[i];
		const next = (current.children || []).find(d => d.data.name === name);
		if (!next) return null;
		current = next;
	}
	return current;
};

/**
 * D3.js를 사용하여 시장 데이터를 트리맵 형태로 시각화하는 컴포넌트입니다.
 * 사용자는 섹터를 클릭하여 줌인하거나 우클릭으로 줌아웃할 수 있습니다.
 * @param {object} props - 컴포넌트 속성
 * @param {string} props.widgetId - 위젯의 고유 ID
 * @param {object} props.settings - 위젯 설정 (e.g., { marketType, path })
 * @param {number} props.width - 위젯의 너비
 * @param {number} props.height - 위젯의 높이
 * @param {function} props.onSettingsChange - 위젯 설정 변경 시 호출되는 함수
 */
function TreemapChart({ widgetId, settings, width, height, onSettingsChange }) {
    const { setSelectedAsset } = useDashboard();
    const { data: dashboardData, isLoading, error } = useData();

    const [view, setView] = useState(null); // 현재 보여주고 있는 계층(줌 상태)
    const [colorScale, setColorScale] = useState(null); // 등락률에 따른 색상 스케일
    
    const svgRef = useRef(null);
    const currentPathRef = useRef(settings?.path || null); // 현재 뷰의 경로
	
    const MIN_PIXEL = 15; // 화면에 표시될 최소 픽셀 크기

    const currentMarket = settings?.marketType || 'ALL';
    const data = dashboardData[`treemap_${currentMarket.toUpperCase()}`];

    /** 컴포넌트 마운트 시 등락률에 대한 D3 색상 스케일을 생성합니다. */
    useEffect(() => {
		const color = d3.scaleDivergingPow().domain([-30, 0, 30]).exponent(0.15)
			.interpolator(d3.interpolateRgbBasis(["#d14242", "#f0f0f0", "#33a033"])).clamp(true);
		setColorScale(() => color);
	}, []);

    /** 데이터가 로드되거나 변경되면, D3 계층 구조를 생성하고 현재 뷰를 설정합니다. */
    useEffect(() => {
		if (!data || !data.children || data.children.length === 0) return;
		
        // D3 계층 구조 생성 및 값 계산
        let newRoot = d3.hierarchy(data).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
		newRoot.eachAfter(node => { // 부모 노드의 등락률을 자식 노드들의 가중 평균으로 계산
			if (node.children) {
				const total = node.value;
				node.data.fluc_rate = total > 0 ? d3.sum(node.children, d => (d.data.fluc_rate || 0) * d.value) / total : 0;
			}
		});
		
        // 저장된 경로(path)가 있으면 해당 뷰로, 없으면 루트 뷰로 설정
        let newViewTarget = currentPathRef.current ? findNodeByPath(newRoot, currentPathRef.current) : null;
		if (newViewTarget) {
			setView(newViewTarget);
		} else {
			currentPathRef.current = getNodePath(newRoot);
			setView(newRoot);
		}
	}, [data]);

    /** 줌인/줌아웃 시 현재 뷰를 변경하고, 변경된 경로를 부모에 저장 요청합니다. */
    const handleViewChange = (newView) => {
        if (!newView) return;
        const newPath = getNodePath(newView);
        currentPathRef.current = newPath;
        setView(newView);
        onSettingsChange(widgetId, { ...settings, path: newPath });
    }

    /** 시장(KOSPI, KOSDAQ 등) 변경 시 호출됩니다. */
    const handleMarketChange = (newMarket) => {
        if (newMarket === currentMarket) return;
        // 새로운 시장으로 변경하고 경로는 초기화
        onSettingsChange(widgetId, { ...settings, marketType: newMarket, path: null });
        currentPathRef.current = null;
        setView(null);
    };

    /** view, 크기, 색상 스케일이 변경될 때마다 D3를 사용하여 트리맵을 다시 렌더링합니다. */
    useEffect(() => {
		if (!view || !colorScale || width <= 0 || height <= 0) {
			d3.select(svgRef.current).selectAll('*').remove();
			return;
		}

		const rootForLayout = view.copy();
		const treemap = d3.treemap().tile(d3.treemapSquarify).size([width, height]).padding(2).round(true);
		treemap(rootForLayout); // 레이아웃 계산

		// 너무 작은 노드는 제거하여 렌더링 성능 최적화
		const prunedData = pruneByPixel(rootForLayout, MIN_PIXEL);
		let displayRoot = d3.hierarchy(prunedData).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
		treemap(displayRoot);

		const x = d3.scaleLinear().rangeRound([0, width]).domain([displayRoot.x0, displayRoot.x1]);
		const y = d3.scaleLinear().rangeRound([0, height]).domain([displayRoot.y0, displayRoot.y1]);
		
        const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
		svg.selectAll('*').remove();
		
        // 우클릭 시 줌아웃 (부모 노드로 이동)
        svg.on('contextmenu', (event) => {
			event.preventDefault();
			if (view && view.parent) handleViewChange(view.parent);
		});

		const group = svg.append('g');
		const cell = group.selectAll('g').data(displayRoot.children || []).join('g')
			.attr('transform', d => `translate(${x(d.x0)}, ${y(d.y0)})`)
			.style('cursor', d => (d.children ? 'pointer' : 'default'))
			.on('click', (event, d) => {
				if (d.children) { // 섹터(부모 노드) 클릭 시 줌인
					const nextView = (view.children || []).find(child => child.data.name === d.data.name);
					if (nextView) handleViewChange(nextView);
				} else { // 종목(자식 노드) 클릭 시 전역 선택 자산으로 설정
					event.stopPropagation();
					setSelectedAsset({ symbol: d.data.symbol, type: 'KRX' });
				}
			});

		// 사각형 렌더링
		cell.append('rect')
			.attr('fill', d => colorScale(d.data.fluc_rate))
			.attr('width', d => x(d.x1) - x(d.x0))
			.attr('height', d => y(d.y1) - y(d.y0));

		// 텍스트 렌더링 (foreignObject 사용하여 HTML 텍스트 렌더링)
		cell.each(function (d) {
			const node = d3.select(this);
			const w = x(d.x1) - x(d.x0);
			const h = y(d.y1) - y(d.y0);
			if (w >= 40 && h >= 40) {
				const fo = node.append('foreignObject').attr('width', w).attr('height', h);
				const div = fo.append('xhtml:div').attr('class', 'treemap-label');
				div.append('xhtml:p').text(d.data.name);
				const rate = d.data.fluc_rate || 0;
				div.append('xhtml:p').text(`${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`);
			}
		});
        
        // 툴팁 추가
        cell.append('title').text(d => `${d.data.name}\n`+(isNaN(d.data.cur_price)?"":`현재가: ${d3.format(",")(d.data.cur_price)} 원\n`)
            +`등락률: ${(d.data.fluc_rate || 0).toFixed(2)}%\n시가총액: ${d.value?.toLocaleString()} 원`);
        
    }, [view, colorScale, width, height, handleViewChange, setSelectedAsset]);
    
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            {/* 컨트롤러: 경로 표시 및 시장 변경 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 5px', minHeight: '50px', flexShrink: 0 }}>
                <h3 style={{ margin: '0 10px 0 0', fontSize: '0.9em', color: '#555', fontWeight: 'normal', flex: 1 }}>
                    {view && view.ancestors().reverse().map(d => d.data.name).join(' > ')}
                </h3>
                <div>
                    {['ALL', 'KOSPI', 'KOSDAQ', 'ETF'].map(market => (
                        <button key={market} onClick={() => handleMarketChange(market)} style={{ background: currentMarket === market ? '#007bff' : '#eee', color: currentMarket === market ? 'white' : 'black', border: 'none', padding: '4px 8px', margin: '0 2px', cursor: 'pointer', borderRadius: '4px' }}>
                            {market}
                        </button>
                    ))}
                </div>
            </div>
            {/* SVG 컨테이너 */}
            <div style={{ flexGrow: 1, width: '100%' }}>
                {isLoading && <div style={{textAlign: 'center', paddingTop: '50px'}}>Loading...</div>}
                {error && <div style={{textAlign: 'center', paddingTop: '50px', color: 'red'}}>Error: {error}</div>}
                {!isLoading && !error && <svg ref={svgRef} style={{ userSelect: 'none' }}></svg>}
            </div>
        </div>
    );
}

export default TreemapChart;