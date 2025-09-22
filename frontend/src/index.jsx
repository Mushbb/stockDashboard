import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// public/index.html 파일에 있는 'root' div를 가져옵니다.
const rootElement = document.getElementById('root');

// React 18 방식의 root를 생성합니다.
const root = createRoot(rootElement);

// App 컴포넌트를 root에 렌더링합니다.
// StrictMode는 개발 중에 잠재적인 문제를 감지하기 위한 래퍼입니다.
root.render(
	<StrictMode>
		<App />
	</StrictMode>
);
