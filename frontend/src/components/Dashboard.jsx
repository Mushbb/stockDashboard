// 파일 경로: src/components/Dashboard.jsx

import React from 'react';
import ChartContainer from './ChartContainer';

/**
 * 대시보드 컴포넌트
 * 여러 차트 컨테이너를 배치하는 레이아웃 역할을 합니다.
 */
function Dashboard() {
	return (
		<div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: '20px' }}>
			<h1 style={{ marginBottom: '30px' }}>주요 증시 현황 대시보드</h1>
			
			<div style={{
				display: 'flex',
				flexWrap: 'wrap',
				justifyContent: 'center',
				gap: '20px'
			}}>
				{/* 각 ChartContainer는 marketType prop을 통해 어떤 데이터를 보여줄지 결정합니다. */}
				<ChartContainer marketType="kospi" />
				<ChartContainer marketType="kosdaq" />
			</div>
		</div>
	);
}

export default Dashboard;