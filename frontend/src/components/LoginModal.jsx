import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const LoginModal = ({ onClose }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isRegister) {
                // 회원가입
                const response = await fetch('/api/users/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                if (!response.ok) throw new Error('Registration failed');
                alert('회원가입이 완료되었습니다. 로그인해주세요.');
                setIsRegister(false); // 로그인 폼으로 전환
            } else {
                // 로그인
                await login(username, password);
                onClose(); // 성공 시 모달 닫기
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ background: 'white', padding: '25px', borderRadius: '8px', color: '#333' }} onClick={e => e.stopPropagation()}>
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
