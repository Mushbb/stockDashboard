import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { DashboardProvider } from './contexts/DashboardContext';
import { ToastProvider } from './contexts/ToastContext';
import Dashboard from './components/Dashboard';
import Toast from './components/Toast';
import './App.css';

// React-Grid-Layout CSS 파일 임포트
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

/**
 * 애플리케이션의 루트 컴포넌트입니다.
 * 모든 하위 컴포넌트가 컨텍스트를 사용할 수 있도록 주요 Provider(Toast, Auth, Dashboard)들로 앱을 감싸는 역할을 합니다.
 */
function App() {
	return (
        <ToastProvider>
            <AuthProvider>
                <DashboardProvider>
                    <Toast />
                    <Dashboard />
                </DashboardProvider>
            </AuthProvider>
        </ToastProvider>
	);
}

export default App;
