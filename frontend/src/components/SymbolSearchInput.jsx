import React, { useState, useEffect, useRef } from 'react';

/**
 * 주식 종목을 검색하고 선택할 수 있는 입력 컴포넌트입니다.
 * 처음에는 '종목 추가' 버튼으로 보이며, 클릭하면 검색창으로 변합니다.
 * @param {object} props - 컴포넌트 속성
 * @param {function(object): void} props.onSymbolSelect - 사용자가 검색 결과에서 종목을 선택했을 때 호출되는 함수. 선택된 종목 객체를 인자로 받습니다.
 */
const SymbolSearchInput = ({ onSymbolSelect }) => {
    const [isActive, setIsActive] = useState(false); // 검색창 활성화 여부
    const [query, setQuery] = useState(''); // 검색어
    const [results, setResults] = useState([]); // 검색 결과
    const searchContainerRef = useRef(null);

    /** 검색어(query)가 변경될 때마다 디바운싱을 적용하여 검색 API를 호출합니다. */
    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            return;
        }
        const debounceTimer = setTimeout(() => {
            fetch(`/api/stocks/search?query=${query}`)
                .then(res => res.ok ? res.json() : Promise.reject('Search failed'))
                .then(data => setResults(data))
                .catch(err => console.error(err));
        }, 300);
        return () => clearTimeout(debounceTimer);
    }, [query]);

    /** 컴포넌트 외부를 클릭하면 검색창을 닫습니다. */
    useEffect(() => {
        function handleClickOutside(event) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setIsActive(false);
                setQuery('');
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [searchContainerRef]);

    /** 검색 결과에서 특정 종목을 선택했을 때 실행되는 핸들러입니다. */
    const handleSelect = (stock) => {
        onSymbolSelect(stock);
        setQuery('');
        setResults([]);
        setIsActive(false);
    };

    if (!isActive) {
        return (
            <button onClick={() => setIsActive(true)} style={{ fontSize: '0.8em', padding: '2px 4px' }}>
                종목 추가
            </button>
        );
    }

    return (
        <div ref={searchContainerRef} style={{ position: 'relative' }}>
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="종목명 검색..."
                autoFocus
                style={{ fontSize: '0.8em', padding: '2px 4px', width: '120px' }}
            />
            {results.length > 0 && (
                <ul style={{ 
                    position: 'absolute', top: '100%', left: 0, right: 0, 
                    background: 'white', border: '1px solid #ccc', 
                    listStyle: 'none', padding: 0, margin: 0, zIndex: 10 
                }}>
                    {results.map(item => (
                        <li key={item.symbol} onClick={() => handleSelect(item)} style={{ padding: '8px 10px', cursor: 'pointer' }}>
                            {item.name} <span style={{color: '#888'}}>({item.symbol})</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SymbolSearchInput;
