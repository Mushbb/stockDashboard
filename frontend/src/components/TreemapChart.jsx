import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import _ from 'lodash';

import { useDashboard } from '../contexts/DashboardContext';
import { useData } from '../contexts/DataProvider'; // 중앙 데이터 공급자 import

// Helper functions (unchanged)
function pruneByPixel(root, minPixel) {
	const keep = new Set();
	root.leaves().forEach(leaf => {
		const w = leaf.x1 - leaf.x0;
		const h = leaf.y1 - leaf.y0;
		const shouldKeep = w >= minPixel && h >= minPixel && (leaf.data.value || 0) > 0;
		if (shouldKeep) {
			let n = leaf;
			while (n) {
				keep.add(n.data);
				n = n.parent;
			}
		}
	});
	function cloneFilter(d) {
		if (!keep.has(d)) return null;
		if (!d.children) return { ...d };
		const kids = d.children.map(cloneFilter).filter(Boolean);
		return { ...d, children: kids };
	}
	const pruned = cloneFilter(root.data);
	return pruned || { name: root.data?.name || 'Market', children: [] };
}
const getNodePath = (node) => node.ancestors().map(d => d.data.name).reverse();
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

function TreemapChart({ widgetId, settings, width, height, onSettingsChange }) {
    const { setSelectedAsset } = useDashboard();
    const { data: dashboardData, isLoading, error } = useData();

    const [view, setView] = useState(null);
    const [colorScale, setColorScale] = useState(null);
    
    const svgRef = useRef(null);
	const svgContainerRef = useRef(null); // SVG 컨테이너를 위한 ref 추가
    const currentPathRef = useRef(settings?.path || null); // 저장된 경로로 초기화
	
    const MIN_PIXEL = 15;

    // 위젯 설정에서 현재 시장 타입을 가져옴
    const currentMarket = settings?.marketType || 'ALL';
    // 중앙 데이터에서 이 위젯에 필요한 데이터를 추출
    const data = dashboardData[`treemap_${currentMarket.toUpperCase()}`];



    useEffect(() => {
		const color = d3.scaleDivergingPow().domain([-30, 0, 30]).exponent(0.15)
			.interpolator(d3.interpolateRgbBasis(["#d14242", "#f0f0f0", "#33a033"])).clamp(true);
		setColorScale(() => color);
	}, []);

    // 데이터 로드 시 저장된 경로로 뷰 설정
    useEffect(() => {
		if (!data || !data.children || data.children.length === 0) return;
		let newRoot = d3.hierarchy(data).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
		newRoot.eachAfter(node => {
			if (node.children) {
				const total = node.value;
				node.data.fluc_rate = total > 0 ? d3.sum(node.children, d => (d.data.fluc_rate || 0) * d.value) / total : 0;
			}
		});
		
        let newViewTarget;
		if (currentPathRef.current) {
			newViewTarget = findNodeByPath(newRoot, currentPathRef.current);
		}
        
        // 저장된 경로가 유효하지 않으면 루트로 설정
		if (newViewTarget) {
			setView(newViewTarget);
		} else {
			currentPathRef.current = getNodePath(newRoot);
			setView(newRoot);
		}
	}, [data]);

    // 줌/아웃 핸들러: 부모(Dashboard)의 중앙 관리 함수를 호출
    const handleViewChange = (newView) => {
        if (!newView) return;
        const newPath = getNodePath(newView);
        // UI는 즉시 업데이트
        currentPathRef.current = newPath;
        setView(newView);
        // 변경된 경로는 중앙 관리 함수를 통해 저장
        onSettingsChange(widgetId, { ...settings, path: newPath });
    }

    const handleMarketChange = (newMarket) => {
        if (newMarket === currentMarket) return;
        // 경로를 리셋하고, 새로운 시장 타입으로 설정을 변경하도록 부모에게 알림
        onSettingsChange(widgetId, { ...settings, marketType: newMarket, path: null });
        currentPathRef.current = null;
        setView(null);
    };

    // D3 렌더링
    useEffect(() => {
		if (!view || !colorScale || width <= 0 || height <= 0) {
			const svg = d3.select(svgRef.current);
			svg.selectAll('*').remove();
			return;
		}
		const rootForLayout = view.copy();
		const treemap = d3.treemap().tile(d3.treemapSquarify).size([width, height]).padding(2).round(true);
		treemap(rootForLayout);
		const prunedData = pruneByPixel(rootForLayout, MIN_PIXEL);
		let displayRoot = d3.hierarchy(prunedData).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
		treemap(displayRoot);
		const x = d3.scaleLinear().rangeRound([0, width]).domain([displayRoot.x0, displayRoot.x1]);
		const y = d3.scaleLinear().rangeRound([0, height]).domain([displayRoot.y0, displayRoot.y1]);
		const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
		svg.selectAll('*').remove();
		
        svg.on('contextmenu', (event) => {
			event.preventDefault();
			if (view && view.parent) {
                handleViewChange(view.parent);
			}
		});

		const group = svg.append('g');
		const cell = group.selectAll('g').data(displayRoot.children || []).join('g')
			.attr('transform', d => `translate(${x(d.x0)}, ${y(d.y0)})`)
			.style('cursor', d => (d.children ? 'pointer' : 'default'))
			.on('click', (event, d) => {
				if (d.children) { // 섹터 클릭 시 줌인
					const nextView = (view.children || []).find(child => child.data.name === d.data.name);
					if (nextView) {
                        handleViewChange(nextView);
					}
				} else { // 종목(leaf) 클릭 시 동기화
					event.stopPropagation(); // 줌인 방지
					setSelectedAsset({ symbol: d.data.symbol, type: 'KRX' });
				}
			});
		cell.append('rect')
			.attr('fill', d => colorScale(d.data.fluc_rate))
			.attr('width', d => x(d.x1) - x(d.x0))
			.attr('height', d => y(d.y1) - y(d.y0));
		cell.each(function (d) {
			const node = d3.select(this);
			const w = x(d.x1) - x(d.x0);
			const h = y(d.y1) - y(d.y0);
			if (w >= 40 && h >= 40) {
				const fo = node.append('foreignObject').attr('width', w).attr('height', h);
				const div = fo.append('xhtml:div').style('display', 'flex').style('flex-direction', 'column').style('align-items', 'center').style('justify-content', 'center').style('width', '100%').style('height', '100%').style('overflow', 'hidden').style('text-align', 'center').style('color', 'black').style('font-weight', 'bold')
					.style('font-size', `${Math.min(w / 6.5, h / 4, 50)}px`);
				div.append('xhtml:p').style('margin', '0').style('padding', '0 2px').style('white-space', 'nowrap').style('overflow', 'hidden').style('display', 'inline-block').style('max-width', '100%').text(d.data.name);
				const rate = d.data.fluc_rate || 0;
				div.append('xhtml:p').style('margin', '2px 0 0 0').style('padding', '0').text(`${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`);
			}
		});
        
        cell.append('title').text(d => `${d.data.name}\n`+(isNaN(d.data.cur_price)?"":`현재가: ${d3.format(",")(d.data.cur_price)} 원\n`)
            +`등락률: ${(d.data.fluc_rate || 0).toFixed(2)}%\n시가총액: ${d.value?.toLocaleString()} 원`);
        
    }, [view, colorScale, width, height, handleViewChange, setSelectedAsset]);
    
    return (
        <div 
            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 5px', minHeight: '50px', flexShrink: 0 }}>
                <h3 style={{ margin: '0 10px 0 0', fontSize: '0.9em', color: '#555', fontWeight: 'normal', flex: 1 }}>
                    {view && view.ancestors().reverse().map(d => d.data.name).join(' > ')}
                </h3>
                <div>
                    {['ALL', 'KOSPI', 'KOSDAQ', 'ETF'].map(market => (
                        <button 
                            key={market}
                            onClick={() => handleMarketChange(market)}
                            style={{
                                background: currentMarket === market ? '#007bff' : '#eee',
                                color: currentMarket === market ? 'white' : 'black',
                                border: 'none', 
                                padding: '4px 8px', 
                                margin: '0 2px', 
                                cursor: 'pointer',
                                borderRadius: '4px'
                            }}
                        >
                            {market}
                        </button>
                    ))}
                </div>
            </div>
            <div style={{ flexGrow: 1, width: '100%' }}>
                {isLoading && <div style={{textAlign: 'center', paddingTop: '50px'}}>Loading...</div>}
                {error && <div style={{textAlign: 'center', paddingTop: '50px', color: 'red'}}>Error: {error}</div>}
                {!isLoading && !error && <svg ref={svgRef} style={{ userSelect: 'none' }}></svg>}
            </div>
        </div>
    );
}

export default TreemapChart;