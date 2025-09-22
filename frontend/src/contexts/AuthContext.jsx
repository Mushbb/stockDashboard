import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // 앱 시작 시, 현재 로그인 상태인지 서버에 확인
    useEffect(() => {
        fetch('/api/user') // 현재 사용자 정보를 가져오는 API (나중에 만들어야 함)
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Not authenticated');
            })
            .then(userData => setUser(userData))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const login = async (username, password) => {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ username, password })
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }

        // 로그인 성공 후 사용자 정보 다시 가져오기
        const userData = await fetch('/api/user').then(res => res.json());
        setUser(userData);
    };

    const logout = async () => {
        await fetch('/api/logout', { method: 'POST' });
        setUser(null);
    };

    const value = { user, loading, login, logout };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
