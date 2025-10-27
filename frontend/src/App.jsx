import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { DashboardProvider } from './contexts/DashboardContext';
import { ToastProvider } from './contexts/ToastContext'; // ToastProvider 임포트
import Dashboard from './components/Dashboard';
import Toast from './components/Toast'; // Toast 컴포넌트 임포트
import './App.css'; // App.css 파일 임포트 추가

// Grid Layout CSS
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

function App() {
	return (
        <ToastProvider>
            <AuthProvider>
                <DashboardProvider>
                    <Toast /> { /* 앱 최상단에 Toast 컴포넌트 렌더링 */ }
                    <Dashboard />
                </DashboardProvider>
            </AuthProvider>
        </ToastProvider>
	);
}

export default App;
