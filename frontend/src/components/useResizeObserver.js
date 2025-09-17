import { useEffect, useState, useRef } from 'react';

/**
 * 대상 요소의 크기 변경을 감지하는 ResizeObserver를 사용하는 커스텀 훅입니다.
 * @returns {[React.RefObject, {width: number, height: number}]} - 관찰할 요소에 연결할 ref와 해당 요소의 크기 객체
 */
export function useResizeObserver() {
    const ref = useRef(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                setSize({ width, height });
            }
        });

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, []);

    return [ref, size];
}
