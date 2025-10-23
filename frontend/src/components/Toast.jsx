import React, { useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext';

const Toast = () => {
    const { toast } = useToast();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (toast.show) {
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
            }, 2700); // Fade out before it's removed
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
        info: { backgroundColor: '#28a745' }, // 초록색 (성공)
        error: { backgroundColor: '#dc3545' }, // 빨간색 (에러)
    };

    if (!toast.show) {
        return null;
    }

    return (
        <div style={{ ...toastStyle, ...typeStyle[toast.type] }}>
            {toast.message}
        </div>
    );
};

export default Toast;
