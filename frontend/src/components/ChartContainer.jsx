// 파일 경로: src/components/ChartContainer.jsx

import React, { useState, useEffect, useLayoutEffect, useRef, memo } from 'react';
import * as d3 from 'd3';
import { useData } from '../contexts/DataProvider.jsx';
import TreemapChart from './TreemapChart.jsx';

const MemoizedTreemapChart = memo(TreemapChart);

function ChartContainer({ marketType, initialPosition = { x: 0, y: 0 } }) {
	const { getChartData } = useData();
	const { data, isLoading, error } = getChartData(marketType);
	
	const containerRef = useRef(null);
	const ghostFrameRef = useRef(null);
	const moveRef = useRef(null);
	const resizeRef = useRef(null);
	
	const [layoutSize, setLayoutSize] = useState({ width: 500, height: 500 });
	const [position, setPosition] = useState(initialPosition);
	const [isInteracting, setIsInteracting] = useState(false);
	
	useLayoutEffect(() => {
		if (containerRef.current) {
			containerRef.current.style.transform = 'translate(0px, 0px)';
		}
	}, [position]);
	
	useEffect(() => {
		if (!containerRef.current) return;
		const containerSelection = d3.select(containerRef.current);
		
		const dragHandle = containerSelection.select('.drag-handle');
		const moveBehavior = d3.drag()
			.on('start', (event) => {
				event.sourceEvent.stopPropagation();
				setIsInteracting(true);
				
				// ✨ 1. 핵심 수정: D3의 보정된 좌표(event.x) 대신 실제 마우스 좌표(event.sourceEvent.clientX)를 사용합니다.
				moveRef.current = {
					startX: event.sourceEvent.clientX,
					startY: event.sourceEvent.clientY,
				};
			})
			.on('drag', (event) => {
				if (!moveRef.current) return;
				
				// ✨ 2. 실제 마우스 좌표를 기준으로 변위를 계산합니다.
				const dx = event.sourceEvent.clientX - moveRef.current.startX;
				const dy = event.sourceEvent.clientY - moveRef.current.startY;
				
				containerRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
			})
			.on('end', (event) => {
				if (!moveRef.current) return;
				
				// ✨ 3. 최종 변위도 실제 마우스 좌표 기준으로 계산합니다.
				const dx = event.sourceEvent.clientX - moveRef.current.startX;
				const dy = event.sourceEvent.clientY - moveRef.current.startY;
				
				setPosition(prev => ({
					x: prev.x + dx,
					y: prev.y + dy,
				}));
				
				setIsInteracting(false);
				moveRef.current = null;
			});
		dragHandle.call(moveBehavior);
		
		// --- 크기 조정 로직 ---
		const resizeHandle = containerSelection.select('.resize-handle');
		const resizeBehavior = d3.drag()
			.on('start', function (event) {
				event.sourceEvent.preventDefault();
				event.sourceEvent.stopPropagation();
				setIsInteracting(true);
				resizeRef.current = {
					width: layoutSize.width, height: layoutSize.height,
					// ✨ 크기 조절 시에도 실제 마우스 좌표를 사용합니다.
					x: event.sourceEvent.clientX, y: event.sourceEvent.clientY
				};
				if (ghostFrameRef.current) {
					ghostFrameRef.current.style.width = `${layoutSize.width}px`;
					ghostFrameRef.current.style.height = `${layoutSize.height}px`;
					ghostFrameRef.current.style.display = 'block';
				}
			})
			.on('drag', function (event) {
				if (!resizeRef.current) return;
				const newWidth = Math.max(300, resizeRef.current.width + (event.sourceEvent.clientX - resizeRef.current.x));
				const newHeight = Math.max(300, resizeRef.current.height + (event.sourceEvent.clientY - resizeRef.current.y));
				if (ghostFrameRef.current) {
					ghostFrameRef.current.style.width = `${newWidth}px`;
					ghostFrameRef.current.style.height = `${newHeight}px`;
				}
			})
			.on('end', function (event) {
				setIsInteracting(false);
				if (ghostFrameRef.current) ghostFrameRef.current.style.display = 'none';
				if (!resizeRef.current) return;
				const finalWidth = Math.max(300, resizeRef.current.width + (event.sourceEvent.clientX - resizeRef.current.x));
				const finalHeight = Math.max(300, resizeRef.current.height + (event.sourceEvent.clientY - resizeRef.current.y));
				setLayoutSize({ width: finalWidth, height: finalHeight });
				resizeRef.current = null;
			});
		resizeHandle.call(resizeBehavior);
		
	}, [position, layoutSize]);
	
	return (
		<div
			ref={containerRef}
			style={{
				position: 'absolute',
				top: `${position.y}px`,
				left: `${position.x}px`,
				zIndex: isInteracting ? 10 : 1,
				width: `${layoutSize.width}px`,
				height: `${layoutSize.height}px`,
				padding: '10px',
				boxSizing: 'border-box',
				boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				borderRadius: '8px',
				display: 'flex',
				flexDirection: 'column',
				backgroundColor: '#fff',
			}}
		>
			<h2
				className="drag-handle"
				style={{
					fontSize: '1.2em',
					color: '#333',
					padding: '0 10px',
					margin: '10px 0',
					flexShrink: 0,
					cursor: 'move',
					userSelect: 'none',
				}}
			>
				{marketType.toUpperCase()} 증시 현황
			</h2>
			
			<div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
				{data ? (
					<MemoizedTreemapChart
						data={data}
						marketType={marketType}
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
				boxSizing: 'border-box', display: isInteracting && resizeRef.current ? 'block' : 'none',
			}}></div>
		</div>
	);
}

export default ChartContainer;