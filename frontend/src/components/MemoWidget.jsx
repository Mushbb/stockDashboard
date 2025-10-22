import React, { useState, useEffect } from 'react';

function MemoWidget({ widgetId, settings, onSettingsChange }) {
    const [content, setContent] = useState(settings?.content || '');

    // settings prop이 외부에서 변경될 때(예: DB에서 로드 완료) 내부 상태를 동기화합니다.
    useEffect(() => {
        setContent(settings?.content || '');
    }, [settings?.content]);

    const handleChange = (event) => {
        setContent(event.target.value);
    };

    // 사용자가 입력을 멈추거나 포커스를 잃었을 때 저장합니다.
    const handleBlur = () => {
        onSettingsChange(widgetId, { ...settings, content: content });
    };

    return (
        <textarea
            value={content}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="메모를 입력하세요..."
            style={{
                width: '100%',
                height: '100%',
                padding: '10px',
                border: 'none',
                boxSizing: 'border-box',
                fontSize: '1em',
                fontFamily: 'sans-serif',
                resize: 'none',
                outline: 'none'
            }}
        />
    );
}

export default MemoWidget;
