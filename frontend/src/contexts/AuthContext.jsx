import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

/**
 * 애플리케이션의 인증 상태를 관리하고, 관련 함수를 제공하는 컴포넌트입니다.
 * @param {object} props - 컴포넌트에 전달되는 속성
 * @param {React.ReactNode} props.children - 이 Provider가 감싸게 될 자식 컴포넌트들
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // 앱 시작 시, 현재 로그인 상태인지 서버에 확인
    useEffect(() => {
        fetch('/api/user') // 현재 사용자 정보를 가져오는 API
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Not authenticated');
            })
            .then(userData => setUser(userData))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    /**
     * 사용자를 로그인시킵니다.
     * @param {string} username - 사용자 이름
     * @param {string} password - 비밀번호
     * @throws {Error} 로그인 실패 시 에러 발생
     */
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

    /**
     * 사용자를 로그아웃시킵니다.
     */
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

/**
 * AuthContext를 사용하기 위한 커스텀 훅입니다.
 * @returns {{user: object|null, loading: boolean, login: function, logout: function}} 인증 컨텍스트 값
 */
export const useAuth = () => {
    return useContext(AuthContext);
};
