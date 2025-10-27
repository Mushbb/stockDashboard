import React, { useState, useEffect } from 'react';

const AVAILABLE_FONTS = [
    { name: '기본 (Sans-serif)', value: 'sans-serif' },
    { name: 'Serif', value: 'serif' },
    { name: 'Monospace', value: 'monospace' },
    { name: '궁서체', value: '궁서체, Gungsuh, serif' },
    { name: '맑은 고딕', value: '맑은 고딕, Malgun Gothic, sans-serif' },
    { name: '나눔고딕', value: 'Nanum Gothic, sans-serif' },
    { name: '돋움', value: 'Dotum, sans-serif' },
    { name: '굴림', value: 'Gulim, sans-serif' },
];

const FONT_SIZES = [
    { name: '작게', value: '0.8em' },
    { name: '보통', value: '1em' },
    { name: '크게', value: '1.2em' },
    { name: '아주 크게', value: '1.5em' },
];

const FONT_WEIGHTS = [
    { name: '보통', value: 'normal' },
    { name: '굵게', value: 'bold' },
];

const FONT_STYLES = [
    { name: '보통', value: 'normal' },
    { name: '기울임', value: 'italic' },
];

function MemoWidget({ widgetId, settings, onSettingsChange, isEditMode }) {
    const [content, setContent] = useState(settings?.content || '');
    const currentFontFamily = settings?.fontFamily || 'sans-serif';
    const currentFontSize = settings?.fontSize || '1em';
    const currentFontWeight = settings?.fontWeight || 'normal';
    const currentFontStyle = settings?.fontStyle || 'normal';

    useEffect(() => {
        setContent(settings?.content || '');
    }, [settings?.content]);

    const handleChange = (event) => {
        setContent(event.target.value);
    };

    const handleBlur = () => {
        onSettingsChange(widgetId, { ...settings, content: content });
    };

    const handleSettingChange = (key, value) => {
        onSettingsChange(widgetId, { ...settings, [key]: value });
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {isEditMode && (
                <div style={{
                    position: 'absolute',
                    top: '5px',
                    right: '5px',
                    zIndex: 10,
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    padding: '3px',
                    borderRadius: '3px',
                    display: 'flex',
                    gap: '5px',
                    flexWrap: 'wrap'
                }}>
                    <select onChange={(e) => handleSettingChange('fontFamily', e.target.value)} value={currentFontFamily} style={{ fontSize: '0.8em' }}>
                        {AVAILABLE_FONTS.map(font => (
                            <option key={font.value} value={font.value}>{font.name}</option>
                        ))}
                    </select>
                    <select onChange={(e) => handleSettingChange('fontSize', e.target.value)} value={currentFontSize} style={{ fontSize: '0.8em' }}>
                        {FONT_SIZES.map(size => (
                            <option key={size.value} value={size.value}>{size.name}</option>
                        ))}
                    </select>
                    <select onChange={(e) => handleSettingChange('fontWeight', e.target.value)} value={currentFontWeight} style={{ fontSize: '0.8em' }}>
                        {FONT_WEIGHTS.map(weight => (
                            <option key={weight.value} value={weight.value}>{weight.name}</option>
                        ))}
                    </select>
                    <select onChange={(e) => handleSettingChange('fontStyle', e.target.value)} value={currentFontStyle} style={{ fontSize: '0.8em' }}>
                        {FONT_STYLES.map(style => (
                            <option key={style.value} value={style.value}>{style.name}</option>
                        ))}
                    </select>
                </div>
            )}
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
                    fontSize: currentFontSize,
                    fontFamily: currentFontFamily,
                    fontWeight: currentFontWeight,
                    fontStyle: currentFontStyle,
                    resize: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent'
                }}
            />
        </div>
    );
}

export default MemoWidget;
