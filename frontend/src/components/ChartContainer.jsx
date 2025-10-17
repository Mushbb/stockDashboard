import React, { memo } from 'react';

/**
 * 위젯의 공통적인 시각적 스타일(테두리, 배경 등)을 제공하는 단순한 컨테이너 컴포넌트입니다.
 * 드래그, 리사이즈 등 모든 동적 기능은 react-grid-layout이 담당합니다.
 */
const ChartContainer = memo(({ widgetId, title, isEditMode, onRename, onDelete, onSettings, children }) => {
	return (
		<div style={{
			width: '100%',
			height: '100%',
			display: 'flex',
			flexDirection: 'column',
            border: '1px solid #ddd',
            background: 'white',
            borderRadius: '8px'
		}}>
			{/* 제목 표시줄 - react-grid-layout의 드래그 핸들 역할 */}
			<h3
				className="widget-title"
				style={{
					height: '41px', // 고정 높이 (border-bottom 1px 포함)
					padding: '0 10px',
					margin: 0,
					borderBottom: '1px solid #ddd',
					background: '#f9f9f9',
					cursor: 'move',
					userSelect: 'none',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					boxSizing: 'border-box' // 패딩과 보더를 높이에 포함
				}}
			>
				<span>{title}</span>
				<div style={{ minWidth: '70px', textAlign: 'right' }}> {/* 버튼 영역 항상 공간 차지 */}
					{isEditMode && (
						<div>
							{onSettings && <button onClick={onSettings} data-id={widgetId} style={{border: 'none', background: 'none', cursor: 'pointer', fontSize: '1em', padding: '4px'}}>⚙️</button>}
							<button onClick={onRename} data-id={widgetId} style={{border: 'none', background: 'none', cursor: 'pointer', fontSize: '1em', padding: '4px'}}>✏️</button>
							<button onClick={onDelete} data-id={widgetId} style={{border: 'none', background: 'none', cursor: 'pointer', fontSize: '1em', padding: '4px'}}>🗑️</button>
						</div>
					)}
				</div>
			</h3>

			{/* 컨텐츠 영역 */}
			<div style={{ width: '100%', height: 'calc(100% - 41px)', overflow: 'hidden' }}>
				{children}
			</div>
		</div>
	);
});

export default ChartContainer;