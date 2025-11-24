import React, { useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext';

/**
 * 애플리케이션 전체에 토스트 메시지를 시각적으로 표시하는 컴포넌트입니다.
 * ToastContext와 함께 사용되며, 컨텍스트의 상태에 따라 화면에 나타나고 사라집니다.
 */
const Toast = () => {
    const { toast } = useToast();
    const [visible, setVisible] = useState(false);

    /**
     * `ToastContext`의 `toast.show` 상태가 변경될 때 애니메이션 효과를 제어합니다.
     * 토스트가 나타날 때 `visible`을 true로 설정하고,
     * 사라지기 직전에 CSS transition을 위해 `visible`을 false로 먼저 설정하여
     * 부드러운 사라짐 효과를 구현합니다.
     */
    useEffect(() => {
        if (toast.show) {
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
            }, 2700); // 3초 후 컨텍스트에서 사라지기 0.3초 전에 fade-out 시작
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const toastStyle = {
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '10px 20px',
        borderRadius: '8px',
        color: 'white',
        fontWeight: 'bold',
        zIndex: 2000,
        transition: 'opacity 0.3s ease-in-out, top 0.3s ease-in-out',
        opacity: visible ? 1 : 0,
        top: visible ? '20px' : '-50px',
    };

    const typeStyle = {
        info: { backgroundColor: '#28a745' }, // 초록색 (성공/정보)
        error: { backgroundColor: '#dc3545' }, // 빨간색 (에러)
    };

    if (!toast.show && !visible) {
        return null;
    }

    return (
        <div style={{ ...toastStyle, ...typeStyle[toast.type] }}>
            {toast.message}
        </div>
    );
};

export default Toast;
