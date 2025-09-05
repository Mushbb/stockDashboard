import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

// 헬퍼 함수 (변경 없음)
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

// --- 1. 계층 경로 유지를 위한 헬퍼 함수 추가 (App_old.jsx에서 가져옴) ---
const getNodePath = (node) => node.ancestors().map(d => d.data.name).reverse();
const findNodeByPath = (root, path) => {
	// ✨ 수정된 부분: 경로의 시작점(path[0])이 현재 root의 이름과 일치하는지 확인
	if (!root || !path || path.length === 0 || root.data.name !== path[0]) {
		return null; // 일치하지 않으면, 이 경로는 현재 데이터에 유효하지 않음
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
// --- ✨ 디버깅을 위한 로그 헬퍼 함수 ---
const logState = (event, viewNode, pathRef) => {
	// const viewName = viewNode ? getNodePath(viewNode).join(' > ') : 'null';
	// const pathName = pathRef ? pathRef.join(' > ') : 'null';
	// console.log(
	// 	`[EVENT: ${event.padEnd(15)}]`,
	// 	`View State: ${viewName.padEnd(30)}`,
	// 	`Path Ref: ${pathName}`
	// );
};
// ----------------------------------------

function TreemapChart({ data, width, height }) {
	const [view, setView] = useState(null);
	const [colorScale, setColorScale] = useState(null);
	
	const svgRef = useRef(null);
	const currentPathRef = useRef(null);
	
	const MIN_PIXEL = 15;
	
	useEffect(() => {
		const color = d3.scaleDivergingPow().domain([-30, 0, 30]).exponent(0.15)
			.interpolator(d3.interpolateRgbBasis(["#d14242", "#f0f0f0", "#33a033"])).clamp(true);
		setColorScale(() => color);
	}, []);
	
	// --- 1. 데이터 처리와 view 업데이트 로직을 하나의 useEffect로 통합 ---
	useEffect(() => {
		// ✨ 수정된 부분: 데이터가 없거나, children이 비어있으면 아무 작업도 하지 않고 반환합니다.
		if (!data || !data.children || data.children.length === 0) {
			return; // 일시적인 빈 데이터 상태를 무시하고 렌더링을 건너뜁니다.
		}
		
		// 새로운 데이터로 d3 계층 구조 생성
		let newRoot = d3.hierarchy(data).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
		newRoot.eachAfter(node => {
			if (node.children) {
				const total = node.value;
				node.data.fluc_rate = total > 0 ? d3.sum(node.children, d => (d.data.fluc_rate || 0) * d.value) / total : 0;
			}
		});
		
		let newViewTarget;
		// 저장된 경로를 이용해 새로운 view를 찾아서 즉시 업데이트
		if (currentPathRef.current) {
			newViewTarget = findNodeByPath(newRoot, currentPathRef.current);
			if (!newViewTarget) {
				console.error('❗️ 탐색 실패! newViewTarget이 null입니다. 루트로 돌아갑니다.');
				newViewTarget = newRoot; // 문제가 발생했으니 루트로 강제 설정
			}
			setView(newViewTarget || newRoot);
		} else {
			// 최초 로딩 시, 경로를 저장하고 view를 설정
			currentPathRef.current = getNodePath(newRoot);
			setView(newRoot);
		}
	}, [data]); // 이 훅은 오직 'data' prop이 변경될 때만 실행됩니다.
	// -----------------------------------------------------------------
	
	
	useEffect(() => {
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
		displayRoot.eachAfter(node => {
			if (node.children) {
				const total = node.value;
				node.data.fluc_rate = total > 0 ? d3.sum(node.children, d => (d.data.fluc_rate || 0) * d.value) / total : 0;
			}
		});
		treemap(displayRoot);
		
		const x = d3.scaleLinear().rangeRound([0, width]).domain([displayRoot.x0, displayRoot.x1]);
		const y = d3.scaleLinear().rangeRound([0, height]).domain([displayRoot.y0, displayRoot.y1]);
		
		const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
		svg.selectAll('*').remove();
		
		// --- 1. 우클릭으로 뒤로가기 기능 추가 ---
		svg.on('contextmenu', (event) => {
			event.preventDefault(); // 기본 우클릭 메뉴 방지
			if (view && view.parent) {
				logState('Right Click', view, currentPathRef.current);
				// 우클릭 시에도 ref와 state를 함께 업데이트
				currentPathRef.current = getNodePath(view.parent);
				setView(view.parent); // 부모 뷰로 이동
			}
		});
		// ------------------------------------
		
		const group = svg.append('g');
		const cell = group.selectAll('g').data(displayRoot.children || []).join('g')
			.attr('transform', d => `translate(${x(d.x0)}, ${y(d.y0)})`)
			.style('cursor', d => (d.children ? 'pointer' : 'default'))
			.on('click', (event, d) => {
				if (d.children) {
					const nextView = (view.children || []).find(child => child.data.name === d.data.name);
					if (nextView) {
						const nextPath = getNodePath(nextView);
						logState('Click', nextView, nextPath);
						// 클릭 시 ref와 state를 함께 업데이트
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

