import React, { createContext, useState, useCallback, useContext } from 'react';

const ToastContext = createContext(null);

/**
 * 애플리케이션 전체에 토스트 메시지를 표시하는 기능을 제공하는 Provider 컴포넌트입니다.
 * @param {object} props - 컴포넌트에 전달되는 속성
 * @param {React.ReactNode} props.children - 이 Provider가 감싸게 될 자식 컴포넌트들
 */
export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

    /**
     * 토스트 메시지를 화면에 표시합니다. 3초 후에 자동으로 사라집니다.
     * @param {string} message - 표시할 메시지
     * @param {'info' | 'success' | 'warning' | 'error'} [type='info'] - 토스트의 종류 (스타일 결정)
     */
    const showToast = useCallback((message, type = 'info') => {
        setToast({ show: true, message, type });
        setTimeout(() => {
            setToast(prev => ({ ...prev, show: false }));
        }, 3000);
    }, []);

    const value = { toast, showToast };

    return (
        <ToastContext.Provider value={value}>
            {children}
        </ToastContext.Provider>
    );
};

/**
 * ToastContext를 사용하기 위한 커스텀 훅입니다.
 * @returns {{toast: {show: boolean, message: string, type: string}, showToast: function}} 토스트 컨텍스트 값
 * @throws {Error} ToastProvider 외부에서 사용 시 에러 발생
 */
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
