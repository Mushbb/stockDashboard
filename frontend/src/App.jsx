import React from 'react';
import { DataProvider } from './contexts/DataProvider';
import Dashboard from './components/Dashboard';

/**
 * 애플리케이션의 최상위 컴포넌트입니다.
 * 이제 복잡한 로직 없이, 필요한 Provider와 메인 컴포넌트를 조립하는 역할만 합니다.
 */
function App() {
	return (
		// 1. DataProvider가 앱 전체를 감싸서, 하위 모든 컴포넌트가 데이터에 접근할 수 있게 합니다.
		<DataProvider>
			{/* 2. Dashboard는 차트들을 화면에 배치하는 역할을 합니다. */}
			<Dashboard />
		</DataProvider>
	);
}

export default App;
