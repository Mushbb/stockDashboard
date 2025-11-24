import React, { memo } from 'react';

/**
 * 모든 위젯을 감싸는 공통 컨테이너 컴포넌트입니다.
 * 위젯의 제목 표시줄, 편집 버튼, 테두리 등 공통적인 UI를 제공합니다.
 * 제목 표시줄은 react-grid-layout의 드래그 핸들 역할을 합니다.
 * @param {object} props - 컴포넌트 속성
 * @param {string} props.widgetId - 위젯의 고유 ID
 * @param {string} props.title - 위젯의 제목
 * @param {boolean} props.isEditMode - 현재 대시보드가 편집 모드인지 여부
 * @param {function|null} props.onRename - 이름 변경 버튼 클릭 시 호출되는 함수
 * @param {function} props.onDelete - 삭제 버튼 클릭 시 호출되는 함수
 * @param {function|null} props.onSettings - 설정 버튼 클릭 시 호출되는 함수
 * @param {React.ReactNode} props.children - 위젯의 실제 컨텐츠
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