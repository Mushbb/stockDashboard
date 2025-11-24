import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * 로그인 및 회원가입 UI를 제공하는 모달 컴포넌트입니다.
 * @param {object} props - 컴포넌트 속성
 * @param {function} props.onClose - 모달을 닫을 때 호출되는 함수
 */
export const LoginModal = ({ onClose }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();

    /**
     * 폼 제출 시 호출되는 핸들러입니다.
     * 'isRegister' 상태에 따라 회원가입 또는 로그인 API를 호출합니다.
     * @param {React.FormEvent} e - 폼 제출 이벤트 객체
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isRegister) {
                // 회원가입 로직
                const response = await fetch('/api/users/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                if (!response.ok) throw new Error('Registration failed');
                alert('회원가입이 완료되었습니다. 로그인해주세요.');
                setIsRegister(false); // 로그인 폼으로 자동 전환
            } else {
                // 로그인 로직
                await login(username, password);
                onClose(); // 성공 시 모달 닫기
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }} onClick={onClose}>
            <div style={{
                position: 'absolute',
                top: '60px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'white', 
                padding: '20px', 
                borderRadius: '8px', 
                color: '#333',
                width: '90%',
                maxWidth: '400px',
                boxSizing: 'border-box'
            }} onClick={e => e.stopPropagation()}>
                <h2>{isRegister ? '회원가입' : '로그인'}</h2>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '15px' }}>
                        <label>아이디</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label>비밀번호</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                    </div>
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    <button type="submit" style={{ width: '100%', padding: '10px' }}>{isRegister ? '가입하기' : '로그인'}</button>
                </form>
                <p style={{ textAlign: 'center', marginTop: '15px' }}>
                    {isRegister ? '이미 계정이 있으신가요?' : '계정이 없으신가요?'}
                    <button onClick={() => setIsRegister(!isRegister)} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer' }}>
                        {isRegister ? '로그인' : '회원가입'}
                    </button>
                </p>
            </div>
        </div>
    );
};
