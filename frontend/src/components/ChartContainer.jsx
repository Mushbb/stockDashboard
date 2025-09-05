// 파일 경로: src/components/ChartContainer.jsx

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useData } from '../contexts/DataProvider.jsx';
import TreemapChart from './TreemapChart.jsx';

/**
 * 차트 컨테이너: 데이터 로딩, 상태 관리 및 '크기 조절' 로직을 담당합니다.
 */
function ChartContainer({ marketType }) {
	const { getChartData } = useData();
	const { data, isLoading, error } = getChartData(marketType);
	
	// --- 1. 크기 조정 로직 (TreemapChart에서 이동) ---
	const containerRef = useRef(null);
	const ghostFrameRef = useRef(null);
	const dragStartInfo = useRef(null);
	const [layoutSize, setLayoutSize] = useState({ width: 500, height: 500 });
	const [isDragging, setIsDragging] = useState(false);
	
	useEffect(() => {
		if (!containerRef.current) return;
		const handle = d3.select(containerRef.current).select('.resize-handle');
		if (handle.empty()) return;
		
		const dragBehavior = d3.drag()
			.on('start', function (event) {
				event.sourceEvent.preventDefault();
				event.sourceEvent.stopPropagation();
				setIsDragging(true);
				dragStartInfo.current = {
					width: layoutSize.width,
					height: layoutSize.height,
					x: event.x,
					y: event.y
				};
				if (ghostFrameRef.current) {
					ghostFrameRef.current.style.width = `${layoutSize.width}px`;
					ghostFrameRef.current.style.height = `${layoutSize.height}px`;
					ghostFrameRef.current.style.display = 'block';
				}
			})
			.on('drag', function (event) {
				if (!dragStartInfo.current) return;
				const newWidth = Math.max(300, dragStartInfo.current.width + (event.x - dragStartInfo.current.x));
				const newHeight = Math.max(300, dragStartInfo.current.height + (event.y - dragStartInfo.current.y));
				if (ghostFrameRef.current) {
					ghostFrameRef.current.style.width = `${newWidth}px`;
					ghostFrameRef.current.style.height = `${newHeight}px`;
				}
			})
			.on('end', function (event) {
				setIsDragging(false);
				if (ghostFrameRef.current) ghostFrameRef.current.style.display = 'none';
				if (!dragStartInfo.current) return;
				const finalWidth = Math.max(300, dragStartInfo.current.width + (event.x - dragStartInfo.current.x));
				const finalHeight = Math.max(300, dragStartInfo.current.height + (event.y - dragStartInfo.current.y));
				setLayoutSize({ width: finalWidth, height: finalHeight });
				dragStartInfo.current = null;
			});
		
		handle.call(dragBehavior);
	}, [layoutSize]);
	// ----------------------------------------------------
	
	// 차트 상단의 컨트롤(뒤로가기 버튼 등) 높이를 제외한 순수 SVG 영역 높이 계산
	const chartHeight = layoutSize.height > 60 ? layoutSize.height - 60 : 0;
	
	return (
		<div
			ref={containerRef}
			style={{
				position: 'relative',
				width: `${layoutSize.width}px`,
				height: `${layoutSize.height}px`,
				padding: '10px',
				boxSizing: 'border-box',
				boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				borderRadius: '8px',
				display: 'flex',
				flexDirection: 'column'
			}}
		>
			<h2 style={{ fontSize: '1.2em', color: '#333', padding: '0 10px', margin: '10px 0', flexShrink: 0 }}>
				{marketType.toUpperCase()} 증시 현황
			</h2>
			{/* --- 2. TreemapChart를 담는 영역 --- */}
			<div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
				{/* 데이터가 한 번이라도 로드되었다면, 로딩 중에도 계속 차트를 보여줍니다.
				  이렇게 하면 컴포넌트가 파괴되지 않고 prop만 업데이트됩니다.
				  초기 로딩이나 에러 시에만 메시지를 보여줍니다.
				*/}
				{data ? (
					<TreemapChart
						data={data}
						width={layoutSize.width - 20}
						height={layoutSize.height - 90}
					/>
				) : isLoading ? (
					<p>데이터를 불러오는 중입니다...</p>
				) : error ? (
					<p style={{ color: 'red' }}>데이터 로딩 실패: {error}</p>
				) : (
					<p>표시할 데이터가 없습니다.</p>
				)}
			</div>
			
			<div className="resize-handle" style={{
				position: 'absolute', bottom: 0, right: 0,
				width: '20px', height: '20px', cursor: 'nwse-resize',
				clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', backgroundColor: '#666',
			}}></div>
			<div ref={ghostFrameRef} style={{
				position: 'absolute', top: 0, left: 0,
				border: '2px dashed #007bff', pointerEvents: 'none',
				boxSizing: 'border-box', display: isDragging ? 'block' : 'none',
			}}></div>
		</div>
	);
}

export default ChartContainer;