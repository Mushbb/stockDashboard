// 파일 경로: src/components/Dashboard.jsx

import React from 'react';
import ChartContainer from './ChartContainer';

/**
 * 대시보드 컴포넌트
 * 여러 차트 컨테이너를 배치하는 레이아웃 역할을 합니다.
 */
function Dashboard() {
	// 각 차트의 초기 레이아웃 정보
	const initialLayout = [
		{ marketType: 'kospi', initialPosition: { x: 20, y: 0 } },
		{ marketType: 'kosdaq', initialPosition: { x: 550, y: 0 } },
	];
	
	return (
		<div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: '20px' }}>
			<h1 style={{ marginBottom: '30px' }}>주요 증시 현황 대시보드</h1>
			
			{/* --- ✨ 수정된 부분: 차트들을 담는 컨테이너 --- */}
			{/* position: relative을 설정하여 자식 요소들의 기준이 되도록 합니다. */}
			<div style={{ position: 'relative', width: '100%', height: '100vh' }}>
				{initialLayout.map(chart => (
					<ChartContainer
						key={chart.marketType}
						marketType={chart.marketType}
						initialPosition={chart.initialPosition}
					/>
				))}
			</div>
		</div>
	);
}

export default Dashboard;