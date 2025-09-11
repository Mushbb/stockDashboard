import React from 'react';
import ChartContainer from './ChartContainer';
import TreemapChart from './TreemapChart';
import RankTable from './RankTable';

function Dashboard() {
	return (
		<div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: '20px', backgroundColor: '#f4f7f6' }}>
			<h1 style={{ marginBottom: '30px' }}>주요 증시 현황 대시보드</h1>

			<div style={{ position: 'relative', width: '100%', height: '1000px' }}>
				<ChartContainer 
					title="KOSPI 증시 현황"
					initialPosition={{ x: 20, y: 0 }}
					initialSize={{ width: 500, height: 500 }}
				>
					<TreemapChart marketType="kospi" />
				</ChartContainer>

				<ChartContainer 
					title="KOSDAQ 증시 현황"
					initialPosition={{ x: 550, y: 0 }}
					initialSize={{ width: 500, height: 500 }}
				>
					<TreemapChart marketType="kosdaq" />
				</ChartContainer>

				<ChartContainer 
					title="📈 상승률 상위"
					initialPosition={{ x: 20, y: 520 }}
					initialSize={{ width: 330, height: 400 }}
				>
					<RankTable by="CHANGE_RATE" order="DESC" limit={10} />
				</ChartContainer>

				<ChartContainer 
					title="📉 하락률 상위"
					initialPosition={{ x: 380, y: 520 }}
					initialSize={{ width: 330, height: 400 }}
				>
					<RankTable by="CHANGE_RATE" order="ASC" limit={10} />
				</ChartContainer>

				<ChartContainer 
					title="🎢 등락률 Top & Bottom"
					initialPosition={{ x: 740, y: 520 }}
					initialSize={{ width: 330, height: 400 }}
				>
					<RankTable mode="top-and-bottom" limit={10} />
				</ChartContainer>
			</div>
		</div>
	);
}

export default Dashboard;
