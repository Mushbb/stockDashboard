import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

// ... (헬퍼 함수들은 변경 없이 그대로 유지) ...
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
	if (!root || !path || path.length === 0 || root.data.name !== path[0]) {
		return null;
	}
	let current = root;
	for (let i = 1; i < path.length; i++) {
		const name = path[i];
		const next = (current.children || []).find(d => d.data.name === name);
		if (!next) return null;
		current = next;
	}
	return current;
};
const logState = () => {}; // 로그 함수는 비활성화

// 1. props로 marketType을 받도록 수정
function TreemapChart({ marketType, width, height }) {
    // 2. 데이터와 로딩/에러 상태를 내부에서 관리
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

	const [view, setView] = useState(null);
	const [colorScale, setColorScale] = useState(null);
	
	const svgRef = useRef(null);
	const currentPathRef = useRef(null);
	
	const MIN_PIXEL = 15;

    // 3. marketType을 기반으로 데이터를 fetch하는 useEffect 추가
    useEffect(() => {
		const fetchData = async () => {
			setIsLoading(true);
            setError(null);
			try {
				const response = await fetch(`/api/charts/treemap/${marketType.toLowerCase()}`);
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const result = await response.json();
				setData(result);
			} catch (e) {
				setError(e.message);
				console.error("Failed to fetch treemap data:", e);
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();

		const intervalId = setInterval(fetchData, 300000); // 5분마다 갱신

		return () => clearInterval(intervalId);
	}, [marketType]);
	
	useEffect(() => {
		const color = d3.scaleDivergingPow().domain([-30, 0, 30]).exponent(0.15)
			.interpolator(d3.interpolateRgbBasis(["#d14242", "#f0f0f0", "#33a033"])).clamp(true);
		setColorScale(() => color);
	}, []);
	
	useEffect(() => {
		if (!data || !data.children || data.children.length === 0) {
			return;
		}
		
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
			if (!newViewTarget) {
				console.error('❗️ 탐색 실패! newViewTarget이 null입니다. 루트로 돌아갑니다.');
				newViewTarget = newRoot;
			}
			setView(newViewTarget || newRoot);
		} else {
			currentPathRef.current = getNodePath(newRoot);
			setView(newRoot);
		}
	}, [data]);
	
	
	useEffect(() => {
        // ... (렌더링 로직은 이전과 동일, 버그 수정된 상태) ...
		logState('Render View', view, currentPathRef.current);
		
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
				currentPathRef.current = getNodePath(view.parent);
				setView(view.parent);
			}
		});
		
		const group = svg.append('g');
		const cell = group.selectAll('g').data(displayRoot.children || []).join('g')
			.attr('transform', d => `translate(${x(d.x0)}, ${y(d.y0)})`)
			.style('cursor', d => (d.children ? 'pointer' : 'default'))
			.on('click', (event, d) => {
				if (d.children) {
					const nextView = (view.children || []).find(child => child.data.name === d.data.name);
					if (nextView) {
						currentPathRef.current = getNodePath(nextView);
						setView(nextView);
					}
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
		
	}, [view, colorScale, width, height]);
	
	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
			{/* --- 2. 뒤로가기 버튼 제거, 제목(경로) UI는 유지 --- */}
			<div style={{ flexShrink: 0, height: '30px', textAlign: 'left', paddingLeft: '5px' }}>
				<h3 style={{ margin: '5px 0', fontSize: '1em', color: '#555', minHeight: '1.2em', fontWeight: 'normal' }}>
					{view && view.ancestors().reverse().map(d => d.data.name).join(' > ')}
				</h3>
			</div>
			{/* ---------------------------------------------------- */}
			<div style={{ flexGrow: 1, width: '100%', height: '100%' }}>
				<svg ref={svgRef} style={{ userSelect: 'none' }}></svg>
			</div>
		</div>
	);
}

export default TreemapChart;