import React, { useState, useEffect } from 'react';

/** 사용 가능한 글꼴 목록 */
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

/** 사용 가능한 글자 크기 목록 */
const FONT_SIZES = [
    { name: '작게', value: '0.8em' },
    { name: '보통', value: '1em' },
    { name: '크게', value: '1.2em' },
    { name: '아주 크게', value: '1.5em' },
];

/** 사용 가능한 글자 굵기 목록 */
const FONT_WEIGHTS = [
    { name: '보통', value: 'normal' },
    { name: '굵게', value: 'bold' },
];

/** 사용 가능한 글자 스타일 목록 */
const FONT_STYLES = [
    { name: '보통', value: 'normal' },
    { name: '기울임', value: 'italic' },
];

/**
 * 사용자가 텍스트를 입력하고 스타일을 지정할 수 있는 메모장 위젯입니다.
 * 편집 모드에서는 글꼴, 크기 등 스타일을 변경할 수 있는 컨트롤이 표시됩니다.
 * @param {object} props - 컴포넌트 속성
 * @param {string} props.widgetId - 위젯의 고유 ID
 * @param {object} props.settings - 위젯의 설정값 (e.g., { content, fontFamily, ... })
 * @param {function} props.onSettingsChange - 위젯 설정 변경 시 호출되는 함수
 * @param {boolean} props.isEditMode - 현재 대시보드가 편집 모드인지 여부
 */
function MemoWidget({ widgetId, settings, onSettingsChange, isEditMode }) {
    const [content, setContent] = useState(settings?.content || '');
    
    // 현재 설정된 폰트 스타일을 상태로 관리
    const currentFontFamily = settings?.fontFamily || 'sans-serif';
    const currentFontSize = settings?.fontSize || '1em';
    const currentFontWeight = settings?.fontWeight || 'normal';
    const currentFontStyle = settings?.fontStyle || 'normal';

    // 외부에서 settings.content가 변경되면 내부 content 상태를 동기화
    useEffect(() => {
        setContent(settings?.content || '');
    }, [settings?.content]);

    /** textarea의 내용이 변경될 때마다 내부 content 상태를 업데이트합니다. */
    const handleChange = (event) => {
        setContent(event.target.value);
    };

    /** textarea에서 포커스가 해제될 때, 변경된 내용을 부모 컨텍스트에 저장합니다. */
    const handleBlur = () => {
        if (content !== settings?.content) {
            onSettingsChange(widgetId, { ...settings, content: content });
        }
    };

    /** 폰트 등 스타일 설정이 변경될 때 호출되는 핸들러입니다. */
    const handleSettingChange = (key, value) => {
        onSettingsChange(widgetId, { ...settings, [key]: value });
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* 편집 모드일 때만 스타일 변경 컨트롤 표시 */}
            {isEditMode && (
                <div style={{
                    position: 'absolute', top: '5px', right: '5px', zIndex: 10,
                    backgroundColor: 'rgba(255,255,255,0.8)', padding: '3px',
                    borderRadius: '3px', display: 'flex', gap: '5px', flexWrap: 'wrap'
                }}>
                    <select onChange={(e) => handleSettingChange('fontFamily', e.target.value)} value={currentFontFamily} style={{ fontSize: '0.8em' }}>
                        {AVAILABLE_FONTS.map(font => <option key={font.value} value={font.value}>{font.name}</option>)}
                    </select>
                    <select onChange={(e) => handleSettingChange('fontSize', e.target.value)} value={currentFontSize} style={{ fontSize: '0.8em' }}>
                        {FONT_SIZES.map(size => <option key={size.value} value={size.value}>{size.name}</option>)}
                    </select>
                    <select onChange={(e) => handleSettingChange('fontWeight', e.target.value)} value={currentFontWeight} style={{ fontSize: '0.8em' }}>
                        {FONT_WEIGHTS.map(weight => <option key={weight.value} value={weight.value}>{weight.name}</option>)}
                    </select>
                    <select onChange={(e) => handleSettingChange('fontStyle', e.target.value)} value={currentFontStyle} style={{ fontSize: '0.8em' }}>
                        {FONT_STYLES.map(style => <option key={style.value} value={style.value}>{style.name}</option>)}
                    </select>
                </div>
            )}
            <textarea
                value={content}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="메모를 입력하세요..."
                style={{
                    width: '100%', height: '100%', padding: '10px', border: 'none',
                    boxSizing: 'border-box', resize: 'none', outline: 'none',
                    backgroundColor: 'transparent',
                    // 현재 설정된 스타일 적용
                    fontSize: currentFontSize,
                    fontFamily: currentFontFamily,
                    fontWeight: currentFontWeight,
                    fontStyle: currentFontStyle,
                }}
            />
        </div>
    );
}

export default MemoWidget;
