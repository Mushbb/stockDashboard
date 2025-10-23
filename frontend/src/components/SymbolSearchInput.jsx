import React, { useState, useEffect, useRef } from 'react';

const SymbolSearchInput = ({ onSymbolSelect }) => {
    const [isActive, setIsActive] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const searchContainerRef = useRef(null);

    // Search effect
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

    // Outside click detector
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
                    position: 'absolute', 
                    top: '100%', 
                    left: 0, 
                    right: 0, 
                    background: 'white', 
                    border: '1px solid #ccc', 
                    listStyle: 'none', 
                    padding: 0, 
                    margin: 0, 
                    zIndex: 10 
                }}>
                    {results.map(item => (
                        <li 
                            key={item.symbol} 
                            onClick={() => handleSelect(item)}
                            style={{ padding: '8px 10px', cursor: 'pointer' }}
                        >
                            {item.name} <span style={{color: '#888'}}>({item.symbol})</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SymbolSearchInput;
